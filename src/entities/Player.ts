import Phaser from 'phaser';

import type { PlayerStats } from '../game/types';

export const DEFAULT_PLAYER_STATS: Readonly<PlayerStats> = Object.freeze({
  maxHealth: 120,
  health: 120,
  damage: 24,
  moveSpeed: 220,
  attackRate: 1,
  attackRange: 96,
  criticalChance: 0.08,
  armor: 0,
  lifeOnKill: 0
});

export function createDefaultPlayerStats(): PlayerStats {
  return { ...DEFAULT_PLAYER_STATS };
}

/**
 * The physics-backed player avatar and its run-scoped state.
 *
 * Timers are expressed in seconds and advanced from a Phaser Scene's `update`.
 */
export class Player extends Phaser.Physics.Arcade.Image {
  public stats: PlayerStats = createDefaultPlayerStats();

  /** Remaining cooldowns and durations, in seconds. */
  public attackCooldown = 0;
  public dashCooldown = 0;
  public dashCooldownMax = 1.2;
  public dashDuration = 0.16;
  public dashRemaining = 0;
  public invulnerable = 0;
  public readonly dashDirection = new Phaser.Math.Vector2();
  public attackIndex = 0;

  public level = 1;
  public experience = 0;
  public nextExperience = 40;
  public kills = 0;
  public gold = 0;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture = 'player'
  ) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setDisplaySize(42, 42);
    this.setCircle(18);
    this.setCollideWorldBounds(true);
    this.setTint(0xe7edf1).setTintMode(Phaser.TintModes.FILL);
  }

  /** Compatibility alias for systems that call experience `xp`. */
  public get xp(): number {
    return this.experience;
  }

  public set xp(value: number) {
    this.experience = value;
  }

  /** Compatibility alias for systems that call the threshold `nextXp`. */
  public get nextXp(): number {
    return this.nextExperience;
  }

  public set nextXp(value: number) {
    this.nextExperience = value;
  }

  /** Advances all run timers using Phaser's delta time in seconds. */
  public tick(delta: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.dashRemaining = Math.max(0, this.dashRemaining - delta);
    this.invulnerable = Math.max(0, this.invulnerable - delta);
  }

  public takeDamage(amount: number): number {
    if (!this.active || this.invulnerable > 0 || amount <= 0) return 0;

    const reduction = Phaser.Math.Clamp(this.stats.armor, 0, 0.8);
    const damageTaken = Math.max(1, Math.round(amount * (1 - reduction)));
    this.stats.health = Math.max(0, this.stats.health - damageTaken);
    return damageTaken;
  }

  public heal(amount: number): number {
    if (amount <= 0) return 0;

    const previousHealth = this.stats.health;
    this.stats.health = Math.min(this.stats.maxHealth, previousHealth + amount);
    return this.stats.health - previousHealth;
  }

  /** Resets all run state while preserving the Game Object instance. */
  public reset(x = this.x, y = this.y): this {
    this.stats = createDefaultPlayerStats();
    this.attackCooldown = 0;
    this.dashCooldown = 0;
    this.dashCooldownMax = 1.2;
    this.dashDuration = 0.16;
    this.dashRemaining = 0;
    this.invulnerable = 0;
    this.dashDirection.set(0, 0);
    this.attackIndex = 0;
    this.level = 1;
    this.experience = 0;
    this.nextExperience = 40;
    this.kills = 0;
    this.gold = 0;

    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    }
    return this;
  }
}
