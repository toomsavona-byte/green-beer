/**
 * GREEN BEER PIZEDES - Sega Mega Drive / Genesis 16-bit Vertical Slice ROM
 * Built with SGDK 2.x (Motorola 68000 @ 7.67 MHz, VDP 320x224, YM2612 + PSG + XGM PCM)
 *
 * Content in this vertical slice:
 * - Title Screen with YM2612 FM theme & mode picker (1P VADEK / 1P ZAVOD KILLER / 2P CO-OP)
 * - Stage 1: BAR "ZAVODNOY" with dual-plane parallax scrolling (BG_B skyline + BG_A street)
 * - Hardware Window HUD (top 3 tile rows: P1/P2 HP, Lives, Score, Zone prompt & Boss HP bar)
 * - 2 Playable Heroes with bespoke melee weapons, ranged fire, jump/melee input buffers:
 *     * VADEK        : Car Wheel melee (28 dmg) + 3-pellet Shotgun
 *     * ZAVOD KILLER : Steel Pipe melee (46 dmg + heavy knockback) + Domna Flame burst
 * - 3 Combat Zones + Dedicated Flying Quadcopter Wave (jump-attack / jump-shoot only!)
 * - Stage 1 Boss: PIVNOY BARMEN (48x64 sprite, bottle throws, rage charge & YM2612 boss theme)
 */

#include <genesis.h>
#include "resources.h"

// ============================================================================
// CONSTANTS & FIXED-POINT HELPERS (1/16 px integer subpixels — blazing on M68k)
// ============================================================================
#define FP_SHIFT        4
#define TO_FP(v)        ((s32)(v) << FP_SHIFT)
#define FROM_FP(v)      ((s16)((v) >> FP_SHIFT))

#define SCREEN_W        320
#define SCREEN_H        224
#define FLOOR_MIN_Y     144
#define FLOOR_MAX_Y     212
#define STAGE_LENGTH    1280

#define MAX_PLAYERS     2
#define MAX_ENEMIES     6
#define MAX_PROJS       14
#define MAX_PICKUPS     4
#define MAX_FX          6

// XGM PCM Sound Effect IDs (64..255 reserved for user SFX)
#define SFX_JUMP        64
#define SFX_SHOOT       65
#define SFX_PIPE        66
#define SFX_WHEEL       67
#define SFX_HIT         68
#define SFX_EXPLOSION   69
#define SFX_BEER        70

// Sprite animation row indices (matching scripts/export-md-assets.mjs)
#define ANIM_HERO_IDLE  0
#define ANIM_HERO_WALK  1
#define ANIM_HERO_JUMP  2
#define ANIM_HERO_MELEE 3
#define ANIM_HERO_SHOOT 4
#define ANIM_HERO_HURT  5

#define ANIM_EN_WALK    0
#define ANIM_EN_ATTACK  1
#define ANIM_EN_HURT    2

#define ANIM_DRONE_FLY  0
#define ANIM_DRONE_HURT 1

#define ANIM_FX_PSHOT   0
#define ANIM_FX_ESHOT   1
#define ANIM_FX_BOOM    2
#define ANIM_FX_PICKUP  3

typedef enum {
    STATE_TITLE = 0,
    STATE_PLAYING,
    STATE_PAUSED,
    STATE_STAGE_CLEAR,
    STATE_GAME_OVER
} GameState;

typedef enum {
    HERO_VADEK = 0,
    HERO_ZAVOD = 1
} HeroKind;

typedef enum {
    ENEMY_DRUNK = 0,
    ENEMY_QUAD_DRONE = 1,
    ENEMY_BOSS_BARMEN = 2
} EnemyKind;

typedef struct {
    bool active;
    bool alive;
    u8 slot;          // 0 = P1, 1 = P2
    HeroKind hero;
    s32 x, y, z;      // World position in fixed-point (FP_SHIFT)
    s16 vx, vy, vz;
    s8 facing;        // 1 = right, -1 = left
    s16 hp;           // 0..3 segments
    s16 lives;        // 0..3 lives
    u32 score;
    u8 shootCd;
    u8 meleeCd;
    u8 meleeTimer;
    u8 shootTimer;
    u8 hurtTimer;
    u8 invulnTimer;
    u8 jumpBuffer;    // 12-frame arcade jump buffer
    u8 meleeBuffer;   // 12-frame arcade melee buffer
    s8 lastAnim;
    Sprite *spr;
} Player;

typedef struct {
    bool active;
    EnemyKind kind;
    s32 x, y, z;
    s16 vx, vy;
    s8 facing;
    s16 hp, maxHp;
    u8 attackCd;
    u8 attackTimer;
    u8 hurtTimer;
    u8 aiTimer;
    s8 lastAnim;
    Sprite *spr;
} Enemy;

typedef struct {
    bool active;
    bool fromPlayer;
    u8 ownerSlot;
    u8 subType;       // 0 = shotgun/bottle, 1 = flame/laser
    s32 x, y, z;
    s16 vx, vy;
    s16 damage;
    u8 life;
    Sprite *spr;
} Projectile;

typedef struct {
    bool active;
    u8 foodFrame;     // 0=Beer, 1=Shawarma, 2=Fries, 3=Pork Knuckle
    s32 x, y;
    u16 life;
    Sprite *spr;
} Pickup;

typedef struct {
    bool active;
    s32 x, y, z;
    u8 timer;
    Sprite *spr;
} BurstFx;

// ============================================================================
// GLOBAL GAME STATE (Zero dynamic allocation during gameplay!)
// ============================================================================
static GameState gState = STATE_TITLE;
static u8 gMenuCursor = 0;       // 0 = 1P VADEK, 1 = 1P ZAVOD KILLER, 2 = 2P CO-OP
static u8 gNumPlayers = 1;
static u16 gFrameCount = 0;

static u16 gPadCurr[2] = { 0, 0 };
static u16 gPadPrev[2] = { 0, 0 };

static s16 gCamX = 0;
static bool gCamLocked = FALSE;
static u8 gZoneIdx = 0;          // 0=Street, 1=Quadcopter Wave, 2=Street 2, 3=Boss
static bool gBossSpawned = FALSE;
static u8 gHitstop = 0;
static u8 gBannerTimer = 0;
static char gBannerText[38];

