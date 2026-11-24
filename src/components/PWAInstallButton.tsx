import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { canInstall, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSGuide((v) => !v);
    } else {
      await promptInstall();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Установить приложение"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 bg-[#10272E]/95 border border-[#39FF14] text-xs font-mono-num font-bold text-[#39FF14] hover:bg-[#39FF14] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">УСТАНОВИТЬ APP</span>
        <span className="sm:hidden">APP</span>
      </button>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-label="Инструкция по установке на iOS"
          className="absolute right-0 top-full mt-2 w-72 bg-[#0D121A] border border-[#39FF14] p-3 text-xs text-[#E6EDF3] shadow-2xl z-50"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-display font-bold text-[#39FF14] tracking-wider">
              УСТАНОВКА НА IPHONE / IPAD
            </span>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              aria-label="Закрыть подсказку"
              className="text-[#94A3B8] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[#CBD5E1] leading-relaxed">
            Нажмите <Share className="inline w-3.5 h-3.5 text-[#00E5FF] mx-0.5" /> «Поделиться» в
            нижней панели Safari, затем выберите{' '}
            <strong className="text-white">«На экран «Домой»»</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
