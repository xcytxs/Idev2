import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from '~/utils/constants';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { debounce } from 'lodash';
import * as diff from 'diff';

const logger = createScopedLogger('FilesStore');

const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  metadata?: {
    lastModified: number;
    size: number;
  };
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

class FilesStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilesStoreError';
  }
}

class FileNotFoundError extends FilesStoreError {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

class FileOperationError extends FilesStoreError {
  constructor(operation: string, path: string, originalError: Error) {
    super(`Failed to ${operation} file ${path}: ${originalError.message}`);
    this.name = 'FileOperationError';
    this.cause = originalError;
  }
}

class FileDecodeError extends FileOperationError {
  constructor(path: string, originalError: Error) {
    super('decode', path, originalError);
    this.name = 'FileDecodeError';
  }
}

class FilePermissionError extends FilesStoreError {
  constructor(operation: string, path: string) {
    super(`Permission denied: Cannot ${operation} file ${path}`);
    this.name = 'FilePermissionError';
  }
}

class FileSizeExceededError extends FilesStoreError {
  constructor(path: string, size: number, maxSize: number) {
    super(`File size exceeded: ${path} (${size} bytes) exceeds maximum allowed size of ${maxSize} bytes`);
    this.name = 'FileSizeExceededError';
  }
}

class FileAlreadyExistsError extends FilesStoreError {
  constructor(path: string) {
    super(`File already exists: ${path}`);
    this.name = 'FileAlreadyExistsError';
  }
}

class InvalidFileNameError extends FilesStoreError {
  constructor(fileName: string) {
    super(`Invalid file name: ${fileName}`);
    this.name = 'InvalidFileNameError';
  }
}

class FileWriteError extends FileOperationError {
  constructor(path: string, originalError: Error) {
    super('write', path, originalError);
    this.name = 'FileWriteError';
  }
}

export interface FilesStoreConfig {
  debounceTime?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class FilesStore {
  #webcontainer: Promise<WebContainer>;
  #size = 0;
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});
  #contentCache: Map<string, string> = new Map();
  #saveDebounce: Map<string, ReturnType<typeof debounce>> = new Map();
  #config: FilesStoreConfig;
  #fileOperationQueue: Array<() => Promise<void>> = [];
  #isProcessingQueue = false;
  #watchStats = {
    totalEvents: 0,
    addDirEvents: 0,
    removeDirEvents: 0,
    addFileEvents: 0,
    changeEvents: 0,
    removeFileEvents: 0,
  };

  constructor(webcontainerPromise: Promise<WebContainer>, config: FilesStoreConfig = {}) {
    this.#webcontainer = webcontainerPromise;
    this.#config = {
      debounceTime: 500,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.dispose(this.#disposeSaveDebounce.bind(this));
    }

    this.#init();
  }

  get filesCount() {
    return this.#size;
  }

  get watchStats() {
    return { ...this.#watchStats };
  }

  getFile(filePath: string): File | undefined {
    const dirent = this.files.get()[filePath];
    return dirent?.type === 'file' ? dirent : undefined;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async setFileContent(path: string, content: string) {
    const sanitizedPath = this.#sanitizePath(path);
    
    if (!this.#isValidFileName(sanitizedPath)) {
      throw new InvalidFileNameError(sanitizedPath);
    }

    const file = this.files.get()[sanitizedPath];

    if (!file || file.type !== 'file') {
      throw new FileNotFoundError(sanitizedPath);
    }

    if (this.#contentCache.get(sanitizedPath) === content) {
      return; // Content hasn't changed, no need to update
    }

    this.#contentCache.set(sanitizedPath, content);
    this.#debouncedSaveFile(sanitizedPath, content, file);
  }

  #isValidFileName(fileName: string): boolean {
    // Implement your file name validation logic here
    // For example, you might want to disallow certain characters or patterns
    return /^[a-zA-Z0-9_\-\.]+$/.test(fileName);
  }

  async #init() {
    const webcontainer = await this.#webcontainer;
    webcontainer.internal.watchPaths(
      { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
      bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
    );
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);

    for (const { type, path, buffer } of watchEvents) {
      const sanitizedPath = this.#sanitizePath(path);
      this.#watchStats.totalEvents++;

      switch (type) {
        case 'add_dir':
          this.#watchStats.addDirEvents++;
          this.files.setKey(sanitizedPath, { type: 'folder' });
          break;
        case 'remove_dir':
          this.#watchStats.removeDirEvents++;
          this.#removeDirectory(sanitizedPath);
          break;
        case 'add_file':
        case 'change':
          type === 'add_file' ? this.#watchStats.addFileEvents++ : this.#watchStats.changeEvents++;
          this.#handleFileAddOrChange(type, sanitizedPath, buffer);
          break;
        case 'remove_file':
          this.#watchStats.removeFileEvents++;
          this.#removeFile(sanitizedPath);
          break;
        case 'update_directory':
          // we don't care about these events
          break;
        default:
          logger.warn(`Unhandled event type: ${type}`);
          break;
      }
    }
  }

  #removeDirectory(path: string) {
    this.files.setKey(path, undefined);
    for (const [direntPath] of Object.entries(this.files.get())) {
      if (direntPath.startsWith(path)) {
        this.files.setKey(direntPath, undefined);
      }
    }
  }

  #handleFileAddOrChange(type: 'add_file' | 'change', path: string, buffer?: Uint8Array) {
    if (type === 'add_file') {
      this.#size++;
    }

    const isBinary = isBinaryFile(buffer);
    const content = isBinary ? '' : this.#decodeFileContent(buffer, path);
    const metadata = {
      lastModified: Date.now(),
      size: buffer?.byteLength ?? 0,
    };
    this.files.setKey(path, { type: 'file', content, isBinary, metadata });
  }

  #removeFile(path: string) {
    this.#size--;
    this.files.setKey(path, undefined);
  }

  #decodeFileContent(buffer?: Uint8Array, path?: string): string {
    if (!buffer || buffer.byteLength === 0) {
      return '';
    }

    try {
      return utf8TextDecoder.decode(buffer);
    } catch (error) {
      logger.error('Failed to decode file content', error);
      if (path) {
        throw new FileDecodeError(path, error as Error);
      }
      return '';
    }
  }

  #sanitizePath(path: string): string {
    return path.replace(/\/+$/g, '');
  }

  #debouncedSaveFile(path: string, content: string, file: File) {
    if (!this.#saveDebounce.has(path)) {
      this.#saveDebounce.set(
        path,
        debounce(this.#saveFile.bind(this), this.#config.debounceTime)
      );
    }
    this.#saveDebounce.get(path)!(path, content, file);
  }

  async #saveFile(path: string, content: string, file: File) {
    await this.#queueFileOperation(async () => {
      const webcontainer = await this.#webcontainer;
      let retries = 0;
      while (retries < this.#config.maxRetries!) {
        try {
          const currentContent = await this.#retryOperation(() => webcontainer.fs.readFile(path, 'utf-8'));
          
          const newSize = Buffer.byteLength(content);
          const maxSize = 1024 * 1024 * 10; // 10 MB, for example
          if (newSize > maxSize) {
            throw new FileSizeExceededError(path, newSize, maxSize);
          }

          if (diff.diffChars(currentContent, content).length > 1) {
            try {
              await this.#retryOperation(() => webcontainer.fs.writeFile(path, content));
            } catch (error) {
              if (error instanceof Error) {
                if (error.message.includes('permission denied')) {
                  throw new FilePermissionError('write', path);
                } else if (error.message.includes('file already exists')) {
                  throw new FileAlreadyExistsError(path);
                }
              }
              throw new FileWriteError(path, error as Error);
            }

            const updatedFile: File = {
              ...file,
              content,
              metadata: {
                lastModified: Date.now(),
                size: newSize,
              },
            };
            this.files.setKey(path, updatedFile);
            
            if (!this.#modifiedFiles.has(path)) {
              this.#modifiedFiles.set(path, currentContent);
            }
          }
          return; // Operation successful, exit the retry loop
        } catch (error) {
          retries++;
          if (retries >= this.#config.maxRetries!) {
            if (error instanceof FilesStoreError) {
              throw error;
            }
            throw new FileOperationError('update', path, error as Error);
          }
          await new Promise(resolve => setTimeout(resolve, this.#config.retryDelay));
        }
      }
    });
  }

  async #retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let retries = 0;
    while (retries < this.#config.maxRetries!) {
      try {
        return await operation();
      } catch (error) {
        retries++;
        if (retries >= this.#config.maxRetries!) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.#config.retryDelay));
      }
    }
    throw new Error('Max retries reached'); // This should never be reached due to the throw in the loop
  }

  async #queueFileOperation(operation: () => Promise<void>) {
    this.#fileOperationQueue.push(operation);
    if (!this.#isProcessingQueue) {
      await this.#processFileOperationQueue();
    }
  }

  async #processFileOperationQueue() {
    if (this.#isProcessingQueue) return;
    this.#isProcessingQueue = true;

    while (this.#fileOperationQueue.length > 0) {
      const operation = this.#fileOperationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          logger.error('File operation failed', error);
        }
      }
    }

    this.#isProcessingQueue = false;
  }

  #disposeSaveDebounce() {
    for (const debounceFn of this.#saveDebounce.values()) {
      debounceFn.cancel();
    }
  }
}

function isBinaryFile(buffer: Uint8Array | undefined): boolean {
  if (buffer === undefined) {
    return false;
  }
  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}

function convertToBuffer(view: Uint8Array): Buffer {
  const buffer = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  Object.setPrototypeOf(buffer, Buffer.prototype);
  return buffer as Buffer;
}
