export type GameMode = 'guild' | 'adventure';
export type EquipmentSlot = 'weapon' | 'armor' | 'charm';
export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'celestial';
export type EnemyKind = 'mint-slime' | 'berry-slime' | 'puffball' | 'crown-slime';
export type AdventureAreaId = 'sunmeadow' | 'komorebi-forest';

export interface AdventureAreaDefinition {
  id: AdventureAreaId;
  name: string;
  description: string;
  unlockHint: string;
  recommendedLevel: number;
  regularKillTarget: number;
  bossName: string | null;
}

export interface AdventureAreaProgress {
  regularKills: number;
  bossDefeated: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  attack: number;
  defense: number;
  maxHp: number;
  score: number;
  locked: boolean;
  upgradeLevel: number;
}

export interface EquipmentBaseDefinition {
  id: string;
  areaId: AdventureAreaId;
  slot: EquipmentSlot;
  name: string;
  attack: number;
  defense: number;
  maxHp: number;
}

export interface EquipmentCatalogEntry {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  source: AdventureAreaId | 'starter' | 'sunmeadow-boss';
  baseId: string | null;
}

export interface EquipmentRarityThreshold {
  rarity: ItemRarity;
  upperBound: number;
}

export interface HeroState {
  level: number;
  xp: number;
  nextXp: number;
  hp: number;
  maxHp: number;
  baseAttack: number;
  baseDefense: number;
  gold: number;
  rank: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  totalKills: number;
}

export interface EnemyState {
  id: string;
  kind: EnemyKind;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xp: number;
  gold: number;
}

export interface QuestState {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardGold: number;
  rewardXp: number;
  claimed: boolean;
}

export interface IdleRpgState {
  version: 1;
  mode: GameMode;
  hero: HeroState;
  inventory: EquipmentItem[];
  equipped: Record<EquipmentSlot, string | null>;
  enemy: EnemyState | null;
  distance: number;
  adventureKills: number;
  encounterCount: number;
  selectedArea: AdventureAreaId;
  unlockedAreas: AdventureAreaId[];
  areaProgress: Record<AdventureAreaId, AdventureAreaProgress>;
  quest: QuestState;
  logs: string[];
}

export interface DerivedStats {
  maxHp: number;
  attack: number;
  defense: number;
}

export type CombatEvent =
  | { type: 'hero-hit'; damage: number; critical: boolean }
  | { type: 'enemy-hit'; damage: number }
  | { type: 'enemy-defeated'; name: string; xp: number; gold: number }
  | { type: 'loot'; item: EquipmentItem }
  | { type: 'loot-auto-sold'; item: EquipmentItem; gold: number }
  | { type: 'level-up'; level: number }
  | { type: 'area-unlocked'; areaId: AdventureAreaId; name: string }
  | { type: 'hero-defeated' };

export interface CombatStep {
  state: IdleRpgState;
  events: CombatEvent[];
}

export const INVENTORY_LIMIT = 30;
export const MAX_ENHANCEMENT_LEVEL = 10;
export const AREA_BOSS_KILL_TARGET = 10;
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'charm'];
export const ITEM_RARITIES: readonly ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
  'celestial'
];

export const ADVENTURE_AREAS: readonly AdventureAreaDefinition[] = [
  {
    id: 'sunmeadow',
    name: 'そよかぜ草原',
    description: '陽だまりの草原。ぷるぷるした魔物が暮らしている。',
    unlockHint: '最初から冒険できます',
    recommendedLevel: 1,
    regularKillTarget: AREA_BOSS_KILL_TARGET,
    bossName: 'おおきな王冠スライム'
  },
  {
    id: 'komorebi-forest',
    name: 'こもれび森',
    description: '木漏れ日がきらめく森。強い魔物と上質な装備が待つ。',
    unlockHint: 'そよかぜ草原のボスをたおすと解放',
    recommendedLevel: 4,
    regularKillTarget: 0,
    bossName: null
  }
] as const;

export const EQUIPMENT_RARITY_LABELS: Readonly<Record<ItemRarity, string>> = {
  common: '素朴な',
  uncommon: '磨かれた',
  rare: 'きらめく',
  epic: '星降る',
  legendary: '伝説の',
  mythic: '神話の',
  celestial: '虹星の'
};

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.65,
  epic: 2.55,
  legendary: 3.65,
  mythic: 5,
  celestial: 6.75
};

export const EQUIPMENT_RARITY_THRESHOLDS: Readonly<
  Record<AdventureAreaId, readonly EquipmentRarityThreshold[]>
