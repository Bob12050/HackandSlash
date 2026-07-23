import type { EnemyDefinition, EnemyKind, ItemRarity, UpgradeChoice } from './types';

export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  thrall: { kind: 'thrall', label: '裂けた亡者', radius: 16, health: 46, speed: 74, damage: 11, experience: 9, color: 0xa72f4a },
  hound: { kind: 'hound', label: '灰喰らい', radius: 12, health: 30, speed: 132, damage: 8, experience: 7, color: 0xd45d43 },
  brute: { kind: 'brute', label: '黒鉄の巨躯', radius: 26, health: 165, speed: 48, damage: 22, experience: 24, color: 0x694251 },
  seer: { kind: 'seer', label: '深淵の眼', radius: 18, health: 70, speed: 55, damage: 13, experience: 16, color: 0x7655a5 }
};

export const RARITY_DATA: Record<ItemRarity, { label: string; color: number; multiplier: number }> = {
  common: { label: '古びた', color: 0xaeb8be, multiplier: 1 },
  rare: { label: '蒼き', color: 0x55b8ed, multiplier: 1.55 },
  epic: { label: '深淵の', color: 0xbd73f5, multiplier: 2.25 },
  legendary: { label: '失われし', color: 0xedb75d, multiplier: 3.4 }
};

export const UPGRADE_CHOICES: UpgradeChoice[] = [
  { id: 'damage', icon: '刃', title: '血濡れの刃', description: '斬撃ダメージ +25%' },
  { id: 'speed', icon: '迅', title: '疾風の型', description: '攻撃速度 +18%' },
  { id: 'vitality', icon: '心', title: '不屈の心臓', description: '最大体力 +30、体力を全回復' },
  { id: 'mobility', icon: '影', title: '影渡り', description: '移動速度 +12%、ダッシュ再使用 -10%' },
  { id: 'critical', icon: '凶', title: '凶兆', description: 'クリティカル率 +10%' },
  { id: 'reach', icon: '円', title: '長き間合い', description: '攻撃範囲 +20%' },
  { id: 'leech', icon: '吸', title: '血の契約', description: '敵撃破時、最大体力の3%回復' },
  { id: 'armor', icon: '甲', title: '黒鉄の皮膚', description: '受けるダメージ -12%' }
];
