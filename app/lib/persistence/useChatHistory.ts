import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

// Initialize database lazily when component mounts
let db: IDBDatabase | undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  // Initialize database when component mounts
  useEffect(() => {
    const initDb = async () => {
      if (!db) {
        db = await openDatabase();
      }
      
      if (!db) {
        setReady(true);
        // Only show error if database failed to open
        toast.error('Failed to initialize chat persistence');
        return;
      }

      if (mixedId) {
        try {
          const storedMessages = await getMessages(db, mixedId);
          if (storedMessages && storedMessages.messages.length > 0) {
            setInitialMessages(storedMessages.messages);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
          } else {
            navigate('/', { replace: true });
          }
        } catch (error) {
          toast.error((error as Error).message);
        }
      }
      setReady(true);
    };

    initDb();
  }, [mixedId, navigate]);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const newUrlId = await getUrlId(db, firstArtifact.id);
        navigateChat(newUrlId);
        setUrlId(newUrlId);
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

      try {
        await setMessages(db, chatId.get() as string, messages, urlId, description.get());
      } catch (error) {
        toast.error('Failed to save chat history');
      }
    },
  };
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;
  window.history.replaceState({}, '', url);
}
