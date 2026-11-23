import { useEffect, useState } from 'react';
import { HERO_MAP, HERO_PORTRAIT_URLS } from '../game/data';
import { HeroId } from '../game/types';
import { HeroPreviewCanvas } from './HeroPreviewCanvas';

interface HeroCoverPortraitProps {
  heroId: HeroId;
  className?: string;
}

export function HeroCoverPortrait({ heroId, className = '' }: HeroCoverPortraitProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [heroId]);

  if (failed) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#090C11] ${className}`}>
        <HeroPreviewCanvas heroId={heroId} width={110} height={140} scale={2.4} />
      </div>
    );
  }

  return (
    <img
      src={HERO_PORTRAIT_URLS[heroId]}
      alt={HERO_MAP[heroId].name}
      draggable={false}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover object-top block select-none transition-transform duration-200 group-hover:scale-[1.03] ${className}`}
    />
  );
}
