import { THEMES } from './data.js';

const WIDTH = 720;
const HEIGHT = 500;

export class BattleRenderer {
  constructor(canvas, encounter, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.encounter = encounter;
    this.theme = THEMES[encounter.info.theme] || THEMES.crypt;
    this.options = options;
    this.effects = [];
    this.startedAt = performance.now();
    this.lastFrame = this.startedAt;
    this.raf = 0;
    this.selectedId = encounter.selectedEnemyId;
    this.positionCache = new Map();
    this.destroyed = false;
    this.ash = Array.from({ length: 16 }, (_, index) => ({
      x: (index * 83 + 37) % WIDTH,
      y: (index * 137 + 61) % HEIGHT,
      size: 1 + (index % 3),
      speed: 4 + (index % 5),
    }));
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.render = this.render.bind(this);
    this.raf = requestAnimationFrame(this.render);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  setSelected(id) {
    this.selectedId = id;
  }

  positions() {
    const alive = this.encounter.enemies.filter((enemy) => !enemy.dead);
    const layout = {
      1: [[360, 334]],
      2: [[245, 338], [475, 338]],
      3: [[155, 348], [360, 326], [565, 348]],
    }[Math.min(3, alive.length)] || [];
    alive.forEach((enemy, index) => this.positionCache.set(enemy.uid, layout[index]));
    return this.positionCache;
  }

  addEffect(effect) {
    this.effects.push({ born: performance.now(), ...effect });
  }

  async showPlayerAttack(results, skill) {
    const targetIds = results.map((result) => result.enemy.uid);
    this.addEffect({ type: 'sealThread', targetIds, duration: 420, color: skill?.id === 'emberSweep' ? '#ef8556' : '#d85a54' });
    await delay(120);
    targetIds.forEach((id, index) => this.addEffect({
      type: skill?.id === 'bellBreaker' ? 'impact' : 'slash',
      targetId: id,
      duration: 300,
      offset: index * 50,
      color: skill?.id === 'emberSweep' ? '#f0a45d' : '#f1ddd0',
    }));
    await delay(110);
    results.forEach((result) => {
      this.addEffect({ type: 'damage', targetId: result.enemy.uid, value: result.damage, critical: result.critical, duration: 720 });
      this.addEffect({ type: 'hitFlash', targetId: result.enemy.uid, duration: 170 });
      if (result.broke) this.addEffect({ type: 'break', targetId: result.enemy.uid, duration: 620 });
      if (result.enemy.dead) this.addEffect({ type: 'death', targetId: result.enemy.uid, duration: 700 });
    });
    if (this.options.shake) this.addEffect({ type: 'shake', duration: 140, strength: results.some((r) => r.critical) ? 7 : 3 });
    await delay(440);
  }

  async showEnemyAttack(enemy, result) {
    this.addEffect({ type: 'enemyLunge', targetId: enemy.uid, duration: 360 });
    await delay(170);
    this.addEffect({ type: result.guarded ? 'guard' : 'playerHit', duration: 360 });
    this.addEffect({ type: 'playerDamage', value: result.damage, guarded: result.guarded, duration: 720 });
    if (this.options.shake) this.addEffect({ type: 'shake', duration: 140, strength: result.guarded ? 2 : 5 });
    await delay(430);
  }

  async showGuard() {
    this.addEffect({ type: 'guard', duration: 520 });
    await delay(350);
  }

  async showHeal(amount) {
    this.addEffect({ type: 'heal', value: amount, duration: 780 });
    await delay(500);
  }

  render(now) {
    if (this.destroyed) return;
    const ctx = this.context;
    const elapsed = (now - this.startedAt) / 1000;
    this.effects = this.effects.filter((effect) => now - effect.born <= effect.duration + (effect.offset || 0));
    const shake = this.effects.find((effect) => effect.type === 'shake');
    const shakeLife = shake ? Math.max(0, 1 - (now - shake.born) / shake.duration) : 0;
    const dx = shake ? Math.sin(now * 0.11) * shake.strength * shakeLife : 0;
    const dy = shake ? Math.cos(now * 0.15) * shake.strength * shakeLife : 0;

    ctx.save();
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.translate(Math.round(dx), Math.round(dy));
    this.drawBackground(ctx, elapsed);
    this.drawEnemies(ctx, elapsed, now);
    this.drawEffects(ctx, elapsed, now);
    ctx.restore();
    this.lastFrame = now;
    this.raf = requestAnimationFrame(this.render);
  }

  drawBackground(ctx, elapsed) {
    const theme = this.theme;
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, theme.sky);
    gradient.addColorStop(0.64, theme.back);
    gradient.addColorStop(1, theme.floor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = theme.haze;
    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.ellipse(360, 310, 300, 105, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (this.encounter.info.theme.startsWith('belfry')) this.drawBelfry(ctx, elapsed);
    else this.drawCrypt(ctx, elapsed);

    ctx.fillStyle = '#090b0e';
    ctx.globalAlpha = 0.28;
    for (let y = 0; y < HEIGHT; y += 4) ctx.fillRect(0, y, WIDTH, 1);
    ctx.globalAlpha = 1;

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ctx.fillStyle = '#d8c6a2';
      this.ash.forEach((ash, index) => {
        const y = (ash.y - elapsed * ash.speed + HEIGHT) % HEIGHT;
        const x = ash.x + Math.sin(elapsed * 0.5 + index) * 8;
        ctx.globalAlpha = 0.08 + (index % 4) * 0.025;
        ctx.fillRect(Math.round(x), Math.round(y), ash.size, ash.size);
      });
      ctx.globalAlpha = 1;
    }

    const vignette = ctx.createRadialGradient(360, 270, 140, 360, 270, 450);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.78)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  drawCrypt(ctx, elapsed) {
    const accent = this.theme.accent;
    ctx.strokeStyle = '#30363a';
    ctx.lineWidth = 14;
    [84, 636].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 350);
      ctx.lineTo(x, 90);
      ctx.stroke();
      ctx.fillStyle = '#252a2e';
      ctx.fillRect(x - 34, 87, 68, 25);
      ctx.fillRect(x - 40, 344, 80, 25);
    });
    ctx.strokeStyle = '#252b30';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(360, 276, 154, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#0a0d11';
    ctx.beginPath();
    ctx.arc(360, 278, 134, Math.PI, Math.PI * 2);
    ctx.lineTo(494, 370);
    ctx.lineTo(226, 370);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 3;
    for (let x = 265; x <= 455; x += 38) {
      ctx.beginPath();
      ctx.moveTo(360, 405);
      ctx.lineTo(x, 305);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.drawCandles(ctx, elapsed, [[150, 348], [570, 348], [203, 375], [518, 375]]);
    this.drawFloor(ctx);
  }

  drawBelfry(ctx, elapsed) {
    ctx.fillStyle = '#17161c';
    ctx.fillRect(42, 72, 62, 320);
    ctx.fillRect(616, 72, 62, 320);
    ctx.strokeStyle = '#433a34';
    ctx.lineWidth = 7;
    [130, 200, 520, 590].forEach((x, index) => {
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.bezierCurveTo(x + Math.sin(elapsed + index) * 3, 130, x - 8, 240, x + 4, 392);
      ctx.stroke();
      for (let y = 24; y < 360; y += 28) {
        ctx.strokeRect(x - 8, y, 16, 17);
      }
    });
    ctx.fillStyle = '#0c0c10';
    ctx.beginPath();
    ctx.moveTo(266, 0); ctx.lineTo(454, 0); ctx.lineTo(426, 165); ctx.lineTo(294, 165); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.theme.accent;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(360, 120, 62, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    this.drawCandles(ctx, elapsed, [[112, 382], [608, 382]]);
    this.drawFloor(ctx);
  }

  drawFloor(ctx) {
    ctx.strokeStyle = 'rgba(161,145,119,.13)';
    ctx.lineWidth = 2;
    for (let y = 390; y < HEIGHT; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }
    for (let x = -80; x < WIDTH + 80; x += 80) {
      ctx.beginPath(); ctx.moveTo(360, 365); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
  }

  drawCandles(ctx, elapsed, positions) {
    positions.forEach(([x, y], index) => {
      ctx.fillStyle = '#bcae90';
      ctx.fillRect(x - 4, y, 8, 30);
      ctx.fillStyle = index % 2 ? '#70a7a2' : '#d36d45';
      ctx.globalAlpha = 0.65 + Math.sin(elapsed * 6 + index) * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, y - 15); ctx.quadraticCurveTo(x + 8, y - 3, x, y + 2); ctx.quadraticCurveTo(x - 8, y - 3, x, y - 15); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  drawEnemies(ctx, elapsed, now) {
    const positions = this.positions();
    this.encounter.enemies.forEach((enemy) => {
      const pos = positions.get(enemy.uid);
      const death = this.effects.find((effect) => effect.type === 'death' && effect.targetId === enemy.uid);
      if ((!pos || enemy.dead) && !death) return;
      const [x, y] = pos || [360, 330];
      const flash = this.effects.find((effect) => effect.type === 'hitFlash' && effect.targetId === enemy.uid);
      const lunge = this.effects.find((effect) => effect.type === 'enemyLunge' && effect.targetId === enemy.uid);
      const deathLife = death ? Math.min(1, (now - death.born) / death.duration) : 0;
      const bob = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.sin(elapsed * 2.3 + x) * 3;
      const lungeLife = lunge ? Math.sin(Math.min(1, (now - lunge.born) / lunge.duration) * Math.PI) : 0;
      const scale = enemy.boss ? 1.2 : (enemy.kind === 'rat' || enemy.kind === 'moth' || enemy.kind === 'slime' ? 0.82 : 0.95);
      ctx.save();
      ctx.translate(x, y + bob + lungeLife * 25 + deathLife * 34);
      ctx.globalAlpha = 1 - deathLife;

      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.ellipse(0, 17, enemy.boss ? 105 : 72, enemy.boss ? 22 : 15, 0, 0, Math.PI * 2); ctx.fill();
      if (enemy.uid === this.selectedId) this.drawTargetRune(ctx, elapsed, enemy.boss);
      if (enemy.intent?.danger) this.drawDangerRune(ctx, elapsed, enemy.boss);

      ctx.scale(scale, scale);
      this.drawCreature(ctx, enemy.kind, flash ? '#f7eee1' : null, elapsed);
      ctx.restore();
    });
  }

  drawTargetRune(ctx, elapsed, boss) {
    const radius = boss ? 112 : 78;
    ctx.strokeStyle = '#d45e54';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.58 + Math.sin(elapsed * 4) * 0.12;
    ctx.beginPath(); ctx.ellipse(0, 16, radius, radius * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      const x = Math.cos(angle + elapsed * 0.3) * radius;
      const y = 16 + Math.sin(angle + elapsed * 0.3) * radius * 0.22;
      ctx.fillStyle = '#d45e54'; ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  drawDangerRune(ctx, elapsed, boss) {
    const y = boss ? -178 : -128;
    ctx.strokeStyle = '#ee7062';
    ctx.fillStyle = 'rgba(96,19,22,.62)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y - 18); ctx.lineTo(18, y + 13); ctx.lineTo(-18, y + 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5d3bd';
    ctx.fillRect(-2, y - 8, 4, 12);
    ctx.fillRect(-2, y + 7, 4, 4);
    ctx.globalAlpha = 0.18 + Math.sin(elapsed * 5) * 0.08;
    ctx.fillStyle = '#ee5e4b';
    ctx.beginPath(); ctx.arc(0, y, 32, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawCreature(ctx, kind, flash, elapsed) {
    const palette = {
      outline: '#080a0e', bone: flash || '#c7baa0', iron: flash || '#5e646a', dark: flash || '#24252c',
      cloth: flash || '#4a3339', ember: flash || '#d56a49', blue: flash || '#6d9c9c', eye: '#f3a65d',
    };
    const draw = {
      slime: () => drawSlime(ctx, palette),
      rat: () => drawRat(ctx, palette),
      moth: () => drawMoth(ctx, palette, elapsed),
      knight: () => drawKnight(ctx, palette),
      mage: () => drawMage(ctx, palette, elapsed),
      golem: () => drawGolem(ctx, palette),
      wraith: () => drawWraith(ctx, palette, elapsed),
      warden: () => drawWarden(ctx, palette),
      dreadBell: () => drawDreadBell(ctx, palette, elapsed),
    };
    (draw[kind] || draw.knight)();
  }

  drawEffects(ctx, elapsed, now) {
    const positions = this.positions();
    this.effects.forEach((effect) => {
      const age = now - effect.born - (effect.offset || 0);
      if (age < 0) return;
      const life = Math.min(1, age / effect.duration);
      const pos = effect.targetId ? positions.get(effect.targetId) : null;
      ctx.save();
      if (effect.type === 'sealThread') {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.8;
        effect.targetIds.forEach((id, index) => {
          const target = positions.get(id);
          if (!target) return;
          ctx.beginPath();
          ctx.moveTo(WIDTH / 2, HEIGHT + 10);
          ctx.bezierCurveTo(340 + index * 24, 430, target[0] - 35, 390, target[0], target[1] - 40);
          ctx.stroke();
        });
      }
      if (effect.type === 'slash' && pos) {
        ctx.translate(pos[0], pos[1] - 65);
        ctx.rotate(-0.55);
        const length = 150 * Math.sin(Math.min(1, life * 1.5) * Math.PI);
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 12 * (1 - life) + 2;
        ctx.globalAlpha = 1 - life;
        ctx.beginPath(); ctx.moveTo(-length / 2, 0); ctx.lineTo(length / 2, 0); ctx.stroke();
        ctx.strokeStyle = '#d45c4e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-length / 2, 11); ctx.lineTo(length / 2, 11); ctx.stroke();
      }
      if (effect.type === 'impact' && pos) {
        ctx.translate(pos[0], pos[1] - 58);
        ctx.strokeStyle = '#efc784';
        ctx.lineWidth = 6;
        ctx.globalAlpha = 1 - life;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
          ctx.lineTo(Math.cos(angle) * (30 + 80 * life), Math.sin(angle) * (30 + 80 * life));
          ctx.stroke();
        }
      }
      if ((effect.type === 'damage' || effect.type === 'playerDamage') && (pos || effect.type === 'playerDamage')) {
        const x = pos?.[0] || WIDTH / 2;
        const y = (pos?.[1] || HEIGHT - 35) - 115 - life * 42;
        ctx.textAlign = 'center';
        ctx.font = `900 ${effect.critical ? 39 : 31}px ui-monospace, monospace`;
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#0b0d12';
        ctx.globalAlpha = Math.min(1, (1 - life) * 1.7);
        ctx.strokeText(`${effect.critical ? 'CRIT ' : ''}${effect.value}`, x, y);
        ctx.fillStyle = effect.guarded ? '#77c9ca' : effect.critical ? '#ffd478' : '#f4e8d3';
        ctx.fillText(`${effect.critical ? 'CRIT ' : ''}${effect.value}`, x, y);
      }
      if (effect.type === 'break' && pos) {
        ctx.textAlign = 'center';
        ctx.font = '900 25px ui-monospace, monospace';
        ctx.fillStyle = '#72c6c7';
        ctx.globalAlpha = Math.min(1, (1 - life) * 2);
        ctx.fillText('BREAK', pos[0], pos[1] - 158 - life * 20);
      }
      if (effect.type === 'guard') {
        const x = WIDTH / 2; const y = HEIGHT - 45;
        ctx.strokeStyle = '#78c9c9'; ctx.fillStyle = 'rgba(59,121,125,.18)'; ctx.lineWidth = 6;
        ctx.globalAlpha = Math.sin(Math.min(1, life * 1.5) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(x, y - 105); ctx.lineTo(x + 64, y - 76); ctx.lineTo(x + 48, y - 12); ctx.lineTo(x, y + 14); ctx.lineTo(x - 48, y - 12); ctx.lineTo(x - 64, y - 76); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      if (effect.type === 'playerHit') {
        ctx.fillStyle = '#a93232';
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.28;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      if (effect.type === 'heal') {
        ctx.textAlign = 'center'; ctx.font = '900 30px ui-monospace, monospace';
        ctx.fillStyle = '#7fd093'; ctx.globalAlpha = Math.min(1, (1 - life) * 1.8);
        ctx.fillText(`+${effect.value}`, WIDTH / 2, HEIGHT - 100 - life * 44);
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI / 4 + life;
          ctx.fillRect(WIDTH / 2 + Math.cos(angle) * (28 + life * 50), HEIGHT - 70 + Math.sin(angle) * 24 - life * 40, 6, 6);
        }
      }
      ctx.restore();
    });
  }
}

function outline(ctx, fill, stroke = '#080a0e', width = 7) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round';
  ctx.fill(); ctx.stroke();
}

function drawSlime(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(-62, 8); ctx.quadraticCurveTo(-70, -42, -28, -70); ctx.quadraticCurveTo(0, -94, 30, -68);
  ctx.quadraticCurveTo(72, -38, 62, 8); ctx.quadraticCurveTo(26, 31, 0, 20); ctx.quadraticCurveTo(-30, 33, -62, 8);
  outline(ctx, p.blue);
  ctx.fillStyle = p.dark; ctx.fillRect(-26, -35, 13, 13); ctx.fillRect(18, -35, 13, 13);
  ctx.fillStyle = p.ember; ctx.fillRect(-21, -31, 5, 5); ctx.fillRect(23, -31, 5, 5);
  ctx.strokeStyle = p.dark; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-13, -7); ctx.quadraticCurveTo(0, 2, 16, -7); ctx.stroke();
}

function drawRat(ctx, p) {
  ctx.strokeStyle = p.bone; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(44, -22); ctx.bezierCurveTo(103, -54, 92, 14, 129, -2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -28, 63, 38, -0.1, 0, Math.PI * 2); outline(ctx, p.dark);
  ctx.beginPath(); ctx.ellipse(-49, -55, 30, 28, -0.3, 0, Math.PI * 2); outline(ctx, p.bone);
  ctx.beginPath(); ctx.moveTo(-65, -74); ctx.lineTo(-59, -104); ctx.lineTo(-38, -75); outline(ctx, p.bone);
  ctx.fillStyle = p.ember; ctx.fillRect(-61, -61, 9, 8);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 6;
  [-22, -5, 13, 31].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, -51); ctx.lineTo(x + 3, -6); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(-35, -6); ctx.lineTo(-47, 22); ctx.moveTo(28, -3); ctx.lineTo(45, 22); ctx.stroke();
}

function drawMoth(ctx, p, elapsed) {
  const flap = Math.sin(elapsed * 5) * 7;
  ctx.beginPath(); ctx.moveTo(-10, -55); ctx.quadraticCurveTo(-70 - flap, -117, -101 - flap, -45); ctx.quadraticCurveTo(-69, -18, -10, -25); outline(ctx, p.cloth);
  ctx.beginPath(); ctx.moveTo(10, -55); ctx.quadraticCurveTo(70 + flap, -117, 101 + flap, -45); ctx.quadraticCurveTo(69, -18, 10, -25); outline(ctx, p.cloth);
  ctx.fillStyle = p.blue; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(-57, -55, 16, 0, Math.PI * 2); ctx.arc(57, -55, 16, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.ellipse(0, -48, 20, 53, 0, 0, Math.PI * 2); outline(ctx, p.dark);
  ctx.fillStyle = p.ember; ctx.fillRect(-7, -67, 14, 8);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, -92); ctx.quadraticCurveTo(-24, -115, -36, -103); ctx.moveTo(6, -92); ctx.quadraticCurveTo(24, -115, 36, -103); ctx.stroke();
}

function drawKnight(ctx, p) {
  ctx.beginPath(); ctx.moveTo(-52, 11); ctx.lineTo(-43, -82); ctx.lineTo(0, -114); ctx.lineTo(43, -82); ctx.lineTo(54, 12); ctx.closePath(); outline(ctx, p.iron);
  ctx.beginPath(); ctx.moveTo(-36, -77); ctx.lineTo(-30, -128); ctx.lineTo(0, -151); ctx.lineTo(31, -126); ctx.lineTo(37, -77); ctx.closePath(); outline(ctx, p.dark);
  ctx.fillStyle = '#080a0e'; ctx.fillRect(-25, -118, 50, 10); ctx.fillStyle = p.ember; ctx.fillRect(9, -116, 9, 6);
  ctx.beginPath(); ctx.moveTo(-59, -68); ctx.lineTo(-96, -30); ctx.lineTo(-68, -2); ctx.lineTo(-37, -42); outline(ctx, p.iron);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(53, -83); ctx.lineTo(89, 3); ctx.stroke();
  ctx.strokeStyle = p.iron; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(82, -16); ctx.lineTo(111, -30); ctx.stroke();
}

function drawMage(ctx, p, elapsed) {
  ctx.beginPath(); ctx.moveTo(-61, 18); ctx.lineTo(-41, -87); ctx.lineTo(0, -112); ctx.lineTo(42, -86); ctx.lineTo(62, 18); ctx.closePath(); outline(ctx, p.cloth);
  ctx.beginPath(); ctx.arc(0, -106, 30, 0, Math.PI * 2); outline(ctx, p.bone);
  ctx.fillStyle = p.dark; ctx.fillRect(-19, -111, 38, 8); ctx.fillStyle = p.ember; ctx.fillRect(-5, -109, 10, 5);
  [-28, 0, 28].forEach((x, i) => {
    ctx.fillStyle = p.bone; ctx.fillRect(x - 5, -158 - i * 7, 10, 48 + i * 7);
    ctx.fillStyle = i === 1 ? p.ember : p.blue;
    ctx.beginPath(); ctx.moveTo(x, -176 - i * 7); ctx.quadraticCurveTo(x + 11, -160, x, -151 - i * 7); ctx.quadraticCurveTo(x - 11, -160, x, -176 - i * 7); ctx.fill();
  });
  ctx.strokeStyle = p.bone; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(49, -55); ctx.lineTo(91, 12); ctx.stroke();
  ctx.fillStyle = p.ember; ctx.globalAlpha = 0.45 + Math.sin(elapsed * 5) * 0.15; ctx.beginPath(); ctx.arc(89, 8, 18, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}

function drawGolem(ctx, p) {
  ctx.beginPath(); ctx.rect(-62, -104, 124, 112); outline(ctx, p.iron);
  ctx.beginPath(); ctx.rect(-46, -153, 92, 60); outline(ctx, p.dark);
  ctx.fillStyle = p.ember; ctx.fillRect(-27, -131, 18, 9); ctx.fillRect(9, -131, 18, 9);
  ctx.beginPath(); ctx.rect(-99, -91, 39, 92); outline(ctx, p.iron);
  ctx.beginPath(); ctx.rect(60, -91, 39, 92); outline(ctx, p.iron);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 5;
  for (let x = -43; x < 50; x += 24) { ctx.beginPath(); ctx.moveTo(x, -96); ctx.lineTo(x + 8, -8); ctx.stroke(); }
  ctx.strokeStyle = '#3f3530'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-88, -42); ctx.quadraticCurveTo(0, 12, 89, -43); ctx.stroke();
}

function drawWraith(ctx, p, elapsed) {
  ctx.globalAlpha = 0.84;
  ctx.beginPath(); ctx.moveTo(-66, 14); ctx.quadraticCurveTo(-55, -77, -37, -112); ctx.quadraticCurveTo(0, -160, 39, -111); ctx.quadraticCurveTo(60, -70, 68, 14); ctx.lineTo(39, -4); ctx.lineTo(17, 18); ctx.lineTo(-8, -2); ctx.lineTo(-35, 18); ctx.closePath(); outline(ctx, p.cloth);
  ctx.beginPath(); ctx.arc(0, -103, 32, Math.PI, 0); ctx.lineTo(24, -73); ctx.lineTo(-24, -73); ctx.closePath(); outline(ctx, p.dark);
  ctx.fillStyle = p.blue; ctx.fillRect(-16, -102, 8, 8); ctx.fillRect(9, -102, 8, 8);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -185 + Math.sin(elapsed * 3) * 3, 28, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWarden(ctx, p) {
  ctx.beginPath(); ctx.moveTo(-86, 16); ctx.lineTo(-72, -125); ctx.lineTo(-32, -174); ctx.lineTo(39, -174); ctx.lineTo(77, -126); ctx.lineTo(88, 16); ctx.closePath(); outline(ctx, p.cloth, '#080a0e', 10);
  ctx.beginPath(); ctx.moveTo(-49, -146); ctx.quadraticCurveTo(0, -222, 52, -145); ctx.lineTo(35, -84); ctx.lineTo(-35, -84); ctx.closePath(); outline(ctx, p.dark);
  ctx.fillStyle = p.ember; ctx.fillRect(-24, -133, 13, 9); ctx.fillRect(13, -133, 13, 9);
  ctx.strokeStyle = p.iron; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(73, -144); ctx.lineTo(116, 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(104, -78); ctx.lineTo(153, -55); ctx.lineTo(120, -6); ctx.closePath(); outline(ctx, p.iron);
  ctx.strokeStyle = p.bone; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -30, 35, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = p.ember; ctx.fillRect(-6, -37, 12, 23);
}

function drawDreadBell(ctx, p, elapsed) {
  ctx.beginPath(); ctx.moveTo(-93, 10); ctx.quadraticCurveTo(-76, -126, -38, -181); ctx.lineTo(0, -216); ctx.lineTo(41, -181); ctx.quadraticCurveTo(82, -128, 96, 10); ctx.closePath(); outline(ctx, p.iron, '#080a0e', 11);
  ctx.beginPath(); ctx.moveTo(-42, -175); ctx.lineTo(-82, -235); ctx.lineTo(-20, -196); ctx.moveTo(42, -175); ctx.lineTo(82, -235); ctx.lineTo(20, -196); ctx.strokeStyle = p.bone; ctx.lineWidth = 13; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -151, 47, 38, 0, 0, Math.PI * 2); outline(ctx, p.dark);
  ctx.fillStyle = p.ember; ctx.fillRect(-27, -159, 17, 10); ctx.fillRect(12, -159, 17, 10);
  ctx.strokeStyle = p.ember; ctx.globalAlpha = 0.65; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -58, 39 + Math.sin(elapsed * 4) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0b0e'; ctx.beginPath(); ctx.arc(0, -58, 23, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = p.bone; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-81, -99); ctx.lineTo(-129, 8); ctx.moveTo(81, -99); ctx.lineTo(129, 8); ctx.stroke();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
