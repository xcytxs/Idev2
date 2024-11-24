import { map } from 'nanostores';
import type { Message } from 'ai/react';
import { chatStore } from './chat';
import { workbenchStore } from './workbench';
import { getMessages, getNextId, getUrlId, setMessages, openDatabase } from '~/lib/persistence/db';
import { atom } from 'nanostores';

interface MessagesState {
  messages: Message[];
  isLoading: boolean;
  input: string;
  ready: boolean;
  description?: string;
  urlId?: string;
  chatId?: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Export chatId atom for use in other components
export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

class MessageStore {
  state = map<MessagesState>({
    messages: [],
    isLoading: false,
    input: '',
    ready: !persistenceEnabled,
    description: undefined,
    urlId: undefined,
    chatId: undefined
  });

  db?: IDBDatabase;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.state = this.state;
    }

    if (persistenceEnabled) {
      this.initializeDb();
    }
  }

  private async initializeDb() {
    this.db = await openDatabase();
    if (!this.db && persistenceEnabled) {
      console.error('Failed to initialize database');
    }
    this.state.setKey('ready', true);
  }

  async loadChat(id: string) {
    if (!this.db) {
      this.state.setKey('ready', true);
      return;
    }

    try {
      const storedMessages = await getMessages(this.db, id);
      if (storedMessages && storedMessages.messages.length > 0) {
        this.state.set({
          ...this.state.get(),
          messages: storedMessages.messages,
          urlId: storedMessages.urlId,
          description: storedMessages.description,
          chatId: storedMessages.id,
          ready: true
        });
        
        // Update atoms
        chatId.set(storedMessages.id);
        description.set(storedMessages.description);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      this.state.setKey('ready', true);
    }
  }

  async append(message: Message) {
    const currentMessages = [...this.state.get().messages, message];
    this.state.setKey('messages', currentMessages);
    
    await this.persistMessages(currentMessages);
  }

  private async persistMessages(messages: Message[]) {
    if (!this.db || messages.length === 0) {
      return;
    }

    const { firstArtifact } = workbenchStore;
    let { urlId, chatId: currentChatId, description: currentDescription } = this.state.get();

    // Handle URL ID for first artifact
    if (!urlId && firstArtifact?.id) {
      urlId = await getUrlId(this.db, firstArtifact.id);
      this.state.setKey('urlId', urlId);
    }

    // Set description if available
    if (!currentDescription && firstArtifact?.title) {
      currentDescription = firstArtifact?.title;
      this.state.setKey('description', currentDescription);
      description.set(currentDescription);
    }

    // Handle chat ID for new conversations
    if (!currentChatId) {
      currentChatId = await getNextId(this.db);
      this.state.setKey('chatId', currentChatId);
      chatId.set(currentChatId);
    }

    // Persist messages
    await setMessages(
      this.db,
      currentChatId,
      messages,
      urlId,
      currentDescription
    );
  }

  setMessages(messages: Message[]) {
    this.state.setKey('messages', messages);
  }

  setIsLoading(isLoading: boolean) {
    this.state.setKey('isLoading', isLoading);
  }

  setInput(input: string) {
    this.state.setKey('input', input);
  }

  get messages() {
    return this.state.get().messages;
  }

  get isLoading() {
    return this.state.get().isLoading;
  }

  get input() {
    return this.state.get().input;
  }

  get ready() {
    return this.state.get().ready;
  }
}

export const messageStore = new MessageStore();
