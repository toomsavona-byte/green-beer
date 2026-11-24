import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1F1A0D]/95 border border-[#FFB000] px-3 py-1 text-[11px] font-mono-num text-[#FDE68A] pointer-events-none"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#FFB000] shrink-0" />
      <span>ОФФЛАЙН · СОЛО И 2P ЛОКАЛЬНО ДОСТУПНЫ</span>
    </div>
  );
}
