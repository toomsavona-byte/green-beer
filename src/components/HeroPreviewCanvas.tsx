import { useEffect, useRef } from 'react';
import { HERO_MAP } from '../game/data';
import { drawHeroSprite } from '../game/sprites';
import { HeroId } from '../game/types';

interface HeroPreviewCanvasProps {
  heroId: HeroId;
  width?: number;
  height?: number;
  scale?: number;
  onBike?: boolean;
  onQuadcopter?: boolean;
  animated?: boolean;
  className?: string;
}

export function HeroPreviewCanvas({
  heroId,
  width = 96,
  height = 96,
  scale = 1.6,
  onBike = false,
  onQuadcopter = false,
  animated = true,
  className = '',
}: HeroPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = 2;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = true;

    const hero = HERO_MAP[heroId];
    let rafId = 0;
    const start = performance.now();

    const renderFrame = (now: number) => {
      const t = Math.max(0, (now - start) / 1000);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawHeroSprite(ctx, {
        heroId,
        x: width / 2 - 2,
        y: height * 0.87,
        z: 0,
        facing: 1,
        aimX: 1,
        aimY: 0,
        animTime: animated ? t : 0,
        moving: animated,
        meleeTimer: 0,
        shootTimer: animated && Math.floor(t * 2.5) % 4 === 0 ? 0.1 : 0,
        hurtTimer: 0,
        invulnTimer: 0,
        weaponId: hero.nativeWeaponId,
        onBike,
        onQuadcopter,
        scale: onQuadcopter ? scale * 0.86 : scale,
      });
      ctx.restore();
      if (animated) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame(start);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [heroId, width, height, scale, onBike, onQuadcopter, animated]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`block ${className}`}
    />
  );
}
