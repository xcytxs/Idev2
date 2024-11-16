import { TEMPLATE_LIST } from '~/utils/constants';
import * as nodePath from 'node:path';
import { matchPatterns } from '~/utils/matchPatterns';
import { BaseTool } from './base-tool';
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

            return this.generateFormattedResult(`Project Scaffolding Is Complete`, `
                # Project Scaffolding Is Complete 

# Project Context

## Imported Files
${ JSON.stringify(
    filteredFiles
    // .map(x => x.path)
    , null, 2) }


${templatePromptFile ? `
## User Requirements
${templatePromptFile.content}
` : ''}

# Development Process (In Strict Order)

1. STEP 1: Dependencies Installation
   npm install   # MANDATORY - Must be run first

2. STEP 2: Planning Phase
   - Create implementation plan
   - List required files
   - Document dependencies

3. STEP 3: Implementation
   - Follow architecture requirements
   - Create/modify files
   - Test functionality

## Architecture Requirements
- Break down functionality into modular components
- Maximum file size: 500 lines of code
- Follow single responsibility principle
- Create reusable utility functions where appropriate

## Project Constraints
1. Template Usage
   - Do NOT import additional templates
   - Existing template is pre-imported and should be used

2. Code Organization
   - Create separate files for distinct functionalities
   - Use meaningful file and function names
   - Implement proper error handling

3. Boilerplate Protection
   - Do NOT modify boilerplate files
   - Exception: Only if absolutely necessary for core functionality
   - Document any required boilerplate changes

4. Dependencies
   - All dependencies must be installed via npm/yarn
   - List all required dependencies with versions
   - Include installation commands in documentation

## Expected Deliverables
1. Implementation plan
2. List of files to be created/modified
3. Dependencies list with installation commands
4. Code implementation
5. Basic usage documentation

## Important Notes
- These guidelines are mandatory and non-negotiable
- Provide clear comments for complex logic
- Include error handling for critical operations
- Document any assumptions made during implementation
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