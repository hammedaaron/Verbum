import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-neutral-900/90 dark:bg-[#18181b]/95 border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
      <WifiOff size={13} className="text-amber-400" />
      <span className="text-[11px]">Offline Mode — Local storage active</span>
    </div>
  );
};
