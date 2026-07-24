import Phaser from 'phaser';

import { runtime } from '../game/runtime';
import type { CombatEvent, IdleRpgState } from '../game/idleRpg';

export class StageScene extends Phaser.Scene {
  private guildBackground!: Phaser.GameObjects.Image;
  private meadowBackground!: Phaser.GameObjects.Image;
  private forestBackground!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private clerk!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Image;
  private lootChest!: Phaser.GameObjects.Image;
  private unsubscribeState: (() => void) | undefined;
  private unsubscribeCombat: (() => void) | undefined;
  private currentMode: IdleRpgState['mode'] | undefined;
  private pendingState: IdleRpgState | undefined;
  private holdingEnemyTransition = false;
  private reduceMotion = false;
  private chestBaseScaleX = 1;
  private chestBaseScaleY = 1;
  private currentEnemyKind: string | undefined;

  constructor() {
    super('StageScene');
  }

  preload(): void {
    this.load.image('guild-background', 'assets/guild-hall.png');
    this.load.image('meadow-background', 'assets/sunmeadow.png');
    this.load.image('forest-background', 'assets/komorebi-forest.png');
    this.load.image('adventurer', 'assets/hero.png');
    this.load.image('guild-clerk', 'assets/guild-clerk.png');
    this.load.image('mint-slime', 'assets/mint-slime.png');
    this.load.image('crown-slime', 'assets/crown-slime.png');
    this.load.image('loot-chest', 'assets/loot-chest.png');
  }

