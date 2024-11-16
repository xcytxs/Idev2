import { TEMPLATE_LIST } from '~/utils/constants';
import * as nodePath from 'node:path';
import { matchPatterns } from '~/utils/matchPatterns';
import { BaseTool } from './base-tool';
import { workbenchStore } from '../stores/workbench';
import type { WebContainer } from '@webcontainer/api';

export class ProjectTemplateImportTool extends BaseTool {
    constructor(webcontainerPromise: Promise<WebContainer> ) {
        super(webcontainerPromise);
    }
    async execute(args: { [key: string]: string; }): Promise<string> {
        if (args.id == 'blank') {
            return this.generateFormattedResult(`template imported successfully`, `
                We are starting from scratch. and black project
            `)
        }
        let template = TEMPLATE_LIST.find(t => t.name === args.id);
        if (!template) {
            console.log('template not found', args.template);

            return 'template not found';
        }
        try {
            let files = await this.getGitHubRepoContent(template.githubRepo);
            let webcontainer = await this.webcontainer;

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
            }

            let filteredFiles = files;

            // ignoring common unwanted files
            // exclude    .git
            filteredFiles = filteredFiles.filter(x => x.path.startsWith(".git") == false)
            // exclude    lock files
            let comminLockFiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]
            filteredFiles = filteredFiles.filter(x => comminLockFiles.includes(x.name) == false)
            // exclude    .bolt
            filteredFiles = filteredFiles.filter(x => x.path.startsWith(".bolt") == false)


            // check for ignore file in .bolt folder
            let templateIgnoreFile = files.find(x => x.path.startsWith(".bolt") && x.name == "ignore")
            if (templateIgnoreFile) {
                // redacting files specified in ignore file
                let ignorepatterns = templateIgnoreFile.content.split("\n").map(x => x.trim())
                filteredFiles = filteredFiles.filter(x => matchPatterns(x.path, ignorepatterns) == false)
                let redactedFiles = filteredFiles.filter(x => matchPatterns(x.path, ignorepatterns))
                redactedFiles = redactedFiles.map(x => {
                    return {
                        ...x,
                        content: "redacted"
                    }
                })
                filteredFiles = [
                    ...filteredFiles,
                    ...redactedFiles
                ]
            }

            let templatePromptFile = files.filter(x => x.path.startsWith(".bolt")).find(x => x.name == 'prompt')

            return this.generateFormattedResult(`template imported successfully`, `
                here is the imported content,
                these files are loaded into the bolt. to not write them again, if it don't require changes
                you only need to write the files that needs changing,
                dont forget to install the dependencies before running the project

                ${templatePromptFile ? `
                <User Instruction>
                ${templatePromptFile.content}
                <User Instruction>
                    `: ''
                }

                <Imported Files>
                    ${JSON.stringify(filteredFiles, null, 2)}
                <Imported Files>
            `)
        } catch (error) {
            console.error('error importing template', error);
            return 'error fetching template';
        }
    }
    private async getGitHubRepoContent(repoName: string, path: string = ''): Promise<{ name: string, path: string, content: string }[]> {

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
    private generateFormattedResult(uiResult: string, aiResult?: string) {
        return `
        ${uiResult}
        ---
        ${aiResult || ""}
        `
    }
}