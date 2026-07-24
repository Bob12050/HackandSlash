import {
  claimQuest,
  createInitialState,
  equipItem,
  performEnemyAttack,
  performHeroAttack,
  returnToGuild,
  sellItem,
  startAdventure,
  type CombatEvent,
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

  startAdventure(): void {
    this.heroClock = 0;
    this.enemyClock = 0;
    this.setState(startAdventure(this.currentState));
  }

  returnToGuild(): void {
    this.heroClock = 0;
    this.enemyClock = 0;
    this.setState(returnToGuild(this.currentState));
  }

  equip(itemId: string): void {
    this.setState(equipItem(this.currentState, itemId));
  }

  sell(itemId: string): void {
    this.setState(sellItem(this.currentState, itemId));
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
      const restored = parsed as IdleRpgState;
      return returnToGuild(restored, '冒険の記録を読み込んだ。');
    } catch {
      return createInitialState();
    }
  }
}

export const runtime = new IdleRpgRuntime();
