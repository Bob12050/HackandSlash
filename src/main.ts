import Phaser from 'phaser';
import '@fortawesome/fontawesome-free/css/all.min.css';

import './styles.css';
import { StageScene } from './scenes/StageScene';
import { mountApp } from './ui/AppView';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root is missing');

mountApp(root);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: 960,
  height: 585,
  backgroundColor: '#a9dea0',
  transparent: false,
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 585
  },
  scene: [StageScene]
});

game.canvas.setAttribute('aria-label', 'こもれびギルド物語 自動戦闘画面');

export default game;
