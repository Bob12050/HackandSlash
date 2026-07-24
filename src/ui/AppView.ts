import { runtime } from '../game/runtime';
import {
  EQUIPMENT_BASE_CATALOG,
  EQUIPMENT_CATALOG,
  EQUIPMENT_RARITY_LABELS,
  INVENTORY_LIMIT,
  ITEM_RARITIES,
  MAX_ENHANCEMENT_LEVEL,
  TOTAL_EQUIPMENT_VARIANTS,
  getDerivedStats,
  getEnhancementCost,
  type AdventureAreaId,
  type EquipmentItem,
  type EquipmentSlot,
  type IdleRpgState
} from '../game/idleRpg';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '防具',
  charm: 'お守り'
};

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: 'fa-wand-sparkles',
  armor: 'fa-shield-halved',
  charm: 'fa-gem'
};

const AREA_LABELS: Record<AdventureAreaId, string> = {
  sunmeadow: 'そよかぜ草原',
  'komorebi-forest': 'こもれび森'
};

const AREA_ORDER: readonly AdventureAreaId[] = ['sunmeadow', 'komorebi-forest'];
const SLOT_ORDER: readonly EquipmentSlot[] = ['weapon', 'armor', 'charm'];

const AREA_CATALOG_META: Record<AdventureAreaId, { number: string; icon: string; description: string }> = {
  sunmeadow: {
    number: 'AREA 01',
    icon: 'fa-seedling',
    description: '風や花、スライムをモチーフにした、冒険の始まりを支える装備。'
  },
  'komorebi-forest': {
    number: 'AREA 02',
    icon: 'fa-tree',
    description: '木漏れ日と森の生き物の力を宿した、ひとつ上の装備。'
  }
};

