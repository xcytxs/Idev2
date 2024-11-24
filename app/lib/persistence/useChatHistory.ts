import { useLoaderData, useNavigate } from '@remix-run/react';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { messageStore } from '~/lib/stores/messages';
import { duplicateChat, openDatabase } from './db';
import { atom } from 'nanostores';
import type { Message } from 'ai';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  useEffect(() => {
    if (!db) {
      if (persistenceEnabled) {
        toast.error(`Chat persistence is unavailable`);
      }
      return;
    }

    if (mixedId) {
      messageStore.loadChat(mixedId).catch((error) => {
        toast.error(error.message);
        navigate('/', { replace: true });
      });
    }
  }, [mixedId]);

  return {
    ready: messageStore.ready,
    initialMessages: messageStore.messages,
    storeMessageHistory: async (messages: Message[]) => {
      messageStore.setMessages(messages);
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!db || (!mixedId && !listItemId)) {
        return;
      }

      try {
        const newId = await duplicateChat(db, mixedId || listItemId);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.log(error);
      }
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
