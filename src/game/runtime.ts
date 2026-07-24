import {
  claimQuest,
  createInitialState,
  enhanceItem,
  equipItem,
  equipRecommended,
  performEnemyAttack,
  performHeroAttack,
  returnToGuild,
  sellItem,
  startAdventure,
  inventoryScore,
  MAX_ENHANCEMENT_LEVEL,
  type AdventureAreaId,
  type AdventureAreaProgress,
  type CombatEvent,
  type EquipmentItem,
  type EquipmentRecommendationMode,
  type EquipmentSlot,
  type HeroState,
  type IdleRpgState
} from './idleRpg';

type StateListener = (state: IdleRpgState) => void;
type CombatListener = (events: CombatEvent[]) => void;

const STORAGE_KEY = 'pocket-guild-save-v1';

class IdleRpgRuntime {
  private currentState = this.load();
  private readonly stateListeners = new Set<StateListener>();
  private readonly combatListeners = new Set<CombatListener>();
  private heroClock = 0;
  private enemyClock = 0;

  get state(): IdleRpgState {
    return this.currentState;
  }

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  onCombat(listener: CombatListener): () => void {
    this.combatListeners.add(listener);
    return () => this.combatListeners.delete(listener);
  }

  startAdventure(areaId: AdventureAreaId = this.currentState.selectedArea): void {
    this.heroClock = 0;
    this.enemyClock = 0;
    this.setState(startAdventure(this.currentState, areaId));
  }

  returnToGuild(): void {
    this.heroClock = 0;
    this.enemyClock = 0;
    this.setState(returnToGuild(this.currentState));
  }

  equip(itemId: string): void {
    this.setState(equipItem(this.currentState, itemId));
  }

  equipRecommended(mode: EquipmentRecommendationMode): boolean {
    const next = equipRecommended(this.currentState, mode);
    if (next === this.currentState) return false;
    this.setState(next);
    return true;
  }

  sell(itemId: string): void {
    this.setState(sellItem(this.currentState, itemId));
  }

  enhance(itemId: string): boolean {
    const next = enhanceItem(this.currentState, itemId);
    if (next === this.currentState) return false;
    this.setState(next);
    return true;
  }

  claimQuest(): void {
    this.setState(claimQuest(this.currentState));
  }

  update(deltaMs: number): void {
    if (this.currentState.mode !== 'adventure') {
      this.heroClock = 0;
      this.enemyClock = 0;
      return;
    }

    const delta = Math.min(Math.max(0, deltaMs), 100);
    this.heroClock += delta;
    this.enemyClock += delta;

    if (this.heroClock >= 820) {
      this.heroClock -= 820;
      const result = performHeroAttack(this.currentState);
      this.applyCombat(result.state, result.events);
      if (result.events.some((event) => event.type === 'enemy-defeated')) this.enemyClock = 0;
    }

    if (this.currentState.mode === 'adventure' && this.enemyClock >= 1180) {
      this.enemyClock -= 1180;
      const result = performEnemyAttack(this.currentState);
      this.applyCombat(result.state, result.events);
    }
  }

  reset(): void {
    this.heroClock = 0;
    this.enemyClock = 0;
    this.setState(createInitialState());
  }

  private applyCombat(state: IdleRpgState, events: CombatEvent[]): void {
    if (events.length === 0) return;
    this.currentState = state;
    this.persist();
    this.combatListeners.forEach((listener) => listener(events));
    this.stateListeners.forEach((listener) => listener(state));
  }

  private setState(state: IdleRpgState): void {
    if (state === this.currentState) return;
    this.currentState = state;
    this.persist();
    this.stateListeners.forEach((listener) => listener(state));
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentState));
    } catch {
      // Private browsing and storage quotas should not block play.
    }
  }

  private load(): IdleRpgState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return createInitialState();
      const parsed = JSON.parse(saved) as Partial<IdleRpgState>;
      if (parsed.version !== 1 || !parsed.hero || !parsed.inventory || !parsed.equipped || !parsed.quest) {
        return createInitialState();
      }
      const restored = normalizeSavedState(parsed);
      if (!restored) return createInitialState();
      return returnToGuild(restored, '冒険の記録を読み込んだ。');
    } catch {
      return createInitialState();
    }
  }
}

