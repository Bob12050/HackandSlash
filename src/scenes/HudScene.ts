import Phaser from 'phaser';

import { RARITY_DATA } from '../game/data';
import { Events, gameEvents } from '../game/events';
import type { HudState, LootItem, RunSummary, UpgradeChoice } from '../game/types';

const UI = {
  panel: 0x090b11,
  panelLight: 0x14131a,
  line: 0x514147,
  crimson: 0xc13d50,
  crimsonDark: 0x4d1523,
  violet: 0x8458c7,
  gold: 0xd4ad68,
  ivory: '#f1eadd',
  muted: '#9a9399'
} as const;

const INITIAL_HUD: HudState = {
  health: 100,
  maxHealth: 100,
  experience: 0,
  nextExperience: 1,
  level: 1,
  kills: 0,
  gold: 0,
  wave: 1,
  waveRemaining: 0,
  elapsed: 0,
  dashRatio: 0
};

interface UpgradeCard {
  choice: UpgradeChoice;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
}

export class HudScene extends Phaser.Scene {
  private hudState: HudState = { ...INITIAL_HUD };
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private hpCaption!: Phaser.GameObjects.Text;
  private hpValue!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private waveRemainingText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private experienceText!: Phaser.GameObjects.Text;
  private dashText!: Phaser.GameObjects.Text;

  private upgradeChoices: UpgradeChoice[] | undefined;
  private upgradeOverlay: Phaser.GameObjects.Container | undefined;
  private upgradeCards: UpgradeCard[] = [];
  private upgradeSelectionPending = false;

  private lootToast: Phaser.GameObjects.Container | undefined;
  private runSummary: RunSummary | undefined;
  private gameOverOverlay: Phaser.GameObjects.Container | undefined;

  private readonly receiveHudUpdate = (state: HudState): void => {
    this.hudState = { ...state };
    this.renderHud();
  };

  private readonly receiveUpgradeChoices = (choices: UpgradeChoice[]): void => {
    this.upgradeChoices = choices.slice(0, 3);
    this.upgradeSelectionPending = false;
    this.rebuildUpgradeOverlay();
  };

  private readonly receiveLoot = (item: LootItem): void => {
    this.showLootToast(item);
  };

  private readonly receiveRunEnd = (summary: RunSummary): void => {
    this.runSummary = { ...summary };
    this.hideUpgradeOverlay();
    this.hideLootToast();
    this.rebuildGameOverOverlay();
  };

  private readonly handleResize = (): void => {
    this.renderHud();
    if (this.upgradeChoices) this.rebuildUpgradeOverlay();
    if (this.runSummary) this.rebuildGameOverOverlay();
    this.layoutLootToast();
  };

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.hudState = { ...INITIAL_HUD };
    this.upgradeChoices = undefined;
    this.runSummary = undefined;
    this.upgradeSelectionPending = false;

    this.hudGraphics = this.add.graphics().setDepth(10);
    this.hpCaption = this.createHudText('生命力', 12, UI.muted).setDepth(11);
    this.hpValue = this.createHudText('', 13, UI.ivory, 'bold').setOrigin(1, 0).setDepth(11);
    this.waveText = this.createHudText('', 16, UI.ivory, 'bold').setOrigin(0.5, 0).setDepth(11);
    this.waveRemainingText = this.createHudText('', 10, UI.muted).setOrigin(0.5, 0).setDepth(11);
    this.statsText = this.createHudText('', 12, UI.ivory).setOrigin(1, 0).setDepth(11);
    this.timerText = this.createHudText('', 18, '#d8c49d', 'bold').setOrigin(1, 0).setDepth(11);
    this.levelText = this.createHudText('', 13, '#f2d596', 'bold').setDepth(11);
    this.experienceText = this.createHudText('', 10, '#c8beca').setOrigin(0.5, 0).setDepth(11);
    this.dashText = this.createHudText('', 10, UI.ivory, 'bold').setOrigin(1, 0).setDepth(11);

