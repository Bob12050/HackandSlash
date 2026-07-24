import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  claimQuest,
  createInitialState,
  enhanceItem,
  equipItem,
  getEnhancementCost,
  getDerivedStats,
  performEnemyAttack,
  performHeroAttack,
  returnToGuild,
  sellItem,
  startAdventure,
  AREA_BOSS_KILL_TARGET,
  INVENTORY_LIMIT,
  MAX_ENHANCEMENT_LEVEL,
  type EquipmentItem
} from '../src/game/idleRpg';

const rolls = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('idle RPG loop', () => {
  it('starts at the guild with beginner equipment', () => {
    const state = createInitialState();
    expect(state.mode).toBe('guild');
    expect(state.inventory).toHaveLength(1);
    expect(getDerivedStats(state).attack).toBe(12);
  });

  it('starts an adventure with a full heal and an enemy', () => {
    const base = createInitialState();
    const damaged = { ...base, hero: { ...base.hero, hp: 1 } };
    const state = startAdventure(damaged, () => 0);
    expect(state.mode).toBe('adventure');
    expect(state.hero.hp).toBe(getDerivedStats(state).maxHp);
    expect(state.enemy?.kind).toBe('mint-slime');
  });

  it('does not restart an active adventure', () => {
    const state = startAdventure(createInitialState(), () => 0);
    expect(startAdventure(state, () => 1)).toBe(state);
  });

  it('hero attacks reduce enemy hp', () => {
    const state = startAdventure(createInitialState(), () => 0);
    const result = performHeroAttack(state, rolls(0.5, 0.5));
    expect(result.state.enemy!.hp).toBeLessThan(state.enemy!.hp);
    expect(result.events[0]?.type).toBe('hero-hit');
  });

  it('critical attacks deal more damage', () => {
    const state = startAdventure(createInitialState(), () => 0);
    const normal = performHeroAttack(state, rolls(0.9, 0.5));
    const critical = performHeroAttack(state, rolls(0.01, 0.5));
    expect(critical.state.enemy!.hp).toBeLessThan(normal.state.enemy!.hp);
  });

  it('enemy attacks reduce hero hp', () => {
    const state = startAdventure(createInitialState(), () => 0);
    const result = performEnemyAttack(state, () => 0.5);
    expect(result.state.hero.hp).toBeLessThan(state.hero.hp);
  });

  it('defeat returns the hero to the guild and heals', () => {
    const adventure = startAdventure(createInitialState(), () => 0);
    const fragile = { ...adventure, hero: { ...adventure.hero, hp: 1 } };
    const result = performEnemyAttack(fragile, () => 0.5);
    expect(result.state.mode).toBe('guild');
    expect(result.state.hero.hp).toBe(getDerivedStats(result.state).maxHp);
    expect(result.events.some((event) => event.type === 'hero-defeated')).toBe(true);
  });

  it('victory grants rewards and creates another encounter', () => {
    const adventure = startAdventure(createInitialState(), () => 0);
    const weakEnemy = { ...adventure.enemy!, hp: 1 };
    const result = performHeroAttack({ ...adventure, enemy: weakEnemy }, rolls(0.9, 0.5, 0, 0.9, 0));
    expect(result.state.hero.gold).toBeGreaterThan(0);
    expect(result.state.distance).toBeGreaterThan(0);
    expect(result.state.enemy?.id).not.toBe(weakEnemy.id);
  });

  it('loot can be awarded on victory', () => {
    const adventure = startAdventure(createInitialState(), () => 0);
    const result = performHeroAttack(
      { ...adventure, enemy: { ...adventure.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.1, 0, 0, 0, 0)
    );
    expect(result.state.inventory.length).toBeGreaterThan(1);
    expect(result.events.some((event) => event.type === 'loot')).toBe(true);
  });

  it('auto-sells a drop without announcing it as stored when inventory is full', () => {
    const base = createInitialState();
    const fullInventory = Array.from({ length: 30 }, (_, index) => ({
      ...base.inventory[0]!, id: `full-${index}`, locked: false
    }));
    const adventure = startAdventure({
      ...base,
      inventory: fullInventory,
      equipped: { weapon: null, armor: null, charm: null }
    }, () => 0);
    const result = performHeroAttack(
      { ...adventure, enemy: { ...adventure.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.1, 0, 0, 0)
    );
    expect(result.state.inventory).toHaveLength(30);
    expect(result.events.some((event) => event.type === 'loot')).toBe(false);
    expect(result.events.some((event) => event.type === 'loot-auto-sold')).toBe(true);
  });

  it('counts only slime enemies toward the slime quest', () => {
    const adventure = startAdventure(createInitialState(), () => 0.99);
    expect(adventure.enemy?.kind).toBe('puffball');
    const result = performHeroAttack(
      { ...adventure, enemy: { ...adventure.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.9, 0)
    );
    expect(result.state.quest.progress).toBe(0);
  });

  it('equipping an item updates derived stats', () => {
    const base = createInitialState();
    const armor: EquipmentItem = {
      id: 'armor-1', name: 'test armor', slot: 'armor', rarity: 'rare', attack: 0,
      defense: 8, maxHp: 12, score: 18, locked: false, upgradeLevel: 0
    };
    const state = equipItem({ ...base, inventory: [...base.inventory, armor] }, armor.id);
    expect(state.equipped.armor).toBe(armor.id);
    expect(getDerivedStats(state).defense).toBe(10);
  });

  it('cannot equip an unknown item', () => {
    const state = createInitialState();
    expect(equipItem(state, 'missing')).toBe(state);
  });

  it('sells unequipped unlocked items', () => {
    const base = createInitialState();
    const charm: EquipmentItem = {
      id: 'charm-1', name: 'test charm', slot: 'charm', rarity: 'common', attack: 1,
      defense: 1, maxHp: 2, score: 4, locked: false, upgradeLevel: 0
    };
    const state = sellItem({ ...base, inventory: [...base.inventory, charm] }, charm.id);
    expect(state.inventory.some((item) => item.id === charm.id)).toBe(false);
    expect(state.hero.gold).toBeGreaterThan(0);
  });

  it('does not sell equipped or locked equipment', () => {
    const state = createInitialState();
    expect(sellItem(state, 'starter-weapon')).toBe(state);
  });

  it('claims a completed quest once', () => {
    const base = createInitialState();
    const ready = { ...base, quest: { ...base.quest, progress: base.quest.target } };
    const claimed = claimQuest(ready);
    expect(claimed.quest.claimed).toBe(true);
    expect(claimed.hero.gold).toBe(base.quest.rewardGold);
    expect(claimQuest(claimed)).toBe(claimed);
  });

  it('cannot claim an unfinished quest', () => {
    const state = createInitialState();
    expect(claimQuest(state)).toBe(state);
  });

  it('manual return resets the run but keeps rewards', () => {
    const adventure = startAdventure(createInitialState(), () => 0);
    const rewarded = { ...adventure, hero: { ...adventure.hero, gold: 99 }, distance: 500 };
    const returned = returnToGuild(rewarded);
    expect(returned.mode).toBe('guild');
    expect(returned.hero.gold).toBe(99);
    expect(returned.distance).toBe(0);
  });

  it('rejects a locked destination and stays at the guild', () => {
    const base = createInitialState();
    const state = startAdventure(base, 'komorebi-forest', () => 0);

    expect(state.mode).toBe('guild');
    expect(state.enemy).toBeNull();
    expect(state.selectedArea).toBe('sunmeadow');
    expect(state.logs.at(-1)).toContain('まだ解放されていません');
  });

  it('keeps meadow progress after returning and spawns the boss after ten regular victories', () => {
    const base = createInitialState();
    const almostReady = {
      ...base,
      areaProgress: {
        ...base.areaProgress,
        sunmeadow: { regularKills: AREA_BOSS_KILL_TARGET - 2, bossDefeated: false }
      }
    };
    const firstRun = startAdventure(almostReady, 'sunmeadow', () => 0);
    const ninthVictory = performHeroAttack(
      { ...firstRun, enemy: { ...firstRun.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.99, 0)
    ).state;
    const returned = returnToGuild(ninthVictory);

    expect(returned.areaProgress.sunmeadow.regularKills).toBe(AREA_BOSS_KILL_TARGET - 1);

    const secondRun = startAdventure(returned, 'sunmeadow', () => 0);
    const tenthVictory = performHeroAttack(
      { ...secondRun, enemy: { ...secondRun.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.99, 0)
    ).state;

    expect(tenthVictory.areaProgress.sunmeadow.regularKills).toBe(AREA_BOSS_KILL_TARGET);
    expect(tenthVictory.enemy?.kind).toBe('crown-slime');
    expect(tenthVictory.enemy?.name).toBe('おおきな王冠スライム');
  });

  it('starts directly at the meadow boss when its ten victories were saved', () => {
    const base = createInitialState();
    const ready = {
      ...base,
      areaProgress: {
        ...base.areaProgress,
        sunmeadow: { regularKills: AREA_BOSS_KILL_TARGET, bossDefeated: false }
      }
    };

    const adventure = startAdventure(ready, 'sunmeadow', () => 0.99);
    expect(adventure.enemy?.kind).toBe('crown-slime');
    expect(adventure.enemy?.level).toBe(5);
  });

  it('unlocks the forest and grants the meadow boss first-clear rewards only once', () => {
    const base = createInitialState();
    const ready = {
      ...base,
      areaProgress: {
        ...base.areaProgress,
        sunmeadow: { regularKills: AREA_BOSS_KILL_TARGET, bossDefeated: false }
      }
    };
    const bossAdventure = startAdventure(ready, 'sunmeadow', () => 0);
    const boss = bossAdventure.enemy!;
    const cleared = performHeroAttack(
      { ...bossAdventure, enemy: { ...boss, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.99, 0)
    );

    expect(cleared.state.areaProgress.sunmeadow.bossDefeated).toBe(true);
    expect(cleared.state.unlockedAreas).toContain('komorebi-forest');
    expect(cleared.state.hero.gold).toBe(boss.gold + 300);
    expect(cleared.state.inventory.some((item) => item.id === 'first-clear-sunmeadow-charm')).toBe(true);
    expect(cleared.events).toContainEqual({
      type: 'area-unlocked', areaId: 'komorebi-forest', name: 'こもれび森'
    });

    const replayState = {
      ...cleared.state,
      enemy: { ...boss, id: 'boss-replay', hp: 1 }
    };
    const replayed = performHeroAttack(replayState, rolls(0.9, 0.5, 0, 0.99, 0));
    expect(replayed.state.hero.gold - cleared.state.hero.gold).toBe(boss.gold);
    expect(replayed.state.inventory.filter((item) => item.id === 'first-clear-sunmeadow-charm')).toHaveLength(1);
    expect(replayed.events.some((event) => event.type === 'area-unlocked')).toBe(false);
  });

  it('keeps the unique first-clear reward when the inventory is full', () => {
    const base = createInitialState();
    const fillerItems = Array.from({ length: 29 }, (_, index) => ({
      id: `boss-reward-filler-${index}`,
      name: `予備装備${index}`,
      slot: 'armor' as const,
      rarity: 'common' as const,
      attack: 0,
      defense: 1 + index,
      maxHp: 0,
      score: 1 + index,
      locked: false,
      upgradeLevel: 0
    }));
    const ready = {
      ...base,
      inventory: [...base.inventory, ...fillerItems],
      areaProgress: {
        ...base.areaProgress,
        sunmeadow: { regularKills: AREA_BOSS_KILL_TARGET, bossDefeated: false }
      }
    };
    const adventure = startAdventure(ready, 'sunmeadow', () => 0);
    const cleared = performHeroAttack(
      { ...adventure, enemy: { ...adventure.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.99, 0)
    );

    expect(cleared.state.inventory).toHaveLength(INVENTORY_LIMIT);
    expect(cleared.state.inventory.some((item) => item.id === 'first-clear-sunmeadow-charm')).toBe(true);
    expect(cleared.state.inventory.some((item) => item.id === 'boss-reward-filler-0')).toBe(false);
    expect(cleared.events).toContainEqual(expect.objectContaining({
      type: 'loot-auto-sold', item: expect.objectContaining({ id: 'boss-reward-filler-0' })
    }));
  });

  it('makes forest enemies stronger than meadow enemies', () => {
    const base = createInitialState();
    const unlocked = { ...base, unlockedAreas: [...base.unlockedAreas, 'komorebi-forest' as const] };
    const meadow = startAdventure(unlocked, 'sunmeadow', () => 0);
    const forest = startAdventure(unlocked, 'komorebi-forest', () => 0);

    expect(forest.enemy!.level).toBeGreaterThan(meadow.enemy!.level);
    expect(forest.enemy!.maxHp).toBeGreaterThan(meadow.enemy!.maxHp);
    expect(forest.enemy!.attack).toBeGreaterThan(meadow.enemy!.attack);
    expect(forest.enemy!.gold).toBeGreaterThan(meadow.enemy!.gold);
  });

  it('gives the forest a higher drop chance and more valuable equipment', () => {
    const base = createInitialState();
    const unlocked = { ...base, unlockedAreas: [...base.unlockedAreas, 'komorebi-forest' as const] };
    const meadow = startAdventure(unlocked, 'sunmeadow', () => 0);
    const forest = startAdventure(unlocked, 'komorebi-forest', () => 0);
    const meadowNoDrop = performHeroAttack(
      { ...meadow, enemy: { ...meadow.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.55, 0)
    );
    const forestDrop = performHeroAttack(
      { ...forest, enemy: { ...forest.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.55, 0, 0.6, 0, 0)
    );

    expect(meadowNoDrop.events.some((event) => event.type === 'loot')).toBe(false);
    expect(forestDrop.events.some((event) => event.type === 'loot')).toBe(true);
    expect(forestDrop.state.inventory.at(-1)?.rarity).toBe('rare');

    const meadowDrop = performHeroAttack(
      { ...meadow, enemy: { ...meadow.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.1, 0, 0.1, 0, 0)
    ).state.inventory.at(-1)!;
    const betterForestDrop = performHeroAttack(
      { ...forest, enemy: { ...forest.enemy!, hp: 1 } },
      rolls(0.9, 0.5, 0, 0.1, 0, 0.1, 0, 0)
    ).state.inventory.at(-1)!;
    expect(betterForestDrop.score).toBeGreaterThan(meadowDrop.score);
  });

  it('enhancement costs rise with each level', () => {
    const item = createInitialState().inventory[0]!;
    const firstCost = getEnhancementCost(item);
    const funded = { ...createInitialState(), hero: { ...createInitialState().hero, gold: 10_000 } };
    const enhanced = enhanceItem(funded, item.id);
    expect(getEnhancementCost(enhanced.inventory[0]!)).toBeGreaterThan(firstCost);
  });

  it('enhances equipment stats and score while spending gold', () => {
    const base = createInitialState();
    const item = base.inventory[0]!;
    const cost = getEnhancementCost(item);
    const funded = { ...base, hero: { ...base.hero, gold: cost + 100 } };
    const enhanced = enhanceItem(funded, item.id);
    const result = enhanced.inventory[0]!;

    expect(result.upgradeLevel).toBe(1);
    expect(result.attack).toBeGreaterThan(item.attack);
    expect(result.score).toBeGreaterThan(item.score);
    expect(enhanced.hero.gold).toBe(100);
    expect(enhanced.logs.at(-1)).toContain('+1');
  });

  it('keeps damage taken intact when equipped max hp is enhanced', () => {
    const base = createInitialState();
    const armor: EquipmentItem = {
      id: 'armor-enhance', name: 'test armor', slot: 'armor', rarity: 'common', attack: 0,
      defense: 3, maxHp: 10, score: 8, locked: false, upgradeLevel: 0
    };
    const equipped = equipItem({
      ...base,
      hero: { ...base.hero, gold: 10_000 },
      inventory: [...base.inventory, armor]
    }, armor.id);
    const damaged = { ...equipped, hero: { ...equipped.hero, hp: getDerivedStats(equipped).maxHp - 7 } };
    const enhanced = enhanceItem(damaged, armor.id);

    expect(getDerivedStats(enhanced).maxHp - enhanced.hero.hp).toBe(7);
    expect(enhanced.hero.hp).toBeGreaterThan(damaged.hero.hp);
  });

  it('does not change hp when enhancing an unequipped item', () => {
    const base = createInitialState();
    const armor: EquipmentItem = {
      id: 'spare-armor', name: 'spare armor', slot: 'armor', rarity: 'common', attack: 0,
      defense: 2, maxHp: 8, score: 6, locked: false, upgradeLevel: 0
    };
    const state = {
      ...base,
      hero: { ...base.hero, gold: 10_000, hp: 31 },
      inventory: [...base.inventory, armor]
    };
    expect(enhanceItem(state, armor.id).hero.hp).toBe(31);
  });

  it('does not enhance missing equipment or equipment without enough gold', () => {
    const state = createInitialState();
    expect(enhanceItem(state, 'missing')).toBe(state);
    expect(enhanceItem(state, state.inventory[0]!.id)).toBe(state);
  });

  it('stops enhancement at +10 without spending gold', () => {
    const base = createInitialState();
    const capped = {
      ...base,
      hero: { ...base.hero, gold: 10_000 },
      inventory: [{ ...base.inventory[0]!, upgradeLevel: MAX_ENHANCEMENT_LEVEL }]
    };
    expect(getEnhancementCost(capped.inventory[0]!)).toBe(0);
    expect(enhanceItem(capped, capped.inventory[0]!.id)).toBe(capped);
  });

  it('allows exactly ten enhancements before reaching the cap', () => {
    const base = createInitialState();
    let state = { ...base, hero: { ...base.hero, gold: 1_000_000 } };
    const itemId = state.inventory[0]!.id;

    for (let level = 1; level <= MAX_ENHANCEMENT_LEVEL; level += 1) {
      state = enhanceItem(state, itemId);
      expect(state.inventory[0]?.upgradeLevel).toBe(level);
    }

    expect(getEnhancementCost(state.inventory[0]!)).toBe(0);
    expect(enhanceItem(state, itemId)).toBe(state);
  });

  it('returns enhancement success only when the runtime changes state', async () => {
    const base = createInitialState();
    const funded = { ...base, hero: { ...base.hero, gold: 1_000 } };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(funded)),
      setItem: vi.fn()
    });
    vi.resetModules();

    const { runtime } = await import('../src/game/runtime');
    expect(runtime.enhance('missing')).toBe(false);
    expect(runtime.enhance(runtime.state.inventory[0]!.id)).toBe(true);
    expect(runtime.state.inventory[0]?.upgradeLevel).toBe(1);
  });

  it('normalizes malformed saved equipment before calculating forge costs', async () => {
    const base = createInitialState();
    const malformed = {
      ...base,
      hero: { ...base.hero, gold: 'broken' },
      inventory: [{ ...base.inventory[0]!, rarity: 'mythic', attack: 'bad', score: null }]
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(malformed)),
      setItem: vi.fn()
    });
    vi.resetModules();

    const { runtime } = await import('../src/game/runtime');
    const restored = runtime.state.inventory[0]!;
    expect(restored.rarity).toBe('common');
    expect(restored.attack).toBe(0);
    expect(Number.isFinite(restored.score)).toBe(true);
    expect(Number.isFinite(getEnhancementCost(restored))).toBe(true);
    expect(runtime.state.hero.gold).toBe(0);
    expect(runtime.enhance(restored.id)).toBe(false);
  });

  it('migrates old v1 saves without area progress to the meadow defaults', async () => {
    const legacySave: Record<string, unknown> = { ...createInitialState() };
    delete legacySave.selectedArea;
    delete legacySave.unlockedAreas;
    delete legacySave.areaProgress;
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(legacySave)),
      setItem: vi.fn()
    });
    vi.resetModules();

    const { runtime } = await import('../src/game/runtime');
    expect(runtime.state.selectedArea).toBe('sunmeadow');
    expect(runtime.state.unlockedAreas).toEqual(['sunmeadow']);
    expect(runtime.state.areaProgress).toEqual({
      sunmeadow: { regularKills: 0, bossDefeated: false },
      'komorebi-forest': { regularKills: 0, bossDefeated: false }
    });
  });

  it('normalizes saved area progress and restores the selected unlocked destination', async () => {
    const saved = {
      ...createInitialState(),
      selectedArea: 'komorebi-forest',
      unlockedAreas: ['sunmeadow', 'invalid-area'],
      areaProgress: {
        sunmeadow: { regularKills: 999, bossDefeated: true },
        'komorebi-forest': { regularKills: -12, bossDefeated: false }
      }
    };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(saved)),
      setItem: vi.fn()
    });
    vi.resetModules();

    const { runtime } = await import('../src/game/runtime');
    expect(runtime.state.areaProgress.sunmeadow.regularKills).toBe(AREA_BOSS_KILL_TARGET);
    expect(runtime.state.areaProgress['komorebi-forest'].regularKills).toBe(0);
    expect(runtime.state.unlockedAreas).toEqual(['sunmeadow', 'komorebi-forest']);
    expect(runtime.state.selectedArea).toBe('komorebi-forest');

    runtime.startAdventure('komorebi-forest');
    expect(runtime.state.mode).toBe('adventure');
    expect(runtime.state.enemy?.level).toBeGreaterThanOrEqual(4);
  });

  it('restores old v1 saves with missing enhancement levels as +0', async () => {
    const oldSave = createInitialState();
    const legacyItem = { ...oldSave.inventory[0] } as Partial<EquipmentItem>;
    delete legacyItem.upgradeLevel;
    const legacySave = { ...oldSave, inventory: [legacyItem] };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(legacySave)),
      setItem: vi.fn()
    });
    vi.resetModules();

    const { runtime } = await import('../src/game/runtime');
    expect(runtime.state.inventory[0]?.upgradeLevel).toBe(0);
    expect(runtime.state.mode).toBe('guild');
  });
});