static Player gPlayers[MAX_PLAYERS];
static Enemy gEnemies[MAX_ENEMIES];
static Projectile gProjs[MAX_PROJS];
static Pickup gPickups[MAX_PICKUPS];
static BurstFx gFx[MAX_FX];

static u16 gHudRefreshTick = 0;

// ============================================================================
// HELPERS
// ============================================================================
static inline s16 iabs16(s16 v) {
    return (v < 0) ? -v : v;
}

static inline u16 padJustPressed(u8 slot, u16 mask) {
    return (gPadCurr[slot] & mask) && !(gPadPrev[slot] & mask);
}

static void playSfx(u8 id, u8 priority, u16 ch) {
    XGM_startPlayPCM(id, priority, ch);
}

static void setBanner(const char *msg, u8 frames) {
    strncpy(gBannerText, msg, 36);
    gBannerText[36] = '\0';
    gBannerTimer = frames;
    gHudRefreshTick = 0;
}

static void clearAllEntities(void) {
    u8 i;
    for (i = 0; i < MAX_PLAYERS; i++) {
        if (gPlayers[i].spr) { SPR_releaseSprite(gPlayers[i].spr); gPlayers[i].spr = NULL; }
        gPlayers[i].active = FALSE;
    }
    for (i = 0; i < MAX_ENEMIES; i++) {
        if (gEnemies[i].spr) { SPR_releaseSprite(gEnemies[i].spr); gEnemies[i].spr = NULL; }
        gEnemies[i].active = FALSE;
    }
    for (i = 0; i < MAX_PROJS; i++) {
        if (gProjs[i].spr) { SPR_releaseSprite(gProjs[i].spr); gProjs[i].spr = NULL; }
        gProjs[i].active = FALSE;
    }
    for (i = 0; i < MAX_PICKUPS; i++) {
        if (gPickups[i].spr) { SPR_releaseSprite(gPickups[i].spr); gPickups[i].spr = NULL; }
        gPickups[i].active = FALSE;
    }
    for (i = 0; i < MAX_FX; i++) {
        if (gFx[i].spr) { SPR_releaseSprite(gFx[i].spr); gFx[i].spr = NULL; }
        gFx[i].active = FALSE;
    }
}

static void spawnBurst(s32 x, s32 y, s32 z) {
    u8 i;
    for (i = 0; i < MAX_FX; i++) {
        if (!gFx[i].active) {
            gFx[i].active = TRUE;
            gFx[i].x = x;
            gFx[i].y = y;
            gFx[i].z = z;
            gFx[i].timer = 15;
            gFx[i].spr = SPR_addSprite(&spr_fx, FROM_FP(x) - gCamX - 8, FROM_FP(y - z) - 8,
                                       TILE_ATTR(PAL0, TRUE, FALSE, FALSE));
            if (gFx[i].spr) {
                SPR_setAnimAndFrame(gFx[i].spr, ANIM_FX_BOOM, 0);
                SPR_setDepth(gFx[i].spr, SPR_MIN_DEPTH);
            }
            return;
        }
    }
}

static void spawnPickup(s32 x, s32 y, u8 foodFrame) {
    u8 i;
    for (i = 0; i < MAX_PICKUPS; i++) {
        if (!gPickups[i].active) {
            gPickups[i].active = TRUE;
            gPickups[i].foodFrame = foodFrame & 3;
            gPickups[i].x = x;
            gPickups[i].y = y;
            gPickups[i].life = 600; // 10 seconds
            gPickups[i].spr = SPR_addSprite(&spr_fx, FROM_FP(x) - gCamX - 8, FROM_FP(y) - 14,
                                            TILE_ATTR(PAL0, TRUE, FALSE, FALSE));
            if (gPickups[i].spr) {
                SPR_setAnimAndFrame(gPickups[i].spr, ANIM_FX_PICKUP, gPickups[i].foodFrame);
            }
            return;
        }
    }
}

static void spawnProjectile(bool fromPlayer, u8 ownerSlot, u8 subType,
                            s32 x, s32 y, s32 z, s16 vx, s16 vy, s16 dmg, u8 life) {
    u8 i;
    for (i = 0; i < MAX_PROJS; i++) {
        if (!gProjs[i].active) {
            gProjs[i].active = TRUE;
            gProjs[i].fromPlayer = fromPlayer;
            gProjs[i].ownerSlot = ownerSlot;
            gProjs[i].subType = subType;
            gProjs[i].x = x;
            gProjs[i].y = y;
            gProjs[i].z = z;
            gProjs[i].vx = vx;
            gProjs[i].vy = vy;
            gProjs[i].damage = dmg;
            gProjs[i].life = life;
            gProjs[i].spr = SPR_addSprite(&spr_fx, FROM_FP(x) - gCamX - 8, FROM_FP(y - z) - 8,
                                          TILE_ATTR(PAL0, TRUE, FALSE, FALSE));
            if (gProjs[i].spr) {
                SPR_setAnimAndFrame(gProjs[i].spr, fromPlayer ? ANIM_FX_PSHOT : ANIM_FX_ESHOT, subType & 1);
            }
            return;
        }
    }
}

static void spawnEnemy(EnemyKind kind, s16 worldX, s16 worldY) {
    u8 i;
    for (i = 0; i < MAX_ENEMIES; i++) {
        if (!gEnemies[i].active) {
            Enemy *e = &gEnemies[i];
            e->active = TRUE;
            e->kind = kind;
            e->x = TO_FP(worldX);
            e->y = TO_FP(worldY);
            e->z = (kind == ENEMY_QUAD_DRONE) ? TO_FP(36) : 0;
            e->vx = 0;
            e->vy = 0;
            e->facing = -1;
            e->attackCd = 35 + (random() & 31);
            e->attackTimer = 0;
            e->hurtTimer = 0;
            e->aiTimer = (u8)(random() & 63);
            e->lastAnim = -1;

            if (kind == ENEMY_BOSS_BARMEN) {
                e->maxHp = (gNumPlayers == 2) ? 460 : 320;
                e->spr = SPR_addSprite(&spr_boss_barmen, worldX - gCamX - 24, worldY - 60,
                                       TILE_ATTR(PAL2, TRUE, FALSE, FALSE));
            } else if (kind == ENEMY_QUAD_DRONE) {
                e->maxHp = (gNumPlayers == 2) ? 64 : 46;
                e->spr = SPR_addSprite(&spr_quad_drone, worldX - gCamX - 16, worldY - 52,
                                       TILE_ATTR(PAL2, TRUE, FALSE, FALSE));
            } else {
                e->maxHp = (gNumPlayers == 2) ? 82 : 58;
                e->spr = SPR_addSprite(&spr_drunk, worldX - gCamX - 16, worldY - 46,
                                       TILE_ATTR(PAL2, TRUE, FALSE, FALSE));
            }
            e->hp = e->maxHp;
            return;
        }
    }
}