    gameEvents.on(Events.HUD_UPDATE, this.receiveHudUpdate);
    gameEvents.on(Events.SHOW_UPGRADES, this.receiveUpgradeChoices);
    gameEvents.on(Events.LOOT_COLLECTED, this.receiveLoot);
    gameEvents.on(Events.RUN_ENDED, this.receiveRunEnd);
    this.scale.on('resize', this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);

    this.renderHud();
  }

  private createHudText(
    text: string,
    fontSize: number,
    color: string,
    fontStyle = 'normal'
  ): Phaser.GameObjects.Text {
    return this.add.text(0, 0, text, {
      fontFamily: '"Yu Gothic", "Hiragino Kaku Gothic ProN", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle,
      color
    });
  }

  private renderHud(): void {
    if (!this.hudGraphics?.active) return;

    const width = this.scale.width;
    const height = this.scale.height;
    const desktop = width >= 820;
    const margin = desktop ? 22 : 12;
    const healthRatio = Phaser.Math.Clamp(this.hudState.health / Math.max(1, this.hudState.maxHealth), 0, 1);
    const experienceRatio = Phaser.Math.Clamp(
      this.hudState.experience / Math.max(1, this.hudState.nextExperience),
      0,
      1
    );
    // GameScene reports the remaining cooldown ratio (0 means ready).
    const dashCooldownRatio = Phaser.Math.Clamp(this.hudState.dashRatio, 0, 1);
    const dashChargeRatio = 1 - dashCooldownRatio;
    const healthPanelWidth = desktop ? Math.min(340, width * 0.34) : Math.min(width - margin * 2, 350);
    const healthPanelHeight = 62;
    const healthX = margin;
    const healthY = margin;

    this.hudGraphics.clear();

    this.drawPanel(healthX, healthY, healthPanelWidth, healthPanelHeight);
    const healthBarX = healthX + 13;
    const healthBarY = healthY + 36;
    const healthBarWidth = healthPanelWidth - 26;
    this.hudGraphics.fillStyle(0x24151b, 1);
    this.hudGraphics.fillRoundedRect(healthBarX, healthBarY, healthBarWidth, 12, 3);
    if (healthRatio > 0) {
      this.hudGraphics.fillGradientStyle(0x7f1f34, 0xd14a59, 0x5a1425, 0xab3044, 1, 1, 1, 1);
      this.hudGraphics.fillRoundedRect(healthBarX, healthBarY, healthBarWidth * healthRatio, 12, 3);
    }
    this.hudGraphics.lineStyle(1, 0xd78c91, 0.35);
    this.hudGraphics.strokeRoundedRect(healthBarX, healthBarY, healthBarWidth, 12, 3);

    this.hpCaption.setPosition(healthX + 13, healthY + 10);
    this.hpValue
      .setText(`${Math.ceil(Math.max(0, this.hudState.health))} / ${Math.ceil(this.hudState.maxHealth)}`)
      .setPosition(healthX + healthPanelWidth - 13, healthY + 9);

    const waveWidth = desktop ? 222 : Math.min(220, width - margin * 2);
    const waveHeight = 54;
    const waveX = (width - waveWidth) / 2;
    const waveY = desktop ? margin : healthY + healthPanelHeight + 8;
    this.drawPanel(waveX, waveY, waveWidth, waveHeight, 0x2e2026);
    this.hudGraphics.lineStyle(2, UI.crimson, 0.8);
    this.hudGraphics.lineBetween(waveX + 18, waveY + waveHeight - 5, waveX + waveWidth - 18, waveY + waveHeight - 5);

    this.waveText
      .setText(`WAVE ${Math.max(1, this.hudState.wave)}`)
      .setPosition(width / 2, waveY + 8);
    this.waveRemainingText
      .setText(`次の亀裂まで  ${Math.ceil(Math.max(0, this.hudState.waveRemaining))}秒`)
      .setPosition(width / 2, waveY + 31);

    if (desktop) {
      const statsWidth = 226;
      const statsX = width - margin - statsWidth;
      this.drawPanel(statsX, margin, statsWidth, 62);
      this.statsText
        .setText(`討伐  ${this.hudState.kills.toLocaleString()}    黄金  ${this.hudState.gold.toLocaleString()}`)
        .setPosition(width - margin - 13, margin + 10)
        .setFontSize(12);
      this.timerText
        .setText(this.formatTime(this.hudState.elapsed))
        .setPosition(width - margin - 13, margin + 31)
        .setFontSize(18);
    } else {
      const statsY = waveY + waveHeight + 7;
      const statsWidth = Math.min(width - margin * 2, 350);
      const statsX = (width - statsWidth) / 2;
      this.drawPanel(statsX, statsY, statsWidth, 36);
      this.statsText
        .setText(`討伐 ${this.hudState.kills.toLocaleString()}   ◆ ${this.hudState.gold.toLocaleString()}   ${this.formatTime(this.hudState.elapsed)}`)
        .setPosition(statsX + statsWidth - 12, statsY + 10)
        .setFontSize(width < 390 ? 10 : 11);
      this.timerText.setText('').setPosition(0, 0);
    }

    const xpBarX = margin;
    const xpBarWidth = width - margin * 2;
    const xpBarY = height - 22;
    this.hudGraphics.fillStyle(UI.panel, 0.92);
    this.hudGraphics.fillRoundedRect(xpBarX, xpBarY, xpBarWidth, 10, 3);
    if (experienceRatio > 0) {
      this.hudGraphics.fillGradientStyle(0x4b347d, 0xa56de0, 0x332457, 0x7049a0, 1, 1, 1, 1);
      this.hudGraphics.fillRoundedRect(xpBarX, xpBarY, xpBarWidth * experienceRatio, 10, 3);
    }
    this.hudGraphics.lineStyle(1, 0xc5a7e0, 0.4);
    this.hudGraphics.strokeRoundedRect(xpBarX, xpBarY, xpBarWidth, 10, 3);

    this.levelText
      .setText(`LV ${Math.max(1, this.hudState.level)}`)
      .setPosition(margin, height - 48);
    this.experienceText
      .setText(`${Math.floor(this.hudState.experience)} / ${Math.max(1, this.hudState.nextExperience)}  XP`)
      .setPosition(width / 2, height - 42);

    const dashWidth = desktop ? 120 : 92;
    const dashX = width - margin - dashWidth;
    const dashY = height - 48;
    this.hudGraphics.fillStyle(0x151821, 0.94);
    this.hudGraphics.fillRoundedRect(dashX, dashY, dashWidth, 7, 2);
    this.hudGraphics.fillStyle(dashCooldownRatio <= 0 ? UI.gold : 0x6f778a, 1);
    this.hudGraphics.fillRoundedRect(dashX, dashY, dashWidth * dashChargeRatio, 7, 2);
    this.dashText
      .setText(dashCooldownRatio <= 0 ? 'DASH  READY' : `DASH  ${Math.round(dashChargeRatio * 100)}%`)
      .setColor(dashCooldownRatio <= 0 ? '#e8cc8c' : '#aaaebb')
      .setPosition(width - margin, dashY - 18);
  }

  private drawPanel(x: number, y: number, width: number, height: number, lineColor: number = UI.line): void {
    this.hudGraphics.fillStyle(UI.panel, 0.88);
    this.hudGraphics.fillRoundedRect(x, y, width, height, 5);
    this.hudGraphics.fillStyle(UI.panelLight, 0.42);
    this.hudGraphics.fillRoundedRect(x + 3, y + 3, width - 6, height - 6, 3);
    this.hudGraphics.lineStyle(1, lineColor, 0.76);
    this.hudGraphics.strokeRoundedRect(x, y, width, height, 5);
  }

  private rebuildUpgradeOverlay(): void {
    this.destroyUpgradeOverlay();
    if (!this.upgradeChoices || this.upgradeChoices.length === 0 || !this.sys.isActive()) return;

    const width = this.scale.width;
    const height = this.scale.height;
    const horizontal = width >= 760 && height >= 520;
    const panelWidth = horizontal ? Math.min(width - 56, 980) : Math.min(width - 24, 520);
    const panelHeight = horizontal ? Math.min(height - 54, 410) : Math.min(height - 20, 610);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    const overlay = this.add.container(0, 0).setDepth(100);

    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x020307, 0.88)
      .setInteractive();
    const frame = this.add.graphics();
    frame.fillStyle(0x0d0d14, 0.99);
    frame.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    frame.lineStyle(1, UI.gold, 0.58);
    frame.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    frame.lineStyle(3, UI.crimson, 0.86);
    frame.lineBetween(panelX + 34, panelY + 5, panelX + panelWidth - 34, panelY + 5);

    const heading = this.add.text(width / 2, panelY + 28, '血脈を刻む', {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: horizontal ? '25px' : '21px',
      fontStyle: 'bold',
      color: UI.ivory,
      letterSpacing: 5
    }).setOrigin(0.5, 0);
    const subheading = this.add.text(width / 2, panelY + 62, 'LEVEL UP  —  ひとつを選べ', {
      fontFamily: 'Arial, "Yu Gothic", sans-serif',
      fontSize: '10px',
      color: '#b99d6d',
      letterSpacing: 2
    }).setOrigin(0.5, 0);

    overlay.add([backdrop, frame, heading, subheading]);
    this.upgradeCards = [];

    const gap = horizontal ? 16 : 9;
    const cardAreaTop = panelY + (horizontal ? 100 : 92);
    const cardAreaHeight = panelY + panelHeight - 20 - cardAreaTop;
    const cardWidth = horizontal
      ? (panelWidth - 56 - gap * 2) / 3
      : panelWidth - 30;
    const cardHeight = horizontal
      ? cardAreaHeight
      : (cardAreaHeight - gap * (this.upgradeChoices.length - 1)) / this.upgradeChoices.length;

    this.upgradeChoices.forEach((choice, index) => {
      const x = horizontal
        ? panelX + 28 + cardWidth / 2 + index * (cardWidth + gap)
        : width / 2;
      const y = horizontal
        ? cardAreaTop + cardHeight / 2
        : cardAreaTop + cardHeight / 2 + index * (cardHeight + gap);
      const card = this.createUpgradeCard(choice, x, y, cardWidth, cardHeight, horizontal, index);
      overlay.add(card.container);
      this.upgradeCards.push(card);
    });

    this.upgradeOverlay = overlay;
  }

  private createUpgradeCard(
    choice: UpgradeChoice,
    x: number,
    y: number,
    width: number,
    height: number,
    horizontal: boolean,
    index: number
  ): UpgradeCard {
    const background = this.add.rectangle(0, 0, width, height, 0x171720, 1)
      .setStrokeStyle(1, 0x5a4c55, 1)
      .setInteractive({ useHandCursor: true });
    const number = this.add.text(-width / 2 + 12, -height / 2 + 9, `0${index + 1}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#7e7279'
    });

    let icon: Phaser.GameObjects.Text;
    let title: Phaser.GameObjects.Text;
    let description: Phaser.GameObjects.Text;
    let prompt: Phaser.GameObjects.Text;

    if (horizontal) {
      icon = this.add.text(0, -height / 2 + 42, choice.icon, {
        fontFamily: '"Yu Mincho", serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#d85668',
        stroke: '#3d111d',
        strokeThickness: 5
      }).setOrigin(0.5, 0);
      title = this.add.text(0, -height / 2 + 100, choice.title, {
        fontFamily: '"Yu Mincho", serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: UI.ivory,
        align: 'center'
      }).setOrigin(0.5, 0);
      description = this.add.text(0, -height / 2 + 140, choice.description, {
        fontFamily: '"Yu Gothic", sans-serif',
        fontSize: '12px',
        color: '#bdb5ba',
        align: 'center',
        wordWrap: { width: width - 30 }
      }).setOrigin(0.5, 0);
      prompt = this.add.text(0, height / 2 - 25, 'SELECT', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        color: '#b99d6d',
        letterSpacing: 2
      }).setOrigin(0.5);
    } else {
      const iconSize = Phaser.Math.Clamp(height * 0.28, 22, 34);
      icon = this.add.text(-width / 2 + 45, 0, choice.icon, {
        fontFamily: '"Yu Mincho", serif',
        fontSize: `${iconSize}px`,
        fontStyle: 'bold',
        color: '#d85668',
        stroke: '#3d111d',
        strokeThickness: 4
      }).setOrigin(0.5);
      title = this.add.text(-width / 2 + 82, -17, choice.title, {
        fontFamily: '"Yu Mincho", serif',
        fontSize: height < 105 ? '13px' : '15px',
        fontStyle: 'bold',
        color: UI.ivory
      }).setOrigin(0, 0.5);
      description = this.add.text(-width / 2 + 82, 15, choice.description, {
        fontFamily: '"Yu Gothic", sans-serif',
        fontSize: height < 105 ? '10px' : '11px',
        color: '#bdb5ba',
        wordWrap: { width: width - 130 }
      }).setOrigin(0, 0.5);
      prompt = this.add.text(width / 2 - 13, 0, '›', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#b99d6d'
      }).setOrigin(1, 0.5);
    }

    const container = this.add.container(x, y, [background, number, icon, title, description, prompt]);
    background.on('pointerover', () => {
      if (this.upgradeSelectionPending) return;
      background.setFillStyle(0x2a1821, 1).setStrokeStyle(2, UI.gold, 0.9);
      container.setScale(1.018);
      icon.setColor('#ff6d7d');
    });
    background.on('pointerout', () => {
      if (this.upgradeSelectionPending) return;
      background.setFillStyle(0x171720, 1).setStrokeStyle(1, 0x5a4c55, 1);
      container.setScale(1);
      icon.setColor('#d85668');
    });
    background.on('pointerdown', () => this.selectUpgrade(choice.id));

    return { choice, container, background };
  }

  private selectUpgrade(id: string): void {
    if (this.upgradeSelectionPending || !this.upgradeChoices) return;
    this.upgradeSelectionPending = true;
    this.upgradeCards.forEach(({ choice, background }) => {
      background.disableInteractive();
      if (choice.id === id) background.setFillStyle(0x51202d, 1).setStrokeStyle(2, UI.gold, 1);
    });

    this.time.delayedCall(90, () => {
      this.hideUpgradeOverlay();
      gameEvents.emit(Events.UPGRADE_SELECTED, id);
    });
  }

  private hideUpgradeOverlay(): void {
    this.upgradeChoices = undefined;
    this.destroyUpgradeOverlay();
  }

  private destroyUpgradeOverlay(): void {
    this.upgradeOverlay?.destroy(true);
    this.upgradeOverlay = undefined;
    this.upgradeCards = [];
  }

  private showLootToast(item: LootItem): void {
    this.hideLootToast();
    if (!this.sys.isActive()) return;

    const rarity = RARITY_DATA[item.rarity];
    const toastWidth = Math.min(390, this.scale.width - 28);
    const toast = this.add.container(this.scale.width / 2, this.scale.height - 108).setDepth(80);
    const shadow = this.add.rectangle(3, 5, toastWidth, 82, 0x000000, 0.45);
    const background = this.add.rectangle(0, 0, toastWidth, 82, 0x0d0e14, 0.97)
      .setStrokeStyle(1, rarity.color, 0.9);
    const stripe = this.add.rectangle(-toastWidth / 2 + 4, 0, 4, 66, rarity.color, 1);
    const label = this.add.text(-toastWidth / 2 + 18, -29, `${rarity.label} 戦利品`, {
      fontFamily: 'Arial, "Yu Gothic", sans-serif',
      fontSize: '9px',
      color: Phaser.Display.Color.IntegerToColor(rarity.color).rgba,
      letterSpacing: 2
    });
    const name = this.add.text(-toastWidth / 2 + 18, -10, item.name, {
      fontFamily: '"Yu Mincho", serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: UI.ivory
    });
    const stat = this.add.text(-toastWidth / 2 + 18, 17, `${item.statLabel}  +${item.value}${item.suffix}`, {
      fontFamily: '"Yu Gothic", sans-serif',
      fontSize: '11px',
      color: '#bbb3b9'
    });
    const acquired = this.add.text(toastWidth / 2 - 14, 22, 'ACQUIRED', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '8px',
      color: '#777078',
      letterSpacing: 1
    }).setOrigin(1, 0);

    toast.add([shadow, background, stripe, label, name, stat, acquired]);
    toast.setAlpha(0).setScale(0.96);
    this.lootToast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      duration: 220,
      hold: 2200,
      yoyo: true,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (this.lootToast === toast) this.lootToast = undefined;
        toast.destroy(true);
      }
    });
  }

  private layoutLootToast(): void {
    this.lootToast?.setPosition(this.scale.width / 2, this.scale.height - 108);
  }

  private hideLootToast(): void {
    if (!this.lootToast) return;
    this.tweens.killTweensOf(this.lootToast);
    this.lootToast.destroy(true);
    this.lootToast = undefined;
  }

  private rebuildGameOverOverlay(): void {
    this.destroyGameOverOverlay();
    if (!this.runSummary || !this.sys.isActive()) return;

    const summary = this.runSummary;
    const width = this.scale.width;
    const height = this.scale.height;
    const wide = width >= 720;
    const panelWidth = wide ? Math.min(width - 60, 790) : Math.min(width - 24, 480);
    const panelHeight = wide ? Math.min(height - 54, 470) : Math.min(height - 20, 610);
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    const overlay = this.add.container(0, 0).setDepth(200);
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x020205, 0.92)
      .setInteractive();
    const frame = this.add.graphics();
    frame.fillStyle(0x0c0c12, 1);
    frame.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    frame.lineStyle(1, 0x6b4f54, 0.9);
    frame.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    frame.lineStyle(3, UI.crimson, 1);
    frame.lineBetween(panelX + 30, panelY + 5, panelX + panelWidth - 30, panelY + 5);

    const epitaph = this.add.text(width / 2, panelY + 28, '—  THE RIFT CLAIMS ANOTHER  —', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#a9845e',
      letterSpacing: 2
    }).setOrigin(0.5, 0);
    const heading = this.add.text(width / 2, panelY + 53, '深淵に呑まれた', {
      fontFamily: '"Yu Mincho", serif',
      fontSize: wide ? '30px' : '24px',
      fontStyle: 'bold',
      color: UI.ivory,
      letterSpacing: wide ? 6 : 3
    }).setOrigin(0.5, 0);
    const subheading = this.add.text(width / 2, panelY + 96, 'しかし、刃の記憶は血の中に残る', {
      fontFamily: '"Yu Gothic", sans-serif',
      fontSize: '11px',
      color: UI.muted
    }).setOrigin(0.5, 0);

    overlay.add([backdrop, frame, epitaph, heading, subheading]);

    const stats = [
      ['TIME', this.formatTime(summary.elapsed)],
      ['KILLS', summary.kills.toLocaleString()],
      ['LEVEL', `${summary.level}`],
      ['WAVE', `${summary.wave}`],
      ['GOLD', summary.gold.toLocaleString()]
    ];
    const statsTop = panelY + (wide ? 138 : 128);
    if (wide) {
      const gap = 8;
      const statWidth = (panelWidth - 48 - gap * 4) / 5;
      stats.forEach(([label, value], index) => {
        const x = panelX + 24 + statWidth / 2 + index * (statWidth + gap);
        overlay.add(this.createSummaryStat(label ?? '', value ?? '', x, statsTop + 49, statWidth, 98));
      });
    } else {
      const gap = 8;
      const statWidth = (panelWidth - 38 - gap) / 2;
      const statHeight = Math.min(74, (panelHeight - 305) / 3);
      stats.forEach(([label, value], index) => {
        const lastCentered = index === 4;
        const column = lastCentered ? 0.5 : index % 2;
        const row = Math.floor(index / 2);
        const x = lastCentered
          ? width / 2
          : panelX + 19 + statWidth / 2 + column * (statWidth + gap);
        const y = statsTop + statHeight / 2 + row * (statHeight + gap);
        overlay.add(this.createSummaryStat(label ?? '', value ?? '', x, y, lastCentered ? panelWidth - 38 : statWidth, statHeight));
      });
    }

    const buttonsY = panelY + panelHeight - (wide ? 68 : 60);
    if (wide) {
      overlay.add(this.createModalButton('再び深淵へ', 'RETRY', width / 2 - 142, buttonsY, 256, true, () => this.retryRun()));
      overlay.add(this.createModalButton('タイトルへ', 'RETURN', width / 2 + 142, buttonsY, 256, false, () => this.returnToTitle()));
    } else {
      const buttonWidth = panelWidth - 38;
      const firstY = buttonsY - 34;
      overlay.add(this.createModalButton('再び深淵へ', 'RETRY', width / 2, firstY, buttonWidth, true, () => this.retryRun()));
      overlay.add(this.createModalButton('タイトルへ', 'RETURN', width / 2, firstY + 65, buttonWidth, false, () => this.returnToTitle()));
    }

    this.gameOverOverlay = overlay;
  }

  private createSummaryStat(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const box = this.add.rectangle(0, 0, width, height, 0x14141b, 1).setStrokeStyle(1, 0x3e373e, 1);
    const labelText = this.add.text(0, -height * 0.22, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#8e8188',
      letterSpacing: 2
    }).setOrigin(0.5);
    const valueText = this.add.text(0, height * 0.12, value, {
      fontFamily: 'Georgia, "Yu Mincho", serif',
      fontSize: height < 72 ? '17px' : '22px',
      fontStyle: 'bold',
      color: '#e5cf9e'
    }).setOrigin(0.5);
    return this.add.container(x, y, [box, labelText, valueText]);
  }

  private createModalButton(
    label: string,
    secondary: string,
    x: number,
    y: number,
    width: number,
    primary: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const baseColor = primary ? 0x781e31 : 0x191921;
    const hoverColor = primary ? 0xa62d43 : 0x292832;
    const borderColor = primary ? UI.gold : 0x68606a;
    const background = this.add.rectangle(0, 0, width, 54, baseColor, 1)
      .setStrokeStyle(1, borderColor, 0.85)
      .setInteractive({ useHandCursor: true });
    const labelText = this.add.text(0, -8, label, {
      fontFamily: '"Yu Mincho", serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: UI.ivory,
      letterSpacing: 2
    }).setOrigin(0.5);
    const secondaryText = this.add.text(0, 13, secondary, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '8px',
      color: primary ? '#d4b878' : '#817982',
      letterSpacing: 2
    }).setOrigin(0.5);
    const container = this.add.container(x, y, [background, labelText, secondaryText]);
    background.on('pointerover', () => {
      background.setFillStyle(hoverColor, 1).setStrokeStyle(2, borderColor, 1);
      container.setScale(1.015);
    });
    background.on('pointerout', () => {
      background.setFillStyle(baseColor, 1).setStrokeStyle(1, borderColor, 0.85);
      container.setScale(1);
    });
    background.on('pointerdown', onClick);
    return container;
  }

  private retryRun(): void {
    if (!this.runSummary) return;
    this.runSummary = undefined;
    this.destroyGameOverOverlay();
    this.hudState = { ...INITIAL_HUD };
    this.renderHud();
    gameEvents.emit(Events.RETRY_RUN);
  }

  private returnToTitle(): void {
    if (!this.runSummary) return;
    this.runSummary = undefined;
    this.destroyGameOverOverlay();
    gameEvents.emit(Events.RETURN_TO_TITLE);
  }

  private destroyGameOverOverlay(): void {
    this.gameOverOverlay?.destroy(true);
    this.gameOverOverlay = undefined;
  }

  private formatTime(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private shutdownScene(): void {
    gameEvents.off(Events.HUD_UPDATE, this.receiveHudUpdate);
    gameEvents.off(Events.SHOW_UPGRADES, this.receiveUpgradeChoices);
    gameEvents.off(Events.LOOT_COLLECTED, this.receiveLoot);
    gameEvents.off(Events.RUN_ENDED, this.receiveRunEnd);
    this.scale.off('resize', this.handleResize);
    this.destroyUpgradeOverlay();
    this.hideLootToast();
    this.destroyGameOverOverlay();
    this.upgradeChoices = undefined;
    this.runSummary = undefined;
  }
}