> = {
  sunmeadow: [
    { rarity: 'common', upperBound: 0.52 },
    { rarity: 'uncommon', upperBound: 0.77 },
    { rarity: 'rare', upperBound: 0.9 },
    { rarity: 'epic', upperBound: 0.96 },
    { rarity: 'legendary', upperBound: 0.988 },
    { rarity: 'mythic', upperBound: 0.998 },
    { rarity: 'celestial', upperBound: 1 }
  ],
  'komorebi-forest': [
    { rarity: 'common', upperBound: 0.28 },
    { rarity: 'uncommon', upperBound: 0.53 },
    { rarity: 'rare', upperBound: 0.73 },
    { rarity: 'epic', upperBound: 0.86 },
    { rarity: 'legendary', upperBound: 0.94 },
    { rarity: 'mythic', upperBound: 0.985 },
    { rarity: 'celestial', upperBound: 1 }
  ]
};

export function rollEquipmentRarity(areaId: AdventureAreaId, roll: number): ItemRarity {
  const normalizedRoll = clampRoll(roll);
  return EQUIPMENT_RARITY_THRESHOLDS[areaId]
    .find((threshold) => normalizedRoll < threshold.upperBound)?.rarity ?? 'celestial';
}

export const EQUIPMENT_BASES_BY_AREA: Readonly<
  Record<AdventureAreaId, Readonly<Record<EquipmentSlot, readonly EquipmentBaseDefinition[]>>>