static u8 countActiveEnemies(void) {
    u8 i, cnt = 0;
    for (i = 0; i < MAX_ENEMIES; i++) {
        if (gEnemies[i].active) cnt++;
    }
    return cnt;
}

static Enemy* findActiveBoss(void) {
    u8 i;
    for (i = 0; i < MAX_ENEMIES; i++) {
        if (gEnemies[i].active && gEnemies[i].kind == ENEMY_BOSS_BARMEN) {
            return &gEnemies[i];
        }
    }
    return NULL;
}

// ============================================================================
// WINDOW HUD (Hardware Non-Scrolling Top 3 Tile Rows — 40 chars wide)
// ============================================================================
static void drawHud(void) {
    char line[42];
    const char *hpBars[4] = { "...", "|..", "||.", "|||" };

    // Row 0: P1 & P2 Status
    const char *p1Name = (gPlayers[0].hero == HERO_ZAVOD) ? "ZAVOD" : "VADEK";
    if (gNumPlayers == 2) {
        const char *p2Name = (gPlayers[1].hero == HERO_ZAVOD) ? "ZAVOD" : "VADEK";
        sprintf(line, "P1:%s [%s] L%d  P2:%s [%s] L%d ",
                p1Name, hpBars[gPlayers[0].hp < 0 ? 0 : gPlayers[0].hp], gPlayers[0].lives,
                p2Name, hpBars[gPlayers[1].hp < 0 ? 0 : gPlayers[1].hp], gPlayers[1].lives);
    } else {
        sprintf(line, "P1:%s HP[%s] L:%d  SCR:%06lu        ",
                p1Name, hpBars[gPlayers[0].hp < 0 ? 0 : gPlayers[0].hp],
                gPlayers[0].lives, (unsigned long)gPlayers[0].score);
    }
    VDP_drawTextBG(WINDOW, line, 1, 0);

    // Row 1: Boss HP Bar OR Banner / Stage Status
    Enemy *boss = findActiveBoss();
    if (boss) {
        s16 blocks = (s16)(((s32)boss->hp * 16) / boss->maxHp);
        if (blocks < 1 && boss->hp > 0) blocks = 1;
        char bar[17];
        s16 b;
        for (b = 0; b < 16; b++) bar[b] = (b < blocks) ? '#' : '-';
        bar[16] = '\0';
        sprintf(line, "BOSS BARMEN [%s] %03dHP  ", bar, boss->hp);
        VDP_drawTextBG(WINDOW, line, 1, 1);
    } else if (gBannerTimer > 0) {
        sprintf(line, "%-38s", gBannerText);
        VDP_drawTextBG(WINDOW, line, 1, 1);
    } else {
        const char *prompt = gCamLocked ? "CLEAR WAVE!" : "GO RIGHT ->";
        sprintf(line, "STAGE 1: BAR ZAVODNOY   %-14s", prompt);
        VDP_drawTextBG(WINDOW, line, 1, 1);
    }

    // Row 2: Controls Strip (or 2P Score)
    if (gNumPlayers == 2) {
        sprintf(line, "SCORE: %06lu   A:HIT B:GUN C:JUMP   ",
                (unsigned long)(gPlayers[0].score + gPlayers[1].score));
    } else {
        const char *meleeHint = (gPlayers[0].hero == HERO_ZAVOD) ? "A:PIPE(46)" : "A:WHEEL(28)";
        sprintf(line, "%s B:SHOOT C:JUMP ST:PAUSE ", meleeHint);
    }
    VDP_drawTextBG(WINDOW, line, 1, 2);
}

// ============================================================================
// SCREEN TRANSITIONS
// ============================================================================
static void enterTitleScreen(void) {
    gState = STATE_TITLE;
    XGM_stopPlay();
    clearAllEntities();
    SPR_update();

    VDP_setWindowVPos(FALSE, 0); // Hide Window HUD on title screen
    VDP_setHorizontalScroll(BG_A, 0);
    VDP_setHorizontalScroll(BG_B, 0);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    VDP_clearPlane(WINDOW, TRUE);

    PAL_setPalette(PAL0, title_bg.palette->data, DMA);
    VDP_drawImageEx(BG_B, &title_bg, TILE_ATTR_FULL(PAL0, FALSE, FALSE, FALSE, TILE_USER_INDEX), 0, 0, FALSE, TRUE);

    VDP_setTextPlane(BG_A);
    VDP_setTextPalette(PAL0);
    VDP_drawTextBG(BG_A, "GREEN BEER PIZEDES", 11, 5);
    VDP_drawTextBG(BG_A, "16-BIT MEGA DRIVE EDITION", 7, 7);
    VDP_drawTextBG(BG_A, "VERTICAL SLICE TEST ROM", 8, 9);

    VDP_drawTextBG(BG_A, "A:MELEE  B:SHOOT  C:JUMP", 8, 22);
    VDP_drawTextBG(BG_A, "PRESS START TO PLAY", 10, 24);

    XGM_startPlay(music_title);
}

static void drawTitleMenuOptions(void) {
    VDP_drawTextBG(BG_A, gMenuCursor == 0 ? "> 1P: VADEK (WHEEL + SHOTGUN)  " : "  1P: VADEK (WHEEL + SHOTGUN)  ", 4, 14);
    VDP_drawTextBG(BG_A, gMenuCursor == 1 ? "> 1P: ZAVOD KILLER (PIPE+FLAME)" : "  1P: ZAVOD KILLER (PIPE+FLAME)", 4, 16);
    VDP_drawTextBG(BG_A, gMenuCursor == 2 ? "> 2P CO-OP: VADEK + ZAVOD      " : "  2P CO-OP: VADEK + ZAVOD      ", 4, 18);
}

