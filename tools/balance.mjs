import {
  Random,
  beginRun,
  completeEncounter,
  computePlayerStats,
  createEncounter,
  createNewState,
  equipItem,
  resolveEnemyAttack,
  resolvePlayerAttack,
} from '../src/engine.js';

const samples = Number(process.argv[2] || 250);
const report = {
  samples,
  completed: 0,
  floorDeaths: Array(11).fill(0),
  turns: Array(11).fill(0),
  encounters: Array(11).fill(0),
  endingLevel: 0,
  endingPower: 0,
};

for (let sample = 1; sample <= samples; sample += 1) {
  const rng = new Random(sample * 7919);
  const state = createNewState(sample);
  let completed = true;

  for (let floor = 1; floor <= 10; floor += 1) {
    // Conservative baseline: the hunter returns to the altar between depths.
    beginRun(state, floor);
    const encounter = createEncounter(state, floor, rng);
    let turn = 0;

    while (state.run.hp > 0 && encounter.enemies.some((enemy) => !enemy.dead) && turn < 80) {
      turn += 1;
      const stats = computePlayerStats(state);
      if (state.run.hp < stats.maxHp * 0.42 && state.run.potions > 0) {
        state.run.potions -= 1;
        state.run.hp = Math.min(stats.maxHp, state.run.hp + Math.round(stats.maxHp * 0.4));
      } else {
        const targets = encounter.enemies.filter((enemy) => !enemy.dead).sort((a, b) => a.hp - b.hp);
        const target = targets[0];
        encounter.selectedEnemyId = target.uid;
        let skillId = null;
        if (state.run.focus >= 1 && target.break <= 62) skillId = 'bellBreaker';
        else if (state.run.focus >= 2) skillId = 'ashenEdge';
        if (skillId === 'bellBreaker') state.run.focus -= 1;
        else if (skillId === 'ashenEdge') state.run.focus -= 2;
        else state.run.focus = Math.min(5, state.run.focus + 1);
        resolvePlayerAttack(state, encounter, { type: skillId ? 'skill' : 'attack', skillId, targetId: target.uid }, rng);
      }

      if (encounter.enemies.every((enemy) => enemy.dead)) break;
      for (const enemy of encounter.enemies.filter((entry) => !entry.dead)) {
        if (enemy.stunned) {
          enemy.stunned = false;
          enemy.break = enemy.maxBreak;
          continue;
        }
        resolveEnemyAttack(state, enemy, rng);
        if (state.run.hp <= 0) break;
      }
    }

    report.turns[floor] += turn;
    report.encounters[floor] += 1;
    if (state.run.hp <= 0 || turn >= 80) {
      report.floorDeaths[floor] += 1;
      completed = false;
      break;
    }

    const result = completeEncounter(state, encounter, rng);
    result.drops.forEach((item) => {
      if (item.score > (state.equipment[item.slot]?.score || 0)) equipItem(state, item.id);
    });
  }

  if (completed) {
    report.completed += 1;
    report.endingLevel += state.player.level;
    const stats = computePlayerStats(state);
    report.endingPower += stats.attack * 4 + stats.defense * 3.2 + stats.maxHp * 0.35;
  }
}

console.log(`Campaign completion: ${report.completed}/${samples} (${(report.completed / samples * 100).toFixed(1)}%)`);
console.log('Floor | avg turns | defeat rate');
for (let floor = 1; floor <= 10; floor += 1) {
  const encounters = report.encounters[floor] || 1;
  console.log(`${String(floor).padStart(5)} | ${(report.turns[floor] / encounters).toFixed(2).padStart(9)} | ${(report.floorDeaths[floor] / encounters * 100).toFixed(1).padStart(10)}%`);
}
if (report.completed) {
  console.log(`Average ending level: ${(report.endingLevel / report.completed).toFixed(2)}`);
  console.log(`Average ending core power: ${(report.endingPower / report.completed).toFixed(1)}`);
}
