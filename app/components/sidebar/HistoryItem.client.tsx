import type { ChatHistoryItem } from '~/lib/persistence';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete: () => void;
}

export function HistoryItem({ item, onDelete }: HistoryItemProps) {
  const [lastSavedDisplay, setLastSavedDisplay] = useState<string>();

  useEffect(() => {
    if (!item.lastSaved) {
      setLastSavedDisplay(undefined);
      return;
    }

    // Update display time immediately
    const updateDisplayTime = () => {
      setLastSavedDisplay(formatDistanceToNow(new Date(item.lastSaved!), { addSuffix: true }));
    };
    updateDisplayTime();

    // Update display time every minute
    const interval = setInterval(updateDisplayTime, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [item.lastSaved]);

  return (
    <div className="group relative">
      <a
        href={`/chat/${item.urlId}`}
        className="flex items-center gap-2 rounded-md p-2 hover:bg-bolt-elements-sidebar-buttonBackgroundHover transition-theme"
      >
        <span className="inline-block i-bolt:chat" />
        <span className="flex-1 truncate">{item.description}</span>
        {lastSavedDisplay && (
          <span 
            className="text-xs text-bolt-elements-textTertiary" 
            title={`Last saved ${lastSavedDisplay}`}
          >
            {lastSavedDisplay}
          </span>
        )}
      </a>
      <button
        onClick={onDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded"
      >
        <div className="i-ph:trash text-bolt-elements-textTertiary" />
      </button>
    </div>
  );
}