> = {
  sunmeadow: {
    weapon: [
      { id: 'meadow-dandelion-dagger', areaId: 'sunmeadow', slot: 'weapon', name: 'たんぽぽの短剣', attack: 3, defense: 0, maxHp: 1 },
      { id: 'meadow-breeze-woodblade', areaId: 'sunmeadow', slot: 'weapon', name: '旅立ちの剣', attack: 4, defense: 0, maxHp: 0 },
      { id: 'meadow-clover-rod', areaId: 'sunmeadow', slot: 'weapon', name: 'クローバーロッド', attack: 3, defense: 1, maxHp: 2 },
      { id: 'meadow-sunlit-rapier', areaId: 'sunmeadow', slot: 'weapon', name: 'ひなたのレイピア', attack: 5, defense: 0, maxHp: 0 },
      { id: 'meadow-picnic-hammer', areaId: 'sunmeadow', slot: 'weapon', name: 'ピクニックハンマー', attack: 4, defense: 1, maxHp: 1 }
    ],
    armor: [
      { id: 'meadow-sprout-cape', areaId: 'sunmeadow', slot: 'armor', name: '森色のケープ', attack: 0, defense: 3, maxHp: 7 },
      { id: 'meadow-cloud-vest', areaId: 'sunmeadow', slot: 'armor', name: 'ひつじ雲ベスト', attack: 0, defense: 3, maxHp: 5 },
      { id: 'meadow-sun-apron', areaId: 'sunmeadow', slot: 'armor', name: 'おひさまエプロン', attack: 1, defense: 2, maxHp: 7 },
      { id: 'meadow-clover-coat', areaId: 'sunmeadow', slot: 'armor', name: 'クローバーコート', attack: 0, defense: 4, maxHp: 6 },
      { id: 'meadow-breeze-garb', areaId: 'sunmeadow', slot: 'armor', name: 'そよ風の旅装', attack: 0, defense: 3, maxHp: 10 }
    ],
    charm: [
      { id: 'meadow-bird-charm', areaId: 'sunmeadow', slot: 'charm', name: '小鳥のお守り', attack: 1, defense: 1, maxHp: 4 },
      { id: 'meadow-fourleaf-bookmark', areaId: 'sunmeadow', slot: 'charm', name: '四つ葉のしおり', attack: 1, defense: 2, maxHp: 3 },
      { id: 'meadow-dandelion-brooch', areaId: 'sunmeadow', slot: 'charm', name: 'たんぽぽブローチ', attack: 2, defense: 1, maxHp: 2 },
      { id: 'meadow-sky-bell', areaId: 'sunmeadow', slot: 'charm', name: '青空の鈴', attack: 1, defense: 1, maxHp: 7 },
      { id: 'meadow-honey-charm', areaId: 'sunmeadow', slot: 'charm', name: 'はちみつチャーム', attack: 2, defense: 2, maxHp: 4 }
    ]
  },
  'komorebi-forest': {
    weapon: [
      { id: 'forest-acorn-mace', areaId: 'komorebi-forest', slot: 'weapon', name: 'どんぐりメイス', attack: 5, defense: 1, maxHp: 2 },
      { id: 'forest-sunbeam-blade', areaId: 'komorebi-forest', slot: 'weapon', name: '木漏れ日の剣', attack: 6, defense: 0, maxHp: 1 },
      { id: 'forest-mushroom-wand', areaId: 'komorebi-forest', slot: 'weapon', name: 'きのこワンド', attack: 5, defense: 1, maxHp: 4 },
      { id: 'forest-birch-bow', areaId: 'komorebi-forest', slot: 'weapon', name: '白樺の弓', attack: 7, defense: 0, maxHp: 0 },
      { id: 'forest-moondew-rapier', areaId: 'komorebi-forest', slot: 'weapon', name: '月露のレイピア', attack: 6, defense: 1, maxHp: 2 },
      { id: 'forest-warden-hammer', areaId: 'komorebi-forest', slot: 'weapon', name: '森番のハンマー', attack: 7, defense: 2, maxHp: 0 }
    ],
    armor: [
      { id: 'forest-moss-cloak', areaId: 'komorebi-forest', slot: 'armor', name: '苔むすマント', attack: 0, defense: 4, maxHp: 10 },
      { id: 'forest-leaf-tunic', areaId: 'komorebi-forest', slot: 'armor', name: '木の葉のチュニック', attack: 1, defense: 4, maxHp: 9 },
      { id: 'forest-mushroom-poncho', areaId: 'komorebi-forest', slot: 'armor', name: 'きのこポンチョ', attack: 0, defense: 5, maxHp: 12 },
      { id: 'forest-birch-mail', areaId: 'komorebi-forest', slot: 'armor', name: '白樺の胸当て', attack: 0, defense: 6, maxHp: 10 },
      { id: 'forest-moonshadow-robe', areaId: 'komorebi-forest', slot: 'armor', name: '月影のローブ', attack: 2, defense: 4, maxHp: 13 },
      { id: 'forest-warden-coat', areaId: 'komorebi-forest', slot: 'armor', name: '森番のコート', attack: 0, defense: 6, maxHp: 15 }
    ],
    charm: [
      { id: 'forest-acorn-pendant', areaId: 'komorebi-forest', slot: 'charm', name: 'どんぐりペンダント', attack: 2, defense: 3, maxHp: 7 },
      { id: 'forest-owl-feather', areaId: 'komorebi-forest', slot: 'charm', name: 'ふくろうの羽根', attack: 3, defense: 2, maxHp: 6 },
      { id: 'forest-berry-ring', areaId: 'komorebi-forest', slot: 'charm', name: '木いちごの指輪', attack: 3, defense: 3, maxHp: 8 },
      { id: 'forest-moondew-vial', areaId: 'komorebi-forest', slot: 'charm', name: '月露の小瓶', attack: 2, defense: 3, maxHp: 12 },
      { id: 'forest-kodama-bell', areaId: 'komorebi-forest', slot: 'charm', name: 'こだまの鈴', attack: 4, defense: 2, maxHp: 9 },
      { id: 'forest-cat-brooch', areaId: 'komorebi-forest', slot: 'charm', name: '森猫のブローチ', attack: 3, defense: 4, maxHp: 10 }
    ]
  }
};

export function getEquipmentBases(
  areaId: AdventureAreaId,
  slot?: EquipmentSlot
): readonly EquipmentBaseDefinition[] {
  if (slot) return EQUIPMENT_BASES_BY_AREA[areaId][slot];
  return EQUIPMENT_SLOTS.flatMap((equipmentSlot) => EQUIPMENT_BASES_BY_AREA[areaId][equipmentSlot]);
}

export const EQUIPMENT_BASE_CATALOG: readonly EquipmentBaseDefinition[] = ADVENTURE_AREAS.flatMap(
  (area) => getEquipmentBases(area.id)
);

const normalEquipmentCatalog: EquipmentCatalogEntry[] = EQUIPMENT_BASE_CATALOG.flatMap((base) =>
  ITEM_RARITIES.map((rarity) => ({
    id: `${base.id}-${rarity}`,
    name: `${EQUIPMENT_RARITY_LABELS[rarity]}${base.name}`,
    slot: base.slot,
    rarity,
    source: base.areaId,
    baseId: base.id
  }))
);