static void startStage1(void) {
    u16 ind = TILE_USER_INDEX;
    u8 i;

    gState = STATE_PLAYING;
    gCamX = 0;
    gCamLocked = FALSE;
    gZoneIdx = 0;
    gBossSpawned = FALSE;
    gHitstop = 0;
    gHudRefreshTick = 0;

    XGM_stopPlay();
    clearAllEntities();

    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    VDP_clearPlane(WINDOW, TRUE);

    // Load all 4 coordinated 16-color Mega Drive palettes
    PAL_setPalette(PAL0, spr_fx.palette->data, DMA);
    PAL_setPalette(PAL1, spr_vadek.palette->data, DMA);
    PAL_setPalette(PAL2, spr_drunk.palette->data, DMA);
    PAL_setPalette(PAL3, bg_sky.palette->data, DMA);

    // Draw seamless 64-tile (512px) wrapping BG_B (skyline) & BG_A (street)
    VDP_drawImageEx(BG_B, &bg_sky, TILE_ATTR_FULL(PAL3, FALSE, FALSE, FALSE, ind), 0, 0, FALSE, TRUE);
    ind += bg_sky.tileset->numTile;
    VDP_drawImageEx(BG_A, &bg_street, TILE_ATTR_FULL(PAL3, FALSE, FALSE, FALSE, ind), 0, 0, FALSE, TRUE);

    VDP_setHorizontalScroll(BG_A, 0);
    VDP_setHorizontalScroll(BG_B, 0);

    // Enable hardware non-scrolling Window HUD on top 3 tile rows (24 px)
    VDP_setWindowVPos(FALSE, 3);
    VDP_setTextPlane(WINDOW);
    VDP_setTextPalette(PAL0);

    // Initialize Players (1P or simultaneous 2P Co-Op!)
    gNumPlayers = (gMenuCursor == 2) ? 2 : 1;
    for (i = 0; i < gNumPlayers; i++) {
        Player *p = &gPlayers[i];
        p->active = TRUE;
        p->alive = TRUE;
        p->slot = i;
        if (gNumPlayers == 1) {
            p->hero = (gMenuCursor == 1) ? HERO_ZAVOD : HERO_VADEK;
        } else {
            p->hero = (i == 0) ? HERO_VADEK : HERO_ZAVOD;
        }
        p->x = TO_FP(56 + i * 24);
        p->y = TO_FP(168 + i * 22);
        p->z = 0;
        p->vx = 0;
        p->vy = 0;
        p->vz = 0;
        p->facing = 1;
        p->hp = 3;
        p->lives = 3;
        p->score = 0;
        p->shootCd = 0;
        p->meleeCd = 0;
        p->meleeTimer = 0;
        p->shootTimer = 0;
        p->hurtTimer = 0;
        p->invulnTimer = 60;
        p->jumpBuffer = 0;
        p->meleeBuffer = 0;
        p->lastAnim = -1;
        p->spr = SPR_addSprite(
            (p->hero == HERO_ZAVOD) ? &spr_zavod : &spr_vadek,
            FROM_FP(p->x) - 16,
            FROM_FP(p->y) - 46,
            TILE_ATTR(PAL1, TRUE, FALSE, FALSE)
        );
    }

    setBanner("STAGE 1: BAR ZAVODNOY - FIGHT!", 150);
    drawHud();
    XGM_startPlay(music_level1);
}

// ============================================================================
// COMBAT & DAMAGE HELPERS
// ============================================================================
static void damageEnemy(Enemy *e, s16 dmg, u8 attackerSlot, s16 knockX) {
    if (!e->active) return;
    e->hp -= dmg;
    e->hurtTimer = 12;
    e->x += TO_FP(knockX);
    if (e->x < TO_FP(gCamX + 16)) e->x = TO_FP(gCamX + 16);
    if (e->x > TO_FP(gCamX + SCREEN_W - 16)) e->x = TO_FP(gCamX + SCREEN_W - 16);

    gHitstop = (dmg >= 36) ? 3 : 2;
    playSfx(SFX_HIT, 4, SOUND_PCM_CH3);

    if (e->hp <= 0) {
        bool wasBoss = (e->kind == ENEMY_BOSS_BARMEN);
        s32 dx = e->x;
        s32 dy = e->y;
        s32 dz = e->z;
        e->active = FALSE;
        if (e->spr) {
            SPR_releaseSprite(e->spr);
            e->spr = NULL;
        }
        spawnBurst(dx, dy, dz + TO_FP(16));
        playSfx(SFX_EXPLOSION, 8, SOUND_PCM_CH4);

        if (attackerSlot < MAX_PLAYERS) {
            gPlayers[attackerSlot].score += wasBoss ? 5000 : (e->kind == ENEMY_QUAD_DRONE ? 350 : 200);
        }

        if (wasBoss) {
            gState = STATE_STAGE_CLEAR;
            XGM_startPlay(music_title);
            VDP_drawTextBG(WINDOW, "   STAGE 1 CLEAR! BOSS DEFEATED!      ", 1, 1);
            VDP_drawTextBG(WINDOW, "      PRESS START FOR TITLE MENU      ", 1, 2);
        } else if ((random() & 3) == 0) {
            // Drop Beer / Shawarma / Fries / Pork Knuckle heal!
            spawnPickup(dx, dy, (u8)(random() & 3));
        }
        gHudRefreshTick = 0;
    }
}

static void damagePlayer(Player *p, s16 dmg) {
    if (!p->active || !p->alive || p->invulnTimer > 0) return;
    p->hp -= dmg;
    p->hurtTimer = 16;
    p->invulnTimer = 65;
    gHitstop = 3;
    playSfx(SFX_HIT, 6, SOUND_PCM_CH3);

    if (p->hp <= 0) {
        p->lives--;
        if (p->lives > 0) {
            p->hp = 3;
            p->z = TO_FP(64);
            p->vz = 0;
            p->jumpBuffer = 0;
            p->meleeBuffer = 0;
            p->invulnTimer = 120;
            setBanner("RESPAWN! WATCH OUT!", 90);
        } else {
            p->alive = FALSE;
            if (p->spr) SPR_setVisibility(p->spr, HIDDEN);
        }
    }
    gHudRefreshTick = 0;
}

