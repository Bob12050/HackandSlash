import Phaser from 'phaser';

import { ENEMIES } from '../game/data';
import type { EnemyDefinition, EnemyKind } from '../game/types';

const ELITE_HEALTH_MULTIPLIER = 2.15;
const ELITE_DAMAGE_MULTIPLIER = 1.35;
const ELITE_SPEED_MULTIPLIER = 1.08;
const ELITE_EXPERIENCE_MULTIPLIER = 2.5;

export class Enemy extends Phaser.Physics.Arcade.Image {
  public readonly kind: EnemyKind;
  public readonly definition: EnemyDefinition;
  public readonly elite: boolean;

  public readonly radius: number;
  public health: number;
  public maxHealth: number;
  public damage: number;
  public speed: number;
  public experience: number;

  public attackCooldown = 0;
  public shootCooldown = 0;
  public lastHitAt = Number.NEGATIVE_INFINITY;
  public readonly knockback = new Phaser.Math.Vector2();

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyKind,
    elite = false,
    texture = `enemy-${kind}`
  ) {
    super(scene, x, y, texture);

    this.kind = kind;
    this.definition = ENEMIES[kind];
    this.elite = elite;
    this.radius = this.definition.radius * (elite ? 1.18 : 1);

    const eliteHealth = elite ? ELITE_HEALTH_MULTIPLIER : 1;
    const eliteDamage = elite ? ELITE_DAMAGE_MULTIPLIER : 1;
    const eliteSpeed = elite ? ELITE_SPEED_MULTIPLIER : 1;
    const eliteExperience = elite ? ELITE_EXPERIENCE_MULTIPLIER : 1;

    this.maxHealth = Math.round(this.definition.health * eliteHealth);
    this.health = this.maxHealth;
    this.damage = this.definition.damage * eliteDamage;
    this.speed = this.definition.speed * eliteSpeed;
    this.experience = Math.round(this.definition.experience * eliteExperience);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(elite ? 8 : 7);

    const diameter = this.radius * 2;
    this.setDisplaySize(diameter, diameter);
    this.setCircle(this.radius);
    this.setCollideWorldBounds(true);
    this.setTint(elite ? 0xf0b44d : this.definition.color)
      .setTintMode(Phaser.TintModes.FILL);
  }

  public get defeated(): boolean {
    return this.health <= 0;
  }

  /** Applies damage and reports whether this hit defeated the enemy. */
  public takeDamage(amount: number, time = 0): boolean {
    if (!this.active || amount <= 0 || this.defeated) return false;

    this.lastHitAt = time;
    this.health = Math.max(0, this.health - amount);
    return this.defeated;
  }

  public applyKnockback(
    velocityX: number,
    velocityY: number
  ): void {
    this.knockback.set(velocityX, velocityY);
    this.setVelocity(velocityX, velocityY);
  }

  /** Advances enemy-local attack timers using delta time in seconds. */
  public tick(delta: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
  }
}
