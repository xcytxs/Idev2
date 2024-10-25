import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';
import type { FileMap, File, Folder } from '~/lib/stores/files';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  lastSaved?: string;
  files?: FileMap;
}

// Only enable persistence if we're in a browser environment
const persistenceEnabled = typeof window !== 'undefined' && !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Initialize database only in browser environment
let db: IDBDatabase | undefined;

if (typeof window !== 'undefined') {
  openDatabase().then((database) => {
    db = database;
  });
}

export { db };

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const lastSaved = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  // Create a save timeout ref
  const saveTimeoutRef = useRef<number>();
  const pendingSaveRef = useRef(false);
  const lastSavedFilesRef = useRef<FileMap>();
  const lastSavedDocumentRef = useRef<string>();

  // Create a save function
  const saveChanges = useCallback(async () => {
    if (!persistenceEnabled || !db || !chatId.get()) {
      return;
    }

    // If there's already a save in progress, mark that we need another save
    if (pendingSaveRef.current) {
      return;
    }

    pendingSaveRef.current = true;

    try {
      const currentFiles = workbenchStore.files.get();
      const currentDocument = workbenchStore.currentDocument.get();
      const currentTimestamp = new Date().toISOString();
      
      // Check if files or current document have changed
      const filesChanged = !lastSavedFilesRef.current || Object.entries(currentFiles).some(([path, file]) => {
        const lastFile = lastSavedFilesRef.current?.[path];
        if (!lastFile || !file) return true;
        if (file.type !== lastFile.type) return true;
        if (file.type === 'file' && lastFile.type === 'file') {
          return file.content !== lastFile.content;
        }
        return false;
      });

      const documentChanged = currentDocument?.value !== lastSavedDocumentRef.current;
      
      if (filesChanged || documentChanged) {
        await setMessages(
          db,
          chatId.get() as string,
          initialMessages,
          urlId,
          description.get(),
          currentTimestamp,
          currentFiles
        );
        lastSaved.set(currentTimestamp);
        lastSavedFilesRef.current = JSON.parse(JSON.stringify(currentFiles));
        lastSavedDocumentRef.current = currentDocument?.value;
      }

      // After successful save, check if we need to save again
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        debouncedSave();
      }
    } catch (error) {
      toast.error('Failed to save changes');
      console.error('Error saving changes:', error);
      pendingSaveRef.current = false;
    }
  }, [initialMessages, urlId, chatId.get()]);

  // Create a debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(saveChanges, 1000);
  }, [saveChanges]);

  // Subscribe to workbench file changes
  useEffect(() => {
    if (!persistenceEnabled || !db || !chatId.get()) {
      return;
    }

    // Save initial state
    const currentFiles = workbenchStore.files.get();
    const currentDocument = workbenchStore.currentDocument.get();
    lastSavedFilesRef.current = JSON.parse(JSON.stringify(currentFiles));
    lastSavedDocumentRef.current = currentDocument?.value;
    debouncedSave();

    // Subscribe to file changes
    const unsubscribe = workbenchStore.files.subscribe(() => {
      debouncedSave();
    });

    // Subscribe to unsaved files changes
    const unsubscribeUnsaved = workbenchStore.unsavedFiles.subscribe((unsavedFiles) => {
      if (unsavedFiles.size === 0) {
        // When all files are saved, save immediately without debouncing
        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
        }
        saveChanges();
      }
    });

    // Subscribe to editor document changes
    const unsubscribeDoc = workbenchStore.currentDocument.subscribe(() => {
      debouncedSave();
    });

    return () => {
      unsubscribe();
      unsubscribeUnsaved();
      unsubscribeDoc();
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      // If there are pending changes, save them before unmounting
      if (pendingSaveRef.current) {
        saveChanges();
      }
    };
  }, [debouncedSave, saveChanges]);

  useEffect(() => {
    // Only attempt to use IndexedDB in browser environment
    if (!persistenceEnabled) {
      setReady(true);
      return;
    }

    if (!db) {
      setReady(true);
      toast.error(`Chat persistence is unavailable`);
      return;
    }

    if (mixedId) {
      getMessages(db, mixedId)
        .then((storedMessages) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            setInitialMessages(storedMessages.messages);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            lastSaved.set(storedMessages.lastSaved);
            lastSavedFilesRef.current = storedMessages.files;

            // Restore files if they exist
            if (storedMessages.files) {
              const files = Object.entries(storedMessages.files).reduce((acc, [path, file]) => {
                if (file) {
                  if (file.type === 'file') {
                    acc[path] = {
                      type: 'file',
                      content: file.content,
                      isBinary: false,
                    } as File;
                  } else {
                    acc[path] = {
                      type: 'folder',
                    } as Folder;
                  }
                }
                return acc;
              }, {} as FileMap);
              workbenchStore.setDocuments(files);
            }
          } else {
            navigate(`/`, { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          toast.error(error.message);
        });
    }
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (!persistenceEnabled || !db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(db, firstArtifact.id);

        navigateChat(urlId);
        setUrlId(urlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      // Save current files state
      const currentFiles = workbenchStore.files.get();
      const currentDocument = workbenchStore.currentDocument.get();
      const currentTimestamp = new Date().toISOString();
      
      await setMessages(
        db,
        chatId.get() as string,
        messages,
        urlId,
        description.get(),
        currentTimestamp,
        currentFiles
      );
      lastSaved.set(currentTimestamp);
      lastSavedFilesRef.current = JSON.parse(JSON.stringify(currentFiles));
      lastSavedDocumentRef.current = currentDocument?.value;
    },
  };
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