let toastTimer: number | undefined;

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell" aria-label="こもれびギルド物語">
      <header class="app-header">
        <div>
          <p class="eyebrow">POCKET AUTO RPG</p>
          <h1>こもれびギルド物語</h1>
        </div>
        <span id="rank-badge" class="rank-badge">F RANK</span>
      </header>

      <section class="stage-card" aria-label="ゲーム画面">
        <div id="game-stage"></div>
        <span id="stage-label" class="stage-label">ギルド</span>
        <span id="stage-mark" class="stage-mark">GUILD</span>
        <span id="distance-label" class="distance-label" hidden>0 m</span>
        <div id="enemy-panel" class="enemy-panel" hidden>
          <strong id="enemy-name">ミントスライム Lv.1</strong>
          <div class="enemy-hp-track"><span id="enemy-hp-fill"></span></div>
          <small id="enemy-hp-value">20 / 20</small>
        </div>
      </section>

      <section class="status-card" aria-label="冒険者情報">
        <div class="meter-grid">
          <div class="meter-block">
            <div class="meter-label"><b>HP</b><span id="hp-value">52 / 52</span></div>
            <div class="meter-track hp"><span id="hp-fill"></span></div>
          </div>
          <div class="meter-block">
            <div class="meter-label"><b>EXP</b><span id="xp-value">0 / 24</span></div>
            <div class="meter-track xp"><span id="xp-fill"></span></div>
          </div>
        </div>
        <div class="status-summary">
          <div><b id="level-value" class="level-value">Lv. 1</b><span id="rank-value" class="rank-value">Fランク冒険者</span></div>
          <div class="gold-block"><small>GOLD</small><b id="gold-value">0G</b></div>
        </div>
      </section>

      <section id="action-panel" class="action-panel" aria-label="行動"></section>

      <section class="log-card" aria-label="冒険ログ">
        <button id="log-toggle" class="log-toggle" type="button" aria-expanded="true" aria-label="ログを開閉">
          <span><b>Logs</b><small>直近6件</small></span>
          <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
        </button>
        <div id="log-list" class="log-list"></div>
        <span id="log-announcer" class="sr-only" role="status" aria-live="polite"></span>
      </section>

      <p class="save-note"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> 冒険の記録は自動保存されます</p>
    </main>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <dialog id="app-modal" class="app-modal" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>
  `;

  const actionPanel = required<HTMLElement>('action-panel');
  const modal = required<HTMLDialogElement>('app-modal');
  const modalContent = required<HTMLElement>('modal-content');
  let latestState = runtime.state;

  runtime.subscribe((state) => {
    latestState = state;
    renderState(state, actionPanel);
    if (modal.open && modal.dataset.view === 'equipment' && modalContent.dataset.signature !== equipmentSignature(state)) {
      refreshModalPreservingFocus(modalContent, () => renderEquipmentModal(state, modalContent));
    }
    if (modal.open && modal.dataset.view === 'quest' && modalContent.dataset.signature !== questSignature(state)) {
      refreshModalPreservingFocus(modalContent, () => renderQuestModal(state, modalContent));
    }
    if (modal.open && modal.dataset.view === 'forge' && modalContent.dataset.signature !== forgeSignature(state)) {
      refreshModalPreservingFocus(modalContent, () => renderForgeModal(state, modalContent));
    }
    if (modal.open && modal.dataset.view === 'destination' && modalContent.dataset.signature !== destinationSignature(state)) {
      refreshModalPreservingFocus(modalContent, () => renderDestinationModal(state, modalContent));
    }
    if (modal.open && modal.dataset.view === 'catalog' && modalContent.dataset.signature !== catalogSignature(state)) {
      refreshModalPreservingFocus(modalContent, () => renderEquipmentCatalogModal(state, modalContent));
    }
  });

  runtime.onCombat((events) => {
    const loot = events.find((event) => event.type === 'loot');
    const autoSold = events.find((event) => event.type === 'loot-auto-sold');
    const levelUp = events.find((event) => event.type === 'level-up');
    const areaUnlocked = events.find((event) => event.type === 'area-unlocked');
    const defeat = events.find((event) => event.type === 'hero-defeated');
    if (areaUnlocked?.type === 'area-unlocked') showToast(`NEW AREA！ ${areaUnlocked.name}が解放されました`, 'area-unlocked');
    else if (loot?.type === 'loot') showToast(`★ ${loot.item.name}を手に入れた！`, `rarity-${loot.item.rarity}`);
    else if (autoSold?.type === 'loot-auto-sold') showToast(`荷物がいっぱい。${autoSold.gold}Gで自動売却`, 'level-up');
    else if (levelUp?.type === 'level-up') showToast(`LEVEL UP！ Lv.${levelUp.level}になった`, 'level-up');
    else if (defeat) showToast('ギルドに運ばれました…', 'danger');
  });

  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'adventure') openModal('destination', modal, modalContent, latestState);
    if (action === 'return') runtime.returnToGuild();
    if (action === 'equipment') openModal('equipment', modal, modalContent, latestState);
    if (action === 'status') openModal('status', modal, modalContent, latestState);
    if (action === 'quest') openModal('quest', modal, modalContent, latestState);
    if (action === 'forge') openModal('forge', modal, modalContent, latestState);
    if (action === 'dispatch') openModal('dispatch', modal, modalContent, latestState);
    if (action === 'menu') openModal('menu', modal, modalContent, latestState);
  });

  modal.addEventListener('click', (event) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-modal-action]');
    if (!element) {
      if (event.target === modal) modal.close();
      return;
    }
    const action = element.dataset.modalAction;
    if (element.getAttribute('aria-disabled') === 'true') return;
    if (action === 'close') modal.close();
    if (action === 'start-area' && element.dataset.areaId) {
      runtime.startAdventure(element.dataset.areaId as AdventureAreaId);
      modal.close();
    }
    if (action === 'equip' && element.dataset.itemId) runtime.equip(element.dataset.itemId);
    if (action === 'sell' && element.dataset.itemId) runtime.sell(element.dataset.itemId);
    if (action === 'enhance' && element.dataset.itemId) {
      if (runtime.enhance(element.dataset.itemId)) showToast('装備を強化しました！', 'level-up');
    }
    if (action === 'claim') runtime.claimQuest();
    if (action === 'catalog') {
      openModal('catalog', modal, modalContent, latestState);
      modalContent.querySelector<HTMLElement>('[data-modal-action="back-menu"]')?.focus();
    }
    if (action === 'back-menu') {
      openModal('menu', modal, modalContent, latestState);
      modalContent.querySelector<HTMLElement>('[data-modal-action="catalog"]')?.focus();
    }
    if (action === 'reset') {
      const confirmed = window.confirm('冒険の記録を消して、はじめから遊びますか？');
      if (confirmed) {
        runtime.reset();
        modal.close();
      }
    }
  });

  const logToggle = required<HTMLButtonElement>('log-toggle');
  logToggle.addEventListener('click', () => {
    const card = logToggle.closest('.log-card')!;
    const collapsed = card.classList.toggle('collapsed');
    logToggle.setAttribute('aria-expanded', (!collapsed).toString());
  });
}

function renderState(state: IdleRpgState, actionPanel: HTMLElement): void {
  const stats = getDerivedStats(state);
  setText('hp-value', `${Math.ceil(state.hero.hp)} / ${stats.maxHp}`);
  setWidth('hp-fill', state.hero.hp / stats.maxHp);
  setText('xp-value', `${state.hero.xp} / ${state.hero.nextXp}`);
  setWidth('xp-fill', state.hero.xp / state.hero.nextXp);
  setText('level-value', `Lv. ${state.hero.level}`);
  setText('rank-value', `${state.hero.rank}ランク冒険者`);
  setText('rank-badge', `${state.hero.rank} RANK`);
  setText('gold-value', `${state.hero.gold.toLocaleString()}G`);
  setText('stage-label', state.mode === 'guild' ? 'ギルド' : (AREA_LABELS[state.selectedArea] ?? AREA_LABELS.sunmeadow));
  setText('stage-mark', state.mode === 'guild' ? 'GUILD' : 'AUTO BATTLE');

  const distance = required<HTMLElement>('distance-label');
  const enemyPanel = required<HTMLElement>('enemy-panel');
  distance.hidden = state.mode !== 'adventure';
  enemyPanel.hidden = state.mode !== 'adventure' || !state.enemy;
  distance.textContent = `${state.distance.toLocaleString()} m`;
  if (state.enemy) {
    setText('enemy-name', `${state.enemy.name} Lv.${state.enemy.level}`);
    setText('enemy-hp-value', `${state.enemy.hp} / ${state.enemy.maxHp}`);
    setWidth('enemy-hp-fill', state.enemy.hp / state.enemy.maxHp);
  }

  if (actionPanel.dataset.mode !== state.mode) {
    actionPanel.innerHTML = state.mode === 'guild' ? guildActions(state) : adventureActions(state);
    actionPanel.dataset.mode = state.mode;
  }
  actionPanel.querySelectorAll<HTMLElement>('[data-inventory-count]').forEach((element) => {
    element.textContent = `${state.inventory.length}/${INVENTORY_LIMIT}`;
  });
  const questBadge = actionPanel.querySelector<HTMLElement>('[data-quest-ready]');
  if (questBadge) questBadge.hidden = state.quest.claimed || state.quest.progress < state.quest.target;

  const logs = state.logs.slice(-6);
  const logList = required<HTMLElement>('log-list');
  const logSignature = logs.join('\u001f');
  if (logList.dataset.signature !== logSignature) {
    logList.dataset.signature = logSignature;
    logList.innerHTML = logs.map((log) => `<p>${escapeHtml(log)}</p>`).join('');
    required<HTMLElement>('log-announcer').textContent = logs.at(-1) ?? '';
  }
}

function guildActions(state: IdleRpgState): string {
  const questReady = !state.quest.claimed && state.quest.progress >= state.quest.target;
  return `
    <div class="primary-actions">
      ${actionButton('equipment', 'fa-shield-halved', '装備', `所持 <span data-inventory-count>${state.inventory.length}/${INVENTORY_LIMIT}</span>`)}
      ${actionButton('status', 'fa-chart-simple', 'ステータス', '能力を確認')}
      ${actionButton('adventure', 'fa-person-running', '冒険に出る', '冒険先を選ぶ', 'accent')}
      ${actionButton('dispatch', 'fa-compass', '遠征', 'Eランクで解放', 'locked')}
    </div>
    <div class="secondary-actions">
      ${compactButton('forge', 'fa-hammer', '鍛冶屋')}
      ${compactButton('quest', 'fa-scroll', 'クエスト', questReady)}
      ${compactButton('menu', 'fa-table-cells-large', 'メニュー')}
    </div>
  `;
}

function adventureActions(state: IdleRpgState): string {
  return `
    <div class="adventure-actions">
      ${actionButton('status', 'fa-chart-simple', 'ステータス', '能力確認')}
      ${actionButton('equipment', 'fa-shield-halved', '装備', `所持 <span data-inventory-count>${state.inventory.length}/${INVENTORY_LIMIT}</span>`)}
      ${actionButton('menu', 'fa-table-cells-large', 'メニュー', '図鑑・設定')}
    </div>
    <button class="return-button" data-action="return" type="button">
      <i class="fa-solid fa-person-running" aria-hidden="true"></i>
      <span><b>ギルドへ帰還</b><small>獲得した装備を持ち帰る</small></span>
    </button>
  `;
}

function actionButton(action: string, icon: string, title: string, subtitle: string, variant = ''): string {
  return `
    <button class="action-button ${variant}" data-action="${action}" type="button">
      <i class="fa-solid ${icon}" aria-hidden="true"></i>
      <span><b>${title}</b><small>${subtitle}</small></span>
    </button>
  `;
}

function compactButton(action: string, icon: string, title: string, badge = false): string {
  return `
    <button class="compact-button" data-action="${action}" type="button">
      <span class="compact-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i>${action === 'quest' ? `<em data-quest-ready ${badge ? '' : 'hidden'}>!</em>` : ''}</span>
      <b>${title}</b>
    </button>
  `;
}

function openModal(
  view: string,
  modal: HTMLDialogElement,
  content: HTMLElement,
  state: IdleRpgState
): void {
  modal.dataset.view = view;
  content.dataset.signature = '';
  if (view === 'equipment') renderEquipmentModal(state, content);
  if (view === 'status') renderStatusModal(state, content);
  if (view === 'quest') renderQuestModal(state, content);
  if (view === 'forge') renderForgeModal(state, content);
  if (view === 'destination') renderDestinationModal(state, content);
  if (view === 'catalog') renderEquipmentCatalogModal(state, content);
  if (view === 'dispatch') renderInfoModal(content, '遠征', 'fa-compass', 'Eランクになると、仲間を送り出して報酬を受け取れるようになります。');
  if (view === 'menu') renderMenuModal(content);
  if (!modal.open) modal.showModal();
}

function renderDestinationModal(state: IdleRpgState, content: HTMLElement): void {
  const meadow = state.areaProgress.sunmeadow;
  const forestUnlocked = state.unlockedAreas.includes('komorebi-forest');
  const meadowProgress = Math.min(10, meadow.regularKills);
  const meadowStatus = meadow.bossDefeated
    ? '<i class="fa-solid fa-crown" aria-hidden="true"></i> ボス討伐済み'
    : meadowProgress >= 10
      ? '<i class="fa-solid fa-crown" aria-hidden="true"></i> ボス出現中！'
      : `ボスまで <b>${meadowProgress} / 10</b>`;

  content.innerHTML = `
    ${modalHeader('冒険先を選ぶ', 'fa-map-location-dot', forestUnlocked ? '2 AREAS' : '1 AREA')}
    <p class="destination-lead">冒険はすべて自動で進みます。行き先を選んだら、あとはリオを見守ろう。</p>
    <div class="destination-list" aria-label="冒険エリア">
      <button class="destination-card meadow" data-modal-action="start-area" data-area-id="sunmeadow" type="button">
        <span class="destination-art" aria-hidden="true"><img src="assets/sunmeadow.png" alt="" /></span>
        <span class="destination-copy">
          <span class="destination-heading"><span><small>AREA 01</small><b>そよかぜ草原</b></span><em>冒険する <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></em></span>
          <span class="destination-description">ぷるぷるスライムが暮らす、やさしい風の草原。</span>
          <span class="destination-progress-label">${meadowStatus}</span>
          <span class="destination-progress" aria-hidden="true"><span style="width:${meadowProgress * 10}%"></span></span>
        </span>
      </button>
      <button
        class="destination-card forest ${forestUnlocked ? '' : 'is-locked'}"
        data-modal-action="start-area"
        data-area-id="komorebi-forest"
        type="button"
        aria-disabled="${!forestUnlocked}"
        aria-describedby="forest-area-description"
      >
        <span class="destination-art" aria-hidden="true"><img src="assets/komorebi-forest.png" alt="" /></span>
        <span class="destination-copy">
          <span class="destination-heading"><span><small>AREA 02</small><b>こもれび森</b></span>${forestUnlocked
            ? '<em>冒険する <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></em>'
            : '<em class="lock-badge"><i class="fa-solid fa-lock" aria-hidden="true"></i> LOCK</em>'}</span>
          <span id="forest-area-description" class="destination-description">${forestUnlocked
            ? '少し手強い魔物が待つ森。レア装備を見つけやすい。'
            : '草原の「おおきな王冠スライム」を倒すと解放。'}</span>
          <span class="destination-reward"><i class="fa-solid ${forestUnlocked ? 'fa-gem' : 'fa-crown'}" aria-hidden="true"></i> ${forestUnlocked ? 'レア装備率アップ' : '草原ボス討伐で解放'}</span>
        </span>
      </button>
    </div>
    <p class="destination-note"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> 討伐数とエリア解放は帰還しても保存されます</p>
  `;
  content.dataset.signature = destinationSignature(state);
}

function renderEquipmentModal(state: IdleRpgState, content: HTMLElement): void {
  const stats = getDerivedStats(state);
  const items = [...state.inventory].sort((a, b) => b.score - a.score);
  content.innerHTML = `
    ${modalHeader('装備', 'fa-shield-halved', `${state.inventory.length} / ${INVENTORY_LIMIT}`)}
    <div class="equipment-summary">
      <span>HP <b>${stats.maxHp}</b></span><span>ATK <b>${stats.attack}</b></span><span>DEF <b>${stats.defense}</b></span>
    </div>
    <div class="equipment-list">
      ${items.map((item) => equipmentRow(item, state)).join('')}
    </div>
  `;
  content.dataset.signature = equipmentSignature(state);
}

function equipmentRow(item: EquipmentItem, state: IdleRpgState): string {
  const equipped = state.equipped[item.slot] === item.id;
  const statParts = [
    item.attack > 0 ? `ATK +${item.attack}` : '',
    item.defense > 0 ? `DEF +${item.defense}` : '',
    item.maxHp > 0 ? `HP +${item.maxHp}` : ''
  ].filter(Boolean).join(' / ');
  return `
    <article class="equipment-row rarity-${item.rarity}">
      <div class="item-icon"><i class="fa-solid ${SLOT_ICONS[item.slot]}" aria-hidden="true"></i></div>
      <div class="item-copy"><small>${SLOT_LABELS[item.slot]}・Score ${item.score}</small><b>${escapeHtml(item.name)}${item.upgradeLevel > 0 ? ` <mark>+${item.upgradeLevel}</mark>` : ''}</b><span>${statParts}</span></div>
      <div class="item-actions">
        <button data-modal-action="equip" data-item-id="${item.id}" ${equipped ? 'disabled' : ''}>${equipped ? '装備中' : '装備'}</button>
        ${!equipped && !item.locked ? `<button class="sell" data-modal-action="sell" data-item-id="${item.id}">売却</button>` : ''}
      </div>
    </article>
  `;
}

function renderStatusModal(state: IdleRpgState, content: HTMLElement): void {
  const stats = getDerivedStats(state);
  content.innerHTML = `
    ${modalHeader('ステータス', 'fa-chart-simple', `${state.hero.rank} RANK`)}
    <div class="hero-profile">
      <img src="assets/hero.png" alt="主人公リオ" />
      <div><small>かけだし冒険者</small><h3>リオ</h3><p>Lv.${state.hero.level}・討伐 ${state.hero.totalKills}体</p></div>
    </div>
    <div class="stat-grid">
      <span>最大HP <b>${stats.maxHp}</b></span>
      <span>攻撃力 <b>${stats.attack}</b></span>
      <span>防御力 <b>${stats.defense}</b></span>
      <span>次のランク <b>${state.hero.rank === 'F' ? 'Lv.4' : '成長中'}</b></span>
    </div>
    <p class="modal-note">装備を入れ替えると能力が変わります。Scoreが高い装備を目安にしてみよう。</p>
  `;
}

function renderQuestModal(state: IdleRpgState, content: HTMLElement): void {
  const quest = state.quest;
  const ready = quest.progress >= quest.target && !quest.claimed;
  content.innerHTML = `
    ${modalHeader('クエスト', 'fa-scroll', quest.claimed ? '達成済み' : `${quest.progress} / ${quest.target}`)}
    <article class="quest-sheet ${quest.claimed ? 'completed' : ''}">
      <small>F RANK QUEST</small>
      <h3>${quest.title}</h3>
      <p>${quest.description}</p>
      <div class="quest-progress"><span style="width:${Math.min(100, quest.progress / quest.target * 100)}%"></span></div>
      <div class="quest-reward"><span><i class="fa-solid fa-coins"></i> ${quest.rewardGold}G</span><span><i class="fa-solid fa-star"></i> EXP ${quest.rewardXp}</span></div>
      <button class="claim-button" data-modal-action="claim" ${ready ? '' : 'disabled'}>${quest.claimed ? '受取済み' : ready ? '報酬を受け取る' : '冒険で条件を達成しよう'}</button>
    </article>
  `;
  content.dataset.signature = questSignature(state);
}

function renderForgeModal(state: IdleRpgState, content: HTMLElement): void {
  const items = [...state.inventory].sort((a, b) => {
    const equippedDifference = Number(state.equipped[b.slot] === b.id) - Number(state.equipped[a.slot] === a.id);
    return equippedDifference || b.upgradeLevel - a.upgradeLevel || b.score - a.score;
  });
  content.innerHTML = `
    ${modalHeader('鍛冶屋', 'fa-hammer', `強化上限 +${MAX_ENHANCEMENT_LEVEL}`)}
    <div class="forge-intro">
      <div>
        <small>所持GOLD</small>
        <strong><i class="fa-solid fa-coins" aria-hidden="true"></i> ${state.hero.gold.toLocaleString()}G</strong>
      </div>
      <p id="forge-description">装備を選んで能力を強化できます。強化した装備は売却するまで効果が残ります。</p>
    </div>
    ${items.length > 0 ? `
      <div class="forge-list" aria-describedby="forge-description">
        ${items.map((item) => forgeRow(item, state)).join('')}
      </div>
    ` : `
      <div class="forge-empty" role="status">
        <i class="fa-solid fa-toolbox" aria-hidden="true"></i>
        <b>強化できる装備がありません</b>
        <p>冒険で装備を手に入れてから、また鍛冶屋を訪ねてみよう。</p>
      </div>
    `}
  `;
  content.dataset.signature = forgeSignature(state);
}

function forgeRow(item: EquipmentItem, state: IdleRpgState): string {
  const equipped = state.equipped[item.slot] === item.id;
  const maxed = item.upgradeLevel >= MAX_ENHANCEMENT_LEVEL;
  const cost = getEnhancementCost(item);
  const insufficientGold = !maxed && state.hero.gold < cost;
  const disabledReason = maxed ? '強化上限' : insufficientGold ? 'GOLD不足' : '';
  const buttonLabel = maxed ? '強化上限' : insufficientGold ? 'GOLD不足' : '強化する';
  const ability = equipmentAbility(item);
  const accessibleName = `${item.name}を強化。現在プラス${item.upgradeLevel}、${ability}。${disabledReason || `費用${cost}G`}`;
  return `
    <article class="forge-row rarity-${item.rarity}" data-item-id="${escapeHtml(item.id)}">
      <div class="forge-item-icon"><i class="fa-solid ${SLOT_ICONS[item.slot]}" aria-hidden="true"></i></div>
      <div class="forge-item-main">
        <div class="forge-item-meta">
          <span>${SLOT_LABELS[item.slot]}</span>
          ${equipped ? '<em><i class="fa-solid fa-circle-check" aria-hidden="true"></i> 装備中</em>' : ''}
        </div>
        <b>${escapeHtml(item.name)} <mark>+${item.upgradeLevel}</mark></b>
        <small>${ability}</small>
      </div>
      <div class="forge-cost ${insufficientGold ? 'is-short' : ''} ${maxed ? 'is-max' : ''}">
        <small>${maxed ? 'MAX' : '次回費用'}</small>
        <strong>${maxed ? `+${MAX_ENHANCEMENT_LEVEL}` : `${cost.toLocaleString()}G`}</strong>
      </div>
      <button
        class="enhance-button"
        data-modal-action="enhance"
        data-item-id="${escapeHtml(item.id)}"
        aria-label="${escapeHtml(accessibleName)}"
        aria-disabled="${maxed || insufficientGold}"
      >
        <i class="fa-solid ${maxed ? 'fa-crown' : insufficientGold ? 'fa-lock' : 'fa-hammer'}" aria-hidden="true"></i>
        ${buttonLabel}
      </button>
      ${disabledReason ? `<p class="forge-row-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${disabledReason}${insufficientGold ? `・あと${(cost - state.hero.gold).toLocaleString()}G` : ''}</p>` : ''}
    </article>
  `;
}

function equipmentAbility(item: EquipmentItem): string {
  return [
    item.attack > 0 ? `ATK +${item.attack}` : '',
    item.defense > 0 ? `DEF +${item.defense}` : '',
    item.maxHp > 0 ? `HP +${item.maxHp}` : ''
  ].filter(Boolean).join(' / ');
}

function renderEquipmentCatalogModal(state: IdleRpgState, content: HTMLElement): void {
  const normalVariantCount = EQUIPMENT_BASE_CATALOG.length * ITEM_RARITIES.length;
  const fixedVariantCount = Math.max(0, TOTAL_EQUIPMENT_VARIANTS - normalVariantCount);
  content.innerHTML = `
    ${modalHeader('装備図鑑', 'fa-book-open', `ALL ${TOTAL_EQUIPMENT_VARIANTS}`)}
    <button class="catalog-back-button" data-modal-action="back-menu" type="button">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i> メニューに戻る
    </button>
    <section class="catalog-intro" aria-labelledby="catalog-intro-title">
      <div class="catalog-total" aria-label="装備は全${TOTAL_EQUIPMENT_VARIANTS}種類">
        <span><strong>${TOTAL_EQUIPMENT_VARIANTS}</strong><small>TOTAL ITEMS</small></span>
        <i class="fa-solid fa-sparkles" aria-hidden="true"></i>
      </div>
      <div class="catalog-intro-copy">
        <h3 id="catalog-intro-title">集めるほど、冒険が楽しくなる！</h3>
        <p>通常のベース装備 <b>${EQUIPMENT_BASE_CATALOG.length}種</b>は、それぞれ${ITEM_RARITIES.length}つのレアリティで登場。${fixedVariantCount > 0 ? `さらに冒険・ボス報酬の固定装備${fixedVariantCount}種を加えて、` : ''}全${TOTAL_EQUIPMENT_VARIANTS}種です。</p>
      </div>
      <div class="catalog-rarity-key" aria-label="${ITEM_RARITIES.length}つのレアリティ">
        ${ITEM_RARITIES.map((rarity) => `<span class="rarity-${rarity}"><i aria-hidden="true"></i>${EQUIPMENT_RARITY_LABELS[rarity]}</span>`).join('')}
      </div>
    </section>
    <div class="equipment-catalog" aria-label="エリア別装備一覧">
      ${AREA_ORDER.map((areaId) => equipmentCatalogArea(areaId, state)).join('')}
      ${fixedEquipmentCatalogSection(state)}
    </div>
    <p class="catalog-footnote"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> 表示中の数値はベース装備の傾向です。レアリティによって能力が大きくなります。</p>
  `;
  content.dataset.signature = catalogSignature(state);
}

function equipmentCatalogArea(areaId: AdventureAreaId, state: IdleRpgState): string {
  const areaItems = EQUIPMENT_BASE_CATALOG.filter((item) => item.areaId === areaId);
  const meta = AREA_CATALOG_META[areaId];
  const unlocked = state.unlockedAreas.includes(areaId);
  const areaVariantCount = areaItems.length * ITEM_RARITIES.length;
  return `
    <section class="catalog-area ${unlocked ? '' : 'is-locked'}" aria-labelledby="catalog-area-${areaId}">
      <header class="catalog-area-header">
        <span class="catalog-area-icon"><i class="fa-solid ${unlocked ? meta.icon : 'fa-lock'}" aria-hidden="true"></i></span>
        <span>
          <small>${meta.number}</small>
          <h3 id="catalog-area-${areaId}">${AREA_LABELS[areaId]}</h3>
          <p>${unlocked ? meta.description : '王冠スライムを倒すと、装備の名前が明らかになります。'}</p>
        </span>
        <em>${areaItems.length} BASE<br><b>${areaVariantCount} ITEMS</b></em>
      </header>
      ${unlocked
        ? SLOT_ORDER.map((slot) => equipmentCatalogSlot(areaId, slot)).join('')
        : equipmentCatalogLockedSlots(areaId)}
    </section>
  `;
}

function equipmentCatalogSlot(areaId: AdventureAreaId, slot: EquipmentSlot): string {
  const items = EQUIPMENT_BASE_CATALOG.filter((item) => item.areaId === areaId && item.slot === slot);
  if (items.length === 0) return '';
  const headingId = `catalog-slot-${areaId}-${slot}`;
  return `
    <section class="catalog-slot-group" aria-labelledby="${headingId}">
      <h4 id="${headingId}">
        <span><i class="fa-solid ${SLOT_ICONS[slot]}" aria-hidden="true"></i>${SLOT_LABELS[slot]}</span>
        <small>${items.length}種 × ${ITEM_RARITIES.length} RARITIES</small>
      </h4>
      <ul class="catalog-item-list">
        ${items.map((item) => equipmentCatalogRow(item)).join('')}
      </ul>
    </section>
  `;
}

function equipmentCatalogLockedSlots(areaId: AdventureAreaId): string {
  return `
    <div class="catalog-locked-preview" role="group" aria-label="未解放の装備内訳">
      ${SLOT_ORDER.map((slot) => {
        const count = EQUIPMENT_BASE_CATALOG.filter((item) => item.areaId === areaId && item.slot === slot).length;
        return `
          <div>
            <span><i class="fa-solid ${SLOT_ICONS[slot]}" aria-hidden="true"></i>${SLOT_LABELS[slot]}</span>
            <b>??? <small>× ${count}</small></b>
          </div>
        `;
      }).join('')}
      <p><i class="fa-solid fa-crown" aria-hidden="true"></i> そよかぜ草原のボス討伐で解放</p>
    </div>
  `;
}

function fixedEquipmentCatalogSection(state: IdleRpgState): string {
  const fixedItems = EQUIPMENT_CATALOG.filter((item) => item.baseId === null);
  const bossRewardUnlocked = state.areaProgress.sunmeadow.bossDefeated
    || state.unlockedAreas.includes('komorebi-forest');
  return `
    <section class="catalog-special" aria-labelledby="catalog-special-title">
      <header class="catalog-special-header">
        <span class="catalog-area-icon"><i class="fa-solid fa-star" aria-hidden="true"></i></span>
        <span>
          <small>SPECIAL / FIXED</small>
          <h3 id="catalog-special-title">特別な装備</h3>
          <p>冒険の始まりや、ボス討伐で一度だけ手に入る固定装備。</p>
        </span>
        <em>${fixedItems.length} ITEMS</em>
      </header>
      <ul class="catalog-special-list">
        ${fixedItems.map((item) => {
          const starter = item.source === 'starter';
          const visible = starter || bossRewardUnlocked;
          return `
            <li class="${visible ? '' : 'is-secret'}">
              <span class="catalog-item-icon"><i class="fa-solid ${visible ? SLOT_ICONS[item.slot] : 'fa-lock'}" aria-hidden="true"></i></span>
              <span class="catalog-item-name">
                <b>${visible ? escapeHtml(item.name) : '???'}</b>
                <small>${starter ? 'はじめから所持' : visible ? '草原ボス初回討伐報酬' : '王冠スライム討伐で解放'}</small>
              </span>
              <span class="catalog-special-badge rarity-${item.rarity}">${visible ? '固定装備' : 'LOCKED'}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `;
}

function equipmentCatalogRow(item: (typeof EQUIPMENT_BASE_CATALOG)[number]): string {
  const stats = [
    item.attack > 0 ? `<span>ATK <b>+${item.attack}</b></span>` : '',
    item.defense > 0 ? `<span>DEF <b>+${item.defense}</b></span>` : '',
    item.maxHp > 0 ? `<span>HP <b>+${item.maxHp}</b></span>` : ''
  ].filter(Boolean).join('');
  return `
    <li>
      <span class="catalog-item-icon"><i class="fa-solid ${SLOT_ICONS[item.slot]}" aria-hidden="true"></i></span>
      <span class="catalog-item-name"><b>${escapeHtml(item.name)}</b><small>${catalogStatTendency(item)}</small></span>
      <span class="catalog-item-stats">${stats}</span>
    </li>
  `;
}

function catalogStatTendency(item: (typeof EQUIPMENT_BASE_CATALOG)[number]): string {
  const stats = [
    { label: '攻撃型', value: item.attack * 2 },
    { label: '防御型', value: item.defense * 1.7 },
    { label: '体力型', value: item.maxHp * 0.32 }
  ];
  const highest = Math.max(...stats.map((stat) => stat.value));
  const strongest = stats.filter((stat) => stat.value === highest && stat.value > 0);
  return strongest.length === 1 ? strongest[0]!.label : 'バランス型';
}

function renderInfoModal(content: HTMLElement, title: string, icon: string, copy: string): void {
  content.innerHTML = `${modalHeader(title, icon, 'COMING SOON')}<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${copy}</p></div>`;
}

function renderMenuModal(content: HTMLElement): void {
  content.innerHTML = `
    ${modalHeader('メニュー', 'fa-table-cells-large', '図鑑・設定')}
    <div class="menu-list">
      <button class="menu-entry-button catalog-entry" data-modal-action="catalog" type="button">
        <i class="fa-solid fa-book-open" aria-hidden="true"></i>
        <span><b>装備図鑑</b><small>エリア別に装備を見る</small></span>
        <em>${TOTAL_EQUIPMENT_VARIANTS}種 <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></em>
      </button>
      <div><i class="fa-solid fa-cloud-arrow-up"></i><span><b>オートセーブ</b><small>この端末に自動で保存</small></span><em>ON</em></div>
      <div><i class="fa-solid fa-volume-high"></i><span><b>サウンド</b><small>演出音は今後追加予定</small></span><em>—</em></div>
    </div>
    <button class="reset-button" data-modal-action="reset">セーブデータをリセット</button>
  `;
}

function modalHeader(title: string, icon: string, detail: string): string {
  return `
    <header class="modal-header"><div><i class="fa-solid ${icon}"></i><h2 id="modal-title">${title}</h2></div><span>${detail}</span><button data-modal-action="close" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button></header>
  `;
}

function showToast(message: string, className: string): void {
  const toast = required<HTMLElement>('toast');
  if (toastTimer !== undefined) window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${className}`;
  toastTimer = window.setTimeout(() => {
    toast.className = 'toast';
    toastTimer = undefined;
  }, 2300);
}

function equipmentSignature(state: IdleRpgState): string {
  return JSON.stringify({
    inventory: state.inventory.map((item) => [item.id, item.score, item.upgradeLevel]),
    equipped: state.equipped
  });
}

function forgeSignature(state: IdleRpgState): string {
  return JSON.stringify({
    gold: state.hero.gold,
    inventory: state.inventory.map((item) => [item.id, item.score, item.upgradeLevel]),
    equipped: state.equipped
  });
}

function questSignature(state: IdleRpgState): string {
  return `${state.quest.progress}:${state.quest.claimed}:${state.hero.level}:${state.hero.gold}`;
}

function destinationSignature(state: IdleRpgState): string {
  const meadow = state.areaProgress.sunmeadow;
  const forest = state.areaProgress['komorebi-forest'];
  return [
    state.unlockedAreas.join(','),
    meadow.regularKills,
    meadow.bossDefeated,
    forest.regularKills,
    forest.bossDefeated
  ].join(':');
}

function catalogSignature(state: IdleRpgState): string {
  return state.unlockedAreas.join(',');
}

function refreshModalPreservingFocus(content: HTMLElement, render: () => void): void {
  const activeElement = document.activeElement instanceof HTMLElement && content.contains(document.activeElement)
    ? document.activeElement
    : null;
  const modalAction = activeElement?.dataset.modalAction;
  const itemId = activeElement?.dataset.itemId;
  const areaId = activeElement?.dataset.areaId;
  render();
  if (!modalAction) return;
  const nextTarget = [...content.querySelectorAll<HTMLElement>('[data-modal-action]')].find((element) => (
    element.dataset.modalAction === modalAction
    && element.dataset.itemId === itemId
    && element.dataset.areaId === areaId
  ));
  const fallback = content.querySelector<HTMLElement>('[data-modal-action="close"]');
  (nextTarget ?? fallback)?.focus({ preventScroll: true });
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function setText(id: string, value: string): void {
  required<HTMLElement>(id).textContent = value;
}

function setWidth(id: string, ratio: number): void {
  required<HTMLElement>(id).style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character] ?? character);
}