export const EQUIPMENT_CATALOG: readonly EquipmentCatalogEntry[] = [
  {
    id: 'starter-weapon',
    name: 'はじまりの木剣',
    slot: 'weapon',
    rarity: 'common',
    source: 'starter',
    baseId: null
  },
  ...normalEquipmentCatalog,
  {
    id: 'first-clear-sunmeadow-charm',
    name: '王冠スライムのお守り',
    slot: 'charm',
    rarity: 'epic',
    source: 'sunmeadow-boss',
    baseId: null
  }
];

export const TOTAL_EQUIPMENT_COUNT = EQUIPMENT_CATALOG.length;
export const TOTAL_EQUIPMENT_VARIANTS = TOTAL_EQUIPMENT_COUNT;

export function createInitialState(): IdleRpgState {
  const starterWeapon: EquipmentItem = {
    id: 'starter-weapon',
    name: 'はじまりの木剣',
    slot: 'weapon',
    rarity: 'common',
    attack: 3,
    defense: 0,
    maxHp: 0,
    score: 3,
    locked: true,
    upgradeLevel: 0
  };

  return {
    version: 1,
    mode: 'guild',
    hero: {
      level: 1,
      xp: 0,
      nextXp: 24,
      hp: 52,
      maxHp: 52,
      baseAttack: 9,
      baseDefense: 2,
      gold: 0,
      rank: 'F',
      totalKills: 0
    },
    inventory: [starterWeapon],
    equipped: { weapon: starterWeapon.id, armor: null, charm: null },
    enemy: null,
    distance: 0,
    adventureKills: 0,
    encounterCount: 0,
    selectedArea: 'sunmeadow',
    unlockedAreas: ['sunmeadow'],
    areaProgress: {
      sunmeadow: { regularKills: 0, bossDefeated: false },
      'komorebi-forest': { regularKills: 0, bossDefeated: false }
    },
    quest: {
      id: 'slime-warmup',
      title: 'ぷるぷる討伐依頼',
      description: '草原のスライムを5体たおす',
      progress: 0,
      target: 5,
      rewardGold: 120,
      rewardXp: 30,
      claimed: false
    },
    logs: ['ギルドへようこそ！', 'まずは「冒険に出る」を選ぼう。']
  };
}

export function getAdventureArea(areaId: AdventureAreaId): AdventureAreaDefinition {
  return ADVENTURE_AREAS.find((area) => area.id === areaId) ?? ADVENTURE_AREAS[0]!;
}

export function isAdventureAreaUnlocked(state: IdleRpgState, areaId: AdventureAreaId): boolean {
  return state.unlockedAreas.includes(areaId);
}

export function getDerivedStats(state: IdleRpgState): DerivedStats {
  const equippedItems = Object.values(state.equipped)
    .map((id) => state.inventory.find((item) => item.id === id))
    .filter((item): item is EquipmentItem => item !== undefined);

  return equippedItems.reduce<DerivedStats>(
    (stats, item) => ({
      maxHp: stats.maxHp + item.maxHp,
      attack: stats.attack + item.attack,
      defense: stats.defense + item.defense
    }),
    {
      maxHp: state.hero.maxHp,
      attack: state.hero.baseAttack,
      defense: state.hero.baseDefense
    }
  );
}

export function startAdventure(state: IdleRpgState, random?: () => number): IdleRpgState;
export function startAdventure(
  state: IdleRpgState,
  areaId?: AdventureAreaId,
  random?: () => number
): IdleRpgState;
export function startAdventure(
  state: IdleRpgState,
  areaOrRandom: AdventureAreaId | (() => number) = state.selectedArea,
  random: () => number = Math.random
): IdleRpgState {
  if (state.mode === 'adventure') return state;
  const areaId = typeof areaOrRandom === 'function' ? state.selectedArea : areaOrRandom;
  const randomSource = typeof areaOrRandom === 'function' ? areaOrRandom : random;
  if (!isAdventureAreaId(areaId) || !isAdventureAreaUnlocked(state, areaId)) {
    const requestedArea = isAdventureAreaId(areaId) ? getAdventureArea(areaId).name : 'そのエリア';
    return {
      ...state,
      logs: appendLog(state.logs, `${requestedArea}はまだ解放されていません。`)
    };
  }
  const stats = getDerivedStats(state);
  const encounterCount = state.encounterCount + 1;
  const next = {
    ...state,
    mode: 'adventure' as const,
    hero: { ...state.hero, hp: stats.maxHp },
    distance: 0,
    adventureKills: 0,
    encounterCount,
    selectedArea: areaId,
    enemy: createNextEncounter(state, areaId, 0, encounterCount, randomSource),
    logs: appendLog(state.logs, `${getAdventureArea(areaId).name}へ出発した！`)
  };
  return next;
}