// ============================================================================
// PLAYER UPDATE (Fixed-Point + 12-frame Jump & Melee Buffers + Gravity First!)
// ============================================================================
static void updatePlayer(Player *p) {
    if (!p->active || !p->alive) return;

    u16 pad = gPadCurr[p->slot];
    bool jumpEdge = padJustPressed(p->slot, BUTTON_C) != 0;
    bool jumpHeld = (pad & BUTTON_C) != 0;
    bool meleeEdge = padJustPressed(p->slot, BUTTON_A) != 0;
    bool meleeHeld = (pad & BUTTON_A) != 0;
    bool shootHeld = (pad & BUTTON_B) != 0;

    if (p->shootCd > 0) p->shootCd--;
    if (p->meleeCd > 0) p->meleeCd--;
    if (p->meleeTimer > 0) p->meleeTimer--;
    if (p->shootTimer > 0) p->shootTimer--;
    if (p->hurtTimer > 0) p->hurtTimer--;
    if (p->invulnTimer > 0) p->invulnTimer--;
    if (p->jumpBuffer > 0) p->jumpBuffer--;
    if (p->meleeBuffer > 0) p->meleeBuffer--;

    if (jumpEdge) p->jumpBuffer = 12;
    if (meleeEdge) p->meleeBuffer = 12;

    // 1. Movement (Vadek faster, Zavod Killer heavier)
    s16 moveSpdX = (p->hero == HERO_ZAVOD) ? 20 : 26; // 1.25 vs 1.625 px/frame
    s16 moveSpdY = (p->hero == HERO_ZAVOD) ? 14 : 18;
    p->vx = 0;
    p->vy = 0;
    if (pad & BUTTON_LEFT)  { p->vx = -moveSpdX; p->facing = -1; }
    if (pad & BUTTON_RIGHT) { p->vx =  moveSpdX; p->facing =  1; }
    if (pad & BUTTON_UP)    { p->vy = -moveSpdY; }
    if (pad & BUTTON_DOWN)  { p->vy =  moveSpdY; }

    p->x += p->vx;
    p->y += p->vy;

    // Clamp to screen camera and street lane
    s32 minX = TO_FP(gCamX + 18);
    s32 maxX = TO_FP(gCamX + SCREEN_W - 18);
    if (p->x < minX) p->x = minX;
    if (p->x > maxX) p->x = maxX;
    if (p->y < TO_FP(FLOOR_MIN_Y)) p->y = TO_FP(FLOOR_MIN_Y);
    if (p->y > TO_FP(FLOOR_MAX_Y)) p->y = TO_FP(FLOOR_MAX_Y);

    // 2. Vertical Physics & Landing FIRST so landing-frame jumps NEVER drop!
    if (p->z > 0 || p->vz > 0) {
        p->z += p->vz;
        p->vz -= 4; // Gravity (-0.25 px/frame^2)
        if (p->z <= 0) {
            p->z = 0;
            p->vz = 0;
        }
    }
    if ((p->jumpBuffer > 0 || jumpHeld) && p->z <= 2) {
        p->vz = 68; // Crisp 4.25 px/frame jump velocity (~58px peak — easily reaches quadcopters!)
        p->z = p->vz;
        p->vz -= 4;
        p->jumpBuffer = 0;
        playSfx(SFX_JUMP, 3, SOUND_PCM_CH2);
    }

    // 3. Melee Attack (with 12-frame buffer + hold-to-combo!)
    if ((p->meleeBuffer > 0 || meleeHeld) && p->meleeCd == 0) {
        bool isZavod = (p->hero == HERO_ZAVOD);
        s16 meleeDmg = isZavod ? 46 : 28;
        s16 reach = isZavod ? 42 : 34;
        s16 knock = isZavod ? 14 : 8;
        u8 i;

        p->meleeBuffer = 0;
        p->meleeCd = isZavod ? 20 : 17;
        p->meleeTimer = 15;
        playSfx(isZavod ? SFX_PIPE : SFX_WHEEL, 6, SOUND_PCM_CH2);

        for (i = 0; i < MAX_ENEMIES; i++) {
            Enemy *e = &gEnemies[i];
            if (!e->active) continue;
            s16 relX = (FROM_FP(e->x - p->x)) * p->facing;
            s16 relY = iabs16(FROM_FP(e->y - p->y));
            if (relX > -10 && relX < reach && relY < 22) {
                if (e->kind == ENEMY_QUAD_DRONE) {
                    if (FROM_FP(p->z) >= 8) {
                        damageEnemy(e, meleeDmg, p->slot, knock * p->facing);
                    } else {
                        setBanner("JUMP TO HIT QUADCOPTERS!", 70);
                    }
                } else {
                    damageEnemy(e, meleeDmg, p->slot, knock * p->facing);
                }
            }
        }
    }

    // 4. Ranged Weapon (Hold B to fire — Shotgun 3-pellet for Vadek, Domna Flame for Zavod)
    if (shootHeld && p->shootCd == 0) {
        bool isZavod = (p->hero == HERO_ZAVOD);
        s32 muzzleX = p->x + TO_FP(14 * p->facing);
        s32 shotZ = p->z + TO_FP(20);
        p->shootTimer = 8;
        playSfx(SFX_SHOOT, 4, SOUND_PCM_CH2);

        if (isZavod) {
            // Domna Flame burst
            p->shootCd = 16;
            spawnProjectile(TRUE, p->slot, 1, muzzleX, p->y, shotZ, 72 * p->facing, 0, 22, 26);
        } else {
            // Vadek 3-pellet Shotgun spread
            p->shootCd = 24;
            spawnProjectile(TRUE, p->slot, 0, muzzleX, p->y, shotZ, 84 * p->facing, -12, 12, 22);
            spawnProjectile(TRUE, p->slot, 0, muzzleX, p->y, shotZ, 88 * p->facing,   0, 14, 22);
            spawnProjectile(TRUE, p->slot, 0, muzzleX, p->y, shotZ, 84 * p->facing,  12, 12, 22);
        }
    }

    // 5. Update Hardware Sprite Position, Flip, Animation & Invuln Blink
    if (p->spr) {
        s8 anim = ANIM_HERO_IDLE;
        if (p->hurtTimer > 0) anim = ANIM_HERO_HURT;
        else if (p->meleeTimer > 0) anim = ANIM_HERO_MELEE;
        else if (p->z > 0) anim = ANIM_HERO_JUMP;
        else if (p->shootTimer > 0) anim = ANIM_HERO_SHOOT;
        else if (p->vx != 0 || p->vy != 0) anim = ANIM_HERO_WALK;

        if (anim != p->lastAnim) {
            SPR_setAnim(p->spr, anim);
            p->lastAnim = anim;
        }
        SPR_setHFlip(p->spr, p->facing < 0);
        SPR_setPosition(p->spr, FROM_FP(p->x) - gCamX - 16, FROM_FP(p->y - p->z) - 46);
        SPR_setDepth(p->spr, (s16)(300 - FROM_FP(p->y)));
        SPR_setVisibility(p->spr, (p->invulnTimer > 0 && (gFrameCount & 2)) ? HIDDEN : VISIBLE);
    }
}

