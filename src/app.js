import { FLOOR_DATA, PLAYER_SKILLS, RARITIES, SLOT_META, STORY, TIPS } from './data.js';
import {
  Random,
  addXp,
  beginRun,
  compareItem,
  completeEncounter,
  computePlayerStats,
  createEncounter,
  createNewState,
  equipItem,
  floorInfo,
  inventoryLimit,
  nextFloorAvailable,
  rarityMeta,
  recoverAtCamp,
  registerDefeat,
  resolveEnemyAttack,
  resolvePlayerAttack,
  rollEnemyIntent,
  salvageItem,
  selectedEnemy,
  statLabel,
  statValue,
  xpNeeded,
} from './engine.js';
import { sound } from './audio.js';
import { BattleRenderer } from './renderer.js';
import { deleteSave, hasSave, loadSave, saveGame } from './storage.js';

const screen = document.querySelector('#screen');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');
const topbar = document.querySelector('#topbar');
const screenTitle = document.querySelector('#screen-title');
const eyebrow = document.querySelector('#eyebrow');
const backButton = document.querySelector('#back-button');
const soundButton = document.querySelector('#sound-button');
const goldValue = document.querySelector('#gold-value');
const emberValue = document.querySelector('#ember-value');
const srLive = document.querySelector('#sr-live');

let state = null;
let currentView = 'title';
let backHandler = null;
let encounter = null;
let renderer = null;
let busy = false;
let victoryResult = null;
let inventoryFilter = 'all';
let storyIndex = 0;
const rng = new Random(Date.now() ^ Math.floor(performance.now() * 1000));

init();

function init() {
  renderTitle();
  screen.addEventListener('click', onScreenClick);
  modalRoot.addEventListener('click', onModalClick);
  backButton.addEventListener('click', () => backHandler?.());
  soundButton.addEventListener('click', toggleSound);
  document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveStateIfStable();
  });
  window.addEventListener('beforeunload', saveStateIfStable);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  window.__ASHEN_RELICS__ = {
    getState: () => structuredClone(state),
    newGame: () => startNewGame(true),
    renderHome,
  };
}

function showTopbar(title, sub = 'ASHEN RELICS', onBack = null) {
  topbar.classList.remove('is-hidden');
  topbar.classList.toggle('has-back', Boolean(onBack));
  screenTitle.textContent = title;
  eyebrow.textContent = sub;
  backHandler = onBack;
  backButton.classList.toggle('is-hidden', !onBack);
  updateTopbar();
}

function hideTopbar() {
  topbar.classList.add('is-hidden');
  topbar.classList.remove('has-back');
  backHandler = null;
}

function updateTopbar() {
  goldValue.textContent = formatNumber(state?.player?.gold || 0);
  emberValue.textContent = formatNumber(state?.player?.ember || 0);
  soundButton.textContent = state?.settings?.sound === false ? '♩' : '♪';
  soundButton.setAttribute('aria-label', state?.settings?.sound === false ? '音声をオンにする' : '音声をオフにする');
}

function setScreen(html, view) {
  destroyRenderer();
  currentView = view;
  screen.innerHTML = html;
  screen.scrollTop = 0;
}

function destroyRenderer() {
  renderer?.destroy();
  renderer = null;
}

function renderTitle() {
  state = null;
  encounter = null;
  modalRoot.innerHTML = '';
  hideTopbar();
  const template = document.querySelector('#title-template');
  setScreen(template.innerHTML, 'title');
  const continueButton = screen.querySelector('[data-action="continue"]');
  if (!hasSave()) {
    continueButton.disabled = true;
    continueButton.textContent = 'セーブデータなし';
  }
}

function continueGame() {
  const loaded = loadSave();
  if (!loaded) {
    toast('セーブデータを読み込めませんでした');
    renderTitle();
    return;
  }
  state = loaded;
  sound.setEnabled(state.settings.sound);
  sound.play('confirm');
  if (!state.flags.openingSeen) {
    storyIndex = 0;
    renderOpening();
    return;
  }
  if (state.flags.pendingEnding && !state.progress.endingSeen) {
    renderEnding();
    return;
  }
  renderHome();
}

function startNewGame(force = false) {
  if (hasSave() && !force) {
    showConfirm(
      'はじめから遊びますか？',
      '現在のセーブデータは上書きされます。',
      'はじめから',
      () => startNewGame(true),
    );
    return;
  }
  deleteSave();
  state = createNewState(Date.now());
  sound.setEnabled(true);
  saveGame(state);
  storyIndex = 0;
  renderOpening();
}

function renderOpening() {
  hideTopbar();
  currentView = 'opening';
  const line = STORY.opening[storyIndex];
  setScreen(`
    <div class="opening-screen view-enter">
      <div class="opening-art" aria-hidden="true">
        <div class="opening-bell"></div>
        <div class="opening-flame"></div>
      </div>
      <div class="opening-copy">
        <span>${String(storyIndex + 1).padStart(2, '0')} / ${String(STORY.opening.length).padStart(2, '0')}</span>
        <p>${escapeHtml(line)}</p>
      </div>
      <button class="primary-button" data-action="story-next" type="button">
        ${storyIndex === STORY.opening.length - 1 ? '灯を掲げる' : 'つぎへ'}
      </button>
    </div>
  `, 'opening');
}