function normalizeSavedState(parsed: Partial<IdleRpgState>): IdleRpgState | null {
  if (parsed.version !== 1 || !isRecord(parsed.hero) || !Array.isArray(parsed.inventory)
    || !isRecord(parsed.equipped) || !isRecord(parsed.quest)) return null;

  const fallback = createInitialState();
  const normalizedItems = parsed.inventory
    .map((item) => normalizeEquipmentItem(item))
    .filter((item): item is EquipmentItem => item !== null);
  const inventory = normalizedItems.length > 0 ? deduplicateItems(normalizedItems) : fallback.inventory;
  const heroSource = parsed.hero as Partial<HeroState>;
  const hero: HeroState = {
    level: safeInteger(heroSource.level, fallback.hero.level, 1),
    xp: safeInteger(heroSource.xp, fallback.hero.xp, 0),
    nextXp: safeInteger(heroSource.nextXp, fallback.hero.nextXp, 1),
    hp: safeNumber(heroSource.hp, fallback.hero.hp, 0),
    maxHp: safeNumber(heroSource.maxHp, fallback.hero.maxHp, 1),
    baseAttack: safeNumber(heroSource.baseAttack, fallback.hero.baseAttack, 0),
    baseDefense: safeNumber(heroSource.baseDefense, fallback.hero.baseDefense, 0),
    gold: safeInteger(heroSource.gold, fallback.hero.gold, 0),
    rank: isRank(heroSource.rank) ? heroSource.rank : fallback.hero.rank,
    totalKills: safeInteger(heroSource.totalKills, fallback.hero.totalKills, 0)
  };
  const questSource = parsed.quest;
  const questTarget = safeInteger(questSource.target, fallback.quest.target, 1);
  const areaProgress = normalizeAreaProgress(parsed.areaProgress, fallback.areaProgress);
  const unlockedAreas = normalizeUnlockedAreas(parsed.unlockedAreas, areaProgress);
  const selectedArea = isAdventureAreaId(parsed.selectedArea) && unlockedAreas.includes(parsed.selectedArea)
    ? parsed.selectedArea
    : fallback.selectedArea;

  return {
    version: 1,
    mode: 'guild',
    hero,
    inventory,
    equipped: {
      weapon: normalizeEquippedId(parsed.equipped.weapon, 'weapon', inventory),
      armor: normalizeEquippedId(parsed.equipped.armor, 'armor', inventory),
      charm: normalizeEquippedId(parsed.equipped.charm, 'charm', inventory)
    },
    enemy: null,
    distance: 0,
    adventureKills: 0,
    encounterCount: safeInteger(parsed.encounterCount, 0, 0),
    selectedArea,
    unlockedAreas,
    areaProgress,
    quest: {
      id: safeText(questSource.id, fallback.quest.id),
      title: safeText(questSource.title, fallback.quest.title),
      description: safeText(questSource.description, fallback.quest.description),
      progress: Math.min(questTarget, safeInteger(questSource.progress, 0, 0)),
      target: questTarget,
      rewardGold: safeInteger(questSource.rewardGold, fallback.quest.rewardGold, 0),
      rewardXp: safeInteger(questSource.rewardXp, fallback.quest.rewardXp, 0),
      claimed: questSource.claimed === true
    },
    logs: Array.isArray(parsed.logs)
      ? parsed.logs.filter((log): log is string => typeof log === 'string').slice(-60)
      : fallback.logs
  };
}

function normalizeEquipmentItem(value: unknown): EquipmentItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.name !== 'string' || value.name.length === 0 || !isSlot(value.slot)) return null;
  const base = {
    id: value.id,
    name: value.name,
    slot: value.slot,
    rarity: isRarity(value.rarity) ? value.rarity : 'common' as const,
    attack: safeInteger(value.attack, 0, 0),
    defense: safeInteger(value.defense, 0, 0),
    maxHp: safeInteger(value.maxHp, 0, 0),
    score: 0,
    locked: value.locked === true,
    upgradeLevel: normalizeUpgradeLevel(value.upgradeLevel)
  };
  return {
    ...base,
    score: safeInteger(value.score, Math.max(0, Math.round(inventoryScore(base))), 0)
  };
}

function normalizeAreaProgress(
  value: unknown,
  fallback: Record<AdventureAreaId, AdventureAreaProgress>
): Record<AdventureAreaId, AdventureAreaProgress> {
  const source = isRecord(value) ? value : {};
  const meadowSource = isRecord(source.sunmeadow) ? source.sunmeadow : {};
  const forestSource = isRecord(source['komorebi-forest']) ? source['komorebi-forest'] : {};
  return {
    sunmeadow: {
      regularKills: Math.min(10, safeInteger(meadowSource.regularKills, fallback.sunmeadow.regularKills, 0)),
      bossDefeated: meadowSource.bossDefeated === true
    },
    'komorebi-forest': {
      regularKills: safeInteger(forestSource.regularKills, fallback['komorebi-forest'].regularKills, 0),
      bossDefeated: forestSource.bossDefeated === true
    }
  };
}

function normalizeUnlockedAreas(
  value: unknown,
  areaProgress: Record<AdventureAreaId, AdventureAreaProgress>
): AdventureAreaId[] {
  const savedAreas = Array.isArray(value) ? value.filter(isAdventureAreaId) : [];
  if (areaProgress.sunmeadow.bossDefeated) savedAreas.push('komorebi-forest');
  return [...new Set<AdventureAreaId>(['sunmeadow', ...savedAreas])];
}

function deduplicateItems(items: EquipmentItem[]): EquipmentItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeEquippedId(value: unknown, slot: EquipmentSlot, inventory: EquipmentItem[]): string | null {
  if (typeof value !== 'string') return null;
  return inventory.some((item) => item.id === value && item.slot === slot) ? value : null;
}

function safeNumber(value: unknown, fallback: number, minimum: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, numeric) : fallback;
}

function safeInteger(value: unknown, fallback: number, minimum: number): number {
  return Math.floor(safeNumber(value, fallback, minimum));
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSlot(value: unknown): value is EquipmentSlot {
  return value === 'weapon' || value === 'armor' || value === 'charm';
}

function isRarity(value: unknown): value is EquipmentItem['rarity'] {
  return value === 'common' || value === 'uncommon' || value === 'rare'
    || value === 'epic' || value === 'legendary' || value === 'mythic'
    || value === 'celestial' || value === 'relic';
}

function isAdventureAreaId(value: unknown): value is AdventureAreaId {
  return value === 'sunmeadow' || value === 'komorebi-forest';
}

function isRank(value: unknown): value is HeroState['rank'] {
  return value === 'F' || value === 'E' || value === 'D' || value === 'C'
    || value === 'B' || value === 'A' || value === 'S';
}

function normalizeUpgradeLevel(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_ENHANCEMENT_LEVEL, Math.max(0, Math.floor(numeric)));
}

export const runtime = new IdleRpgRuntime();
