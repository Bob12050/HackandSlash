import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { ENEMIES, RARITY_DATA, UPGRADE_CHOICES } from '../game/data';
import { Events, gameEvents } from '../game/events';
import { applyLootItem, applyUpgrade, createLootItem } from '../game/loot';
import type { EnemyKind, HudState, LootItem, RunSummary } from '../game/types';

type RunState = 'playing' | 'levelup' | 'gameover';
type DropKind = 'experience' | 'gold' | 'loot';

interface Controls {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
}

interface WorldDrop {
  kind: DropKind;
  visual: Phaser.GameObjects.Image;
  value: number;
  lifetime: number;
  velocityY: number;
  item?: LootItem;
}

interface HostileProjectile {
  visual: Phaser.GameObjects.Image;
  velocity: Phaser.Math.Vector2;
  damage: number;
  lifetime: number;
}

export class GameScene extends Phaser.Scene {
  private state: RunState = 'playing';
  private player!: Player;
  private controls!: Controls;
  private arena!: Phaser.GameObjects.Graphics;
  private healthBars!: Phaser.GameObjects.Graphics;
  private enemies: Enemy[] = [];
  private drops: WorldDrop[] = [];
  private projectiles: HostileProjectile[] = [];
  private attackIndex = 0;
  private elapsed = 0;
  private wave = 1;
  private waveRemaining = 25;
  private spawnTimer = 1;
  private hudTimer = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.state = 'playing';
    this.elapsed = 0;
    this.wave = 1;
    this.waveRemaining = 25;
    this.spawnTimer = 1;
    this.attackIndex = 0;
    this.enemies = [];
    this.drops = [];
    this.projectiles = [];

