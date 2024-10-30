import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

// Initialize IndexedDB before hydration
async function initIndexedDB() {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return new Promise((resolve) => {
      const request = window.indexedDB.open('boltHistory', 1);
      request.onerror = () => {
        console.error('Failed to initialize IndexedDB');
        resolve(false);
      };
      request.onsuccess = () => {
        console.debug('IndexedDB initialized');
        resolve(true);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      };
    });
  }
  return Promise.resolve(false);
}

// Initialize IndexedDB before hydrating the app
initIndexedDB().then(() => {
  startTransition(() => {
    hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
  });
});
