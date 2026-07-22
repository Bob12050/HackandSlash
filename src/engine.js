import {
  AFFIXES,
  ENEMIES,
  FLOOR_DATA,
  GAME_VERSION,
  ITEM_BASES,
  PLAYER_SKILLS,
  RARITIES,
  SLOT_META,
} from './data.js';

const RARITY_ORDER = ['common', 'magic', 'rare', 'epic', 'legendary'];
const INVENTORY_LIMIT = 36;

export class Random {
  constructor(seed = Date.now()) {
    this.seed = (Number(seed) >>> 0) || 0x6d2b79f5;
  }

  next() {
    let value = (this.seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }
}

function uid(prefix, rng) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(rng.next() * 0xffffff).toString(36)}`;
}

export function xpNeeded(level) {
  return 28 + level * 24 + Math.max(0, level - 3) * 8;
}

export function createNewState(seed = Date.now()) {
  const rng = new Random(seed);
  const starterWeapon = createStarterItem('weapon', rng);
  const starterArmor = createStarterItem('armor', rng);
  const starterCharm = createStarterItem('charm', rng);
  return {
    version: GAME_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    player: {
      name: '名もなき灰狩り',
      level: 1,
      xp: 0,
      focus: 2,
      gold: 30,
      ember: 0,
      potions: 3,
    },
    equipment: {
      weapon: starterWeapon,
      armor: starterArmor,
      charm: starterCharm,
    },
    inventory: [],
    progress: {
      maxFloor: 1,
      clearedFloor: 0,
      bosses: [],
      endingSeen: false,
    },
    run: null,
    records: {
      battles: 0,
      victories: 0,
      defeats: 0,
      kills: 0,
      legendaryFound: 0,
      bestHit: 0,
    },
    settings: {
      sound: true,
      shake: true,
      vibration: true,
    },
    flags: {
      openingSeen: false,
      lootHelpSeen: false,
      breakHelpSeen: false,
      pendingEnding: false,
    },
  };
}

function createStarterItem(slot, rng) {
  const starter = {
    weapon: { name: '灰狩りの短剣', icon: '剣', stats: { attack: 4 } },
    armor: { name: '旅立ちの革衣', icon: '衣', stats: { defense: 2 } },
    charm: { name: '小さな残り火', icon: '灯', stats: { maxHp: 8 } },
  }[slot];
  return {
    id: uid('starter', rng),
    slot,
    itemLevel: 0,
    rarity: 'common',
    name: starter.name,
    icon: starter.icon,
    stats: starter.stats,
    affixes: [],
    score: itemScore({ stats: starter.stats, rarity: 'common', itemLevel: 0 }),
    foundAt: 0,
    starter: true,
  };
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fresh = createNewState();
  const state = {
    ...fresh,
    ...raw,
    version: GAME_VERSION,
    player: { ...fresh.player, ...(raw.player || {}) },
    equipment: { ...fresh.equipment, ...(raw.equipment || {}) },
    progress: { ...fresh.progress, ...(raw.progress || {}) },
    records: { ...fresh.records, ...(raw.records || {}) },
    settings: { ...fresh.settings, ...(raw.settings || {}) },
    flags: { ...fresh.flags, ...(raw.flags || {}) },
    inventory: Array.isArray(raw.inventory) ? raw.inventory.slice(0, INVENTORY_LIMIT) : [],
  };
  state.updatedAt = Date.now();
  return state;
}

export function computePlayerStats(state) {
  const level = Math.max(1, state.player.level || 1);
  const totals = {
    maxHp: 112 + (level - 1) * 14,
    attack: 16 + (level - 1) * 3,
    defense: 8 + (level - 1) * 2,
    crit: 5,
    lifesteal: 0,
    fortune: 0,
    breakPower: 0,
    potionPower: 0,
    thorns: 0,
    attackPct: 0,
    defensePct: 0,
  };

  Object.values(state.equipment || {}).filter(Boolean).forEach((item) => {
    Object.entries(item.stats || {}).forEach(([stat, amount]) => {
      totals[stat] = (totals[stat] || 0) + amount;
    });
  });

  totals.attack = Math.round(totals.attack * (1 + totals.attackPct / 100));
  totals.defense = Math.round(totals.defense * (1 + totals.defensePct / 100));
  totals.maxHp = Math.round(totals.maxHp);
  totals.crit = Math.min(50, totals.crit);
  totals.lifesteal = Math.min(15, totals.lifesteal);
  return totals;
}

export function calculateDamage(attack, defense, power, critChance, rng = new Random()) {
  const variance = 0.95 + rng.next() * 0.1;
  const critical = rng.chance(Math.max(0, critChance) / 100);
  const raw = Math.max(1, attack * power - defense * 0.48);
  return {
    damage: Math.max(1, Math.round(raw * variance * (critical ? 1.55 : 1))),
    critical,
  };
}

export function floorInfo(floor) {
  const safe = Math.min(Math.max(1, floor), FLOOR_DATA.length - 1);
  return FLOOR_DATA[safe];
}

export function createEncounter(state, floor, rng = new Random()) {
  const info = floorInfo(floor);
  const ids = info.boss
    ? [info.boss]
    : Array.from({ length: rng.int(info.count[0], info.count[1]) }, () => rng.pick(info.enemies));
  const seen = new Map();
  const enemies = ids.map((id) => {
    const template = ENEMIES[id];
    const serial = (seen.get(id) || 0) + 1;
    seen.set(id, serial);
    const scale = template.boss ? 1 : 1 + Math.max(0, floor - (template.minFloor || 1)) * 0.035;
    const maxHp = Math.round(template.hp * scale);
    const maxBreak = Math.round(template.break * (1 + Math.max(0, floor - 1) * 0.018));
    const enemy = {
      uid: uid(id, rng),
      templateId: id,
      name: template.name,
      displayName: ids.filter((value) => value === id).length > 1 ? `${template.name} ${toLetter(serial)}` : template.name,
      kind: template.kind,
      boss: Boolean(template.boss),
      maxHp,
      hp: maxHp,
      attack: Math.round(template.attack * scale),
      defense: Math.round(template.defense * scale),
      maxBreak,
      break: maxBreak,
      stunned: false,
      dead: false,
      speed: template.speed,
      intent: null,
      turnCount: 0,
      xp: Math.round(template.xp * scale),
      gold: Math.round(template.gold * scale),
    };
    enemy.intent = rollEnemyIntent(enemy, rng);
    return enemy;
  });

  return {
    floor,
    info,
    enemies,
    turn: 1,
    selectedEnemyId: enemies[0]?.uid || null,
    log: `${info.name}に魔物の気配が満ちる。`,
  };
}

function toLetter(index) {
  return String.fromCharCode(64 + Math.min(26, index));
}

export function rollEnemyIntent(enemy, rng = new Random()) {
  const template = ENEMIES[enemy.templateId];
  enemy.turnCount += 1;
  let candidates = template.moves.filter((move) => !move.hpThreshold || enemy.hp / enemy.maxHp <= move.hpThreshold);
  if (enemy.boss && enemy.turnCount % 3 === 0) {
    const dangerous = candidates.filter((move) => move.telegraph || move.power >= 1.35);
    if (dangerous.length) candidates = dangerous;
  }
  const move = rng.pick(candidates);
  return {
    ...move,
    danger: Boolean(move.telegraph || move.power >= 1.3),
  };
}

export function selectedEnemy(encounter) {
  return encounter.enemies.find((enemy) => enemy.uid === encounter.selectedEnemyId && !enemy.dead)
    || encounter.enemies.find((enemy) => !enemy.dead)
    || null;
}

export function resolvePlayerAttack(state, encounter, action, rng = new Random()) {
  const stats = computePlayerStats(state);
  const definition = action.type === 'skill'
    ? PLAYER_SKILLS.find((skill) => skill.id === action.skillId)
    : null;
  const power = definition?.power || 1;
  const baseBreak = definition?.break || 20;
  const targets = definition?.target === 'all'
    ? encounter.enemies.filter((enemy) => !enemy.dead)
    : [encounter.enemies.find((enemy) => enemy.uid === action.targetId && !enemy.dead) || selectedEnemy(encounter)].filter(Boolean);
  const results = [];

  targets.forEach((enemy) => {
    const brokenBonus = enemy.stunned ? 1.32 : 1;
    const outcome = calculateDamage(stats.attack, enemy.defense, power * brokenBonus, stats.crit, rng);
    enemy.hp = Math.max(0, enemy.hp - outcome.damage);
    const breakDamage = Math.round((baseBreak + stats.breakPower) * (outcome.critical ? 1.2 : 1));
    enemy.break = Math.max(0, enemy.break - breakDamage);
    let broke = false;
    if (enemy.break <= 0 && enemy.hp > 0) {
      enemy.stunned = true;
      broke = true;
    }
    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.stunned = false;
    }
    results.push({ enemy, ...outcome, breakDamage, broke });
  });

  const totalDamage = results.reduce((sum, result) => sum + result.damage, 0);
  const healing = Math.min(
    Math.max(0, Math.round(totalDamage * stats.lifesteal / 100)),
    Math.max(0, stats.maxHp - (state.run?.hp || stats.maxHp)),
  );
  if (state.run && healing > 0) state.run.hp += healing;
  state.records.bestHit = Math.max(state.records.bestHit || 0, ...results.map((result) => result.damage));
  return { results, healing, definition };
}

export function resolveEnemyAttack(state, enemy, rng = new Random()) {
  const stats = computePlayerStats(state);
  const intent = enemy.intent;
  const outcome = calculateDamage(enemy.attack, stats.defense, intent.power, intent.crit ? intent.crit * 100 : 3, rng);
  const guarded = Boolean(state.run?.guarding);
  const damage = Math.max(1, Math.round(outcome.damage * (guarded ? 0.4 : 1)));
  if (state.run) state.run.hp = Math.max(0, state.run.hp - damage);
  const reflected = guarded && stats.thorns > 0 ? Math.min(enemy.hp, stats.thorns) : 0;
  if (reflected) {
    enemy.hp -= reflected;
    if (enemy.hp <= 0) enemy.dead = true;
  }
  enemy.intent = rollEnemyIntent(enemy, rng);
  return { damage, critical: outcome.critical, guarded, reflected, intent };
}

export function beginRun(state, floor = state.progress.maxFloor) {
  const stats = computePlayerStats(state);
  state.run = {
    floor: Math.min(Math.max(1, floor), FLOOR_DATA.length - 1),
    hp: stats.maxHp,
    focus: 2,
    potions: 3,
    guarding: false,
    startedAt: Date.now(),
    lootFound: 0,
    encounter: null,
    phase: 'player',
  };
  return state.run;
}

export function recoverAtCamp(state) {
  state.run = null;
  state.player.focus = 2;
  state.player.potions = 3;
}

export function addXp(state, amount) {
  const levels = [];
  state.player.xp += amount;
  while (state.player.xp >= xpNeeded(state.player.level)) {
    state.player.xp -= xpNeeded(state.player.level);
    state.player.level += 1;
    levels.push(state.player.level);
  }
  return levels;
}

export function completeEncounter(state, encounter, rng = new Random()) {
  const xp = encounter.enemies.reduce((sum, enemy) => sum + enemy.xp, 0);
  const gold = encounter.enemies.reduce((sum, enemy) => sum + enemy.gold, 0);
  const levels = addXp(state, xp);
  state.player.gold += gold;
  state.records.victories += 1;
  state.records.kills += encounter.enemies.length;
  state.progress.clearedFloor = Math.max(state.progress.clearedFloor, encounter.floor);
  state.progress.maxFloor = Math.min(FLOOR_DATA.length - 1, Math.max(state.progress.maxFloor, encounter.floor + 1));
  if (encounter.info.boss && !state.progress.bosses.includes(encounter.info.boss)) {
    state.progress.bosses.push(encounter.info.boss);
  }
  const drops = generateDrops(state, encounter.floor, Boolean(encounter.info.boss), rng);
  const stored = storeItems(state, drops);
  if (state.run) {
    const stats = computePlayerStats(state);
    state.run.hp = Math.min(stats.maxHp, state.run.hp + Math.round(stats.maxHp * (encounter.info.boss ? 0.3 : 0.12)));
    state.run.focus = Math.min(5, state.run.focus + 1);
    state.run.floor = Math.min(FLOOR_DATA.length - 1, encounter.floor + 1);
    state.run.lootFound += stored.kept.length;
  }
  return { xp, gold, levels, drops: stored.kept, overflowEmber: stored.ember };
}

export function registerDefeat(state) {
  state.records.defeats += 1;
  const lostGold = Math.min(state.player.gold, Math.floor(state.player.gold * 0.12));
  state.player.gold -= lostGold;
  recoverAtCamp(state);
  return lostGold;
}

export function rollRarity(floor, fortune = 0, rng = new Random(), minimumRank = 0) {
  let weights;
  if (floor <= 2) weights = [64, 28, 7, 0.8, 0.2];
  else if (floor <= 4) weights = [50, 33, 14, 2.5, 0.5];
  else weights = [39, 34, 20, 5.8, 1.2];
  const luckShift = Math.min(18, fortune * 0.55);
  weights[0] = Math.max(8, weights[0] - luckShift);
  weights[2] += luckShift * 0.55;
  weights[3] += luckShift * 0.32;
  weights[4] += luckShift * 0.13;
  for (let index = 0; index < minimumRank; index += 1) weights[index] = 0;
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = rng.next() * total;
  const index = weights.findIndex((weight) => ((roll -= weight) <= 0));
  return RARITY_ORDER[Math.max(minimumRank, index < 0 ? 0 : index)];
}

export function createItem(slot, itemLevel, rng = new Random(), options = {}) {
  const rarityId = options.rarity || rollRarity(itemLevel, options.fortune || 0, rng, options.minimumRank || 0);
  const rarity = RARITIES[rarityId];
  const bases = ITEM_BASES[slot];
  const unlocked = bases.slice(0, Math.min(bases.length, 2 + Math.floor(itemLevel / 3)));
  const base = rng.pick(unlocked);
  const stats = {};
  if (slot === 'weapon') stats.attack = Math.round((4 + itemLevel * 2.35) * rarity.multiplier);
  if (slot === 'armor') {
    stats.defense = Math.round((1 + itemLevel * 1.45) * rarity.multiplier);
    stats.maxHp = Math.round((4 + itemLevel * 2.4) * rarity.multiplier);
  }
  if (slot === 'charm') stats.maxHp = Math.round((7 + itemLevel * 3.7) * rarity.multiplier);

  const affixes = [];
  const pool = AFFIXES.filter((affix) => affix.slots.includes(slot));
  while (affixes.length < rarity.affixes && pool.length) {
    const choice = rng.pick(pool.filter((affix) => !affixes.some((used) => used.id === affix.id)));
    if (!choice) break;
    const scale = 1 + Math.max(0, itemLevel - 1) * 0.085;
    const value = Math.max(1, Math.round((choice.min + rng.next() * (choice.max - choice.min)) * scale));
    affixes.push({ id: choice.id, label: choice.label, stat: choice.stat, mode: choice.mode, value });
    stats[choice.stat] = (stats[choice.stat] || 0) + value;
  }

  const prefixes = {
    common: '',
    magic: '燐光の',
    rare: affixes[0] ? `${affixes[0].label}の` : '黄金の',
    epic: '忘却を裂く',
    legendary: '遺灰に刻まれし',
  };
  const item = {
    id: uid('gear', rng),
    slot,
    itemLevel,
    rarity: rarityId,
    name: `${prefixes[rarityId]}${base.name}`,
    icon: base.icon,
    style: base.style,
    stats,
    affixes,
    foundAt: itemLevel,
  };
  item.score = itemScore(item);
  return item;
}

export function itemScore(item) {
  const stats = item.stats || {};
  const rarity = RARITIES[item.rarity] || RARITIES.common;
  return Math.round(
    (stats.attack || 0) * 4
      + (stats.defense || 0) * 3.3
      + (stats.maxHp || 0) * 0.42
      + (stats.crit || 0) * 3
      + (stats.lifesteal || 0) * 4
      + (stats.fortune || 0) * 1.4
      + (stats.breakPower || 0) * 0.8
      + (stats.attackPct || 0) * 2.4
      + (stats.defensePct || 0) * 1.8
      + (stats.potionPower || 0) * 0.65
      + (stats.thorns || 0) * 3
      + rarity.rank * 4
      + (item.itemLevel || 0) * 2,
  );
}

export function generateDrops(state, floor, boss = false, rng = new Random()) {
  const stats = computePlayerStats(state);
  const slots = Object.keys(SLOT_META);
  const weakest = slots
    .slice()
    .sort((a, b) => (state.equipment[a]?.score || 0) - (state.equipment[b]?.score || 0))[0];
  const count = boss ? 3 : 1 + (rng.chance(0.32 + stats.fortune / 300) ? 1 : 0);
  const drops = [];
  for (let index = 0; index < count; index += 1) {
    const slot = rng.chance(0.45) ? weakest : rng.pick(slots);
    const minimumRank = boss && index === 0 ? (rng.chance(0.18) ? 4 : 2) : 0;
    drops.push(createItem(slot, floor, rng, { fortune: stats.fortune, minimumRank }));
  }
  return drops;
}

export function storeItems(state, items) {
  const kept = [];
  let ember = 0;
  items.forEach((item) => {
    if (item.rarity === 'legendary') state.records.legendaryFound += 1;
    if (state.inventory.length < INVENTORY_LIMIT) {
      state.inventory.push(item);
      kept.push(item);
    } else {
      ember += salvageValue(item);
    }
  });
  state.player.ember += ember;
  return { kept, ember };
}

export function equipItem(state, itemId) {
  const index = state.inventory.findIndex((item) => item.id === itemId);
  if (index < 0) return null;
  const [item] = state.inventory.splice(index, 1);
  const previous = state.equipment[item.slot] || null;
  state.equipment[item.slot] = item;
  if (previous && !previous.starter) state.inventory.push(previous);
  if (state.run) state.run.hp = Math.min(state.run.hp, computePlayerStats(state).maxHp);
  return { item, previous };
}

export function salvageValue(item) {
  const rarity = RARITIES[item.rarity] || RARITIES.common;
  return Math.max(1, 1 + rarity.rank * 3 + Math.floor((item.itemLevel || 0) / 2));
}

export function salvageItem(state, itemId) {
  const index = state.inventory.findIndex((item) => item.id === itemId);
  if (index < 0) return 0;
  const [item] = state.inventory.splice(index, 1);
  const value = salvageValue(item);
  state.player.ember += value;
  return value;
}

export function compareItem(state, item) {
  const current = state.equipment[item.slot];
  const stats = [
    'attack', 'attackPct', 'defense', 'defensePct', 'maxHp', 'crit', 'lifesteal', 'fortune',
    'breakPower', 'potionPower', 'thorns',
  ];
  return stats
    .map((stat) => ({
      stat,
      current: current?.stats?.[stat] || 0,
      next: item.stats?.[stat] || 0,
      delta: (item.stats?.[stat] || 0) - (current?.stats?.[stat] || 0),
    }))
    .filter((row) => row.current || row.next);
}

export function statLabel(stat) {
  return {
    attack: '攻撃', defense: '防御', maxHp: '最大HP', crit: '会心', lifesteal: '吸命', fortune: '幸運',
    breakPower: '崩し', potionPower: '薬効', thorns: '反棘', attackPct: '攻撃%', defensePct: '防御%',
  }[stat] || stat;
}

export function statValue(stat, value, signed = false) {
  const percent = ['crit', 'lifesteal', 'fortune', 'potionPower', 'attackPct', 'defensePct'].includes(stat);
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value}${percent ? '%' : ''}`;
}

export function rarityMeta(id) {
  return RARITIES[id] || RARITIES.common;
}

export function inventoryLimit() {
  return INVENTORY_LIMIT;
}

export function nextFloorAvailable(state) {
  return Math.min(FLOOR_DATA.length - 1, Math.max(1, state.run?.floor || state.progress.maxFloor));
}
