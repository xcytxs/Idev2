import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatHistory');

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

// Initialize database lazily when needed
let db: IDBDatabase | undefined;
let dbInitialized = false;

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
      try {
        // Only attempt to initialize once
        if (!dbInitialized) {
          logger.debug('Initializing database');
          db = await openDatabase();
          dbInitialized = true;
        }

        // If we have a mixedId but no database, navigate home
        if (mixedId && !db) {
          logger.debug('No database available, navigating home');
          navigate('/', { replace: true });
          setReady(true);
          return;
        }

        // If we have both mixedId and database, try to load messages
        if (mixedId && db) {
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
            logger.error('Failed to load messages:', error);
            navigate('/', { replace: true });
          }
        }

        setReady(true);
      } catch (error) {
        logger.error('Failed to initialize:', error);
        setReady(true);
      }
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

      try {
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

        await setMessages(db, chatId.get() as string, messages, urlId, description.get());
      } catch (error) {
        logger.error('Failed to store messages:', error);
      }
    },
  };
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;
  window.history.replaceState({}, '', url);
}
