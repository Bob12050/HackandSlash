import { describe, expect, it } from 'vitest';

import {
  claimQuest,
  createInitialState,
  equipItem,
  getDerivedStats,
  performEnemyAttack,
  performHeroAttack,
  returnToGuild,
  sellItem,
  startAdventure,
  type EquipmentItem
} from '../src/game/idleRpg';

const rolls = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
};

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
      defense: 8, maxHp: 12, score: 18, locked: false
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
      defense: 1, maxHp: 2, score: 4, locked: false
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
});
