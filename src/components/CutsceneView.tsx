import { useEffect, useRef, useState } from 'react';
import { FastForward } from 'lucide-react';
import { HERO_MAP, HERO_PORTRAIT_URLS } from '../game/data';
import { soundEngine } from '../game/audio';
import { drawCutsceneScene, VIRTUAL_H, VIRTUAL_W } from '../game/sprites';
import { CutsceneDef } from '../game/types';

interface CutsceneViewProps {
  cutscene: CutsceneDef;
  crtScanlines: boolean;
  isTouchDevice: boolean;
  renderScale: number;
  onComplete: () => void;
  isOnlineGuest?: boolean;
  syncLineIndex?: number;
  onLineChange?: (lineIndex: number) => void;
}

export function CutsceneView({
  cutscene,
  crtScanlines,
  isTouchDevice,
  renderScale,
  onComplete,
  isOnlineGuest = false,
  syncLineIndex,
  onLineChange,
}: CutsceneViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showEpilogue, setShowEpilogue] = useState(false);

  const currentLine = cutscene.lines[lineIdx] ?? cutscene.lines[cutscene.lines.length - 1];
  const speaker = HERO_MAP[currentLine.speakerId];
  const fullText = showEpilogue ? cutscene.epilogueAction : currentLine.text;

  // Reset when cutscene changes
  useEffect(() => {
    setLineIdx(0);
    setVisibleChars(0);
    setShowEpilogue(false);
    soundEngine.playMusic(cutscene.levelId === 'victory' ? 'victory' : 'cutscene');
  }, [cutscene]);

  // Follow Host's cutscene progress in Online 2P Guest mode
  useEffect(() => {
    if (!isOnlineGuest || syncLineIndex === undefined) return;
    if (syncLineIndex >= cutscene.lines.length) {
      setShowEpilogue(true);
      setVisibleChars(0);
    } else if (syncLineIndex !== lineIdx) {
      setShowEpilogue(false);
      setLineIdx(Math.max(0, syncLineIndex));
      setVisibleChars(0);
    }
  }, [isOnlineGuest, syncLineIndex, cutscene.lines.length, lineIdx]);

  // Animated HD arcade cutscene diorama canvas (with live epilogue action sequence!)
  const epilogueStartRef = useRef<number>(0);
  useEffect(() => {
    if (showEpilogue) {
      epilogueStartRef.current = performance.now();
    }
  }, [showEpilogue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(VIRTUAL_W * renderScale);
    canvas.height = Math.round(VIRTUAL_H * renderScale);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.max(0, (now - start) / 1000);
      const epT = showEpilogue ? Math.max(0, (now - epilogueStartRef.current) / 1000) : 0;
      ctx.save();
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      drawCutsceneScene(
        ctx,
        cutscene,
        showEpilogue ? null : currentLine.speakerId,
        t,
        showEpilogue,
        epT
      );
      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cutscene, currentLine.speakerId, showEpilogue, renderScale]);

  // Typewriter reveal
  useEffect(() => {
    if (visibleChars >= fullText.length) return;
    const timer = window.setTimeout(() => {
      const next = visibleChars + 1;
      setVisibleChars(next);
      if (!showEpilogue && next % 3 === 0) {
        soundEngine.playTypeBlip(lineIdx);
      }
    }, showEpilogue ? 18 : 24);
    return () => window.clearTimeout(timer);
  }, [visibleChars, fullText, lineIdx, showEpilogue]);

  const advance = () => {
    if (isOnlineGuest) return;
    soundEngine.unlock();
    if (visibleChars < fullText.length) {
      setVisibleChars(fullText.length);
      return;
    }

    if (showEpilogue) {
      soundEngine.playMenuConfirm();
      onComplete();
      return;
    }

    if (lineIdx + 1 < cutscene.lines.length) {
      const nextIdx = lineIdx + 1;
      soundEngine.playMenuMove();
      setLineIdx(nextIdx);
      setVisibleChars(0);
      onLineChange?.(nextIdx);
    } else {
      soundEngine.playMenuConfirm();
      setShowEpilogue(true);
      setVisibleChars(0);
      onLineChange?.(cutscene.lines.length);
    }
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (isOnlineGuest) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') {
        e.preventDefault();
        advanceRef.current();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        soundEngine.playMenuConfirm();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onComplete, isOnlineGuest]);

  const revealed = fullText.slice(0, visibleChars);

  return (
    <div className="relative w-screen h-[100dvh] bg-[#090C11] flex flex-col overflow-hidden safe-area-inset">
      {/* Top title strip */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-[#0D121A] border-b border-[#242F40] shrink-0">
        <div className="min-w-0">
          <div className="font-display font-bold text-sm sm:text-lg text-[#39FF14] tracking-wider truncate">
            {cutscene.title}
          </div>
          <div className="text-[11px] sm:text-xs font-mono-num text-[#94A3B8] truncate hidden sm:block">
            {cutscene.locationLabel}
          </div>
        </div>

        {isOnlineGuest ? (
          <div className="px-3 py-1.5 bg-[#10272E] border border-[#00E5FF] text-[11px] sm:text-xs font-mono-num text-[#00E5FF] whitespace-nowrap shrink-0">
            ХОСТ УПРАВЛЯЕТ КАТСЦЕНОЙ
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuConfirm();
              onComplete();
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[38px] sm:py-2 bg-[#141A24] border border-[#2B3648] hover:border-[#39FF14] text-[11px] sm:text-xs font-mono-num text-[#E6EDF3] cursor-pointer whitespace-nowrap shrink-0"
          >
            <FastForward className="w-3.5 h-3.5 text-[#39FF14]" />
            <span>
              {cutscene.levelId === 'victory'
                ? 'К ИТОГАМ'
                : isTouchDevice
                ? 'В БОЙ'
                : 'ПРОПУСТИТЬ В БОЙ (ESC)'}
            </span>
          </button>
        )}
      </div>

      {/* Animated HD Arcade Stage Diorama */}
      <div
        onClick={advance}
        className="relative flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden cursor-pointer"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block"
        />
        {crtScanlines && (
          <div className="absolute inset-0 crt-scanlines pointer-events-none opacity-60" />
        )}
      </div>

      {/* Bottom Panel: Character Dialogue OR Cinematic Stage Action Caption */}
      {showEpilogue ? (
        <div
          onClick={advance}
          className="relative z-10 bg-[#0A0E14] border-t-2 border-[#FFB000] px-4 sm:px-8 py-3 sm:py-5 cursor-pointer shrink-0"
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-2.5 text-center">
            <p className="text-sm sm:text-lg italic text-[#FDE68A] leading-relaxed min-h-[2.4rem]">
              {revealed}
            </p>
            <div className="flex items-center justify-center gap-4 text-[11px] sm:text-xs font-mono-num text-[#39FF14]">
              <span>
                {cutscene.levelId === 'victory'
                  ? isTouchDevice
                    ? 'НАЖМИТЕ · ПЕРЕЙТИ К ИТОГАМ ->'
                    : 'ENTER / КЛИК · ПЕРЕЙТИ К ИТОГАМ ->'
                  : isTouchDevice
                  ? 'НАЖМИТЕ · В БОЙ ->'
                  : 'ENTER / КЛИК · В БОЙ ->'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={advance}
          className="relative z-10 bg-[#0D121A] border-t-2 border-[#39FF14] px-4 sm:px-8 py-2.5 sm:py-4 cursor-pointer shrink-0"
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-5">
            <div className="w-14 h-16 sm:w-20 sm:h-24 shrink-0 border-2 border-[#39FF14] overflow-hidden bg-[#090C11]">
              <img
                src={HERO_PORTRAIT_URLS[currentLine.speakerId]}
                alt={speaker.name}
                className="w-full h-full object-cover object-top block"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1 sm:gap-2">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
                  <span className="font-display font-bold text-base sm:text-xl text-[#39FF14] tracking-wider shrink-0">
                    {speaker.name}
                  </span>
                  <span className="text-[11px] sm:text-xs italic text-[#94A3B8] truncate">
                    *{currentLine.stageAction}*
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-mono-num text-[#94A3B8] shrink-0">
                  {lineIdx + 1} / {cutscene.lines.length}
                </span>
              </div>

              <p className="text-sm sm:text-lg text-white leading-snug sm:leading-relaxed min-h-[2.6rem] sm:min-h-[3.4rem]">
                «{revealed}»
              </p>

              <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono-num text-[#94A3B8] pt-0.5">
                <span>
                  {isTouchDevice
                    ? 'Нажмите на экран — дальше'
                    : 'Клик или Space / Enter — следующая реплика'}
                </span>
                <span className="text-[#39FF14]">ДАЛЕЕ -&gt;</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
