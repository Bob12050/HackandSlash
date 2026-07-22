import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Random,
  beginRun,
  calculateDamage,
  completeEncounter,
  computePlayerStats,
  createEncounter,
  createItem,
  createNewState,
  equipItem,
  generateDrops,
  inventoryLimit,
  itemScore,
  rarityMeta,
  resolvePlayerAttack,
  rollRarity,
  salvageItem,
  storeItems,
} from '../src/engine.js';
import { loadSave } from '../src/storage.js';

test('new game starts with a complete, playable loadout', () => {
  const state = createNewState(1);
  const stats = computePlayerStats(state);
  assert.equal(state.player.level, 1);
  assert.ok(state.equipment.weapon);
  assert.ok(state.equipment.armor);
  assert.ok(state.equipment.charm);
  assert.deepEqual(stats, {
    maxHp: 120,
    attack: 20,
    defense: 10,
    crit: 5,
    lifesteal: 0,
    fortune: 0,
    breakPower: 0,
    potionPower: 0,
    thorns: 0,
    attackPct: 0,
    defensePct: 0,
  });
});

test('seeded random produces repeatable values', () => {
  const first = new Random(42);
  const second = new Random(42);
  assert.deepEqual(
    Array.from({ length: 8 }, () => first.next()),
    Array.from({ length: 8 }, () => second.next()),
  );
});

test('damage stays positive and critical hits are stronger', () => {
  const normalRng = { next: () => 0.5, chance: () => false };
  const critRng = { next: () => 0.5, chance: () => true };
  const normal = calculateDamage(20, 10, 1, 5, normalRng);
  const critical = calculateDamage(20, 10, 1, 5, critRng);
  assert.ok(normal.damage >= 1);
  assert.ok(critical.damage > normal.damage);
  assert.equal(critical.critical, true);
});

test('minimum rarity is always respected', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const rarity = rollRarity(1, 0, new Random(seed), 2);
    assert.ok(rarityMeta(rarity).rank >= 2);
  }
});

test('generated gear has the expected affix count and useful score', () => {
  const item = createItem('weapon', 5, new Random(12), { rarity: 'epic' });
  assert.equal(item.affixes.length, 3);
  assert.equal(new Set(item.affixes.map((entry) => entry.id)).size, 3);
  assert.ok(item.stats.attack > 0);
  assert.ok(item.score > 0);
});

test('all ten floors generate a valid encounter', () => {
  const state = createNewState(7);
  for (let floor = 1; floor <= 10; floor += 1) {
    const encounter = createEncounter(state, floor, new Random(floor));
    assert.ok(encounter.enemies.length >= 1 && encounter.enemies.length <= 3);
    encounter.enemies.forEach((enemy) => {
      assert.ok(enemy.hp > 0);
      assert.ok(enemy.break > 0);
      assert.ok(enemy.intent?.name);
    });
    if (floor === 5 || floor === 10) assert.equal(encounter.enemies[0].boss, true);
  }
});

test('player attacks damage HP and break gauge', () => {
  const state = createNewState(3);
  beginRun(state, 1);
  const encounter = createEncounter(state, 1, new Random(3));
  const enemy = encounter.enemies[0];
  const hp = enemy.hp;
  const stance = enemy.break;
  const outcome = resolvePlayerAttack(state, encounter, { type: 'attack', targetId: enemy.uid }, new Random(4));
  assert.equal(outcome.results.length, 1);
  assert.ok(enemy.hp < hp);
  assert.ok(enemy.break < stance);
});

test('victory grants rewards, loot, healing, and floor progress', () => {
  const state = createNewState(9);
  beginRun(state, 1);
  state.run.hp = 50;
  const encounter = createEncounter(state, 1, new Random(9));
  encounter.enemies.forEach((enemy) => { enemy.hp = 0; enemy.dead = true; });
  const result = completeEncounter(state, encounter, new Random(10));
  assert.ok(result.xp > 0);
  assert.ok(result.gold > 0);
  assert.ok(result.drops.length >= 1);
  assert.equal(state.progress.clearedFloor, 1);
  assert.equal(state.progress.maxFloor, 2);
  assert.ok(state.run.hp > 50);
});

test('boss drops include at least one rare item', () => {
  const state = createNewState(11);
  const drops = generateDrops(state, 5, true, new Random(11));
  assert.equal(drops.length, 3);
  assert.ok(drops.some((item) => rarityMeta(item.rarity).rank >= 2));
});

test('equipping and salvaging both preserve inventory consistency', () => {
  const state = createNewState(18);
  const first = createItem('weapon', 3, new Random(19), { rarity: 'rare' });
  const second = createItem('armor', 2, new Random(20), { rarity: 'magic' });
  storeItems(state, [first, second]);
  const previous = state.equipment.weapon;
  const equipped = equipItem(state, first.id);
  assert.equal(equipped.item.id, first.id);
  assert.equal(state.equipment.weapon.id, first.id);
  assert.equal(state.inventory.some((item) => item.id === previous.id), false, 'starter gear should not return to the bag');
  const before = state.player.ember;
  const value = salvageItem(state, second.id);
  assert.ok(value > 0);
  assert.equal(state.player.ember, before + value);
  assert.equal(state.inventory.some((item) => item.id === second.id), false);
});

test('equipping lower max-HP gear clamps current run HP to the new maximum', () => {
  const state = createNewState(21);
  beginRun(state, 1);
  state.run.hp = computePlayerStats(state).maxHp;
  state.inventory.push({
    id: 'fragile-charm',
    slot: 'charm',
    itemLevel: 1,
    rarity: 'common',
    name: '空の護符',
    stats: {},
    affixes: [],
    score: 0,
  });

  equipItem(state, 'fragile-charm');

  const newMaximum = computePlayerStats(state).maxHp;
  assert.equal(newMaximum, 112);
  assert.equal(state.run.hp, newMaximum);
});

test('item score values percentage attack, percentage defense, and potion power', () => {
  const base = { rarity: 'common', itemLevel: 1, stats: {} };
  const baseline = itemScore(base);

  assert.ok(itemScore({ ...base, stats: { attackPct: 5 } }) > baseline);
  assert.ok(itemScore({ ...base, stats: { defensePct: 5 } }) > baseline);
  assert.ok(itemScore({ ...base, stats: { potionPower: 5 } }) > baseline);
});

test('a legendary drop is recorded even when a full inventory auto-salvages it', () => {
  const state = createNewState(22);
  state.inventory = Array.from({ length: inventoryLimit() }, (_, index) => ({
    id: `filler-${index}`,
    slot: 'weapon',
    itemLevel: 1,
    rarity: 'common',
    stats: { attack: 1 },
  }));
  const legendary = createItem('weapon', 10, new Random(23), { rarity: 'legendary' });

  const result = storeItems(state, [legendary]);

  assert.equal(result.kept.length, 0);
  assert.ok(result.ember > 0);
  assert.equal(state.records.legendaryFound, 1);
});

test('loadSave falls back to a valid backup when the primary save is corrupt', () => {
  const backup = createNewState(24);
  backup.player.gold = 987;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWarn = console.warn;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) {
        if (key === 'ashen-relics-save-v1') return '{broken-json';
        if (key === 'ashen-relics-save-backup-v1') return JSON.stringify(backup);
        return null;
      },
    },
  });
  console.warn = () => {};

  try {
    const loaded = loadSave();
    assert.ok(loaded);
    assert.equal(loaded.player.gold, 987);
  } finally {
    console.warn = previousWarn;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});