// ============================================================================
// ENEMY & BOSS AI
// ============================================================================
static Player* findNearestPlayer(s32 ex, s32 ey) {
    Player *best = NULL;
    s32 bestDist = 0x7FFFFFFF;
    u8 i;
    for (i = 0; i < gNumPlayers; i++) {
        if (!gPlayers[i].active || !gPlayers[i].alive) continue;
        s32 d = (s32)iabs16(FROM_FP(gPlayers[i].x - ex)) + (s32)iabs16(FROM_FP(gPlayers[i].y - ey));
        if (d < bestDist) {
            bestDist = d;
            best = &gPlayers[i];
        }
    }
    return best;
}

static void updateEnemies(void) {
    u8 i;
    for (i = 0; i < MAX_ENEMIES; i++) {
        Enemy *e = &gEnemies[i];
        if (!e->active) continue;

        if (e->hurtTimer > 0) e->hurtTimer--;
        if (e->attackTimer > 0) e->attackTimer--;
        if (e->attackCd > 0) e->attackCd--;
        e->aiTimer++;

        Player *target = findNearestPlayer(e->x, e->y);
        if (target && e->hurtTimer == 0) {
            s16 dx = FROM_FP(target->x - e->x);
            s16 dy = FROM_FP(target->y - e->y);
            e->facing = (dx >= 0) ? 1 : -1;

            if (e->kind == ENEMY_QUAD_DRONE) {
                // Flying quadcopter hovers overhead at z=36..44 and fires laser bolts!
                s16 bob = ((e->aiTimer & 31) < 16) ? (s16)(e->aiTimer & 15) : (s16)(16 - (e->aiTimer & 15));
                e->z = TO_FP(34 + (bob >> 1));
                if (iabs16(dx) > 68) e->x += (dx > 0) ? 14 : -14;
                if (iabs16(dy) > 10) e->y += (dy > 0) ? 10 : -10;
                if (e->attackCd == 0 && iabs16(dx) < 160) {
                    e->attackCd = 82 + (random() & 31);
                    spawnProjectile(FALSE, 0, 1, e->x, e->y, TO_FP(18), 52 * e->facing, (dy > 14 ? 8 : dy < -14 ? -8 : 0), 1, 65);
                }
            } else if (e->kind == ENEMY_BOSS_BARMEN) {
                // Stage 1 Boss: charges toward player and hurls radioactive green beer bottles!
                s16 spd = (e->hp < (e->maxHp >> 1)) ? 16 : 12;
                if (iabs16(dx) > 30) e->x += (dx > 0) ? spd : -spd;
                if (iabs16(dy) > 6)  e->y += (dy > 0) ? 10 : -10;

                if (e->attackCd == 0) {
                    if (iabs16(dx) < 38 && iabs16(dy) < 18) {
                        // Heavy melee keg smash
                        e->attackTimer = 18;
                        e->attackCd = 45;
                        if (FROM_FP(target->z) < 22) {
                            damagePlayer(target, 1);
                        }
                    } else {
                        // Throw green beer bottle volley!
                        e->attackTimer = 20;
                        e->attackCd = (e->hp < (e->maxHp >> 1)) ? 55 : 78;
                        spawnProjectile(FALSE, 0, 0, e->x + TO_FP(14 * e->facing), e->y, TO_FP(22), 54 * e->facing, 0, 1, 75);
                        if (e->hp < (e->maxHp >> 1)) {
                            spawnProjectile(FALSE, 0, 0, e->x + TO_FP(14 * e->facing), e->y, TO_FP(22), 50 * e->facing, 12, 1, 75);
                            spawnProjectile(FALSE, 0, 0, e->x + TO_FP(14 * e->facing), e->y, TO_FP(22), 50 * e->facing, -12, 1, 75);
                        }
                    }
                }
            } else {
                // Street Drunk Punk
                if (iabs16(dx) > 22) e->x += (dx > 0) ? 12 : -12;
                if (iabs16(dy) > 6)  e->y += (dy > 0) ? 8 : -8;
                if (e->attackCd == 0 && iabs16(dx) < 28 && iabs16(dy) < 16) {
                    e->attackTimer = 16;
                    e->attackCd = 58 + (random() & 15);
                    if (FROM_FP(target->z) < 18) {
                        damagePlayer(target, 1);
                    }
                }
            }
        }

        if (e->y < TO_FP(FLOOR_MIN_Y)) e->y = TO_FP(FLOOR_MIN_Y);
        if (e->y > TO_FP(FLOOR_MAX_Y)) e->y = TO_FP(FLOOR_MAX_Y);

        if (e->spr) {
            s8 anim;
            if (e->kind == ENEMY_QUAD_DRONE) {
                anim = (e->hurtTimer > 0) ? ANIM_DRONE_HURT : ANIM_DRONE_FLY;
            } else {
                anim = (e->hurtTimer > 0) ? ANIM_EN_HURT : (e->attackTimer > 0 ? ANIM_EN_ATTACK : ANIM_EN_WALK);
            }
            if (anim != e->lastAnim) {
                SPR_setAnim(e->spr, anim);
                e->lastAnim = anim;
            }
            SPR_setHFlip(e->spr, e->facing < 0);
            s16 ox = (e->kind == ENEMY_BOSS_BARMEN) ? 24 : 16;
            s16 oy = (e->kind == ENEMY_BOSS_BARMEN) ? 60 : (e->kind == ENEMY_QUAD_DRONE ? 20 : 46);
            SPR_setPosition(e->spr, FROM_FP(e->x) - gCamX - ox, FROM_FP(e->y - e->z) - oy);
            SPR_setDepth(e->spr, (s16)(300 - FROM_FP(e->y)));
        }
    }
}

