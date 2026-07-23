export type EnemyKind = 'thrall' | 'hound' | 'brute' | 'seer';
export type ItemKind = 'blade' | 'armor' | 'boots' | 'ring';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface EnemyDefinition {
  kind: EnemyKind;
  label: string;
  radius: number;
  health: number;
  speed: number;
  damage: number;
  experience: number;
  color: number;
}

export interface PlayerStats {
  maxHealth: number;
  health: number;
  damage: number;
  moveSpeed: number;
  attackRate: number;
  attackRange: number;
  criticalChance: number;
  armor: number;
  lifeOnKill: number;
}

export interface HudState {
  health: number;
  maxHealth: number;
  experience: number;
  nextExperience: number;
  level: number;
  kills: number;
  gold: number;
  wave: number;
  waveRemaining: number;
  elapsed: number;
  dashRatio: number;
}

export interface RunSummary {
  elapsed: number;
  kills: number;
  level: number;
  wave: number;
  gold: number;
}

export interface UpgradeChoice {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface LootItem {
  id: string;
  kind: ItemKind;
  rarity: ItemRarity;
  name: string;
  statLabel: string;
  value: number;
  suffix: string;
}
