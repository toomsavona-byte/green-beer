# GREEN BEER PIZEDES - Sega Mega Drive 16-bit Vertical Slice Resources (SGDK rescomp)

# Backgrounds & Title Screen
IMAGE title_bg   "gfx/title_bg.png"   FAST
IMAGE bg_sky     "gfx/bg_sky.png"     FAST
IMAGE bg_street  "gfx/bg_street.png"  FAST

# Playable Heroes (32x48 = 4x6 tiles, shared PAL1)
SPRITE spr_vadek "gfx/vadek.png" 4 6 FAST 6
SPRITE spr_zavod "gfx/zavod.png" 4 6 FAST 6

# Enemies & Stage 1 Boss (shared PAL2)
SPRITE spr_drunk       "gfx/drunk.png"       4 6 FAST 7
SPRITE spr_quad_drone  "gfx/quad_drone.png"  4 3 FAST 4
SPRITE spr_boss_barmen "gfx/boss_barmen.png" 6 8 FAST 8

# Projectiles, Explosions & Heal Pickups (16x16 = 2x2 tiles, PAL0)
SPRITE spr_fx "gfx/fx.png" 2 2 FAST 5

# YM2612 + SN76489 Soundtrack (XGM compiled directly from VGM v1.50)
XGM music_title  "sfx/music_title.vgm"  0
XGM music_level1 "sfx/music_level1.vgm" 0
XGM music_boss   "sfx/music_boss.vgm"   0

# 14000 Hz 8-bit PCM Sound Effects (XGM Z80 PCM channels)
WAV sfx_jump      "sfx/sfx_jump.wav"      XGM
WAV sfx_shoot     "sfx/sfx_shoot.wav"     XGM
WAV sfx_pipe      "sfx/sfx_pipe.wav"      XGM
WAV sfx_wheel     "sfx/sfx_wheel.wav"     XGM
WAV sfx_hit       "sfx/sfx_hit.wav"       XGM
WAV sfx_explosion "sfx/sfx_explosion.wav" XGM
WAV sfx_beer      "sfx/sfx_beer.wav"      XGM
