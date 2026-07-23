import { RARITY_DATA } from './data';
import type {
  ItemKind,
  ItemRarity,
  LootItem,
  PlayerStats
} from './types';

export type RandomSource = () => number;

export interface LootOptions {
  wave?: number;
  elite?: boolean;
  random?: RandomSource;
}

const RARITY_WEIGHTS: ReadonlyArray<readonly [ItemRarity, number]> = [
  ['common', 0.65],
  ['rare', 0.25],
  ['epic', 0.08],
  ['legendary', 0.02]
];

const ITEM_KINDS: readonly ItemKind[] = ['blade', 'armor', 'boots', 'ring'];

const ITEM_DATA: Record<
  ItemKind,
  { name: string; statLabel: string; minimum: number; maximum: number; suffix: string }
> = {
  blade: { name: '断罪の刃', statLabel: '攻撃力', minimum: 4, maximum: 8, suffix: '' },
  armor: { name: '灰鉄の鎧', statLabel: 'ダメージ軽減', minimum: 3, maximum: 6, suffix: '%' },
  boots: { name: '影走りの靴', statLabel: '移動速度', minimum: 4, maximum: 8, suffix: '%' },
  ring: { name: '凶兆の指輪', statLabel: '会心率', minimum: 3, maximum: 7, suffix: '%' }
};

function normalizedRoll(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}

export function rollRarity(random: RandomSource = Math.random): ItemRarity {
  const roll = normalizedRoll(random);
  let threshold = 0;

  for (const [rarity, weight] of RARITY_WEIGHTS) {
    threshold += weight;
    if (roll < threshold) return rarity;
  }

  return 'legendary';
}

/** Generates one display-ready item. `wave` scales its base stat by 6% per wave. */
export function createLootItem(options?: LootOptions): LootItem;
export function createLootItem(random?: RandomSource, wave?: number): LootItem;
export function createLootItem(
  source: RandomSource | LootOptions = Math.random,
  waveArgument = 1
): LootItem {
  const options = typeof source === 'function' ? undefined : source;
  const random = typeof source === 'function' ? source : (source.random ?? Math.random);
  const wave = Math.max(1, options?.wave ?? waveArgument);
  const kind = ITEM_KINDS[Math.floor(normalizedRoll(random) * ITEM_KINDS.length)] ?? 'blade';
  const rarityRoll = normalizedRoll(random);
  const rarity = rollRarity(() => Math.min(1, rarityRoll + (options?.elite ? 0.18 : 0)));
  const item = ITEM_DATA[kind];
  const baseValue = item.minimum
    + Math.floor(normalizedRoll(random) * (item.maximum - item.minimum + 1));
  const levelMultiplier = 1 + (wave - 1) * 0.06;
  const value = Math.max(
    1,
    Math.round(baseValue * RARITY_DATA[rarity].multiplier * levelMultiplier)
  );
  const idPart = Math.floor(normalizedRoll(random) * 0x1_0000_0000)
    .toString(36)
    .padStart(7, '0');

  return {
    id: `loot-${idPart}`,
    kind,
    rarity,
    name: `${RARITY_DATA[rarity].label}${item.name}`,
    statLabel: item.statLabel,
    value,
    suffix: item.suffix
  };
}

/** Applies an item without mutating the supplied stats object. */
export function applyLootItem(stats: PlayerStats, item: LootItem): PlayerStats {
  const next = { ...stats };

  switch (item.kind) {
    case 'blade':
      next.damage += item.value;
      break;
    case 'armor':
      next.armor = Math.min(0.8, next.armor + item.value / 100);
      break;
    case 'boots':
      next.moveSpeed *= 1 + item.value / 100;
      break;
    case 'ring':
      next.criticalChance = Math.min(1, next.criticalChance + item.value / 100);
      break;
  }

  return next;
}

/** Applies a level-up choice without mutating the supplied stats object. */
export function applyUpgrade(stats: PlayerStats, upgradeId: string): PlayerStats {
  const next = { ...stats };

  switch (upgradeId) {
    case 'damage':
      next.damage *= 1.25;
      break;
    case 'speed':
      next.attackRate *= 1.18;
      break;
    case 'vitality':
      next.maxHealth += 30;
      next.health = next.maxHealth;
      break;
    case 'mobility':
      next.moveSpeed *= 1.12;
      break;
    case 'critical':
      next.criticalChance = Math.min(1, next.criticalChance + 0.1);
      break;
    case 'reach':
      next.attackRange *= 1.2;
      break;
    case 'leech':
      next.lifeOnKill = Math.min(1, next.lifeOnKill + 0.03);
      break;
    case 'armor':
      next.armor = Math.min(0.8, next.armor + 0.12);
      break;
  }

  return next;
}
