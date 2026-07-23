import { describe, expect, it } from 'vitest';

import {
  applyLootItem,
  applyUpgrade,
  createLootItem,
  rollRarity,
  type RandomSource
} from '../src/game/loot';
import type { LootItem, PlayerStats } from '../src/game/types';

const BASE_STATS: PlayerStats = {
  maxHealth: 120,
  health: 73,
  damage: 24,
  moveSpeed: 220,
  attackRate: 1,
  attackRange: 96,
  criticalChance: 0.08,
  armor: 0,
  lifeOnKill: 0
};

function sequence(...values: number[]): RandomSource {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('rollRarity', () => {
  it.each([
    [0, 'common'],
    [0.649_999, 'common'],
    [0.65, 'rare'],
    [0.899_999, 'rare'],
    [0.9, 'epic'],
    [0.979_999, 'epic'],
    [0.98, 'legendary'],
    [1, 'legendary']
  ] as const)('maps a roll of %s to %s', (roll, expected) => {
    expect(rollRarity(() => roll)).toBe(expected);
  });
});

describe('createLootItem', () => {
  it('creates a deterministic, rarity-scaled item', () => {
    const item = createLootItem(sequence(0, 0.99, 0.999, 0.25));

    expect(item).toEqual({
      id: 'loot-0hra0hs',
      kind: 'blade',
      rarity: 'legendary',
      name: '失われし断罪の刃',
      statLabel: '攻撃力',
      value: 27,
      suffix: ''
    });
  });

  it('scales values with level', () => {
    const levelOne = createLootItem(sequence(0, 0, 0, 0), 1);
    const levelEleven = createLootItem(sequence(0, 0, 0, 0), 11);

    expect(levelOne.value).toBe(4);
    expect(levelEleven.value).toBe(6);
  });
});

describe('applyLootItem', () => {
  it.each([
    ['blade', 7, 'damage', 31],
    ['armor', 7, 'armor', 0.07],
    ['boots', 10, 'moveSpeed', 242],
    ['ring', 7, 'criticalChance', 0.15]
  ] as const)('applies %s loot to %s', (kind, value, field, expected) => {
    const before = { ...BASE_STATS };
    const item: LootItem = {
      id: 'test',
      kind,
      rarity: 'common',
      name: 'test',
      statLabel: 'test',
      value,
      suffix: ''
    };

    const result = applyLootItem(BASE_STATS, item);

    expect(result[field]).toBeCloseTo(expected);
    expect(BASE_STATS).toEqual(before);
    expect(result).not.toBe(BASE_STATS);
  });
});

describe('applyUpgrade', () => {
  it('applies every upgrade and keeps the input immutable', () => {
    expect(applyUpgrade(BASE_STATS, 'damage').damage).toBe(30);
    expect(applyUpgrade(BASE_STATS, 'speed').attackRate).toBeCloseTo(1.18);
    expect(applyUpgrade(BASE_STATS, 'mobility').moveSpeed).toBeCloseTo(246.4);
    expect(applyUpgrade(BASE_STATS, 'critical').criticalChance).toBeCloseTo(0.18);
    expect(applyUpgrade(BASE_STATS, 'reach').attackRange).toBeCloseTo(115.2);
    expect(applyUpgrade(BASE_STATS, 'leech').lifeOnKill).toBeCloseTo(0.03);
    expect(applyUpgrade(BASE_STATS, 'armor').armor).toBeCloseTo(0.12);

    const vitality = applyUpgrade(BASE_STATS, 'vitality');
    expect(vitality.maxHealth).toBe(150);
    expect(vitality.health).toBe(150);
    expect(BASE_STATS.health).toBe(73);
  });

  it('returns an unchanged copy for an unknown upgrade', () => {
    const result = applyUpgrade(BASE_STATS, 'unknown');

    expect(result).toEqual(BASE_STATS);
    expect(result).not.toBe(BASE_STATS);
  });
});