export function returnToGuild(state: IdleRpgState, reason = 'ギルドへ帰還した。'): IdleRpgState {
  const stats = getDerivedStats(state);
  return {
    ...state,
    mode: 'guild',
    hero: { ...state.hero, hp: stats.maxHp },
    enemy: null,
    distance: 0,
    adventureKills: 0,
    logs: appendLog(state.logs, reason)
  };
}

export function performHeroAttack(state: IdleRpgState, random: () => number = Math.random): CombatStep {
  if (state.mode !== 'adventure' || !state.enemy || state.hero.hp <= 0) return { state, events: [] };

  const stats = getDerivedStats(state);
  const critical = clampRoll(random()) < 0.1;
  const variance = 0.9 + clampRoll(random()) * 0.2;
  const damage = Math.max(1, Math.round((stats.attack - state.enemy.defense * 0.45) * variance * (critical ? 1.8 : 1)));
  const enemy = { ...state.enemy, hp: Math.max(0, state.enemy.hp - damage) };
  const hitEvent: CombatEvent = { type: 'hero-hit', damage, critical };

  if (enemy.hp > 0) return { state: { ...state, enemy }, events: [hitEvent] };
  return resolveVictory({ ...state, enemy }, random, hitEvent);
}

export function performEnemyAttack(state: IdleRpgState, random: () => number = Math.random): CombatStep {
  if (state.mode !== 'adventure' || !state.enemy || state.enemy.hp <= 0 || state.hero.hp <= 0) {
    return { state, events: [] };
  }

  const stats = getDerivedStats(state);
  const variance = 0.9 + clampRoll(random()) * 0.2;
  const damage = Math.max(1, Math.round((state.enemy.attack - stats.defense * 0.52) * variance));
  const hero = { ...state.hero, hp: Math.max(0, state.hero.hp - damage) };
  const events: CombatEvent[] = [{ type: 'enemy-hit', damage }];
  const damagedState = { ...state, hero };

  if (hero.hp > 0) return { state: damagedState, events };
  events.push({ type: 'hero-defeated' });
  return {
    state: returnToGuild(damagedState, `${state.distance}m地点で力尽き、ギルドに運ばれた。`),
    events
  };
}

export function equipItem(state: IdleRpgState, itemId: string): IdleRpgState {
  const item = state.inventory.find((candidate) => candidate.id === itemId);
  if (!item) return state;
  const previousStats = getDerivedStats(state);
  const equipped = { ...state.equipped, [item.slot]: item.id };
  const next = { ...state, equipped };
  const nextStats = getDerivedStats(next);
  const hp = Math.min(nextStats.maxHp, state.hero.hp + Math.max(0, nextStats.maxHp - previousStats.maxHp));
  return {
    ...next,
    hero: { ...state.hero, hp },
    logs: appendLog(state.logs, `${item.name}を装備した。`)
  };
}

export function sellItem(state: IdleRpgState, itemId: string): IdleRpgState {
  const item = state.inventory.find((candidate) => candidate.id === itemId);
  if (!item || item.locked || Object.values(state.equipped).includes(itemId)) return state;
  const price = Math.max(3, Math.round(item.score * 2.5));
  return {
    ...state,
    hero: { ...state.hero, gold: state.hero.gold + price },
    inventory: state.inventory.filter((candidate) => candidate.id !== itemId),
    logs: appendLog(state.logs, `${item.name}を${price}Gで売却した。`)
  };
}

export function getEnhancementCost(item: EquipmentItem): number {
  const level = normalizedUpgradeLevel(item);
  if (level >= MAX_ENHANCEMENT_LEVEL) return 0;

  const rarityMultiplier: Record<ItemRarity, number> = {
    common: 1,
    uncommon: 1.15,
    rare: 1.35,
    epic: 1.8,
    legendary: 2.35,
    mythic: 3,
    celestial: 3.8
  };
  const score = Number.isFinite(item.score) ? Math.max(1, item.score) : 1;
  const multiplier = rarityMultiplier[item.rarity] ?? rarityMultiplier.common;
  const baseValue = 18 + score * 1.8;
  return Math.max(1, Math.round(baseValue * multiplier * (1 + level * 0.55)));
}