function nextStory() {
  sound.play('confirm');
  storyIndex += 1;
  if (storyIndex >= STORY.opening.length) {
    state.flags.openingSeen = true;
    saveGame(state);
    renderHome();
  } else {
    renderOpening();
  }
}

function renderHome() {
  if (!state) return renderTitle();
  if (state.flags.pendingEnding && !state.progress.endingSeen) return renderEnding();
  currentView = 'home';
  showTopbar('灰灯の祭壇', 'CAMP OF THE ASHEN LAMP');
  const stats = computePlayerStats(state);
  const nextFloor = state.run?.floor || state.progress.maxFloor;
  const floor = floorInfo(nextFloor);
  const xpMax = xpNeeded(state.player.level);
  const hp = state.run ? state.run.hp : stats.maxHp;
  const runActive = Boolean(state.run);
  const equipment = Object.entries(SLOT_META).map(([slot, meta]) => {
    const item = state.equipment[slot];
    const rarity = rarityMeta(item.rarity);
    return `
      <button class="equipment-mini" data-action="inventory" data-filter="${slot}" type="button">
        <span class="equipment-icon rarity-${item.rarity}" aria-hidden="true">${escapeHtml(item.icon || meta.icon)}</span>
        <span><small>${meta.label}</small><strong style="--rarity:${rarity.color}">${escapeHtml(item.name)}</strong></span>
        <b>戦力 ${item.score}</b>
      </button>`;
  }).join('');

  setScreen(`
    <div class="home-screen view-enter">
      <section class="hero-panel cut-panel">
        <div class="hero-avatar" aria-hidden="true">
          <span class="avatar-flame"></span>
          <span class="avatar-silhouette"></span>
        </div>
        <div class="hero-identity">
          <p>THE ASHEN HUNTER</p>
          <h2>${escapeHtml(state.player.name)}</h2>
          <span>LV.${state.player.level} <i></i> 戦力 ${totalPower(stats)}</span>
        </div>
        <div class="hero-vitals">
          ${barMarkup('HP', hp, stats.maxHp, 'hp')}
          ${barMarkup('EXP', state.player.xp, xpMax, 'xp')}
        </div>
        <dl class="stat-row">
          <div><dt>攻撃</dt><dd>${stats.attack}</dd></div>
          <div><dt>防御</dt><dd>${stats.defense}</dd></div>
          <div><dt>会心</dt><dd>${stats.crit}%</dd></div>
          <div><dt>吸命</dt><dd>${stats.lifesteal}%</dd></div>
        </dl>
      </section>

      <section class="expedition-card ${floor.boss ? 'is-boss' : ''}">
        <div class="expedition-glow" aria-hidden="true"></div>
        <div class="expedition-heading">
          <span>${floor.boss ? 'BOSS CHAMBER' : 'NEXT DEPTH'}</span>
          <strong>深度 ${String(nextFloor).padStart(2, '0')}</strong>
        </div>
        <h2>${escapeHtml(floor.name)}</h2>
        <p>${floor.boss ? '強大な鐘の気配。帰還の準備を整えよ。' : '灰の奥から、まだ見ぬ聖遺物が呼んでいる。'}</p>
        <div class="depth-track" aria-label="迷宮の進行度">
          ${Array.from({ length: 10 }, (_, index) => {
            const value = index + 1;
            const status = value <= state.progress.clearedFloor ? 'cleared' : value === nextFloor ? 'current' : '';
            return `<i class="${status} ${value % 5 === 0 ? 'boss-node' : ''}">${value % 5 === 0 ? '◆' : ''}</i>`;
          }).join('')}
        </div>
        <button class="expedition-button" data-action="explore" type="button">
          <span>${runActive ? '探索を再開' : '探索へ向かう'}</span>
          <small>${runActive ? `HP ${state.run.hp}で深度${state.run.floor}へ` : '装備はいつでも持ち帰れる'}</small>
        </button>
      </section>

      <section class="home-section">
        <div class="section-heading"><div><small>EQUIPMENT</small><h3>現在の装備</h3></div><button data-action="inventory" type="button">一覧を見る ›</button></div>
        <div class="equipment-list">${equipment}</div>
      </section>

      <nav class="home-nav" aria-label="拠点メニュー">
        <button data-action="inventory" type="button"><span aria-hidden="true">◇</span><b>装備</b><small>${state.inventory.length}/${inventoryLimit()}</small></button>
        <button data-action="records" type="button"><span aria-hidden="true">▥</span><b>記録</b><small>戦歴と指南</small></button>
      </nav>
      <p class="home-tip"><i>TIP</i>${escapeHtml(rng.pick(TIPS))}</p>
    </div>
  `, 'home');
  updateTopbar();
}