    this.arena = this.add.graphics().setDepth(-20);
    this.healthBars = this.add.graphics().setDepth(18);
    this.drawArena(this.scale.width, this.scale.height);
    this.physics.world.setBounds(0, 76, this.scale.width, Math.max(120, this.scale.height - 76));
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2, 'player');

    this.controls = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE
    }) as Controls;

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard!.on('keydown-SHIFT', this.tryDash, this);
    this.input.keyboard!.on('keydown-SPACE', this.attackTowardPointer, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    gameEvents.on(Events.UPGRADE_SELECTED, this.handleUpgrade, this);
    gameEvents.on(Events.RETRY_RUN, this.restartRun, this);
    gameEvents.on(Events.RETURN_TO_TITLE, this.returnToTitle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    this.emitHud();
  }

  update(_time: number, deltaMs: number): void {
    if (this.state !== 'playing') return;
    const delta = Math.min(deltaMs / 1000, 0.05);
    this.elapsed += delta;
    this.waveRemaining -= delta;
    this.spawnTimer -= delta;
    this.hudTimer -= delta;
    this.player.tick(delta);

    if (this.waveRemaining <= 0) this.beginNextWave();
    if (this.spawnTimer <= 0 && this.enemies.length < 64) this.spawnWavelet();

    this.updatePlayerMovement();
    this.updateEnemies(delta);
    this.updateProjectiles(delta);
    this.updateDrops(delta);
    this.drawHealthBars();

    const pointer = this.input.activePointer;
    if (pointer.isDown && pointer.leftButtonDown() && this.player.attackCooldown <= 0) this.attack(pointer.worldX, pointer.worldY);
    if (this.hudTimer <= 0) {
      this.emitHud();
      this.hudTimer = 0.05;
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) this.attack(pointer.worldX, pointer.worldY);
  }

  private updatePlayerMovement(): void {
    const pointer = this.input.activePointer;
    this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (this.player.dashRemaining > 0) {
      body.setVelocity(this.player.dashDirection.x * 680, this.player.dashDirection.y * 680);
      if (Math.random() < 0.45) this.spark(this.player.x, this.player.y, 0x5de8dc, 1, 38);
      return;
    }

    const x = Number(this.controls.right.isDown) - Number(this.controls.left.isDown);
    const y = Number(this.controls.down.isDown) - Number(this.controls.up.isDown);
    const movement = new Phaser.Math.Vector2(x, y).normalize().scale(this.player.stats.moveSpeed);
    body.setVelocity(movement.x, movement.y);
  }

  private tryDash(): void {
    if (this.state !== 'playing' || this.player.dashCooldown > 0 || this.player.dashRemaining > 0) return;
    const x = Number(this.controls.right.isDown) - Number(this.controls.left.isDown);
    const y = Number(this.controls.down.isDown) - Number(this.controls.up.isDown);
    const direction = new Phaser.Math.Vector2(x, y);
    if (direction.lengthSq() === 0) direction.setToPolar(this.player.rotation, 1);
    direction.normalize();
    this.player.dashDirection.copy(direction);
    this.player.dashRemaining = this.player.dashDuration;
    this.player.dashCooldown = this.player.dashCooldownMax;
    this.player.invulnerable = 0.3;
    this.cameras.main.shake(70, 0.0025);
    this.emitHud();
  }

  private attackTowardPointer(): void {
    const pointer = this.input.activePointer;
    this.attack(pointer.worldX, pointer.worldY);
  }

  private attack(targetX: number, targetY: number): void {
    if (this.state !== 'playing' || this.player.attackCooldown > 0) return;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    this.player.rotation = angle;
    this.player.attackCooldown = 0.48 / this.player.stats.attackRate;
    this.attackIndex += 1;
    this.drawSlash(angle, this.attackIndex % 2 === 0);

    let hitCount = 0;
    [...this.enemies].forEach((enemy) => {
      if (!enemy.active) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const enemyAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const angleDelta = Math.abs(Phaser.Math.Angle.Wrap(enemyAngle - angle));
      if (distance > this.player.stats.attackRange + this.enemyRadius(enemy) || angleDelta > 0.92) return;

      const critical = Math.random() < this.player.stats.criticalChance;
      const damage = this.player.stats.damage * Phaser.Math.FloatBetween(0.88, 1.12) * (critical ? 2 : 1);
      this.damageEnemy(enemy, damage, critical);
      if (enemy.active) {
        const force = enemy.kind === 'brute' ? 85 : 160;
        const knockback = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize().scale(force);
        enemy.applyKnockback(knockback.x, knockback.y);
      }
      hitCount += 1;
    });

    if (hitCount > 0) this.cameras.main.shake(80, Math.min(0.01, 0.003 + hitCount * 0.0012));
  }

  private drawSlash(angle: number, reverse: boolean): void {
    const slash = this.add.graphics().setPosition(this.player.x, this.player.y).setDepth(30).setRotation(angle);
    slash.lineStyle(7, 0xb8fff8, 0.9);
    const start = reverse ? 1.02 : -1.02;
    slash.beginPath().arc(0, 0, this.player.stats.attackRange, start, -start, reverse).strokePath();
    this.tweens.add({ targets: slash, alpha: 0, scale: 1.12, duration: 170, ease: 'Quad.easeOut', onComplete: () => slash.destroy() });
  }

  private spawnWavelet(): void {
    this.spawnEnemy(this.chooseEnemyKind());
    if (this.wave > 5 && Math.random() < 0.18) this.spawnEnemy('hound');
    const interval = Math.max(0.3, 1.35 - this.wave * 0.055);
    this.spawnTimer = interval * Phaser.Math.FloatBetween(0.72, 1.34);
  }

  private spawnEnemy(kind: EnemyKind): void {
    const position = this.randomEdgePosition();
    const elite = Math.random() < Math.min(0.03 + this.wave * 0.008, 0.14);
    const enemy = new Enemy(this, position.x, position.y, kind, elite, `enemy-${kind}`);
    const waveScale = 1 + (this.wave - 1) * 0.13 + this.elapsed / 720;
    enemy.health *= waveScale;
    enemy.maxHealth *= waveScale;
    enemy.damage *= 1 + this.wave * 0.075;
    enemy.speed *= 1 + this.wave * 0.01;
    enemy.attackCooldown = Math.random();
    enemy.shootCooldown = Phaser.Math.FloatBetween(0.9, 1.8);
    this.enemies.push(enemy);
  }

  private chooseEnemyKind(): EnemyKind {
    const roll = Math.random();
    if (this.wave >= 4 && roll < 0.13) return 'seer';
    if (this.wave >= 3 && roll < 0.28) return 'brute';
    if (this.wave >= 2 && roll < 0.5) return 'hound';
    return 'thrall';
  }

  private randomEdgePosition(): Phaser.Math.Vector2 {
    const side = Phaser.Math.Between(0, 3);
    if (side === 0) return new Phaser.Math.Vector2(Phaser.Math.Between(0, this.scale.width), 62);
    if (side === 1) return new Phaser.Math.Vector2(this.scale.width + 40, Phaser.Math.Between(90, this.scale.height));
    if (side === 2) return new Phaser.Math.Vector2(Phaser.Math.Between(0, this.scale.width), this.scale.height + 40);
    return new Phaser.Math.Vector2(-40, Phaser.Math.Between(90, this.scale.height));
  }

  private updateEnemies(delta: number): void {
    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      enemy.tick(delta);
      const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      const distance = Math.max(1, toPlayer.length());
      const direction = toPlayer.normalize();
      let desire = 1;

      if (enemy.kind === 'seer') {
        desire = distance > 270 ? 1 : distance < 185 ? -1 : 0;
        if (enemy.shootCooldown <= 0 && distance < 540) {
          this.spawnProjectile(enemy, direction);
          enemy.shootCooldown = Math.max(1.45, 2.15 - this.wave * 0.035);
        }
      } else if (distance <= this.enemyRadius(enemy) + 19) {
        desire = 0;
      }

      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const velocity = direction.clone().scale(enemy.speed * desire).add(enemy.knockback);
      body.setVelocity(velocity.x, velocity.y);
      enemy.knockback.scale(Math.pow(0.025, delta));
      if (enemy.kind === 'hound') enemy.rotation = direction.angle();

      if (enemy.kind !== 'seer' && distance < this.enemyRadius(enemy) + 27 && enemy.attackCooldown <= 0) {
        this.hurtPlayer(enemy.damage, direction);
        enemy.attackCooldown = enemy.kind === 'hound' ? 0.8 : 1.15;
      }
    });
  }

  private spawnProjectile(enemy: Enemy, direction: Phaser.Math.Vector2): void {
    const visual = this.add.image(enemy.x, enemy.y, 'void-bolt').setDepth(15);
    this.projectiles.push({ visual, velocity: direction.clone().scale(245), damage: enemy.damage, lifetime: 4 });
    this.spark(enemy.x, enemy.y, 0xaa7add, 7, 90);
  }

  private updateProjectiles(delta: number): void {
    this.projectiles.forEach((projectile) => {
      projectile.lifetime -= delta;
      projectile.visual.x += projectile.velocity.x * delta;
      projectile.visual.y += projectile.velocity.y * delta;
      if (Phaser.Math.Distance.Between(projectile.visual.x, projectile.visual.y, this.player.x, this.player.y) < 24) {
        this.hurtPlayer(projectile.damage, projectile.velocity.clone().normalize());
        projectile.lifetime = 0;
      }
    });
    this.projectiles.filter((projectile) => projectile.lifetime <= 0).forEach((projectile) => projectile.visual.destroy());
    this.projectiles = this.projectiles.filter((projectile) => projectile.lifetime > 0);
  }

  private damageEnemy(enemy: Enemy, amount: number, critical: boolean): void {
    if (!enemy.active) return;
    enemy.health -= amount;
    enemy.setTint(0xf3dde2).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => {
      if (!enemy.active) return;
      enemy
        .setTint(enemy.elite ? 0xf0b44d : enemy.definition.color)
        .setTintMode(Phaser.TintModes.FILL);
    });
    this.floatingText(enemy.x, enemy.y - this.enemyRadius(enemy), Math.round(amount).toString(), critical ? '#f4c66d' : '#e7eff2', critical ? 20 : 14);
    this.spark(enemy.x, enemy.y, ENEMIES[enemy.kind].color, critical ? 11 : 6, critical ? 175 : 115);
    if (enemy.health <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    if (!enemy.active) return;
    enemy.setActive(false);
    this.player.kills += 1;
    if (this.player.stats.lifeOnKill > 0) {
      this.player.stats.health = Math.min(this.player.stats.maxHealth, this.player.stats.health + this.player.stats.maxHealth * this.player.stats.lifeOnKill);
    }

    const xpPieces = enemy.elite ? 3 : 1;
    for (let index = 0; index < xpPieces; index += 1) {
      this.createDrop('experience', enemy.x + Phaser.Math.Between(-10, 10), enemy.y + Phaser.Math.Between(-10, 10), Math.ceil(enemy.experience / xpPieces));
    }
    if (Math.random() < (enemy.elite ? 0.88 : 0.12 + this.wave * 0.006)) this.createLootDrop(enemy.x, enemy.y, enemy.elite);
    if (Math.random() < 0.38) this.createDrop('gold', enemy.x, enemy.y, 2 + Phaser.Math.Between(0, 3 + this.wave));

    this.spark(enemy.x, enemy.y, ENEMIES[enemy.kind].color, enemy.elite ? 26 : 14, 195);
    enemy.destroy();
    this.enemies = this.enemies.filter((candidate) => candidate !== enemy);
  }

  private createDrop(kind: Exclude<DropKind, 'loot'>, x: number, y: number, value: number): void {
    const texture = kind === 'experience' ? 'xp-shard' : 'gold';
    const visual = this.add.image(x, y, texture).setDepth(8);
    this.drops.push({ kind, visual, value, lifetime: kind === 'experience' ? 30 : 20, velocityY: -30 });
  }

  private createLootDrop(x: number, y: number, elite: boolean): void {
    const item = createLootItem({ wave: this.wave + (elite ? 3 : 0), elite });
    const color = RARITY_DATA[item.rarity].color;
    const visual = this.add.image(x, y, 'relic').setTint(color).setDepth(9).setRotation(Math.PI / 4);
    this.drops.push({ kind: 'loot', visual, value: 0, lifetime: 30, velocityY: -45, item });
  }

  private updateDrops(delta: number): void {
    this.drops.forEach((drop) => {
      drop.lifetime -= delta;
      drop.velocityY += 100 * delta;
      drop.visual.y += drop.velocityY * delta;
      const distance = Phaser.Math.Distance.Between(drop.visual.x, drop.visual.y, this.player.x, this.player.y);
      const magnetRange = drop.kind === 'experience' ? 132 : 78;
      if (distance < magnetRange && distance > 0) {
        const speed = 250 + (magnetRange - distance) * 5;
        const direction = new Phaser.Math.Vector2(this.player.x - drop.visual.x, this.player.y - drop.visual.y).normalize();
        drop.visual.x += direction.x * speed * delta;
        drop.visual.y += direction.y * speed * delta;
      }
      if (distance >= 31) return;
      if (drop.kind === 'experience') this.gainExperience(drop.value);
      if (drop.kind === 'gold') this.player.gold += drop.value;
      if (drop.kind === 'loot' && drop.item) {
        this.player.stats = applyLootItem(this.player.stats, drop.item);
        gameEvents.emit(Events.LOOT_COLLECTED, drop.item);
      }
      drop.lifetime = 0;
    });
    this.drops.filter((drop) => drop.lifetime <= 0).forEach((drop) => drop.visual.destroy());
    this.drops = this.drops.filter((drop) => drop.lifetime > 0);
  }

  private gainExperience(value: number): void {
    this.player.xp += value;
    if (this.player.xp < this.player.nextXp) return;
    this.player.xp -= this.player.nextXp;
    this.player.level += 1;
    this.player.nextXp = Math.round(this.player.nextXp * 1.38 + 10);
    this.player.stats.health = Math.min(this.player.stats.maxHealth, this.player.stats.health + 15);
    this.state = 'levelup';
    this.physics.pause();
    const choices = Phaser.Utils.Array.Shuffle([...UPGRADE_CHOICES]).slice(0, 3);
    gameEvents.emit(Events.SHOW_UPGRADES, choices);
    this.emitHud();
  }

  private handleUpgrade(upgradeId: string): void {
    if (this.state !== 'levelup') return;
    this.player.stats = applyUpgrade(this.player.stats, upgradeId);
    if (upgradeId === 'mobility') this.player.dashCooldownMax *= 0.9;
    this.state = 'playing';
    this.physics.resume();
    this.spark(this.player.x, this.player.y, 0x5de8dc, 30, 225);
    this.emitHud();
  }

  private hurtPlayer(amount: number, direction: Phaser.Math.Vector2): void {
    if (this.state !== 'playing') return;
    const damageTaken = this.player.takeDamage(amount);
    if (damageTaken <= 0) return;
    this.player.invulnerable = 0.55;
    this.player.x += direction.x * 10;
    this.player.y += direction.y * 10;
    this.player.setTint(0xff6375).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(150, () => { if (this.player.active) this.player.clearTint(); });
    this.cameras.main.shake(130, 0.012);
    this.spark(this.player.x, this.player.y, 0xed3b52, 14, 170);
    if (this.player.stats.health <= 0) this.gameOver();
  }

  private beginNextWave(): void {
    this.wave += 1;
    this.waveRemaining = 25;
    const count = Math.min(2 + Math.floor(this.wave / 3), 5);
    for (let index = 0; index < count; index += 1) this.spawnEnemy(this.wave % 3 === 0 ? 'brute' : this.chooseEnemyKind());
  }

  private gameOver(): void {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.physics.pause();
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.player.setAlpha(0.25);
    const summary: RunSummary = {
      elapsed: this.elapsed,
      kills: this.player.kills,
      level: this.player.level,
      wave: this.wave,
      gold: this.player.gold
    };
    gameEvents.emit(Events.RUN_ENDED, summary);
  }

  private restartRun(): void {
    this.scene.restart();
  }

  private returnToTitle(): void {
    this.scene.stop('HudScene');
    this.scene.start('TitleScene');
  }

  private emitHud(): void {
    const hud: HudState = {
      health: Math.max(0, this.player.stats.health),
      maxHealth: this.player.stats.maxHealth,
      experience: this.player.xp,
      nextExperience: this.player.nextXp,
      level: this.player.level,
      kills: this.player.kills,
      gold: this.player.gold,
      wave: this.wave,
      waveRemaining: this.waveRemaining,
      elapsed: this.elapsed,
      dashRatio: Phaser.Math.Clamp(this.player.dashCooldown / this.player.dashCooldownMax, 0, 1)
    };
    gameEvents.emit(Events.HUD_UPDATE, hud);
  }

  private drawArena(width: number, height: number): void {
    this.arena.clear();
    this.arena.fillStyle(0x0d131a, 1).fillRect(0, 0, width, height);
    this.arena.fillStyle(0x17232c, 0.76).fillCircle(width / 2, height / 2, Math.min(width, height) * 0.39);
    this.arena.lineStyle(1, 0x91a8b5, 0.07);
    for (let x = (width / 2) % 82; x < width; x += 82) this.arena.lineBetween(x, 74, x, height);
    for (let y = 74 + (height / 2) % 82; y < height; y += 82) this.arena.lineBetween(0, y, width, y);
    this.arena.lineStyle(1, 0xdb3854, 0.12);
    this.arena.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.31);
    this.arena.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.18);
  }

  private drawHealthBars(): void {
    this.healthBars.clear();
    this.enemies.forEach((enemy) => {
      if (!enemy.active && !enemy.elite) return;
      if (enemy.health >= enemy.maxHealth && !enemy.elite) return;
      const radius = this.enemyRadius(enemy);
      const width = radius * 2.25;
      const x = enemy.x - width / 2;
      const y = enemy.y - radius - 12;
      this.healthBars.fillStyle(0x05070a, 0.8).fillRect(x, y, width, 4);
      this.healthBars.fillStyle(enemy.elite ? 0xbd73f5 : 0xe04458, 1).fillRect(x, y, width * Math.max(0, enemy.health / enemy.maxHealth), 4);
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.drawArena(gameSize.width, gameSize.height);
    this.physics.world.setBounds(0, 76, gameSize.width, Math.max(120, gameSize.height - 76));
    this.player.x = Phaser.Math.Clamp(this.player.x, 24, gameSize.width - 24);
    this.player.y = Phaser.Math.Clamp(this.player.y, 98, gameSize.height - 24);
  }

  private enemyRadius(enemy: Enemy): number {
    return enemy.definition.radius * (enemy.elite ? 1.18 : 1);
  }

  private spark(x: number, y: number, color: number, count: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const particle = this.add.rectangle(x, y, Phaser.Math.Between(2, 4), Phaser.Math.Between(2, 4), color).setDepth(35);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.FloatBetween(speed * 0.2, speed);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance * 0.45,
        y: y + Math.sin(angle) * distance * 0.45,
        alpha: 0,
        duration: Phaser.Math.Between(260, 650),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  private floatingText(x: number, y: number, text: string, color: string, size: number): void {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Barlow Condensed, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: label, y: y - 30, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
  }

  private cleanup(): void {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.off('keydown-SHIFT', this.tryDash, this);
    this.input.keyboard?.off('keydown-SPACE', this.attackTowardPointer, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    gameEvents.off(Events.UPGRADE_SELECTED, this.handleUpgrade, this);
    gameEvents.off(Events.RETRY_RUN, this.restartRun, this);
    gameEvents.off(Events.RETURN_TO_TITLE, this.returnToTitle, this);
  }
}
