import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import * as nodePath from 'node:path';
import type { WebContainerProcess } from '@webcontainer/api';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #boltTerminal: { terminal: ITerminal; process: WebContainerProcess } | undefined;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {

    this.#terminalStore.attachBoltTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer, () => this.boltTerminal),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }
    if (data.action.type === 'file') {
      let wc = await webcontainer
      const fullPath = nodePath.join(wc.workdir, data.action.filePath);
      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }
      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }
      const doc = this.#editorStore.documents.get()[fullPath];
      if (!doc) {
        await artifact.runner.runAction(data, isStreaming);
      }

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming) {
        this.resetCurrentDocument();
        await artifact.runner.runAction(data);
      }
    } else {
      artifact.runner.runAction(data);
    }
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        // remove '/home/project/' from the beginning of the path
        const relativePath = filePath.replace(/^\/home\/project\//, '');

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = filePath.replace(/^\/home\/project\//, '');
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], { create: true });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async pushToGitHub(
    repoName: string, 
    githubUsername: string, 
    ghToken: string, 
    isPrivate: boolean,
    branchName?: string,
    isNewBranch?: boolean
  ) {
    try {
      // Clean and validate inputs
      const cleanUsername = githubUsername.trim().replace(/[@\s]/g, '');
      const cleanRepoName = repoName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      const targetBranch = (branchName || 'main').trim();
  
      // Initialize Octokit client with auth token
      const octokit = new Octokit({
        auth: ghToken,
        baseUrl: 'https://api.github.com'
      });
  
      // Get or create repository
      let repoData;
      try {
        // Try to get existing repo first
        const { data } = await octokit.rest.repos.get({
          owner: cleanUsername,
          repo: cleanRepoName
        });
        repoData = data;
  
        // Update repository visibility if it exists
        await octokit.rest.repos.update({
          owner: cleanUsername,
          repo: cleanRepoName,
          private: isPrivate,
          name: cleanRepoName
        });
  
      } catch (error: any) {
        if (error?.response?.status === 404) {
          const { data } = await octokit.rest.repos.createForAuthenticatedUser({
            name: cleanRepoName,
            private: isPrivate,
            auto_init: true
          });
          repoData = data;
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
  
      // Get base commit SHA from default branch
      let baseCommitSha;
      try {
        const { data: ref } = await octokit.rest.git.getRef({
          owner: cleanUsername,
          repo: cleanRepoName,
          ref: `heads/${repoData.default_branch}`
        });
        baseCommitSha = ref.object.sha;
      } catch (error) {
        console.error('Error getting default branch:', error);
        throw new Error('Failed to get default branch. Repository may not be properly initialized.');
      }
  
      // Create blobs for files in batches to avoid rate limits
      const files = this.files.get();
      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }
  
      const blobs = [];
      const BATCH_SIZE = 3;
      const fileEntries = Object.entries(files);
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        const batch = fileEntries.slice(i, i + BATCH_SIZE);
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
  
        const batchResults = await Promise.all(batch.map(async ([filePath, dirent]) => {
          if (dirent?.type === 'file' && dirent.content) {
            try {
              const { data } = await octokit.rest.git.createBlob({
                owner: cleanUsername,
                repo: cleanRepoName,
                content: Buffer.from(dirent.content).toString('base64'),
                encoding: 'base64'
              });
              return {
                path: filePath.replace(/^\/home\/project\//, ''),
                mode: '100644' as const,
                type: 'blob' as const,
                sha: data.sha
              };
            } catch (error) {
              console.error('Error creating blob:', error);
              return null;
            }
          }
          return null;
        }));
  
        blobs.push(...batchResults.filter((blob): blob is NonNullable<typeof blob> => blob !== null));
      }
  
      const { data: tree } = await octokit.rest.git.createTree({
        owner: cleanUsername,
        repo: cleanRepoName,
        base_tree: baseCommitSha,
        tree: blobs
      });
  
      const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: cleanUsername,
        repo: cleanRepoName,
        message: 'Update from Bolt',
        tree: tree.sha,
        parents: [baseCommitSha]
      });
  
      if (isNewBranch && branchName) {
        try {
          await octokit.rest.git.createRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `refs/heads/${targetBranch}`,
            sha: newCommit.sha
          });
        } catch (error: any) {
          if (error?.response?.status === 422) {
            await octokit.rest.git.updateRef({
              owner: cleanUsername,
              repo: cleanRepoName,
              ref: `heads/${targetBranch}`,
              sha: newCommit.sha,
              force: true
            });
          } else {
            throw error;
          }
        }
      } else {
        try {
          const { data: branchRef } = await octokit.rest.git.getRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `heads/${targetBranch}`
          });
  
          if (branchRef.object.sha !== baseCommitSha) {
            throw new Error('Branch has diverged from the base commit. Manual merge or pull request required.');
          }
  
          await octokit.rest.git.updateRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `heads/${targetBranch}`,
            sha: newCommit.sha
          });
        } catch (error: any) {
          if (error?.response?.status === 404) {
            await octokit.rest.git.createRef({
              owner: cleanUsername,
              repo: cleanRepoName,
              ref: `refs/heads/${targetBranch}`,
              sha: newCommit.sha
            });
          } else {
            throw error;
          }
        }
      }
  
      return repoData.html_url;
    } catch (error) {
      console.error('GitHub push error:', error);
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('Resource protected by organization SAML enforcement')) {
          throw new Error('This repository is protected by SAML enforcement. Please authorize your token for SSO.');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred while pushing to GitHub');
    }
  }
}