function startExploration() {
  sound.play('confirm');
  if (!state.run) beginRun(state, state.progress.maxFloor);
  state.run.floor = Math.min(state.run.floor, FLOOR_DATA.length - 1);
  startBattle(nextFloorAvailable(state));
}

function startBattle(floor) {
  modalRoot.innerHTML = '';
  victoryResult = null;
  busy = false;
  const savedEncounter = state.run.encounter;
  const canResume = state.run.phase === 'player'
    && savedEncounter?.floor === floor
    && Array.isArray(savedEncounter.enemies)
    && savedEncounter.enemies.some((enemy) => !enemy.dead);
  encounter = canResume ? savedEncounter : createEncounter(state, floor, rng);
  if (!canResume) state.records.battles += 1;
  state.run.floor = floor;
  state.run.guarding = false;
  state.run.encounter = encounter;
  state.run.phase = 'player';
  saveGame(state);
  renderBattle();
}

function renderBattle() {
  destroyRenderer();
  currentView = 'battle';
  const floor = encounter.info;
  showTopbar(floor.short, `DEPTH ${String(encounter.floor).padStart(2, '0')}`, null);
  screen.innerHTML = `
    <div class="battle-screen view-enter">
      <div class="battle-meta">
        <span>${floor.boss ? 'BOSS BATTLE' : `ENCOUNTER ${state.records.battles}`}</span>
        <b id="turn-label">TURN ${String(encounter.turn).padStart(2, '0')}</b>
      </div>
      <div class="battle-stage">
        <canvas id="battle-canvas" width="720" height="500" role="img" aria-label="${escapeHtml(floor.name)}での戦闘"></canvas>
        <div class="stage-vignette" aria-hidden="true"></div>
      </div>
      <div id="enemy-roster" class="enemy-roster"></div>
      <div id="battle-log" class="battle-log"><i></i><span>${escapeHtml(encounter.log)}</span></div>
      <section class="player-combat-panel">
        <div class="combat-player-head">
          <div><small>LV.${state.player.level}</small><strong>${escapeHtml(state.player.name)}</strong></div>
          <div id="focus-pips" class="focus-pips" aria-label="集中"></div>
        </div>
        <div id="player-bars" class="player-bars"></div>
        <div id="command-area" class="command-area"></div>
      </section>
    </div>
  `;
  renderer = new BattleRenderer(screen.querySelector('#battle-canvas'), encounter, { shake: state.settings.shake });
  updateBattleUI();
  renderCommands();
  announce(`${floor.name}。${encounter.enemies.map((enemy) => enemy.name).join('、')}が現れた。`);
}

function updateBattleUI() {
  if (currentView !== 'battle') return;
  const stats = computePlayerStats(state);
  const roster = screen.querySelector('#enemy-roster');
  roster.innerHTML = encounter.enemies.map((enemy) => {
    const selected = enemy.uid === encounter.selectedEnemyId;
    const hpPct = Math.max(0, enemy.hp / enemy.maxHp * 100);
    const breakPct = Math.max(0, enemy.break / enemy.maxBreak * 100);
    return `
      <button class="enemy-card ${selected ? 'is-selected' : ''} ${enemy.dead ? 'is-dead' : ''}" data-enemy-id="${enemy.uid}" type="button" ${enemy.dead ? 'disabled' : ''}>
        <div><strong>${escapeHtml(enemy.displayName)}</strong><span class="intent ${enemy.intent?.danger ? 'danger' : ''}">${enemy.stunned ? '体勢崩壊' : `予兆：${escapeHtml(enemy.intent?.name || '攻撃')}`}</span></div>
        <div class="enemy-gauges">
          <span class="mini-bar"><i class="hp" style="width:${hpPct}%"></i></span>
          <span class="mini-bar break"><i style="width:${breakPct}%"></i></span>
          <small>${enemy.hp}/${enemy.maxHp}</small>
        </div>
      </button>`;
  }).join('');

  screen.querySelector('#player-bars').innerHTML = `
    ${barMarkup('HP', state.run.hp, stats.maxHp, 'hp')}
    <div class="potion-count"><i aria-hidden="true">✚</i><span>薬瓶</span><b>${state.run.potions}/3</b></div>
  `;
  screen.querySelector('#focus-pips').innerHTML = `<span>集中</span>${Array.from({ length: 5 }, (_, index) => `<i class="${index < state.run.focus ? 'filled' : ''}"></i>`).join('')}`;
  screen.querySelector('#turn-label').textContent = `TURN ${String(encounter.turn).padStart(2, '0')}`;
  updateTopbar();
}

function renderCommands() {
  const area = screen.querySelector('#command-area');
  if (!area) return;
  area.innerHTML = `
    <button class="command-button attack" data-command="attack" type="button" ${busy ? 'disabled' : ''}>
      <span class="command-rune">刃</span><b>攻撃</b><small>集中 +1</small>
    </button>
    <button class="command-button skill" data-command="skills" type="button" ${busy ? 'disabled' : ''}>
      <span class="command-rune">紋</span><b>技</b><small>集中を消費</small>
    </button>
    <button class="command-button guard" data-command="guard" type="button" ${busy ? 'disabled' : ''}>
      <span class="command-rune">盾</span><b>防御</b><small>軽減・集中 +2</small>
    </button>
    <button class="command-button item" data-command="potion" type="button" ${busy || state.run.potions <= 0 ? 'disabled' : ''}>
      <span class="command-rune">薬</span><b>薬瓶</b><small>HPを回復 ${state.run.potions}/3</small>
    </button>
  `;
}