  create(): void {
    this.guildBackground = this.add.image(480, 292.5, 'guild-background').setDisplaySize(1040, 585);
    this.meadowBackground = this.add.image(480, 292.5, 'meadow-background').setDisplaySize(1040, 585);
    this.forestBackground = this.add.image(480, 292.5, 'forest-background').setDisplaySize(1040, 585);

    this.hero = this.add.image(255, 480, 'adventurer').setDisplaySize(190, 190).setOrigin(0.5, 0.88);
    this.clerk = this.add.image(710, 480, 'guild-clerk').setDisplaySize(190, 190).setOrigin(0.5, 0.88);
    this.enemy = this.add.image(720, 470, 'mint-slime').setDisplaySize(205, 205).setOrigin(0.5, 0.88);
    this.lootChest = this.add.image(480, 430, 'loot-chest').setDisplaySize(150, 150).setOrigin(0.5).setVisible(false);
    this.chestBaseScaleX = this.lootChest.scaleX;
    this.chestBaseScaleY = this.lootChest.scaleY;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!this.reduceMotion) {
      this.tweens.add({ targets: this.hero, y: '+=7', duration: 800, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.clerk, y: '+=6', duration: 1050, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.enemy, y: '+=9', duration: 620, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    }

    this.unsubscribeState = runtime.subscribe((state) => this.renderState(state));
    this.unsubscribeCombat = runtime.onCombat((events) => this.animateCombat(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    runtime.update(delta);
  }

  private renderState(state: IdleRpgState): void {
    const isGuild = state.mode === 'guild';
    if (this.holdingEnemyTransition && !isGuild) {
      this.pendingState = state;
      return;
    }
    if (isGuild) {
      this.holdingEnemyTransition = false;
      this.pendingState = undefined;
    }
    this.guildBackground.setVisible(isGuild);
    const isForest = !isGuild && state.selectedArea === 'komorebi-forest';
    this.meadowBackground.setVisible(!isGuild && !isForest);
    this.forestBackground.setVisible(isForest);
    this.clerk.setVisible(isGuild);
    this.enemy.setVisible(!isGuild).setAlpha(1);

    if (this.currentMode !== state.mode) {
      this.currentMode = state.mode;
      if (isGuild) {
        this.hero.setPosition(255, 480).setFlipX(false);
        if (!this.reduceMotion) this.cameras.main.fadeIn(240, 255, 247, 226);
      } else {
        this.hero.setPosition(235, 470).setFlipX(false);
        this.enemy.setPosition(720, 470).setFlipX(false);
        if (!this.reduceMotion) this.cameras.main.flash(220, 255, 255, 255);
      }
    }

    if (!state.enemy) {
      this.currentEnemyKind = undefined;
      return;
    }
    const enemyKindChanged = this.currentEnemyKind !== state.enemy.kind;
    this.currentEnemyKind = state.enemy.kind;
    const isBoss = state.enemy.kind === 'crown-slime';

    this.enemy
      .setTexture(isBoss ? 'crown-slime' : 'mint-slime')
      .clearTint()
      .setDisplaySize(isBoss ? 255 : 205, isBoss ? 255 : 205);

    if (state.enemy.kind === 'berry-slime') {
      this.enemy.setTint(0xff8ca6);
    } else if (state.enemy.kind === 'puffball') {
      this.enemy.setTint(0xffd97a).setDisplaySize(180, 180);
    }

    if (isBoss && enemyKindChanged) this.banner('BOSS!  おおきな王冠スライム');
  }

  private animateCombat(events: CombatEvent[]): void {
    events.forEach((event) => {
      if (event.type === 'hero-hit') {
        if (!this.reduceMotion) this.tweens.add({ targets: this.hero, x: 325, duration: 125, yoyo: true, ease: 'Quad.easeOut' });
        this.damageLabel(this.enemy.x, this.enemy.y - 145, event.damage, event.critical ? '#ff6f91' : '#355b55', event.critical);
        if (!this.reduceMotion) this.tweens.add({ targets: this.enemy, angle: 6, duration: 75, yoyo: true, repeat: 1 });
      }
      if (event.type === 'enemy-hit') {
        if (!this.reduceMotion) this.tweens.add({ targets: this.enemy, x: 655, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
        this.damageLabel(this.hero.x, this.hero.y - 150, event.damage, '#e65d67', false);
        this.hero.setTint(0xffa8ac);
        this.time.delayedCall(160, () => this.hero.clearTint());
      }
      if (event.type === 'enemy-defeated' && !this.reduceMotion) {
        this.holdingEnemyTransition = true;
        this.tweens.add({
          targets: this.enemy,
          alpha: 0,
          scaleX: this.enemy.scaleX * 0.55,
          scaleY: this.enemy.scaleY * 0.55,
          duration: 210,
          ease: 'Back.easeIn',
          onComplete: () => {
            this.holdingEnemyTransition = false;
            const pending = this.pendingState;
            this.pendingState = undefined;
            if (pending) this.renderState(pending);
            this.enemy.setAlpha(1);
          }
        });
      }
      if (event.type === 'loot') this.showLootChest();
      if (event.type === 'level-up') this.banner(`LEVEL UP!  Lv.${event.level}`);
      if (event.type === 'hero-defeated' && !this.reduceMotion) this.cameras.main.shake(230, 0.012);
    });
  }

  private damageLabel(x: number, y: number, value: number, color: string, critical: boolean): void {
    const label = this.add.text(x, y, critical ? `★ ${value}` : value.toString(), {
      fontFamily: '"M PLUS Rounded 1c", sans-serif',
      fontSize: critical ? '31px' : '26px',
      fontStyle: 'bold',
      color,
      stroke: '#ffffff',
      strokeThickness: 7
    }).setOrigin(0.5).setDepth(20);
    if (this.reduceMotion) {
      this.time.delayedCall(360, () => label.destroy());
      return;
    }
    this.tweens.add({
      targets: label,
      y: y - 55,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  private showLootChest(): void {
    if (this.reduceMotion) {
      this.lootChest
        .setVisible(true)
        .setAlpha(1)
        .setScale(this.chestBaseScaleX, this.chestBaseScaleY)
        .setAngle(0);
      this.time.delayedCall(520, () => this.lootChest.setVisible(false));
      return;
    }
    this.lootChest
      .setVisible(true)
      .setAlpha(0)
      .setScale(this.chestBaseScaleX * 0.35, this.chestBaseScaleY * 0.35)
      .setAngle(-7);
    this.tweens.add({
      targets: this.lootChest,
      alpha: 1,
      scaleX: this.chestBaseScaleX,
      scaleY: this.chestBaseScaleY,
      angle: 5,
      duration: 240,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 420,
      onComplete: () => this.lootChest.setVisible(false)
    });
  }

  private banner(text: string): void {
    const banner = this.add.text(480, 105, text, {
      fontFamily: '"M PLUS Rounded 1c", sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#fffdf0',
      backgroundColor: '#ed8f86dd',
      padding: { x: 22, y: 9 },
      stroke: '#9d5c5b',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(30).setScale(0.7).setAlpha(0);
    if (this.reduceMotion) {
      banner.setScale(1).setAlpha(1);
      this.time.delayedCall(850, () => banner.destroy());
      return;
    }
    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 800,
      onComplete: () => banner.destroy()
    });
  }

  private cleanup(): void {
    this.unsubscribeState?.();
    this.unsubscribeCombat?.();
  }
}