export const workbenchStore = new WorkbenchStore();import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import * as nodePath from 'node:path';
import type { WebContainerProcess } from '@webcontainer/api';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];
  #boltTerminal: { terminal: ITerminal; process: WebContainerProcess } | undefined;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {

    this.#terminalStore.attachBoltTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer, () => this.boltTerminal),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }
    if (data.action.type === 'file') {
      let wc = await webcontainer
      const fullPath = nodePath.join(wc.workdir, data.action.filePath);
      if (this.selectedFile.value !== fullPath) {
        this.setSelectedFile(fullPath);
      }
      if (this.currentView.value !== 'code') {
        this.currentView.set('code');
      }
      const doc = this.#editorStore.documents.get()[fullPath];
      if (!doc) {
        await artifact.runner.runAction(data, isStreaming);
      }

      this.#editorStore.updateFile(fullPath, data.action.content);

      if (!isStreaming) {
        this.resetCurrentDocument();
        await artifact.runner.runAction(data);
      }
    } else {
      artifact.runner.runAction(data);
    }
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        // remove '/home/project/' from the beginning of the path
        const relativePath = filePath.replace(/^\/home\/project\//, '');

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = filePath.replace(/^\/home\/project\//, '');
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], { create: true });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async pushToGitHub(
    repoName: string, 
    githubUsername: string, 
    ghToken: string, 
    isPrivate: boolean,
    branchName?: string,
    isNewBranch?: boolean
  ) {
    try {
      // Clean and validate inputs
      const cleanUsername = githubUsername.trim().replace(/[@\s]/g, '');
      const cleanRepoName = repoName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      const targetBranch = (branchName || 'main').trim();
  
      // Initialize Octokit client with auth token
      const octokit = new Octokit({
        auth: ghToken,
        baseUrl: 'https://api.github.com'
      });
  
      // Get or create repository
      let repoData;
      try {
        // Try to get existing repo first
        const { data } = await octokit.rest.repos.get({
          owner: cleanUsername,
          repo: cleanRepoName
        });
        repoData = data;
  
        // Update repository visibility if it exists
        await octokit.rest.repos.update({
          owner: cleanUsername,
          repo: cleanRepoName,
          private: isPrivate,
          name: cleanRepoName
        });
  
      } catch (error: any) {
        if (error?.response?.status === 404) {
          const { data } = await octokit.rest.repos.createForAuthenticatedUser({
            name: cleanRepoName,
            private: isPrivate,
            auto_init: true
          });
          repoData = data;
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
  
      // Get base commit SHA from default branch
      let baseCommitSha;
      try {
        const { data: ref } = await octokit.rest.git.getRef({
          owner: cleanUsername,
          repo: cleanRepoName,
          ref: `heads/${repoData.default_branch}`
        });
        baseCommitSha = ref.object.sha;
      } catch (error) {
        console.error('Error getting default branch:', error);
        throw new Error('Failed to get default branch. Repository may not be properly initialized.');
      }
  
      // Create blobs for files in batches to avoid rate limits
      const files = this.files.get();
      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }
  
      const blobs = [];
      const BATCH_SIZE = 3;
      const fileEntries = Object.entries(files);
      for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
        const batch = fileEntries.slice(i, i + BATCH_SIZE);
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
  
        const batchResults = await Promise.all(batch.map(async ([filePath, dirent]) => {
          if (dirent?.type === 'file' && dirent.content) {
            try {
              const { data } = await octokit.rest.git.createBlob({
                owner: cleanUsername,
                repo: cleanRepoName,
                content: Buffer.from(dirent.content).toString('base64'),
                encoding: 'base64'
              });
              return {
                path: filePath.replace(/^\/home\/project\//, ''),
                mode: '100644' as const,
                type: 'blob' as const,
                sha: data.sha
              };
            } catch (error) {
              console.error('Error creating blob:', error);
              return null;
            }
          }
          return null;
        }));
  
        blobs.push(...batchResults.filter((blob): blob is NonNullable<typeof blob> => blob !== null));
      }
  
      const { data: tree } = await octokit.rest.git.createTree({
        owner: cleanUsername,
        repo: cleanRepoName,
        base_tree: baseCommitSha,
        tree: blobs
      });
  
      const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: cleanUsername,
        repo: cleanRepoName,
        message: 'Update from Bolt',
        tree: tree.sha,
        parents: [baseCommitSha]
      });
  
      if (isNewBranch && branchName) {
        try {
          await octokit.rest.git.createRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `refs/heads/${targetBranch}`,
            sha: newCommit.sha
          });
        } catch (error: any) {
          if (error?.response?.status === 422) {
            await octokit.rest.git.updateRef({
              owner: cleanUsername,
              repo: cleanRepoName,
              ref: `heads/${targetBranch}`,
              sha: newCommit.sha,
              force: true
            });
          } else {
            throw error;
          }
        }
      } else {
        try {
          const { data: branchRef } = await octokit.rest.git.getRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `heads/${targetBranch}`
          });
  
          if (branchRef.object.sha !== baseCommitSha) {
            throw new Error('Branch has diverged from the base commit. Manual merge or pull request required.');
          }
  
          await octokit.rest.git.updateRef({
            owner: cleanUsername,
            repo: cleanRepoName,
            ref: `heads/${targetBranch}`,
            sha: newCommit.sha
          });
        } catch (error: any) {
          if (error?.response?.status === 404) {
            await octokit.rest.git.createRef({
              owner: cleanUsername,
              repo: cleanRepoName,
              ref: `refs/heads/${targetBranch}`,
              sha: newCommit.sha
            });
          } else {
            throw error;
          }
        }
      }
  
      return repoData.html_url;
    } catch (error) {
      console.error('GitHub push error:', error);
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('Resource protected by organization SAML enforcement')) {
          throw new Error('This repository is protected by SAML enforcement. Please authorize your token for SSO.');
        }
        throw error;
      }
      throw new Error('An unexpected error occurred while pushing to GitHub');
    }
  }
}

export const workbenchStore = new WorkbenchStore();