function renderSkillMenu() {
  const area = screen.querySelector('#command-area');
  area.innerHTML = `
    <div class="skill-menu-head"><strong>戦技を選ぶ</strong><button data-command="close-skills" type="button">閉じる ×</button></div>
    ${PLAYER_SKILLS.map((skill) => `
      <button class="skill-row" data-skill-id="${skill.id}" type="button" ${busy || state.run.focus < skill.cost ? 'disabled' : ''}>
        <span class="skill-rune">${skill.icon}</span>
        <span><b>${escapeHtml(skill.name)}</b><small>${escapeHtml(skill.description)}</small></span>
        <em>${skill.cost}<small>集中</small></em>
      </button>
    `).join('')}
  `;
}

async function doPlayerAttack(skillId = null) {
  if (busy || !encounter || state.run.hp <= 0) return;
  const skill = skillId ? PLAYER_SKILLS.find((entry) => entry.id === skillId) : null;
  if (skill && state.run.focus < skill.cost) {
    toast('集中が足りません');
    return;
  }
  const target = selectedEnemy(encounter);
  if (!target) return;
  setBusy(true);
  state.run.phase = 'resolving';
  state.run.guarding = false;
  if (skill) state.run.focus -= skill.cost;
  else state.run.focus = Math.min(5, state.run.focus + 1);

  const outcome = resolvePlayerAttack(state, encounter, {
    type: skill ? 'skill' : 'attack',
    skillId: skill?.id,
    targetId: target.uid,
  }, rng);
  setBattleLog(skill ? `${skill.name}！` : `${target.displayName}へ斬りかかった！`, skill?.id === 'bellBreaker');
  sound.play('attack');
  await renderer.showPlayerAttack(outcome.results, skill);
  if (outcome.results.some((result) => result.critical)) sound.play('crit');
  else sound.play('hit');
  if (outcome.results.some((result) => result.broke)) {
    sound.play('break');
    vibrate([25, 30, 40]);
    announce('敵の体勢を崩した。次の行動を阻止します。');
  } else vibrate(18);
  if (outcome.healing) toast(`吸命でHPが${outcome.healing}回復`);
  updateAfterPlayerHit();

  if (encounter.enemies.every((enemy) => enemy.dead)) {
    await finishVictory();
    return;
  }
  await enemyPhase();
}

function updateAfterPlayerHit() {
  if (encounter.selectedEnemyId && encounter.enemies.find((enemy) => enemy.uid === encounter.selectedEnemyId)?.dead) {
    encounter.selectedEnemyId = encounter.enemies.find((enemy) => !enemy.dead)?.uid || null;
    renderer.setSelected(encounter.selectedEnemyId);
  }
  updateBattleUI();
}

async function doGuard() {
  if (busy) return;
  setBusy(true);
  state.run.phase = 'resolving';
  state.run.guarding = true;
  state.run.focus = Math.min(5, state.run.focus + 2);
  setBattleLog('武器を構え、灰の護りを固めた。', true);
  sound.play('guard');
  await renderer.showGuard();
  updateBattleUI();
  await enemyPhase();
}

async function usePotion() {
  if (busy || state.run.potions <= 0) return;
  const stats = computePlayerStats(state);
  if (state.run.hp >= stats.maxHp) {
    toast('HPは満タンです');
    return;
  }
  setBusy(true);
  state.run.phase = 'resolving';
  state.run.guarding = false;
  state.run.potions -= 1;
  const healing = Math.min(
    stats.maxHp - state.run.hp,
    Math.round(stats.maxHp * 0.4 * (1 + stats.potionPower / 100)),
  );
  state.run.hp += healing;
  setBattleLog(`灰灯薬を使い、HPが${healing}回復した。`);
  sound.play('heal');
  await renderer.showHeal(healing);
  updateBattleUI();
  await enemyPhase();
}

