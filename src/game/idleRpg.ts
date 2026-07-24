export type GameMode = 'guild' | 'adventure';
export type EquipmentSlot = 'weapon' | 'armor' | 'charm';
export type ItemRarity = 'common' | 'rare' | 'epic';
export type EnemyKind = 'mint-slime' | 'berry-slime' | 'puffball';

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
  | { type: 'hero-defeated' };

export interface CombatStep {
  state: IdleRpgState;
  events: CombatEvent[];
}

export const INVENTORY_LIMIT = 30;
export const MAX_ENHANCEMENT_LEVEL = 10;

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: '素朴な',
  rare: 'きらめく',
  epic: '星降る'
};

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  rare: 1.65,
  epic: 2.55
};

const ITEM_BASES: Record<EquipmentSlot, { name: string; attack: number; defense: number; maxHp: number }> = {
  weapon: { name: '旅立ちの剣', attack: 4, defense: 0, maxHp: 0 },
  armor: { name: '森色のケープ', attack: 0, defense: 3, maxHp: 7 },
  charm: { name: '小鳥のお守り', attack: 1, defense: 1, maxHp: 4 }
};

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

export function startAdventure(state: IdleRpgState, random: () => number = Math.random): IdleRpgState {
  if (state.mode === 'adventure') return state;
  const stats = getDerivedStats(state);
  const next = {
    ...state,
    mode: 'adventure' as const,
    hero: { ...state.hero, hp: stats.maxHp },
    distance: 0,
    adventureKills: 0,
    encounterCount: 1,
    enemy: createEnemy(0, 1, random),
    logs: appendLog(state.logs, 'そよかぜ草原へ出発した！')
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
    rare: 1.35,
    epic: 1.8
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
  let next: IdleRpgState = {
    ...state,
    hero: {
      ...state.hero,
      gold: state.hero.gold + enemy.gold,
      totalKills: state.hero.totalKills + 1
    },
    adventureKills: state.adventureKills + 1,
    distance: state.distance + 55 + Math.floor(clampRoll(random()) * 36),
    quest: state.quest.claimed || enemy.kind === 'puffball'
      ? state.quest
      : { ...state.quest, progress: Math.min(state.quest.target, state.quest.progress + 1) },
    logs: appendLog(state.logs, `${enemy.name}を討伐。${enemy.gold}G / EXP ${enemy.xp}`)
  };
  const events: CombatEvent[] = [
    hitEvent,
    { type: 'enemy-defeated', name: enemy.name, xp: enemy.xp, gold: enemy.gold }
  ];

  const experience = applyExperience(next, enemy.xp);
  next = experience.state;
  if (experience.leveledUp) events.push({ type: 'level-up', level: next.hero.level });

  if (clampRoll(random()) < 0.48) {
    const item = createEquipment(enemy.level, state.encounterCount, random);
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
    enemy: createEnemy(next.distance, encounterCount, random)
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

function createEnemy(distance: number, encounterCount: number, random: () => number): EnemyState {
  const level = 1 + Math.floor(distance / 240);
  const roll = clampRoll(random());
  const kind: EnemyKind = roll < 0.62 ? 'mint-slime' : roll < 0.88 ? 'berry-slime' : 'puffball';
  const name = kind === 'mint-slime' ? 'ミントスライム' : kind === 'berry-slime' ? 'ベリースライム' : 'わたげポポ';
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

function createEquipment(level: number, encounterCount: number, random: () => number): EquipmentItem {
  const slotRoll = clampRoll(random());
  const slot: EquipmentSlot = slotRoll < 0.4 ? 'weapon' : slotRoll < 0.75 ? 'armor' : 'charm';
  const rarityRoll = clampRoll(random());
  const rarity: ItemRarity = rarityRoll < 0.72 ? 'common' : rarityRoll < 0.95 ? 'rare' : 'epic';
  const base = ITEM_BASES[slot];
  const multiplier = RARITY_MULTIPLIER[rarity] * (1 + Math.max(0, level - 1) * 0.12);
  const item: EquipmentItem = {
    id: `loot-${encounterCount}-${Math.floor(clampRoll(random()) * 1_000_000).toString(36)}`,
    name: `${RARITY_LABELS[rarity]}${base.name}`,
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

function clampRoll(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}
