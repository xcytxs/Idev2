import type { WebContainer, FileNode } from '@webcontainer/api';
import type { FileMap, FilesStore } from './files';
import { TEMPLATE_LIST } from '~/utils/constants';
import * as nodePath from 'node:path';
import type { EditorStore } from './editor';
import type { WorkbenchStore } from './workbench';




export class ToolStore {
    #webcontainer: Promise<WebContainer>;
    #workbench: WorkbenchStore;
    #editorStore: EditorStore;
    constructor(webcontainerPromise: Promise<WebContainer>, workbench: WorkbenchStore, editorStore: EditorStore) {
        this.#webcontainer = webcontainerPromise;
        this.#workbench = workbench;
        this.#editorStore = editorStore;
    }

    async handleToolCall(payload: { toolName: string, args: any, toolCallId: string; }): Promise<string> {
        console.log('handleToolCall', payload);

        switch (payload.toolName) {
            case 'SelectCodeTemplate':
                return await this.selectCodeTemplate(payload.args);
            default:
                console.log('tool not found', payload.toolName);

                return 'execution complete';
        }
    }
    private async selectCodeTemplate(args: any): Promise<string> {
        console.log('selectCodeTemplate', args);
        let template = TEMPLATE_LIST.find(t => t.name === args.template);
        if (!template) {
            console.log('template not found', args.template);

            return 'template not found';
        }
        try {
            let files = await this.getGitHubRepoContent(template.githubRepo);
            let webcontainer = await this.#webcontainer;
            console.log(files);

            for (const file of files) {
                let fullPath = nodePath.join(webcontainer.workdir, file.path);
                let folder = nodePath.dirname(file.path);
                // remove trailing slashes
                folder = folder.replace(/\/+$/g, '');
                if (folder !== '.') {
                    try {
                        await webcontainer.fs.mkdir(folder, { recursive: true });
                        console.debug('Created folder', folder);
                    } catch (error) {
                        console.error('Failed to create folder\n\n', error);
                    }
                }
                console.log("Writing to file", fullPath);

                await webcontainer.fs.writeFile(file.path, file.content);
                await this.#workbench.files.setKey(fullPath, { type: 'file', content: '', isBinary: false })
                await this.#editorStore.updateFile(fullPath, file.content)
                await this.#workbench.saveFile(file.path)
                // await this.#editorStore.setSelectedFile(file.path)


            }
        } catch (error) {
            console.error('error importing template', error);
            return 'error fetching template';
        }
        return 'templace imported successfully';
    }
    private async getGitHubRepoContent(repoName: string, path: string = ''): Promise<{ name: string, path: string, content: string }[]> {

        console.log('getGitHubRepoContent', repoName, path);

        const baseUrl = 'https://api.github.com';

        try {
            // Fetch contents of the path
            const response = await fetch(`${baseUrl}/repos/${repoName}/contents/${path}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    // Add your GitHub token if needed
                    'Authorization': 'token ' + import.meta.env.VITE_GITHUB_ACCESS_TOKEN
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: any = await response.json();

            // If it's a single file, return its content
            if (!Array.isArray(data)) {
                if (data.type === 'file') {
                    // If it's a file, get its content
                    const content = atob(data.content); // Decode base64 content
                    return [{
                        name: data.name,
                        path: data.path,
                        content: content
                    }];
                }
            }

            // Process directory contents recursively
            const contents = await Promise.all(
                data.map(async (item: any) => {
                    if (item.type === 'dir') {
                        // Recursively get contents of subdirectories
                        return await this.getGitHubRepoContent(repoName, item.path);
                    } else if (item.type === 'file') {
                        // Fetch file content
                        const fileResponse = await fetch(item.url, {
                            headers: {
                                'Accept': 'application/vnd.github.v3+json',
                                'Authorization': 'token ' + import.meta.env.VITE_GITHUB_ACCESS_TOKEN
                            }
                        });
                        const fileData: any = await fileResponse.json();
                        const content = atob(fileData.content); // Decode base64 content

                        return [{
                            name: item.name,
                            path: item.path,
                            content: content
                        }];
                    }
                })
            );

            // Flatten the array of contents
            return contents.flat();
        } catch (error) {
            console.error('Error fetching repo contents:', error);
            throw error;
        }
    }
}