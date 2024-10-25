import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { lastSaved } from '~/lib/persistence';

export function LastSavedIndicator() {
  const lastSavedTime = useStore(lastSaved);
  const [displayTime, setDisplayTime] = useState<string>();

  useEffect(() => {
    if (!lastSavedTime) {
      setDisplayTime(undefined);
      return;
    }

    // Update display time immediately
    const updateDisplayTime = () => {
      setDisplayTime(formatDistanceToNow(new Date(lastSavedTime), { addSuffix: true }));
    };
    updateDisplayTime();

    // Update display time every minute
    const interval = setInterval(updateDisplayTime, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [lastSavedTime]);

  if (!displayTime) return null;
  
  return (
    <span className="text-xs text-bolt-elements-textTertiary ml-2">
      Saved {displayTime}
    </span>
  );
}