async function enemyPhase() {
  state.run.phase = 'enemy';
  const living = encounter.enemies.filter((enemy) => !enemy.dead).sort((a, b) => b.speed - a.speed);
  for (const enemy of living) {
    if (enemy.dead) continue;
    if (enemy.stunned) {
      setBattleLog(`${enemy.displayName}は体勢を崩し、動けない！`, true);
      announce(`${enemy.displayName}の行動をブレイクで阻止。`);
      await wait(470);
      enemy.stunned = false;
      enemy.break = enemy.maxBreak;
      enemy.intent = rollEnemyIntent(enemy, rng);
      updateBattleUI();
      continue;
    }
    const result = resolveEnemyAttack(state, enemy, rng);
    setBattleLog(`${enemy.displayName}の${result.intent.name}！ ${escapeHtml(result.intent.text || '')}`, result.intent.danger);
    await renderer.showEnemyAttack(enemy, result);
    if (result.guarded) sound.play('guard');
    else sound.play('hit');
    vibrate(result.guarded ? 12 : 24);
    updateBattleUI();
    announce(`${enemy.displayName}の${result.intent.name}。${result.damage}ダメージ。${result.guarded ? '防御で軽減。' : ''}`);
    if (state.run.hp <= 0) {
      await finishDefeat();
      return;
    }
    if (encounter.enemies.every((target) => target.dead)) {
      await finishVictory();
      return;
    }
    await wait(100);
  }
  state.run.guarding = false;
  encounter.turn += 1;
  state.run.encounter = encounter;
  state.run.phase = 'player';
  setBusy(false);
  setBattleLog('あなたの番。敵の予兆を見極めよ。');
  updateBattleUI();
  renderCommands();
  saveGame(state);
}

async function finishVictory() {
  setBusy(true);
  await wait(260);
  victoryResult = completeEncounter(state, encounter, rng);
  state.run.encounter = null;
  state.run.phase = 'player';
  if (encounter.floor === FLOOR_DATA.length - 1) state.flags.pendingEnding = true;
  saveGame(state);
  sound.play('victory');
  vibrate([30, 40, 30]);
  updateTopbar();
  showVictoryModal();
}

function showVictoryModal() {
  const boss = Boolean(encounter.info.boss);
  const loot = victoryResult.drops.map((item, index) => lootCard(item, index)).join('');
  modalRoot.innerHTML = `
    <div class="modal-backdrop victory-backdrop">
      <section class="victory-sheet modal-enter" role="dialog" aria-modal="true" aria-label="戦闘結果">
        <div class="victory-crown" aria-hidden="true"><i></i><span>◆</span><i></i></div>
        <p class="result-kicker">${boss ? 'BOSS VANQUISHED' : 'ENCOUNTER CLEARED'}</p>
        <h2>${boss ? '深層の主を討伐' : '戦闘勝利'}</h2>
        <div class="reward-summary">
          <span><small>獲得経験値</small><b>+${victoryResult.xp}</b></span>
          <span><small>獲得ゴールド</small><b>+${victoryResult.gold}</b></span>
          ${victoryResult.levels.length ? `<span class="level-reward"><small>LEVEL UP</small><b>LV.${state.player.level}</b></span>` : ''}
        </div>
        <div class="loot-heading"><div><small>RELICS FOUND</small><strong>戦利品</strong></div><span>${victoryResult.drops.length}点</span></div>
        <div class="loot-list">${loot || '<p class="empty-loot">装備袋がいっぱいのため灰片に変換されました。</p>'}</div>
        ${victoryResult.overflowEmber ? `<p class="overflow-note">所持上限を超えた装備を灰片 ${victoryResult.overflowEmber} に変換しました。</p>` : ''}
        <div class="result-actions">
          ${encounter.floor < FLOOR_DATA.length - 1 ? `<button class="primary-button" data-modal-action="victory-next" type="button">次の深度へ</button>` : `<button class="primary-button" data-modal-action="ending" type="button">鐘の向こうへ</button>`}
          <button class="ghost-button" data-modal-action="victory-return" type="button">祭壇へ帰還</button>
        </div>
      </section>
    </div>
  `;
  sound.play('loot');
  announce(`戦闘勝利。経験値${victoryResult.xp}、ゴールド${victoryResult.gold}、装備${victoryResult.drops.length}点を獲得。`);
}

