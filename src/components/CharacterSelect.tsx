import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { HEROES, LEVEL_MAP, WEAPON_MAP } from '../game/data';
import { soundEngine } from '../game/audio';
import { HeroId, LevelId } from '../game/types';
import { HeroCoverPortrait } from './HeroCoverPortrait';
import { HeroPreviewCanvas } from './HeroPreviewCanvas';

interface CharacterSelectProps {
  players: 1 | 2;
  startLevel: LevelId;
  isTouchDevice: boolean;
  onBack: () => void;
  onConfirm: (selectedHeroes: HeroId[]) => void;
}

export function CharacterSelect({
  players,
  startLevel,
  isTouchDevice,
  onBack,
  onConfirm,
}: CharacterSelectProps) {
  const [p1Idx, setP1Idx] = useState(0);
  const [p2Idx, setP2Idx] = useState(7); // DED default for P2
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);

  const p1Hero = HEROES[p1Idx];
  const p2Hero = HEROES[p2Idx];
  const levelInfo = LEVEL_MAP[startLevel];

  useEffect(() => {
    if (players === 1 && p1Ready) {
      onConfirm([HEROES[p1Idx].id]);
    } else if (players === 2 && p1Ready && p2Ready) {
      onConfirm([HEROES[p1Idx].id, HEROES[p2Idx].id]);
    }
  }, [players, p1Ready, p2Ready, p1Idx, p2Idx, onConfirm]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        soundEngine.playMenuMove();
        onBack();
        return;
      }

      // P1 Navigation (WASD + J / Enter / Space)
      if (!p1Ready) {
        if (e.code === 'KeyD') {
          soundEngine.playMenuMove();
          setP1Idx((i) => (i + 1) % HEROES.length);
        } else if (e.code === 'KeyA') {
          soundEngine.playMenuMove();
          setP1Idx((i) => (i + HEROES.length - 1) % HEROES.length);
        } else if (e.code === 'KeyS') {
          soundEngine.playMenuMove();
          setP1Idx((i) => (i + 4) % HEROES.length);
        } else if (e.code === 'KeyW') {
          soundEngine.playMenuMove();
          setP1Idx((i) => (i + HEROES.length - 4) % HEROES.length);
        } else if (e.code === 'KeyJ' || (players === 1 && (e.code === 'Enter' || e.code === 'Space'))) {
          e.preventDefault();
          soundEngine.playMenuConfirm();
          setP1Ready(true);
        }
      } else if (e.code === 'KeyK') {
        setP1Ready(false);
      }

      // P2 Navigation (Arrows + Numpad1 / Semicolon / Enter)
      if (players === 2) {
        if (!p2Ready) {
          if (e.code === 'ArrowRight') {
            soundEngine.playMenuMove();
            setP2Idx((i) => (i + 1) % HEROES.length);
          } else if (e.code === 'ArrowLeft') {
            soundEngine.playMenuMove();
            setP2Idx((i) => (i + HEROES.length - 1) % HEROES.length);
          } else if (e.code === 'ArrowDown') {
            soundEngine.playMenuMove();
            setP2Idx((i) => (i + 4) % HEROES.length);
          } else if (e.code === 'ArrowUp') {
            soundEngine.playMenuMove();
            setP2Idx((i) => (i + HEROES.length - 4) % HEROES.length);
          } else if (e.code === 'Numpad1' || e.code === 'Semicolon' || (p1Ready && e.code === 'Enter')) {
            e.preventDefault();
            soundEngine.playMenuConfirm();
            setP2Ready(true);
          }
        } else if (e.code === 'Numpad2' || e.code === 'Quote') {
          setP2Ready(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [players, p1Ready, p2Ready, onBack]);

  const renderStatBar = (label: string, val: number, accent: string) => (
    <div key={label} className="flex items-center gap-2 text-xs font-mono-num">
      <span className="w-20 text-[#94A3B8] shrink-0">{label}</span>
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="h-2 flex-1"
            style={{ backgroundColor: n <= val ? accent : '#1E293B' }}
          />
        ))}
      </div>
      <span className="w-6 text-right text-[#E6EDF3]">{val}/5</span>
    </div>
  );

  const renderDetailCard = (
    slot: 1 | 2,
    heroIdx: number,
    ready: boolean,
    onToggleReady: () => void
  ) => {
    const hero = HEROES[heroIdx];
    const weapon = WEAPON_MAP[hero.nativeWeaponId];
    const slotColor = slot === 1 ? '#39FF14' : '#00E5FF';

    return (
      <div
        className="flex-1 bg-[#121822] border-2 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4 min-w-0"
        style={{ borderColor: ready ? slotColor : '#2B3648' }}
      >
        {/* Live animated in-game pixel sprite preview */}
        <div className="bg-[#090C11] border border-[#2B3648] p-1 shrink-0 hidden md:block">
          <HeroPreviewCanvas
            heroId={hero.id}
            width={88}
            height={94}
            scale={1.48}
            onBike={startLevel === 4}
          />
        </div>

        {/* Bio + Weapon */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5 sm:gap-1">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono-num">
            <span className="font-bold" style={{ color: slotColor }}>
              ИГРОК {slot} {ready ? '· ГОТОВ' : ''}
            </span>
            <span aria-hidden="true" className="text-[#475569] hidden sm:inline">·</span>
            <span className="text-[#94A3B8] hidden sm:inline">3 ЖИЗНИ × 3 HP</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-lg sm:text-2xl font-bold text-white leading-none truncate">
              {hero.name}
            </h2>
            <span className="text-[11px] sm:text-xs text-[#94A3B8] truncate hidden sm:inline">{hero.subtitle}</span>
          </div>
          <p className="text-[11px] sm:text-xs text-[#CBD5E1] leading-snug line-clamp-2 hidden sm:block">{hero.bio}</p>
          <div className="text-[11px] sm:text-xs font-mono-num text-[#FFB000] truncate mt-0.5">
            РОДНОЕ (+10%): {weapon.name}
          </div>
        </div>

        {/* 5 Stat Bars */}
        <div className="w-44 shrink-0 hidden xl:flex flex-col gap-1 pl-3 border-l border-[#1E293B]">
          {renderStatBar('Скорость', hero.stats.speed, slotColor)}
          {renderStatBar('Стойкость', hero.stats.hp, slotColor)}
          {renderStatBar('Урон', hero.stats.damage, slotColor)}
          {renderStatBar('Темп', hero.stats.fireRate, slotColor)}
          {renderStatBar(hero.stats.specialLabel, hero.stats.specialValue, '#FFB000')}
        </div>

        {/* Ready CTA */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuConfirm();
            onToggleReady();
          }}
          className="px-3.5 sm:px-4 min-h-[42px] sm:py-2.5 text-xs font-display font-bold tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          style={{
            backgroundColor: ready ? '#1E293B' : slotColor,
            color: ready ? '#E6EDF3' : '#090C11',
          }}
        >
          {ready && <Check className="w-3.5 h-3.5" />}
          {ready ? 'ОТМЕНИТЬ' : `ВЫБРАТЬ P${slot}`}
        </button>
      </div>
    );
  };

  return (
    <div className="w-screen h-[100dvh] bg-[#090C11] text-[#E6EDF3] flex flex-col justify-between p-2.5 sm:p-4 gap-2 sm:gap-3 overflow-hidden safe-area-inset">
      {/* Compact Arcade Top Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 border-b border-[#1E293B] pb-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuMove();
            onBack();
          }}
          className="flex items-center gap-1.5 min-h-[40px] px-2 text-xs font-mono-num text-[#94A3B8] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">НАЗАД (ESC)</span>
          <span className="sm:hidden">НАЗАД</span>
        </button>

        <div className="text-center min-w-0">
          <h1 className="font-display text-base sm:text-2xl font-bold tracking-wider text-[#39FF14] leading-tight truncate">
            ВЫБОР БОЙЦОВ · {players === 1 ? '1P' : '2P CO-OP'}
          </h1>
          <div className="text-[11px] sm:text-xs text-[#94A3B8] font-mono-num truncate hidden sm:block">
            СТАРТ: {levelInfo.name} · {levelInfo.location}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuConfirm();
            if (players === 1) {
              onConfirm([p1Hero.id]);
            } else {
              onConfirm([p1Hero.id, p2Hero.id]);
            }
          }}
          className="px-4 sm:px-6 min-h-[40px] sm:py-2 bg-[#FF2A85] hover:bg-[#FF4696] text-white font-display font-bold text-xs sm:text-sm tracking-widest cursor-pointer whitespace-nowrap shrink-0"
        >
          В БОЙ!
        </button>
      </div>

      {/* LARGE FULL-HEIGHT ARCADE COVER-ART FIGHTER CARDS (Scrollable on phones, full-height 8-col on desktop) */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5 pr-0.5 lg:pr-0">
        {HEROES.map((hero, idx) => {
          const isP1 = p1Idx === idx;
          const isP2 = players === 2 && p2Idx === idx;
          const isSelected = isP1 || isP2;
          const borderColor =
            isP1 && isP2 ? '#FFB000' : isP1 ? '#39FF14' : isP2 ? '#00E5FF' : '#242F40';

          return (
            <button
              key={hero.id}
              type="button"
              onClick={() => {
                soundEngine.playMenuMove();
                if (players === 1 || !p1Ready) {
                  setP1Idx(idx);
                } else {
                  setP2Idx(idx);
                }
              }}
              onDoubleClick={() => {
                soundEngine.playMenuConfirm();
                if (players === 1) {
                  onConfirm([hero.id]);
                } else if (!p1Ready) {
                  setP1Idx(idx);
                  setP1Ready(true);
                } else {
                  setP2Idx(idx);
                  setP2Ready(true);
                }
              }}
              onContextMenu={(e) => {
                if (players === 2) {
                  e.preventDefault();
                  soundEngine.playMenuMove();
                  setP2Idx(idx);
                }
              }}
              className={`group relative aspect-[3/4] lg:aspect-auto lg:h-full w-full overflow-hidden bg-[#0E141D] border-2 text-left transition-transform duration-150 cursor-pointer flex flex-col justify-end ${
                isSelected ? 'scale-[1.015] z-10' : 'opacity-85 hover:opacity-100'
              }`}
              style={{ borderColor }}
            >
              {/* Full-bleed HD Portrait */}
              <div className="absolute inset-0">
                <HeroCoverPortrait heroId={hero.id} />
              </div>

              {/* Crisp bottom scrim for readable arcade nameplate */}
              <div className="absolute inset-x-0 bottom-0 h-24 sm:h-28 bg-gradient-to-t from-[#070A0F] via-[#070A0F]/85 to-transparent pointer-events-none" />

              {/* Top P1 / P2 Selection Flags */}
              {isSelected && (
                <div className="absolute top-2 inset-x-2 flex items-center justify-between font-mono-num text-xs font-bold">
                  {isP1 ? (
                    <span className="px-2 py-0.5 bg-[#39FF14] text-[#090C11]">P1</span>
                  ) : (
                    <span />
                  )}
                  {isP2 && (
                    <span className="px-2 py-0.5 bg-[#00E5FF] text-[#090C11]">P2</span>
                  )}
                </div>
              )}

              {/* Bottom Hero Nameplate & Weapon */}
              <div className="relative z-10 px-2 sm:px-2.5 pb-2 sm:pb-2.5 pt-3">
                <div className="font-display font-bold text-sm sm:text-lg text-white leading-tight tracking-wide truncate">
                  {hero.name}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono-num text-[#FFB000] truncate mt-0.5">
                  {WEAPON_MAP[hero.nativeWeaponId].shortTag}
                </div>
                <div className="text-[10px] sm:text-[11px] text-[#94A3B8] truncate hidden sm:block">
                  {hero.role.split('·')[0].trim()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Selected Hero Inspector Deck */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
        {renderDetailCard(1, p1Idx, p1Ready, () => setP1Ready((r) => !r))}
        {players === 2 && renderDetailCard(2, p2Idx, p2Ready, () => setP2Ready((r) => !r))}
      </div>

      {/* Single flat control hint */}
      <div className="text-center text-[11px] sm:text-xs text-[#94A3B8] font-mono-num shrink-0 hidden sm:block">
        {isTouchDevice
          ? 'Нажмите на карточку бойца для просмотра и нажмите «В БОЙ!» для старта'
          : `P1: WASD + J выбрать (или двойной клик) · ${
              players === 2 ? 'P2: Стрелки + Numpad 1 (;) · ПКМ выбирает P2 · ' : ''
            }Кнопка «В БОЙ!» для мгновенного старта`}
      </div>
    </div>
  );
}
