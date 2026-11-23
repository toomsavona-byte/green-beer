import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Crosshair, RefreshCw, Zap } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { VirtualButtonAction } from '../game/engine';

interface TouchControlsProps {
  onStickMove: (x: number, y: number) => void;
  onButtonChange: (action: VirtualButtonAction, pressed: boolean) => void;
  onClearAll: () => void;
}

const STICK_MAX_RADIUS = 44;

export function TouchControls({
  onStickMove,
  onButtonChange,
  onClearAll,
}: TouchControlsProps) {
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [activeButtons, setActiveButtons] = useState<Record<VirtualButtonAction, boolean>>({
    shoot: false,
    melee: false,
    jump: false,
    swap: false,
  });

  // Always clear virtual inputs cleanly if component unmounts (e.g. pause / stage clear)
  useEffect(() => {
    return () => {
      onClearAll();
    };
  }, [onClearAll]);

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, STICK_MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0 ? Math.cos(angle) * clampedDist : 0;
    const ky = dist > 0 ? Math.sin(angle) * clampedDist : 0;

    setKnobPos({ x: kx, y: ky });
    onStickMove(kx / STICK_MAX_RADIUS, ky / STICK_MAX_RADIUS);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    soundEngine.unlock();
    if (stickPointerIdRef.current !== null) return;
    stickPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setStickActive(true);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    stickPointerIdRef.current = null;
    setStickActive(false);
    setKnobPos({ x: 0, y: 0 });
    onStickMove(0, 0);
  };

  const bindActionButton = (action: VirtualButtonAction) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      soundEngine.unlock();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActiveButtons((prev) => (prev[action] ? prev : { ...prev, [action]: true }));
      onButtonChange(action, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setActiveButtons((prev) => (!prev[action] ? prev : { ...prev, [action]: false }));
      onButtonChange(action, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setActiveButtons((prev) => (!prev[action] ? prev : { ...prev, [action]: false }));
      onButtonChange(action, false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-25 pointer-events-none flex items-end justify-between px-4 sm:px-7 pb-4 sm:pb-6"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Left Thumb Zone: 8-Way Virtual Arcade Joystick */}
      <div
        ref={stickBaseRef}
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickEnd}
        onPointerCancel={handleStickEnd}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Виртуальный джойстик движения и прицеливания"
        className={`pointer-events-auto touch-control-surface relative w-32 h-32 sm:w-36 sm:h-36 rounded-full border-2 flex items-center justify-center transition-opacity ${
          stickActive
            ? 'bg-[#090C11]/65 border-[#39FF14]/85 opacity-95'
            : 'bg-[#090C11]/45 border-[#39FF14]/45 opacity-80'
        }`}
      >
        {/* Subtle 8-way crosshair reticle */}
        <div className="pointer-events-none absolute inset-4 rounded-full border border-[#39FF14]/20" />
        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-[#39FF14]/20" />
        <div className="pointer-events-none absolute inset-y-4 left-1/2 w-px bg-[#39FF14]/20" />

        {/* Directional ticks */}
        <span className="pointer-events-none absolute top-1.5 text-[9px] font-mono-num text-[#39FF14]/55">▲</span>
        <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-mono-num text-[#39FF14]/55">▼</span>
        <span className="pointer-events-none absolute left-2 text-[9px] font-mono-num text-[#39FF14]/55">◀</span>
        <span className="pointer-events-none absolute right-2 text-[9px] font-mono-num text-[#39FF14]/55">▶</span>

        {/* Thumb Puck */}
        <div
          className={`pointer-events-none w-13 h-13 rounded-full border-2 flex items-center justify-center ${
            stickActive
              ? 'bg-[#39FF14]/40 border-[#39FF14] shadow-[0_0_14px_rgba(57,255,20,0.45)]'
              : 'bg-[#1D2533]/85 border-[#39FF14]/70'
          }`}
          style={{
            transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
          }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-[#39FF14]/80" />
        </div>
      </div>

      {/* Right Thumb Zone: Ergonomic 4-Button Sega Arcade Diamond */}
      <div className="pointer-events-auto touch-control-surface relative w-44 h-36 sm:w-48 sm:h-40">
        {/* SWAP / PICKUP (Top-Left of cluster) */}
        <button
          type="button"
          {...bindActionButton('swap')}
          aria-label="Подобрать или сменить оружие"
          className={`touch-control-surface absolute left-2 top-0 w-13 h-13 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
            activeButtons.swap
              ? 'bg-[#FF2A85]/45 border-[#FF2A85] scale-95 text-white'
              : 'bg-[#090C11]/55 border-[#FF2A85]/70 text-[#FF85B8]'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[9px] font-mono-num font-bold leading-none">СТВОЛ</span>
        </button>

        {/* JUMP (Top-Right of cluster) */}
        <button
          type="button"
          {...bindActionButton('jump')}
          aria-label="Прыжок"
          className={`touch-control-surface absolute right-1 top-1 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
            activeButtons.jump
              ? 'bg-[#00E5FF]/45 border-[#00E5FF] scale-95 text-white'
              : 'bg-[#090C11]/55 border-[#00E5FF]/70 text-[#7DD3FC]'
          }`}
        >
          <ArrowUp className="w-5 h-5" />
          <span className="text-[9px] font-mono-num font-bold leading-none">ПРЫЖ</span>
        </button>

        {/* MELEE (Bottom-Left of cluster) */}
        <button
          type="button"
          {...bindActionButton('melee')}
          aria-label="Ближний удар"
          className={`touch-control-surface absolute left-0 bottom-1 w-15 h-15 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
            activeButtons.melee
              ? 'bg-[#FFB000]/45 border-[#FFB000] scale-95 text-white'
              : 'bg-[#090C11]/55 border-[#FFB000]/75 text-[#FDE047]'
          }`}
        >
          <Zap className="w-5 h-5" />
          <span className="text-[10px] font-mono-num font-bold leading-none">УДАР</span>
        </button>

        {/* SHOOT / HOLD AUTO-FIRE (Bottom-Right Primary Anchor — largest hitbox) */}
        <button
          type="button"
          {...bindActionButton('shoot')}
          aria-label="Огонь (удерживайте для стрельбы)"
          className={`touch-control-surface absolute right-0 bottom-0 w-18 h-18 rounded-full border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
            activeButtons.shoot
              ? 'bg-[#39FF14]/45 border-[#39FF14] scale-95 text-white shadow-[0_0_16px_rgba(57,255,20,0.45)]'
              : 'bg-[#090C11]/60 border-[#39FF14]/80 text-[#39FF14]'
          }`}
        >
          <Crosshair className="w-6 h-6" />
          <span className="text-[10px] font-display font-bold tracking-wider leading-none">ОГОНЬ</span>
        </button>
      </div>
    </div>
  );
}
