import Phaser from 'phaser';
import { ENEMIES } from '../game/data';
import type { EnemyKind } from '../game/types';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createProceduralTextures();
    this.scene.start('TitleScene');
  }

  private createProceduralTextures(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0xe3ecef, 1);
    graphics.fillTriangle(54, 32, 18, 18, 13, 32);
    graphics.fillTriangle(54, 32, 13, 32, 18, 46);
    graphics.fillStyle(0x172a31, 1);
    graphics.fillTriangle(44, 32, 19, 25, 23, 39);
    graphics.lineStyle(2, 0x84fff1, 1).lineBetween(46, 32, 63, 32);
    graphics.generateTexture('player', 64, 64);
    graphics.clear();

    (Object.keys(ENEMIES) as EnemyKind[]).forEach((kind) => {
      const definition = ENEMIES[kind];
      graphics.fillStyle(definition.color, 1);
      if (kind === 'hound') {
        graphics.fillTriangle(53, 32, 19, 19, 26, 32);
        graphics.fillTriangle(53, 32, 26, 32, 19, 45);
      } else {
        const points: Phaser.Math.Vector2[] = [];
        for (let index = 0; index < 12; index += 1) {
          const angle = index / 12 * Math.PI * 2;
          const radius = definition.radius * (index % 2 === 0 ? 1.14 : 0.82);
          points.push(new Phaser.Math.Vector2(32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius));
        }
        graphics.fillPoints(points, true);
      }
      graphics.fillStyle(0x100b10, 1).fillCircle(32, 32, definition.radius * 0.45);
      graphics.fillStyle(kind === 'seer' ? 0xd6acff : 0xff6c78, 1).fillRect(34, 30, Math.max(7, definition.radius * 0.5), 3);
      graphics.generateTexture(`enemy-${kind}`, 64, 64);
      graphics.clear();
    });

    graphics.fillStyle(0x60eadc, 1).fillTriangle(8, 0, 16, 10, 8, 20).fillTriangle(8, 0, 0, 10, 8, 20);
    graphics.generateTexture('xp-shard', 16, 20);
    graphics.clear();

    graphics.fillStyle(0xf0bd5f, 1).fillCircle(8, 8, 7);
    graphics.lineStyle(2, 0xffe4a0, 0.8).strokeCircle(8, 8, 5);
    graphics.generateTexture('gold', 16, 16);
    graphics.clear();

    graphics.fillStyle(0xffffff, 1).fillRect(4, 4, 16, 16);
    graphics.fillStyle(0x0b1118, 1).fillRect(9, 9, 6, 6);
    graphics.generateTexture('relic', 24, 24);
    graphics.clear();

    graphics.fillStyle(0xb98bea, 1).fillCircle(8, 8, 7);
    graphics.fillStyle(0xf3d7ff, 0.8).fillCircle(6, 6, 2);
    graphics.generateTexture('void-bolt', 16, 16);
    graphics.destroy();
  }
}
