import Phaser from 'phaser';

const COLORS = {
  ink: 0x05060a,
  wine: 0x190a12,
  crimson: 0xb8324b,
  crimsonBright: 0xe05263,
  gold: 0xd4ad68,
  ivory: '#eee7da',
  muted: '#8e8790'
} as const;

interface Ember {
  glow: Phaser.GameObjects.Arc;
  xRatio: number;
  yRatio: number;
}

export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private sigil!: Phaser.GameObjects.Graphics;
  private eyebrow!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private premise!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;
  private startButtonBackground!: Phaser.GameObjects.Rectangle;
  private startButtonAccent!: Phaser.GameObjects.Rectangle;
  private controlsPanel!: Phaser.GameObjects.Rectangle;
  private controlsHeading!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text[];
  private footer!: Phaser.GameObjects.Text;
  private embers: Ember[] = [];
  private starting = false;

  private readonly handleResize = (): void => {
    this.layout();
  };

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.starting = false;
    this.background = this.add.graphics().setDepth(-20);
    this.sigil = this.add.graphics().setDepth(-10);

    this.createEmbers();

    this.eyebrow = this.add.text(0, 0, '—  A DESCENT INTO THE SUNDERED REALM  —', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '12px',
      color: '#b99865',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.title = this.add.text(0, 0, 'RIFTBORNE', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '76px',
      fontStyle: 'bold',
      color: COLORS.ivory,
      stroke: '#2a0b14',
      strokeThickness: 8,
      shadow: { color: '#d52f49', blur: 24, fill: true, offsetX: 0, offsetY: 0 }
    }).setOrigin(0.5);

    this.subtitle = this.add.text(0, 0, '深淵を裂く者', {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: '22px',
      color: '#d5bd91',
      letterSpacing: 9
    }).setOrigin(0.5);

    this.premise = this.add.text(0, 0, '血に飢えた刃を手に、次々と押し寄せる魔物を討ち滅ぼせ。\n深く潜るほど、戦利品は強く、深淵もまた猛る。', {
      fontFamily: '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
      fontSize: '14px',
      color: '#aaa2a5',
      align: 'center',
      lineSpacing: 7
    }).setOrigin(0.5);

    const buttonBackground = this.add.rectangle(0, 0, 280, 58, 0x771d30, 0.96)
      .setStrokeStyle(1, COLORS.gold, 0.75)
      .setInteractive({ useHandCursor: true });
    this.startButtonBackground = buttonBackground;
    this.startButtonAccent = this.add.rectangle(-136, 0, 3, 42, COLORS.crimsonBright, 1);
    const buttonLabel = this.add.text(0, -2, '深淵へ挑む', {
      fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#fff5e4',
      letterSpacing: 4
    }).setOrigin(0.5);
    const buttonHint = this.add.text(0, 19, 'BEGIN THE HUNT', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#d9b777',
      letterSpacing: 2
    }).setOrigin(0.5);
    this.startButton = this.add.container(0, 0, [buttonBackground, this.startButtonAccent, buttonLabel, buttonHint]);

    buttonBackground.on('pointerover', () => {
      if (this.starting) return;
      buttonBackground.setFillStyle(0xa2283e, 1).setStrokeStyle(2, 0xf0c878, 1);
      this.startButton.setScale(1.025);
    });
    buttonBackground.on('pointerout', () => {
      if (this.starting) return;
      buttonBackground.setFillStyle(0x771d30, 0.96).setStrokeStyle(1, COLORS.gold, 0.75);
      this.startButton.setScale(1);
    });
    buttonBackground.on('pointerdown', () => this.beginRun());

    this.controlsPanel = this.add.rectangle(0, 0, 660, 92, 0x0b0c12, 0.82)
      .setStrokeStyle(1, 0x4a3b3e, 0.8);
    this.controlsHeading = this.add.text(0, 0, 'CONTROLS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#b99865',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.controls = [
      this.add.text(0, 0, 'WASD\n移動', this.controlTextStyle()).setOrigin(0.5),
      this.add.text(0, 0, '左クリック ・ SPACE\n斬撃', this.controlTextStyle()).setOrigin(0.5),
      this.add.text(0, 0, 'SHIFT\nダッシュ', this.controlTextStyle()).setOrigin(0.5)
    ];

    this.footer = this.add.text(0, 0, '—  DEATH IS ONLY ANOTHER DOOR  —', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '10px',
      color: '#625b61',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', this.beginRun, this);
    this.input.keyboard?.once('keydown-SPACE', this.beginRun, this);
    this.scale.on('resize', this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);

    this.layout();
    this.cameras.main.fadeIn(650, 5, 6, 10);
  }

  private controlTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
      fontSize: '12px',
      color: '#d4ced0',
      align: 'center',
      lineSpacing: 4
    };
  }

  private createEmbers(): void {
    const positions = [
      [0.09, 0.19], [0.18, 0.72], [0.31, 0.12], [0.73, 0.16],
      [0.86, 0.68], [0.93, 0.31], [0.63, 0.83], [0.42, 0.76]
    ];

    this.embers = positions.map(([xRatio, yRatio], index) => {
      const glow = this.add.circle(0, 0, index % 3 === 0 ? 2 : 1.3, 0xdb3f51, 0.55).setDepth(-8);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.18, to: 0.8 },
        scale: { from: 0.7, to: 1.5 },
        duration: 1200 + index * 170,
        delay: index * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      return { glow, xRatio: xRatio ?? 0, yRatio: yRatio ?? 0 };
    });
  }

  private layout(): void {
    if (!this.background?.active) return;

    const width = this.scale.width;
    const height = this.scale.height;
    const compact = height < 720 || width < 760;
    const centerX = width / 2;
    const heroY = compact ? Math.max(118, height * 0.2) : height * 0.235;

    this.drawBackground(width, height, centerX, heroY);
    this.embers.forEach(({ glow, xRatio, yRatio }) => glow.setPosition(width * xRatio, height * yRatio));

    this.eyebrow.setPosition(centerX, heroY - (compact ? 66 : 88));
    this.title
      .setPosition(centerX, heroY)
      .setFontSize(Math.round(Phaser.Math.Clamp(width * 0.075, compact ? 42 : 54, 82)));
    this.subtitle
      .setPosition(centerX, heroY + (compact ? 48 : 65))
      .setFontSize(compact ? 17 : 22);
    this.premise
      .setPosition(centerX, heroY + (compact ? 108 : 137))
      .setFontSize(compact ? 12 : 14)
      .setWordWrapWidth(Math.min(640, width - 44));

    const buttonY = heroY + (compact ? 188 : 232);
    const buttonWidth = Math.min(300, width - 48);
    this.startButton.setPosition(centerX, buttonY);
    this.startButtonBackground.setDisplaySize(buttonWidth, compact ? 54 : 58);
    this.startButtonAccent.setX(-buttonWidth / 2 + 5);

    const controlsWidth = Math.min(660, width - 32);
    const controlsHeight = compact ? 80 : 92;
    const controlsY = Math.min(height - (compact ? 75 : 95), buttonY + (compact ? 95 : 120));
    this.controlsPanel.setPosition(centerX, controlsY).setDisplaySize(controlsWidth, controlsHeight);
    this.controlsHeading.setPosition(centerX, controlsY - controlsHeight / 2 + 14);
    this.controls.forEach((control, index) => {
      const spacing = controlsWidth / 3;
      control
        .setPosition(centerX - controlsWidth / 2 + spacing * (index + 0.5), controlsY + 12)
        .setFontSize(width < 560 ? 10 : 12);
    });

    this.footer.setPosition(centerX, height - 18).setVisible(height >= 550);
  }

  private drawBackground(width: number, height: number, centerX: number, heroY: number): void {
    this.background.clear();
    this.background.fillGradientStyle(COLORS.ink, 0x0a080d, COLORS.wine, COLORS.ink, 1, 1, 1, 1);
    this.background.fillRect(0, 0, width, height);

    this.background.fillStyle(0x5e1124, 0.12);
    this.background.fillTriangle(0, 0, width * 0.36, 0, 0, height * 0.74);
    this.background.fillTriangle(width, height, width * 0.66, height, width, height * 0.28);

    for (let index = 0; index < 12; index += 1) {
      const alpha = 0.04 + index * 0.002;
      this.background.lineStyle(1, index % 2 === 0 ? 0x9f263c : 0x706067, alpha);
      this.background.lineBetween(0, height * (0.16 + index * 0.072), width, height * (0.04 + index * 0.078));
    }

    this.sigil.clear();
    this.sigil.lineStyle(1, 0x8f2940, 0.22);
    this.sigil.strokeCircle(centerX, heroY + 4, Math.min(width * 0.23, 210));
    this.sigil.lineStyle(1, 0xc49a5d, 0.12);
    this.sigil.strokeCircle(centerX, heroY + 4, Math.min(width * 0.18, 164));
    this.sigil.lineStyle(1, 0x9f2940, 0.18);
    const radius = Math.min(width * 0.2, 184);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
      this.sigil.lineBetween(
        centerX + Math.cos(angle) * (radius - 10),
        heroY + 4 + Math.sin(angle) * (radius - 10),
        centerX + Math.cos(angle) * radius,
        heroY + 4 + Math.sin(angle) * radius
      );
    }
  }

  private beginRun(): void {
    if (this.starting) return;
    this.starting = true;
    this.startButtonBackground.disableInteractive().setFillStyle(0x4d1824, 1);
    this.startButton.setScale(1);

    this.cameras.main.fadeOut(260, 5, 6, 10);
    this.time.delayedCall(250, () => {
      this.scene.start('GameScene');
      this.scene.launch('HudScene');
    });
  }

  private shutdownScene(): void {
    this.scale.off('resize', this.handleResize);
  }
}