export function enhanceItem(state: IdleRpgState, itemId: string): IdleRpgState {
  const itemIndex = state.inventory.findIndex((candidate) => candidate.id === itemId);
  if (itemIndex < 0) return state;

  const item = state.inventory[itemIndex]!;
  const upgradeLevel = normalizedUpgradeLevel(item);
  if (upgradeLevel >= MAX_ENHANCEMENT_LEVEL) return state;

  const cost = getEnhancementCost(item);
  if (!Number.isFinite(state.hero.gold) || !Number.isFinite(cost) || cost <= 0 || state.hero.gold < cost) return state;

  const previousStats = getDerivedStats(state);
  const enhanced = growEquipment(item, upgradeLevel + 1);
  const inventory = state.inventory.map((candidate, index) => index === itemIndex ? enhanced : candidate);
  const next = {
    ...state,
    inventory,
    hero: { ...state.hero, gold: state.hero.gold - cost }
  };
  const nextStats = getDerivedStats(next);
  const maxHpIncrease = Math.max(0, nextStats.maxHp - previousStats.maxHp);
  const hp = Math.min(nextStats.maxHp, next.hero.hp + maxHpIncrease);

  return {
    ...next,
    hero: { ...next.hero, hp },
    logs: appendLog(state.logs, `${item.name}を+${enhanced.upgradeLevel}に強化した。-${cost}G`)
  };
}

export function claimQuest(state: IdleRpgState): IdleRpgState {
  if (state.quest.claimed || state.quest.progress < state.quest.target) return state;
  const rewarded: IdleRpgState = {
    ...state,
    hero: { ...state.hero, gold: state.hero.gold + state.quest.rewardGold },
    quest: { ...state.quest, claimed: true },
    logs: appendLog(state.logs, `依頼達成！ ${state.quest.rewardGold}Gを受け取った。`)
  };
  return applyExperience(rewarded, state.quest.rewardXp).state;
}

export function inventoryScore(item: EquipmentItem): number {
  return item.attack * 2 + item.defense * 1.7 + item.maxHp * 0.32;
}

function resolveVictory(
  state: IdleRpgState,
  random: () => number,
  hitEvent: CombatEvent
): CombatStep {
  const enemy = state.enemy!;
  const areaId = state.selectedArea;
  const previousProgress = state.areaProgress[areaId];
  const isBoss = enemy.kind === 'crown-slime';
  const isFirstBossClear = isBoss && areaId === 'sunmeadow' && !previousProgress.bossDefeated;
  const nextAreaProgress: AdventureAreaProgress = isBoss
    ? { ...previousProgress, bossDefeated: true }
    : {
        ...previousProgress,
        regularKills: areaId === 'sunmeadow'
          ? Math.min(AREA_BOSS_KILL_TARGET, previousProgress.regularKills + 1)
          : previousProgress.regularKills + 1
      };
  let next: IdleRpgState = {
    ...state,
    hero: {
      ...state.hero,
      gold: state.hero.gold + enemy.gold + (isFirstBossClear ? 300 : 0),
      totalKills: state.hero.totalKills + 1
    },
    adventureKills: state.adventureKills + 1,
    distance: state.distance + 55 + Math.floor(clampRoll(random()) * 36),
    areaProgress: {
      ...state.areaProgress,
      [areaId]: nextAreaProgress
    },
    unlockedAreas: isFirstBossClear
      ? uniqueAreas([...state.unlockedAreas, 'komorebi-forest'])
      : state.unlockedAreas,
    quest: state.quest.claimed || enemy.kind === 'puffball'
      ? state.quest
      : { ...state.quest, progress: Math.min(state.quest.target, state.quest.progress + 1) },
    logs: appendLog(
      state.logs,
      isFirstBossClear
        ? `${enemy.name}を討伐！ 初回報酬300Gを獲得し、こもれび森が解放された！`
        : `${enemy.name}を討伐。${enemy.gold}G / EXP ${enemy.xp}`
    )
  };
  const events: CombatEvent[] = [
    hitEvent,
    { type: 'enemy-defeated', name: enemy.name, xp: enemy.xp, gold: enemy.gold }
  ];

  const experience = applyExperience(next, enemy.xp);
  next = experience.state;
  if (experience.leveledUp) events.push({ type: 'level-up', level: next.hero.level });

  if (isFirstBossClear) {
    const firstClearItem = createSunmeadowFirstClearReward();
    const equippedIds = new Set(Object.values(next.equipped).filter((id): id is string => id !== null));
    const replaceableItem = next.inventory
      .filter((item) => !item.locked && !equippedIds.has(item.id))
      .sort((a, b) => a.score - b.score)[0];
    if (next.inventory.length >= INVENTORY_LIMIT && replaceableItem) {
      const autoSell = Math.max(3, Math.round(replaceableItem.score * 2));
      events.push({ type: 'loot-auto-sold', item: replaceableItem, gold: autoSell });
      next = {
        ...next,
        hero: { ...next.hero, gold: next.hero.gold + autoSell },
        inventory: next.inventory.filter((item) => item.id !== replaceableItem.id),
        logs: appendLog(next.logs, `荷物がいっぱい。${replaceableItem.name}を${autoSell}Gで自動売却。`)
      };
    }
    events.push({ type: 'loot', item: firstClearItem });
    next = {
      ...next,
      inventory: [...next.inventory, firstClearItem],
      logs: appendLog(next.logs, `${firstClearItem.name}を手に入れた！`)
    };
    events.push({ type: 'area-unlocked', areaId: 'komorebi-forest', name: 'こもれび森' });
  }

  if (clampRoll(random()) < getAdventureAreaDropChance(areaId)) {
    const item = createEquipment(enemy.level, state.encounterCount, areaId, random);
    if (next.inventory.length < INVENTORY_LIMIT) {
      events.push({ type: 'loot', item });
      next = {
        ...next,
        inventory: [...next.inventory, item],
        logs: appendLog(next.logs, `${item.name}を手に入れた！`)
      };
    } else {
      const autoSell = Math.max(3, Math.round(item.score * 2));
      events.push({ type: 'loot-auto-sold', item, gold: autoSell });
      next = {
        ...next,
        hero: { ...next.hero, gold: next.hero.gold + autoSell },
        logs: appendLog(next.logs, `荷物がいっぱい。${item.name}を${autoSell}Gで自動売却。`)
      };
    }
  }

  const encounterCount = next.encounterCount + 1;
  next = {
    ...next,
    encounterCount,
    enemy: createNextEncounter(next, areaId, next.distance, encounterCount, random)
  };
  return { state: next, events };
}