// ============================================================================
// PROJECTILES, PICKUPS & EXPLOSION FX
// ============================================================================
static void updateProjectiles(void) {
    u8 i, j;
    for (i = 0; i < MAX_PROJS; i++) {
        Projectile *pr = &gProjs[i];
        if (!pr->active) continue;

        pr->x += pr->vx;
        pr->y += pr->vy;
        pr->life--;

        s16 sx = FROM_FP(pr->x) - gCamX;
        bool dead = (pr->life == 0 || sx < -16 || sx > SCREEN_W + 16);

        if (!dead && pr->fromPlayer) {
            for (j = 0; j < MAX_ENEMIES; j++) {
                Enemy *e = &gEnemies[j];
                if (!e->active) continue;
                s16 hitW = (e->kind == ENEMY_BOSS_BARMEN) ? 24 : 16;
                if (iabs16(FROM_FP(pr->x - e->x)) < hitW && iabs16(FROM_FP(pr->y - e->y)) < 18) {
                    // Flying quadcopters hover high — ground shots pass underneath! Must jump to shoot!
                    if (e->kind == ENEMY_QUAD_DRONE && FROM_FP(pr->z) < 28) {
                        continue;
                    }
                    damageEnemy(e, pr->damage, pr->ownerSlot, (pr->vx >= 0) ? 4 : -4);
                    dead = TRUE;
                    break;
                }
            }
        } else if (!dead && !pr->fromPlayer) {
            for (j = 0; j < gNumPlayers; j++) {
                Player *p = &gPlayers[j];
                if (!p->active || !p->alive) continue;
                if (iabs16(FROM_FP(pr->x - p->x)) < 14 &&
                    iabs16(FROM_FP(pr->y - p->y)) < 14 &&
                    FROM_FP(p->z) < 26) {
                    damagePlayer(p, pr->damage);
                    dead = TRUE;
                    break;
                }
            }
        }

        if (dead) {
            pr->active = FALSE;
            if (pr->spr) { SPR_releaseSprite(pr->spr); pr->spr = NULL; }
        } else if (pr->spr) {
            SPR_setPosition(pr->spr, sx - 8, FROM_FP(pr->y - pr->z) - 8);
            SPR_setDepth(pr->spr, (s16)(295 - FROM_FP(pr->y)));
        }
    }
}

static void updatePickupsAndFx(void) {
    u8 i, j;
    for (i = 0; i < MAX_PICKUPS; i++) {
        Pickup *pk = &gPickups[i];
        if (!pk->active) continue;
        pk->life--;

        bool consumed = (pk->life == 0);
        if (!consumed) {
            for (j = 0; j < gNumPlayers; j++) {
                Player *p = &gPlayers[j];
                if (!p->active || !p->alive) continue;
                if (iabs16(FROM_FP(pk->x - p->x)) < 18 && iabs16(FROM_FP(pk->y - p->y)) < 16) {
                    if (p->hp < 3) p->hp++;
                    p->score += 250;
                    playSfx(SFX_BEER, 5, SOUND_PCM_CH3);
                    setBanner("HEALED +1 HP! DELICIOUS!", 75);
                    consumed = TRUE;
                    break;
                }
            }
        }

        if (consumed) {
            pk->active = FALSE;
            if (pk->spr) { SPR_releaseSprite(pk->spr); pk->spr = NULL; }
        } else if (pk->spr) {
            SPR_setPosition(pk->spr, FROM_FP(pk->x) - gCamX - 8, FROM_FP(pk->y) - 14);
            SPR_setDepth(pk->spr, (s16)(300 - FROM_FP(pk->y)));
            SPR_setVisibility(pk->spr, (pk->life < 90 && (gFrameCount & 4)) ? HIDDEN : VISIBLE);
        }
    }

    for (i = 0; i < MAX_FX; i++) {
        BurstFx *fx = &gFx[i];
        if (!fx->active) continue;
        fx->timer--;
        if (fx->timer == 0) {
            fx->active = FALSE;
            if (fx->spr) { SPR_releaseSprite(fx->spr); fx->spr = NULL; }
        } else if (fx->spr) {
            u8 boomFrame = (u8)((15 - fx->timer) >> 2);
            if (boomFrame > 3) boomFrame = 3;
            SPR_setFrame(fx->spr, boomFrame);
            SPR_setPosition(fx->spr, FROM_FP(fx->x) - gCamX - 8, FROM_FP(fx->y - fx->z) - 8);
        }
    }
}