function lootCard(item, index) {
  const rarity = rarityMeta(item.rarity);
  const equipped = state.equipment[item.slot]?.id === item.id;
  const compare = compareItem(state, item).slice(0, 5);
  return `
    <article class="loot-card rarity-${item.rarity}" style="--rarity:${rarity.color};--delay:${index * 90}ms">
      <div class="loot-runes" aria-hidden="true">${'◆'.repeat(Math.max(1, rarity.rank + 1))}</div>
      <div class="loot-icon"><span>${escapeHtml(item.icon)}</span><small>ILV ${item.itemLevel}</small></div>
      <div class="loot-copy">
        <p><span>${rarity.label}・${SLOT_META[item.slot].label}</span><b>戦力 ${item.score}</b></p>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="compare-grid">
          ${compare.map((row) => `
            <span>${statLabel(row.stat)}</span><b>${statValue(row.stat, row.next)}</b>
            <em class="${row.delta > 0 ? 'positive' : row.delta < 0 ? 'negative' : ''}">${row.delta ? statValue(row.stat, row.delta, true) : '—'}</em>
          `).join('')}
        </div>
        ${item.affixes.length ? `<div class="affix-list">${item.affixes.map((affix) => `<span><i>◆</i>${affix.label} ${statValue(affix.stat, affix.value, true)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="equip-loot-button" data-modal-action="equip-loot" data-item-id="${item.id}" type="button" ${equipped ? 'disabled' : ''}>
        ${equipped ? '装備中' : '装備する'}
      </button>
    </article>`;
}

function continueAfterVictory() {
  modalRoot.innerHTML = '';
  const next = Math.min(FLOOR_DATA.length - 1, encounter.floor + 1);
  state.run.floor = next;
  saveGame(state);
  startBattle(next);
}

function returnAfterVictory() {
  modalRoot.innerHTML = '';
  recoverAtCamp(state);
  saveGame(state);
  sound.play('back');
  renderHome();
}

async function finishDefeat() {
  setBusy(true);
  await wait(350);
  const lostGold = registerDefeat(state);
  saveGame(state);
  sound.play('defeat');
  modalRoot.innerHTML = `
    <div class="modal-backdrop defeat-backdrop">
      <section class="defeat-sheet modal-enter" role="dialog" aria-modal="true">
        <div class="broken-sigil" aria-hidden="true">◇</div>
        <p>THE FLAME FADES</p>
        <h2>灰灯が消えた</h2>
        <p class="defeat-copy">倒れても、得た装備と経験は失われない。<br>灯を掲げ直し、再び深層へ。</p>
        <div class="defeat-loss"><span>失ったゴールド</span><b>−${lostGold}</b></div>
        <button class="primary-button" data-modal-action="defeat-return" type="button">祭壇で目覚める</button>
      </section>
    </div>`;
  announce(`敗北。ゴールドを${lostGold}失い、祭壇へ戻ります。`);
}

function renderEnding() {
  modalRoot.innerHTML = '';
  state.flags.pendingEnding = false;
  state.progress.endingSeen = true;
  recoverAtCamp(state);
  saveGame(state);
  hideTopbar();
  setScreen(`
    <div class="ending-screen view-enter">
      <div class="ending-sun" aria-hidden="true"><i></i></div>
      <p>PROLOGUE COMPLETE</p>
      <h1>鐘は、まだ止まない。</h1>
      <div class="ending-copy">
        <p>喪鐘の獣は灰へ還った。</p>
        <p>しかし鐘の内側には、あなたの失われた名が刻まれていた。</p>
        <p>迷宮はさらに深く、王都の眠る場所へ続いている。</p>
      </div>
      <dl class="ending-records">
        <div><dt>到達レベル</dt><dd>${state.player.level}</dd></div>
        <div><dt>撃破数</dt><dd>${state.records.kills}</dd></div>
        <div><dt>最高ダメージ</dt><dd>${state.records.bestHit}</dd></div>
        <div><dt>遺物発見</dt><dd>${state.records.legendaryFound}</dd></div>
      </dl>
      <button class="primary-button" data-action="ending-home" type="button">灰灯の祭壇へ</button>
      <small>THANK YOU FOR PLAYING</small>
    </div>
  `, 'ending');
}

function renderInventory(filter = inventoryFilter) {
  inventoryFilter = filter || 'all';
  currentView = 'inventory';
  showTopbar('装備と聖遺物', 'RELIC VAULT', renderHome);
  const stats = computePlayerStats(state);
  const items = state.inventory
    .filter((item) => inventoryFilter === 'all' || item.slot === inventoryFilter)
    .sort((a, b) => RARITIES[b.rarity].rank - RARITIES[a.rarity].rank || b.score - a.score);
  setScreen(`
    <div class="inventory-screen view-enter">
      <section class="loadout-summary cut-panel">
        <div class="loadout-title"><div><small>CURRENT LOADOUT</small><h2>灰狩りの装具</h2></div><strong>戦力 ${totalPower(stats)}</strong></div>
        <div class="loadout-slots">
          ${Object.entries(SLOT_META).map(([slot, meta]) => equippedSlotMarkup(slot, meta)).join('')}
        </div>
        <dl class="stat-row compact">
          <div><dt>HP</dt><dd>${stats.maxHp}</dd></div>
          <div><dt>攻撃</dt><dd>${stats.attack}</dd></div>
          <div><dt>防御</dt><dd>${stats.defense}</dd></div>
          <div><dt>会心</dt><dd>${stats.crit}%</dd></div>
        </dl>
      </section>
      <div class="inventory-toolbar">
        <div class="filter-tabs" role="tablist" aria-label="装備種別">
          ${[['all', 'すべて'], ['weapon', '武器'], ['armor', '防具'], ['charm', '護符']].map(([id, label]) => `<button class="${inventoryFilter === id ? 'active' : ''}" data-action="inventory-filter" data-filter="${id}" type="button">${label}</button>`).join('')}
        </div>
        <span>${state.inventory.length}/${inventoryLimit()}</span>
      </div>
      <div class="inventory-list">
        ${items.length ? items.map(inventoryItemMarkup).join('') : `
          <div class="empty-state"><span aria-hidden="true">◇</span><h3>装備袋は空です</h3><p>迷宮の魔物を倒し、聖遺物を持ち帰りましょう。</p></div>`}
      </div>
      <p class="salvage-note">不要な装備は分解すると、希少度に応じた灰片になります。</p>
    </div>
  `, 'inventory');
  updateTopbar();
}

function equippedSlotMarkup(slot, meta) {
  const item = state.equipment[slot];
  const rarity = rarityMeta(item.rarity);
  return `
    <button class="loadout-slot rarity-${item.rarity}" data-action="inventory-filter" data-filter="${slot}" type="button" style="--rarity:${rarity.color}">
      <span>${escapeHtml(item.icon || meta.icon)}</span>
      <small>${meta.label}</small>
      <strong>${escapeHtml(item.name)}</strong>
      <b>${item.score}</b>
    </button>`;
}

function inventoryItemMarkup(item) {
  const rarity = rarityMeta(item.rarity);
  const comparison = compareItem(state, item);
  const net = item.score - (state.equipment[item.slot]?.score || 0);
  return `
    <article class="inventory-item rarity-${item.rarity}" style="--rarity:${rarity.color}">
      <div class="inventory-item-icon"><span>${escapeHtml(item.icon)}</span><small>ILV ${item.itemLevel}</small></div>
      <div class="inventory-item-copy">
        <p><span>${rarity.label}・${SLOT_META[item.slot].label}</span><b class="${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}">${net > 0 ? `戦力 +${net}` : `戦力 ${item.score}`}</b></p>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="item-stats">
          ${Object.entries(item.stats).map(([stat, amount]) => `<span>${statLabel(stat)} <b>${statValue(stat, amount, true)}</b></span>`).join('')}
        </div>
        ${item.affixes.length ? `<div class="affix-list inline">${item.affixes.map((affix) => `<span><i>◆</i>${affix.label}</span>`).join('')}</div>` : ''}
      </div>
      <div class="inventory-item-actions">
        <button class="small-primary" data-action="equip-item" data-item-id="${item.id}" type="button">装備</button>
        <button class="small-ghost" data-action="salvage-item" data-item-id="${item.id}" type="button">分解</button>
      </div>
      <div class="inventory-comparison sr-only">${comparison.map((row) => `${statLabel(row.stat)} ${row.delta >= 0 ? 'プラス' : 'マイナス'}${Math.abs(row.delta)}`).join('、')}</div>
    </article>`;
}

function renderRecords() {
  currentView = 'records';
  showTopbar('灰狩りの記録', 'CHRONICLE', renderHome);
  const completion = Math.round(state.progress.clearedFloor / (FLOOR_DATA.length - 1) * 100);
  setScreen(`
    <div class="records-screen view-enter">
      <section class="chronicle-hero">
        <small>EXPLORATION RECORD</small>
        <h2>迷宮踏破率 <strong>${completion}%</strong></h2>
        <div class="chronicle-progress"><i style="width:${completion}%"></i></div>
        <p>最深到達：深度 ${String(Math.max(1, state.progress.clearedFloor)).padStart(2, '0')}</p>
      </section>
      <section class="record-grid">
        ${recordTile('交戦回数', state.records.battles, 'BATTLES')}
        ${recordTile('勝利回数', state.records.victories, 'VICTORIES')}
        ${recordTile('撃破した魔物', state.records.kills, 'KILLS')}
        ${recordTile('最大ダメージ', state.records.bestHit, 'BEST HIT')}
        ${recordTile('発見した遺物', state.records.legendaryFound, 'LEGENDARIES')}
        ${recordTile('討伐した深層主', state.progress.bosses.length, 'BOSSES')}
      </section>
      <section class="guide-section cut-panel">
        <div class="section-heading"><div><small>HUNTER'S GUIDE</small><h3>戦闘指南</h3></div></div>
        <details open><summary><i>予</i>敵の予兆を読む</summary><p>敵名の下には、次に使う技が表示されます。赤い予兆は大技。防御は被害を60%軽減し、集中も2つ得られます。</p></details>
        <details><summary><i>崩</i>体勢をブレイクする</summary><p>敵HPの下にある青緑色のゲージが体勢です。「鐘砕き」で素早く削り切ると、敵の次の行動を阻止できます。</p></details>
        <details><summary><i>装</i>装備効果を組み合わせる</summary><p>攻撃力だけでなく、吸命・幸運・崩しなども攻略を変えます。不要な装備は分解し、灰片へ変えられます。</p></details>
      </section>
      <button class="danger-link" data-action="reset-save" type="button">セーブデータを消去</button>
    </div>
  `, 'records');
}

function recordTile(label, value, sub) {
  return `<div class="record-tile"><small>${sub}</small><strong>${formatNumber(value)}</strong><span>${label}</span></div>`;
}

function equipFromInventory(itemId) {
  const result = equipItem(state, itemId);
  if (!result) return;
  sound.play('confirm');
  saveGame(state);
  toast(`${result.item.name}を装備しました`);
  renderInventory(inventoryFilter);
}

function salvageFromInventory(itemId) {
  const item = state.inventory.find((entry) => entry.id === itemId);
  if (!item) return;
  const value = salvageItem(state, itemId);
  saveGame(state);
  sound.play('back');
  toast(`${item.name}を分解：灰片 +${value}`);
  renderInventory(inventoryFilter);
}

function equipLoot(itemId) {
  const result = equipItem(state, itemId);
  if (!result) return;
  sound.play('confirm');
  saveGame(state);
  toast(`${result.item.name}を装備しました`);
  showVictoryModal();
  updateTopbar();
}

function onScreenClick(event) {
  const enemyButton = event.target.closest('[data-enemy-id]');
  if (enemyButton && !busy) {
    encounter.selectedEnemyId = enemyButton.dataset.enemyId;
    renderer?.setSelected(encounter.selectedEnemyId);
    sound.play('confirm');
    updateBattleUI();
    return;
  }
  const skillButton = event.target.closest('[data-skill-id]');
  if (skillButton) {
    void doPlayerAttack(skillButton.dataset.skillId);
    return;
  }
  const command = event.target.closest('[data-command]')?.dataset.command;
  if (command) {
    if (command === 'attack') void doPlayerAttack();
    if (command === 'skills') renderSkillMenu();
    if (command === 'close-skills') renderCommands();
    if (command === 'guard') void doGuard();
    if (command === 'potion') void usePotion();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'continue') continueGame();
  if (action === 'new-game') startNewGame();
  if (action === 'story-next') nextStory();
  if (action === 'explore') startExploration();
  if (action === 'inventory') renderInventory(button.dataset.filter || 'all');
  if (action === 'inventory-filter') renderInventory(button.dataset.filter);
  if (action === 'equip-item') equipFromInventory(button.dataset.itemId);
  if (action === 'salvage-item') salvageFromInventory(button.dataset.itemId);
  if (action === 'records') renderRecords();
  if (action === 'ending-home') renderHome();
  if (action === 'reset-save') showConfirm('記録を消去しますか？', '装備・進行・戦歴は元に戻せません。', 'すべて消去', () => { deleteSave(); renderTitle(); });
}

function onModalClick(event) {
  const button = event.target.closest('[data-modal-action]');
  if (!button) return;
  const action = button.dataset.modalAction;
  if (action === 'close') modalRoot.innerHTML = '';
  if (action === 'confirm') {
    const callback = modalRoot._confirmCallback;
    modalRoot.innerHTML = '';
    callback?.();
  }
  if (action === 'equip-loot') equipLoot(button.dataset.itemId);
  if (action === 'victory-next') continueAfterVictory();
  if (action === 'victory-return') returnAfterVictory();
  if (action === 'defeat-return') { modalRoot.innerHTML = ''; renderHome(); }
  if (action === 'ending') renderEnding();
}

function showConfirm(title, copy, confirmLabel, callback) {
  modalRoot._confirmCallback = callback;
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="confirm-modal modal-enter" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <span class="confirm-rune" aria-hidden="true">◇</span>
        <h2 id="confirm-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(copy)}</p>
        <button class="danger-button" data-modal-action="confirm" type="button">${escapeHtml(confirmLabel)}</button>
        <button class="ghost-button" data-modal-action="close" type="button">やめる</button>
      </section>
    </div>`;
}

function toggleSound() {
  if (!state) return;
  state.settings.sound = !state.settings.sound;
  sound.setEnabled(state.settings.sound);
  if (state.settings.sound) sound.play('confirm');
  saveStateIfStable();
  updateTopbar();
  toast(state.settings.sound ? 'サウンド ON' : 'サウンド OFF');
}

function saveStateIfStable() {
  if (!state) return false;
  if (currentView === 'battle' && busy) return false;
  return saveGame(state);
}

function setBusy(value) {
  busy = value;
  screen.querySelectorAll('[data-command], [data-skill-id], [data-enemy-id]').forEach((button) => {
    button.disabled = value || button.classList.contains('is-dead');
  });
  if (!value && currentView === 'battle') renderCommands();
}

function setBattleLog(message, danger = false) {
  const log = screen.querySelector('#battle-log');
  if (!log) return;
  log.classList.toggle('is-danger', danger);
  log.querySelector('span').textContent = message;
}

function barMarkup(label, value, max, kind) {
  const percent = Math.max(0, Math.min(100, max ? value / max * 100 : 0));
  return `
    <div class="meter ${kind}">
      <div><span>${label}</span><b>${formatNumber(value)}<small> / ${formatNumber(max)}</small></b></div>
      <i><em style="width:${percent}%"></em></i>
    </div>`;
}

function totalPower(stats) {
  return Math.round(stats.attack * 4 + stats.defense * 3.2 + stats.maxHp * 0.35 + stats.crit * 2 + stats.lifesteal * 4);
}

function formatNumber(value) {
  return new Intl.NumberFormat('ja-JP').format(Math.max(0, Math.round(Number(value) || 0)));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  toastRoot.append(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => {
    element.classList.remove('show');
    setTimeout(() => element.remove(), 240);
  }, 2200);
}

function announce(message) {
  srLive.textContent = '';
  requestAnimationFrame(() => { srLive.textContent = message; });
}

function vibrate(pattern) {
  if (state?.settings?.vibration !== false) navigator.vibrate?.(pattern);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