function applyExperience(state: IdleRpgState, amount: number): { state: IdleRpgState; leveledUp: boolean } {
  let hero = { ...state.hero, xp: state.hero.xp + Math.max(0, Math.floor(amount)) };
  let leveledUp = false;
  while (hero.xp >= hero.nextXp) {
    hero.xp -= hero.nextXp;
    hero.level += 1;
    hero.nextXp = Math.round(hero.nextXp * 1.32 + 9);
    hero.maxHp += 7;
    hero.hp += 7;
    hero.baseAttack += 2;
    hero.baseDefense += 1;
    hero.rank = rankForLevel(hero.level);
    leveledUp = true;
  }
  return { state: { ...state, hero }, leveledUp };
}

function createNextEncounter(
  state: IdleRpgState,
  areaId: AdventureAreaId,
  distance: number,
  encounterCount: number,
  random: () => number
): EnemyState {
  const progress = state.areaProgress[areaId];
  if (areaId === 'sunmeadow' && progress.regularKills >= AREA_BOSS_KILL_TARGET && !progress.bossDefeated) {
    return createCrownSlime(encounterCount);
  }
  return createEnemy(distance, encounterCount, areaId, random);
}

function createCrownSlime(encounterCount: number): EnemyState {
  const maxHp = 150;
  return {
    id: `boss-${encounterCount}`,
    kind: 'crown-slime',
    name: 'おおきな王冠スライム',
    level: 5,
    hp: maxHp,
    maxHp,
    attack: 14,
    defense: 5,
    xp: 72,
    gold: 96
  };
}

function createEnemy(
  distance: number,
  encounterCount: number,
  areaId: AdventureAreaId,
  random: () => number
): EnemyState {
  const areaLevelOffset = areaId === 'komorebi-forest' ? 4 : 1;
  const level = areaLevelOffset + Math.floor(distance / 240);
  const roll = clampRoll(random());
  const kind: Exclude<EnemyKind, 'crown-slime'> = roll < 0.62
    ? 'mint-slime'
    : roll < 0.88 ? 'berry-slime' : 'puffball';
  const meadowNames: Record<Exclude<EnemyKind, 'crown-slime'>, string> = {
    'mint-slime': 'ミントスライム',
    'berry-slime': 'ベリースライム',
    puffball: 'わたげポポ'
  };
  const forestNames: Record<Exclude<EnemyKind, 'crown-slime'>, string> = {
    'mint-slime': 'こもれびスライム',
    'berry-slime': '木いちごスライム',
    puffball: 'きのこポポ'
  };
  const name = (areaId === 'komorebi-forest' ? forestNames : meadowNames)[kind];
  const maxHp = 20 + level * 6 + (kind === 'puffball' ? 8 : 0);
  return {
    id: `enemy-${encounterCount}`,
    kind,
    name,
    level,
    hp: maxHp,
    maxHp,
    attack: 5 + level * 2 + (kind === 'berry-slime' ? 1 : 0),
    defense: 1 + level + (kind === 'puffball' ? 2 : 0),
    xp: 6 + level * 3,
    gold: 4 + level * 3
  };
}

