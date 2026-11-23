import { Pause, Volume2, VolumeX } from 'lucide-react';
import { DIFFICULTY_MAP } from '../game/data';
import { HudSnapshot, PlayerHudInfo } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot | null;
  muted: boolean;
  showTouchControls: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

export function GameHud({
  hud,
  muted,
  showTouchControls,
  onToggleMute,
  onPause,
}: GameHudProps) {
  if (!hud) return null;

  const renderPlayerCard = (p: PlayerHudInfo) => {
    const isP1 = p.slot === 1;
    const accent = isP1 ? '#39FF14' : '#00E5FF';

    return (
      <div
        key={p.slot}
        className="bg-[#090C11]/85 border px-2 sm:px-3 py-1.5 sm:py-2 w-[150px] sm:min-w-[230px] sm:max-w-[270px]"
        style={{ borderColor: p.alive ? accent : '#EF4444' }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono-num text-[10px] sm:text-xs font-bold" style={{ color: accent }}>
              P{p.slot}
            </span>
            <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
              {p.heroName}
            </span>
          </div>
          {/* Strictly 3 Lives readout */}
          <div className="flex items-center gap-1 font-mono-num text-[10px] sm:text-xs shrink-0">
            <span className="text-[#94A3B8] hidden sm:inline">ЖИЗНИ</span>
            <span className="font-bold text-[#FFB000]">♥×{p.lives}</span>
          </div>
        </div>

        {/* Strictly 3 HP Segments per Life! */}
        <div className="mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5">
          <span className="font-mono-num text-[9px] sm:text-[10px] text-[#94A3B8] w-5 sm:w-6">HP</span>
          <div className="flex gap-1 flex-1">
            {[1, 2, 3].map((seg) => {
              const filled = seg <= p.hpSegments;
              const color =
                p.hpSegments === 1 ? '#FF2A85' : p.hpSegments === 2 ? '#FFB000' : accent;
              return (
                <div
                  key={seg}
                  className="h-2.5 sm:h-3 flex-1 border border-[#2B3648]"
                  style={{ backgroundColor: filled ? color : '#141A24' }}
                />
              );
            })}
          </div>
          <span className="font-mono-num text-[10px] sm:text-[11px] font-bold text-white w-6 sm:w-7 text-right">
            {p.hpSegments}/3
          </span>
        </div>

        {/* Optional armor toughness pips for tank heroes */}
        {p.maxArmorPips > 0 && (
          <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5">
            <span className="font-mono-num text-[9px] sm:text-[10px] text-[#64748B] w-5 sm:w-6">АРМ</span>
            <div className="flex gap-1 flex-1">
              {Array.from({ length: p.maxArmorPips }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-1 sm:h-1.5 flex-1"
                  style={{
                    backgroundColor: idx < p.armorPips ? '#38BDF8' : '#1E293B',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Weapon & Native +10% Bonus */}
        <div className="mt-1 flex items-center justify-between gap-1.5 text-[10px] sm:text-[11px] font-mono-num">
          <span className="text-[#E6EDF3] truncate">{p.weaponName}</span>
          {p.isNativeWeapon && (
            <span className="text-[#39FF14] font-bold whitespace-nowrap shrink-0">
              +10%
            </span>
          )}
        </div>

        {!p.alive && (
          <div className="mt-0.5 text-[9px] sm:text-[10px] font-mono-num text-[#FF2A85] font-bold">
            ВЫБЫЛ · КОНТИНЬЮ
          </div>
        )}
      </div>
    );
  };

  const bossBar = hud.boss && (
    <div className="w-full max-w-md sm:max-w-xl bg-[#090C11]/90 border border-[#FF2A85] px-3 sm:px-4 py-1.5 sm:py-2">
      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-mono-num mb-1">
        <span className="font-display font-bold text-xs sm:text-sm text-[#FF2A85] tracking-wider truncate">
          {hud.boss.name}
        </span>
        <span className="text-[#FFB000] font-bold whitespace-nowrap shrink-0">
          Ф{hud.boss.phase}/{hud.boss.maxPhases} · {Math.ceil((hud.boss.hp / hud.boss.maxHp) * 100)}%
        </span>
      </div>
      <div className="h-2.5 sm:h-3 w-full bg-[#1E141D] border border-[#4C1D35]">
        <div
          className="h-full bg-[#FF2A85] transition-all duration-100"
          style={{ width: `${Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100))}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2 sm:p-3 safe-area-inset">
      {/* Top Perimeter Cluster */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          {/* P1 Status */}
          <div className="flex items-start gap-2 shrink-0">
            {hud.players[0] && renderPlayerCard(hud.players[0])}
          </div>

          {/* Center Arcade Telemetry: Stage, Continues (3), Score + Pause/Mute */}
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div className="bg-[#090C11]/88 border border-[#2B3648] px-2 sm:px-4 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-3 font-mono-num text-[11px] sm:text-xs">
              <span className="text-[#39FF14] font-bold whitespace-nowrap hidden lg:inline">
                {hud.levelName}
              </span>
              {hud.mode === 'elevator' && (
                <span className="text-[#00E5FF] font-bold whitespace-nowrap">
                  ▲ {String(hud.elevatorFloor ?? 1).padStart(2, '0')}F/88F
                </span>
              )}
              <span aria-hidden="true" className="text-[#475569] hidden lg:inline">·</span>
              <span
                className="font-bold whitespace-nowrap hidden md:inline"
                style={{
                  color:
                    hud.difficulty === 'hard'
                      ? '#FF2A85'
                      : hud.difficulty === 'normal'
                        ? '#FFB000'
                        : '#39FF14',
                }}
              >
                {DIFFICULTY_MAP[hud.difficulty].shortLabel}
              </span>
              <span aria-hidden="true" className="text-[#475569] hidden md:inline">·</span>
              <span className="text-white whitespace-nowrap">
                {hud.totalScore.toString().padStart(7, '0')}
              </span>
              <span aria-hidden="true" className="text-[#475569]">·</span>
              <span className="text-[#FFB000] font-bold whitespace-nowrap">
                C:{hud.continuesLeft}/{hud.maxContinues}
              </span>
              <div className="flex items-center gap-0.5 sm:gap-1.5 pl-1.5 sm:pl-2 border-l border-[#2B3648] pointer-events-auto">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:p-1 flex items-center justify-center text-[#CBD5E1] hover:text-[#39FF14] cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#FF2A85]" /> : <Volume2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={onPause}
                  aria-label="Пауза"
                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:p-1 flex items-center justify-center text-[#CBD5E1] hover:text-[#39FF14] cursor-pointer"
                >
                  <Pause className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>

            {hud.announcement && (
              <div className="mt-1 bg-[#090C11]/92 border border-[#FFB000] px-3 sm:px-4 py-1 sm:py-1.5 font-display font-bold text-xs sm:text-sm text-[#FFB000] tracking-wider text-center">
                {hud.announcement}
              </div>
            )}
          </div>

          {/* P2 Status (when in 2P co-op) */}
          <div className="flex items-start justify-end shrink-0">
            {hud.players[1] ? renderPlayerCard(hud.players[1]) : <div className="hidden lg:block min-w-[230px]" />}
          </div>
        </div>

        {/* When Touch Controls are visible, anchor Boss HP cleanly below top bar so it never collides with thumbs */}
        {showTouchControls && bossBar && (
          <div className="flex justify-center px-2">{bossBar}</div>
        )}
      </div>

      {/* Right-Edge Pulsing GO -> Arrow when zone cleared */}
      {hud.showGoArrow && (
        <div className="self-end mr-2 sm:mr-4 my-auto animate-go-arrow bg-[#090C11]/88 border border-[#39FF14] px-2.5 sm:px-3 py-1 sm:py-1.5 font-display font-bold text-base sm:text-lg text-[#39FF14] tracking-widest">
          GO →
        </div>
      )}

      {/* Desktop Bottom-Center Boss HP Bar */}
      {!showTouchControls && (
        <div className="flex justify-center">
          {bossBar}
        </div>
      )}
    </div>
  );
}
