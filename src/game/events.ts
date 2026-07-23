import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const Events = {
  HUD_UPDATE: 'hud-update',
  SHOW_UPGRADES: 'show-upgrades',
  UPGRADE_SELECTED: 'upgrade-selected',
  LOOT_COLLECTED: 'loot-collected',
  RUN_ENDED: 'run-ended',
  RETRY_RUN: 'retry-run',
  RETURN_TO_TITLE: 'return-to-title'
} as const;