export function createEquipment(
  level: number,
  encounterCount: number,
  areaId: AdventureAreaId,
  random: () => number
): EquipmentItem {
  const slotRoll = clampRoll(random());
  const slot: EquipmentSlot = slotRoll < 0.4 ? 'weapon' : slotRoll < 0.75 ? 'armor' : 'charm';
  const rarity = rollEquipmentRarity(areaId, random());
  const basePool = EQUIPMENT_BASES_BY_AREA[areaId][slot];
  const baseIndex = Math.floor(clampRoll(random()) * basePool.length);
  const base = basePool[baseIndex]!;
  const areaQuality = areaId === 'komorebi-forest' ? 1.15 : 1;
  const multiplier = RARITY_MULTIPLIER[rarity] * (1 + Math.max(0, level - 1) * 0.12) * areaQuality;
  const item: EquipmentItem = {
    id: `loot-${encounterCount}-${Math.floor(clampRoll(random()) * 1_000_000).toString(36)}`,
    name: `${EQUIPMENT_RARITY_LABELS[rarity]}${base.name}`,
    slot,
    rarity,
    attack: Math.round(base.attack * multiplier),
    defense: Math.round(base.defense * multiplier),
    maxHp: Math.round(base.maxHp * multiplier),
    score: 0,
    locked: false,
    upgradeLevel: 0
  };
  return { ...item, score: Math.round(inventoryScore(item)) };
}

function createSunmeadowFirstClearReward(): EquipmentItem {
  const item: EquipmentItem = {
    id: 'first-clear-sunmeadow-charm',
    name: '王冠スライムのお守り',
    slot: 'charm',
    rarity: 'epic',
    attack: 3,
    defense: 3,
    maxHp: 14,
    score: 0,
    locked: true,
    upgradeLevel: 0
  };
  return { ...item, score: Math.round(inventoryScore(item)) };
}

function getAdventureAreaDropChance(areaId: AdventureAreaId): number {
  return areaId === 'komorebi-forest' ? 0.62 : 0.48;
}

function growEquipment(item: EquipmentItem, upgradeLevel: number): EquipmentItem {
  let attack = item.attack;
  let defense = item.defense;
  let maxHp = item.maxHp;

  if (item.slot === 'weapon') {
    attack += Math.max(1, Math.ceil(Math.max(1, item.attack) * 0.12));
  } else if (item.slot === 'armor') {
    defense += Math.max(1, Math.ceil(Math.max(1, item.defense) * 0.12));
    maxHp += Math.max(2, Math.ceil(Math.max(1, item.maxHp) * 0.1));
  } else {
    attack += Math.max(1, Math.ceil(Math.max(1, item.attack) * 0.1));
    defense += Math.max(1, Math.ceil(Math.max(1, item.defense) * 0.1));
    maxHp += Math.max(1, Math.ceil(Math.max(1, item.maxHp) * 0.08));
  }

  const enhanced = { ...item, attack, defense, maxHp, upgradeLevel };
  return {
    ...enhanced,
    score: Math.max(item.score + 1, Math.round(inventoryScore(enhanced)))
  };
}

function normalizedUpgradeLevel(item: EquipmentItem): number {
  const value = Number((item as EquipmentItem & { upgradeLevel?: number }).upgradeLevel);
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_ENHANCEMENT_LEVEL, Math.max(0, Math.floor(value)));
}

function rankForLevel(level: number): HeroState['rank'] {
  if (level >= 36) return 'S';
  if (level >= 28) return 'A';
  if (level >= 21) return 'B';
  if (level >= 15) return 'C';
  if (level >= 9) return 'D';
  if (level >= 4) return 'E';
  return 'F';
}

function appendLog(logs: string[], message: string): string[] {
  return [...logs, message].slice(-30);
}

function uniqueAreas(areaIds: AdventureAreaId[]): AdventureAreaId[] {
  return [...new Set(areaIds)];
}

function isAdventureAreaId(value: unknown): value is AdventureAreaId {
  return value === 'sunmeadow' || value === 'komorebi-forest';
}

function clampRoll(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}
