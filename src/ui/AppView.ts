import { runtime } from '../game/runtime';
import {
  INVENTORY_LIMIT,
  MAX_ENHANCEMENT_LEVEL,
  getDerivedStats,
  getEnhancementCost,
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
  });

  runtime.onCombat((events) => {
    const loot = events.find((event) => event.type === 'loot');
    const autoSold = events.find((event) => event.type === 'loot-auto-sold');
    const levelUp = events.find((event) => event.type === 'level-up');
    const defeat = events.find((event) => event.type === 'hero-defeated');
    if (loot?.type === 'loot') showToast(`★ ${loot.item.name}を手に入れた！`, `rarity-${loot.item.rarity}`);
    else if (autoSold?.type === 'loot-auto-sold') showToast(`荷物がいっぱい。${autoSold.gold}Gで自動売却`, 'level-up');
    else if (levelUp?.type === 'level-up') showToast(`LEVEL UP！ Lv.${levelUp.level}になった`, 'level-up');
    else if (defeat) showToast('ギルドに運ばれました…', 'danger');
  });

  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'adventure') runtime.startAdventure();
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
    if (action === 'equip' && element.dataset.itemId) runtime.equip(element.dataset.itemId);
    if (action === 'sell' && element.dataset.itemId) runtime.sell(element.dataset.itemId);
    if (action === 'enhance' && element.dataset.itemId) {
      if (runtime.enhance(element.dataset.itemId)) showToast('装備を強化しました！', 'level-up');
    }
    if (action === 'claim') runtime.claimQuest();
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
  setText('stage-label', state.mode === 'guild' ? 'ギルド' : 'そよかぜ草原');
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
      ${actionButton('adventure', 'fa-person-running', '冒険に出る', 'そよかぜ草原へ', 'accent')}
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
  if (view === 'dispatch') renderInfoModal(content, '遠征', 'fa-compass', 'Eランクになると、仲間を送り出して報酬を受け取れるようになります。');
  if (view === 'menu') renderMenuModal(content);
  if (!modal.open) modal.showModal();
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

function renderInfoModal(content: HTMLElement, title: string, icon: string, copy: string): void {
  content.innerHTML = `${modalHeader(title, icon, 'COMING SOON')}<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${copy}</p></div>`;
}

function renderMenuModal(content: HTMLElement): void {
  content.innerHTML = `
    ${modalHeader('メニュー', 'fa-table-cells-large', '設定')}
    <div class="menu-list">
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

function refreshModalPreservingFocus(content: HTMLElement, render: () => void): void {
  const activeElement = document.activeElement instanceof HTMLElement && content.contains(document.activeElement)
    ? document.activeElement
    : null;
  const modalAction = activeElement?.dataset.modalAction;
  const itemId = activeElement?.dataset.itemId;
  render();
  if (!modalAction) return;
  const nextTarget = [...content.querySelectorAll<HTMLElement>('[data-modal-action]')].find((element) => (
    element.dataset.modalAction === modalAction && element.dataset.itemId === itemId
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