// ============================================================================
// STAGE 1 CAMERA SCROLL & WAVE/BOSS PROGRESSION
// ============================================================================
static void updateStageProgression(void) {
    // Smooth Beat 'em up Camera Follow
    if (!gCamLocked) {
        s16 maxPlayerX = gCamX;
        u8 i;
        for (i = 0; i < gNumPlayers; i++) {
            if (gPlayers[i].active && gPlayers[i].alive) {
                s16 px = FROM_FP(gPlayers[i].x);
                if (px > maxPlayerX) maxPlayerX = px;
            }
        }
        s16 desired = maxPlayerX - 132;
        if (desired > gCamX) {
            gCamX += (desired - gCamX > 2) ? 2 : 1;
            if (gCamX > STAGE_LENGTH - SCREEN_W) gCamX = STAGE_LENGTH - SCREEN_W;
        }
    }

    // Hardware Dual-Plane Parallax Scrolling!
    VDP_setHorizontalScroll(BG_B, -(gCamX >> 1));
    VDP_setHorizontalScroll(BG_A, -gCamX);

    // Zone Triggers
    if (!gCamLocked) {
        if (gZoneIdx == 0 && gCamX >= 140) {
            gCamLocked = TRUE;
            spawnEnemy(ENEMY_DRUNK, gCamX + 300, 162);
            spawnEnemy(ENEMY_DRUNK, gCamX + 312, 198);
            spawnEnemy(ENEMY_DRUNK, gCamX + 16,  184);
            if (gNumPlayers == 2) spawnEnemy(ENEMY_DRUNK, gCamX + 286, 178);
            setBanner("WAVE 1: DRUNK PUNKS!", 110);
        } else if (gZoneIdx == 1 && gCamX >= 440) {
            // Dedicated Flying Quadcopter-Only Wave!
            gCamLocked = TRUE;
            spawnEnemy(ENEMY_QUAD_DRONE, gCamX + 270, 160);
            spawnEnemy(ENEMY_QUAD_DRONE, gCamX + 295, 196);
            spawnEnemy(ENEMY_QUAD_DRONE, gCamX + 42,  176);
            if (gNumPlayers == 2) spawnEnemy(ENEMY_QUAD_DRONE, gCamX + 240, 180);
            setBanner("DRONE WAVE! JUMP TO ATTACK!", 140);
        } else if (gZoneIdx == 2 && gCamX >= 740) {
            gCamLocked = TRUE;
            spawnEnemy(ENEMY_DRUNK, gCamX + 302, 158);
            spawnEnemy(ENEMY_DRUNK, gCamX + 310, 204);
            spawnEnemy(ENEMY_DRUNK, gCamX + 20,  166);
            spawnEnemy(ENEMY_DRUNK, gCamX + 280, 182);
            spawnPickup(TO_FP(gCamX + 160), TO_FP(182), 0); // Free beer before boss!
            setBanner("WAVE 3: BAR BOUNCERS!", 110);
        } else if (gZoneIdx == 3 && !gBossSpawned && gCamX >= STAGE_LENGTH - SCREEN_W - 8) {
            gCamLocked = TRUE;
            gBossSpawned = TRUE;
            spawnEnemy(ENEMY_BOSS_BARMEN, gCamX + 264, 180);
            spawnEnemy(ENEMY_DRUNK, gCamX + 296, 156);
            setBanner("BOSS: PIVNOY BARMEN!", 150);
            XGM_startPlay(music_boss);
        }
    } else if (!gBossSpawned && countActiveEnemies() == 0) {
        gCamLocked = FALSE;
        gZoneIdx++;
        setBanner("CLEAR! MOVE RIGHT ->", 90);
    }

    // Check Total Defeat
    bool anyAlive = FALSE;
    u8 i;
    for (i = 0; i < gNumPlayers; i++) {
        if (gPlayers[i].active && gPlayers[i].alive) anyAlive = TRUE;
    }
    if (!anyAlive) {
        gState = STATE_GAME_OVER;
        XGM_stopPlay();
        VDP_drawTextBG(WINDOW, "      GAME OVER! OUT OF BEER...       ", 1, 1);
        VDP_drawTextBG(WINDOW, "      PRESS START TO TRY AGAIN        ", 1, 2);
    }
}

// ============================================================================
// MAIN ENTRY POINT (60 FPS NTSC Hardware Loop)
// ============================================================================
int main(bool hardReset) {
    (void)hardReset;

    VDP_setScreenWidth320();
    VDP_setPlaneSize(64, 32, TRUE);
    VDP_setScrollingMode(HSCROLL_PLANE, VSCROLL_PLANE);
    SPR_init();
    JOY_init();

    // Register 14kHz PCM Sound Effects with XGM Z80 sound driver
    XGM_setPCM(SFX_JUMP,      sfx_jump,      sizeof(sfx_jump));
    XGM_setPCM(SFX_SHOOT,     sfx_shoot,     sizeof(sfx_shoot));
    XGM_setPCM(SFX_PIPE,      sfx_pipe,      sizeof(sfx_pipe));
    XGM_setPCM(SFX_WHEEL,     sfx_wheel,     sizeof(sfx_wheel));
    XGM_setPCM(SFX_HIT,       sfx_hit,       sizeof(sfx_hit));
    XGM_setPCM(SFX_EXPLOSION, sfx_explosion, sizeof(sfx_explosion));
    XGM_setPCM(SFX_BEER,      sfx_beer,      sizeof(sfx_beer));

    enterTitleScreen();
    drawTitleMenuOptions();

    while (TRUE) {
        gFrameCount++;
        gPadPrev[0] = gPadCurr[0];
        gPadPrev[1] = gPadCurr[1];
        gPadCurr[0] = JOY_readJoypad(JOY_1);
        gPadCurr[1] = JOY_readJoypad(JOY_2);

        if (gState == STATE_TITLE) {
            if (padJustPressed(0, BUTTON_UP)) {
                gMenuCursor = (gMenuCursor == 0) ? 2 : (gMenuCursor - 1);
                playSfx(SFX_JUMP, 2, SOUND_PCM_CH2);
                drawTitleMenuOptions();
            } else if (padJustPressed(0, BUTTON_DOWN)) {
                gMenuCursor = (gMenuCursor + 1) % 3;
                playSfx(SFX_JUMP, 2, SOUND_PCM_CH2);
                drawTitleMenuOptions();
            } else if (padJustPressed(0, BUTTON_START | BUTTON_A | BUTTON_B | BUTTON_C)) {
                playSfx(SFX_BEER, 6, SOUND_PCM_CH3);
                startStage1();
            }
        } else if (gState == STATE_PLAYING) {
            if (padJustPressed(0, BUTTON_START) || padJustPressed(1, BUTTON_START)) {
                gState = STATE_PAUSED;
                VDP_drawTextBG(WINDOW, "      === PAUSED (PRESS START) ===    ", 1, 1);
            } else if (gHitstop > 0) {
                gHitstop--;
            } else {
                u8 i;
                if (gBannerTimer > 0) gBannerTimer--;
                for (i = 0; i < gNumPlayers; i++) updatePlayer(&gPlayers[i]);
                updateEnemies();
                updateProjectiles();
                updatePickupsAndFx();
                updateStageProgression();

                if (gState == STATE_PLAYING) {
                    if (gHudRefreshTick == 0) {
                        drawHud();
                        gHudRefreshTick = 10; // Refresh HUD every ~6 Hz to save VDP bandwidth
                    } else {
                        gHudRefreshTick--;
                    }
                }
            }
        } else if (gState == STATE_PAUSED) {
            if (padJustPressed(0, BUTTON_START) || padJustPressed(1, BUTTON_START)) {
                gState = STATE_PLAYING;
                gHudRefreshTick = 0;
            }
        } else if (gState == STATE_STAGE_CLEAR || gState == STATE_GAME_OVER) {
            if (padJustPressed(0, BUTTON_START | BUTTON_A)) {
                enterTitleScreen();
                drawTitleMenuOptions();
            }
        }

        SPR_update();
        SYS_doVBlankProcess();
    }

    return 0;
}
