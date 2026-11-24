import { useEffect } from 'react';
import { PlusSquare, Share, ShieldCheck, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

interface IosFullscreenModalProps {
  open: boolean;
  onClose: () => void;
}

export function IosFullscreenModal({ open, onClose }: IosFullscreenModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useGamepadMenuNav({
    enabled: open,
    onConfirm: onClose,
    onBack: onClose,
    onStart: onClose,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090C11]/90 flex items-center justify-center p-3 sm:p-4 safe-area-inset"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121822] border-2 border-[#00E5FF] p-4 sm:p-5 flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#242F40] pb-2.5">
          <h2 className="font-display font-bold text-base sm:text-lg text-[#00E5FF] tracking-wider">
            ПОЛНЫЙ ЭКРАН НА IPHONE / IOS
          </h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              onClose();
            }}
            aria-label="Закрыть подсказку"
            className="p-1 text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
          Safari на iPhone не позволяет сайтам скрывать панель браузера одной кнопкой. Чтобы открыть
          игру <span className="text-[#39FF14] font-bold">на 100% экрана без панелей и свайпов назад</span>:
        </p>

        <ol className="flex flex-col gap-2 text-xs sm:text-sm text-[#E6EDF3] bg-[#090C11] border border-[#242F40] p-3">
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 shrink-0 bg-[#10272E] border border-[#00E5FF] text-[#00E5FF] font-mono-num text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span className="flex-1">
              Нажмите кнопку <Share className="inline w-3.5 h-3.5 text-[#00E5FF] mx-0.5 -mt-0.5" />{' '}
              <strong>«Поделиться»</strong> внизу экрана Safari.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 shrink-0 bg-[#10272E] border border-[#00E5FF] text-[#00E5FF] font-mono-num text-xs font-bold flex items-center justify-center">
              2
            </span>
            <span className="flex-1">
              Выберите <PlusSquare className="inline w-3.5 h-3.5 text-[#39FF14] mx-0.5 -mt-0.5" />{' '}
              <strong>«На экран «Домой»»</strong> и нажмите <strong>«Добавить»</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 shrink-0 bg-[#1F2D22] border border-[#39FF14] text-[#39FF14] font-mono-num text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span className="flex-1">
              Запустите <strong>GREEN BEER</strong> с иконки — браузерных кнопок и боковых свайпов больше не будет!
            </span>
          </li>
        </ol>

        <div className="flex items-center gap-2 bg-[#16271C] border border-[#39FF14]/50 px-3 py-2 text-[11px] font-mono-num text-[#B8FF9E]">
          <ShieldCheck className="w-4 h-4 text-[#39FF14] shrink-0" />
          <span>
            Защита от боковых свайпов и отступы кнопок от краёв экрана уже включены и в обычной вкладке.
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuConfirm();
            onClose();
          }}
          className="w-full min-h-[42px] py-2 bg-[#39FF14] hover:bg-[#57FF38] text-[#090C11] font-display font-bold text-sm tracking-widest cursor-pointer"
        >
          ПОНЯТНО
        </button>
      </div>
    </div>
  );
}
