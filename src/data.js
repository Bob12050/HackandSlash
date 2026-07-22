export const GAME_VERSION = 1;

export const RARITIES = {
  common: {
    id: 'common', label: '粗製', color: '#a9adaf', glow: '#687075', rank: 0, affixes: 0, multiplier: 1,
  },
  magic: {
    id: 'magic', label: '魔装', color: '#62aeea', glow: '#315f88', rank: 1, affixes: 1, multiplier: 1.16,
  },
  rare: {
    id: 'rare', label: '希少', color: '#f1c75b', glow: '#8b6e28', rank: 2, affixes: 2, multiplier: 1.34,
  },
  epic: {
    id: 'epic', label: '秘宝', color: '#bd79f5', glow: '#70418f', rank: 3, affixes: 3, multiplier: 1.58,
  },
  legendary: {
    id: 'legendary', label: '遺物', color: '#ef7b4a', glow: '#9c3f28', rank: 4, affixes: 4, multiplier: 1.88,
  },
};

export const SLOT_META = {
  weapon: { label: '武器', icon: '†', main: 'attack' },
  armor: { label: '防具', icon: '◇', main: 'defense' },
  charm: { label: '護符', icon: '✦', main: 'maxHp' },
};

export const ITEM_BASES = {
  weapon: [
    { name: '欠けた鉄剣', icon: '剣', style: 'sword' },
    { name: '墓守の斧', icon: '斧', style: 'axe' },
    { name: '祈り裂きの槍', icon: '槍', style: 'spear' },
    { name: '黒鋼の大剣', icon: '大', style: 'greatsword' },
    { name: '鐘砕きの槌', icon: '槌', style: 'hammer' },
  ],
  armor: [
    { name: '煤けた旅装', icon: '衣', style: 'cloth' },
    { name: '骨留めの外套', icon: '套', style: 'coat' },
    { name: '墓所の鎖帷子', icon: '鎖', style: 'mail' },
    { name: '灰銀の胸甲', icon: '甲', style: 'plate' },
  ],
  charm: [
    { name: '消えかけの灯芯', icon: '灯', style: 'wick' },
    { name: '白骨の数珠', icon: '骨', style: 'beads' },
    { name: '封蝋の聖印', icon: '印', style: 'seal' },
    { name: 'ひび割れた鐘片', icon: '鐘', style: 'bell' },
  ],
};

export const AFFIXES = [
  { id: 'attack', label: '猛攻', stat: 'attack', mode: 'flat', min: 2, max: 7, slots: ['weapon', 'charm'] },
  { id: 'defense', label: '堅牢', stat: 'defense', mode: 'flat', min: 2, max: 6, slots: ['armor', 'charm'] },
  { id: 'maxHp', label: '生命', stat: 'maxHp', mode: 'flat', min: 9, max: 26, slots: ['armor', 'charm'] },
  { id: 'attackPct', label: '破砕', stat: 'attackPct', mode: 'percent', min: 3, max: 9, slots: ['weapon'] },
  { id: 'defensePct', label: '城壁', stat: 'defensePct', mode: 'percent', min: 4, max: 11, slots: ['armor'] },
  { id: 'crit', label: '会心', stat: 'crit', mode: 'percent', min: 2, max: 7, slots: ['weapon', 'charm'] },
  { id: 'lifesteal', label: '吸命', stat: 'lifesteal', mode: 'percent', min: 2, max: 6, slots: ['weapon', 'charm'] },
  { id: 'fortune', label: '幸運', stat: 'fortune', mode: 'percent', min: 4, max: 12, slots: ['charm'] },
  { id: 'breakPower', label: '衝撃', stat: 'breakPower', mode: 'flat', min: 8, max: 20, slots: ['weapon', 'armor'] },
  { id: 'potionPower', label: '霊薬', stat: 'potionPower', mode: 'percent', min: 6, max: 18, slots: ['armor', 'charm'] },
  { id: 'thorns', label: '反棘', stat: 'thorns', mode: 'flat', min: 1, max: 4, slots: ['armor'] },
];

export const PLAYER_SKILLS = [
  {
    id: 'ashenEdge',
    name: '断灰の一閃',
    description: '敵単体へ強烈な斬撃。ブレイク中は威力上昇。',
    cost: 2,
    power: 1.72,
    break: 24,
    target: 'single',
    icon: '刃',
  },
  {
    id: 'bellBreaker',
    name: '鐘砕き',
    description: '体勢を大きく崩す一撃。ブレイク値が高い。',
    cost: 1,
    power: 1.08,
    break: 58,
    target: 'single',
    icon: '砕',
  },
  {
    id: 'emberSweep',
    name: '残火薙ぎ',
    description: '残火をまとい、敵全体を薙ぎ払う。',
    cost: 3,
    power: 0.92,
    break: 18,
    target: 'all',
    icon: '焔',
  },
];

export const ENEMIES = {
  ashSlime: {
    id: 'ashSlime', name: '灰泥スライム', kind: 'slime', hp: 36, attack: 8, defense: 2, break: 78,
    xp: 12, gold: 8, speed: 5, weight: 24,
    moves: [
      { name: '灰の体当たり', power: 1, text: '粘つく身体が襲いかかる！' },
      { name: '煤の飛沫', power: 0.82, text: '熱い煤が弾けた！' },
    ],
  },
  boneRat: {
    id: 'boneRat', name: '骨走り', kind: 'rat', hp: 28, attack: 10, defense: 1, break: 60,
    xp: 13, gold: 7, speed: 9, weight: 25,
    moves: [
      { name: '噛み裂き', power: 1.05, text: '鋭い骨牙が閃く！' },
      { name: '死角跳び', power: 0.9, crit: 0.18, text: '骨走りが死角へ跳んだ！' },
    ],
  },
  graveMoth: {
    id: 'graveMoth', name: '墓灯蛾', kind: 'moth', hp: 31, attack: 9, defense: 2, break: 52,
    xp: 15, gold: 9, speed: 12, weight: 18,
    moves: [
      { name: '燐粉', power: 0.9, text: '青白い燐粉が降り注ぐ！' },
      { name: '灯喰らい', power: 1.18, text: '墓灯蛾が灯を喰らった！' },
    ],
  },
  hollowKnight: {
    id: 'hollowKnight', name: '空洞騎士', kind: 'knight', hp: 72, attack: 13, defense: 7, break: 105,
    xp: 25, gold: 16, speed: 5, weight: 17, minFloor: 3,
    moves: [
      { name: '錆刃', power: 1.05, text: '錆びた長剣が振り下ろされる！' },
      { name: '盾打ち', power: 0.88, extraBreak: 15, text: '空の盾が唸りを上げた！' },
    ],
  },
  candleMage: {
    id: 'candleMage', name: '蝋燭の侍祭', kind: 'mage', hp: 49, attack: 15, defense: 3, break: 70,
    xp: 28, gold: 19, speed: 7, weight: 13, minFloor: 4,
    moves: [
      { name: '葬火', power: 1.24, text: '弔いの炎が足元に灯る！' },
      { name: '熔蝋', power: 1.08, text: '灼けた蝋が降り注ぐ！' },
    ],
  },
  chainGolem: {
    id: 'chainGolem', name: '鎖塊の番兵', kind: 'golem', hp: 112, attack: 18, defense: 11, break: 128,
    xp: 42, gold: 28, speed: 3, weight: 17, minFloor: 6,
    moves: [
      { name: '鉄塊打ち', power: 1.18, text: '重い拳が床ごと砕く！' },
      { name: '鎖振り', power: 0.96, text: '唸る鎖が横薙ぎに迫る！' },
    ],
  },
  bellWraith: {
    id: 'bellWraith', name: '弔鐘の亡霊', kind: 'wraith', hp: 78, attack: 21, defense: 5, break: 82,
    xp: 45, gold: 31, speed: 11, weight: 16, minFloor: 7,
    moves: [
      { name: '魂鳴り', power: 1.25, text: '魂を揺らす鐘音が響く！' },
      { name: '冷たい指', power: 1.04, text: '青白い指が心臓へ伸びる！' },
    ],
  },
  cryptWarden: {
    id: 'cryptWarden', name: '墓鐘守ヴァルグ', kind: 'warden', hp: 310, attack: 19, defense: 9, break: 165,
    xp: 125, gold: 95, speed: 7, boss: true,
    moves: [
      { name: '墓守の断罪', power: 1.18, text: 'ヴァルグの大鉈が灰を巻き上げる！' },
      { name: '弔鐘', power: 1.34, telegraph: true, text: '巨大な鐘が不吉に揺れた……！' },
      { name: '灰葬', power: 1.46, hpThreshold: 0.45, text: '「灰へ還れ」――墓所が鳴動する！' },
    ],
  },
  dreadBell: {
    id: 'dreadBell', name: '喪鐘の獣イグナ', kind: 'dreadBell', hp: 590, attack: 28, defense: 14, break: 210,
    xp: 290, gold: 220, speed: 9, boss: true,
    moves: [
      { name: '黒鐘爪', power: 1.2, text: '黒鉄の爪が空間を裂く！' },
      { name: '奈落反響', power: 1.42, telegraph: true, text: '奈落の鐘音が重なっていく……！' },
      { name: '終刻', power: 1.62, hpThreshold: 0.35, text: 'すべてを終わらせる鐘が鳴る！' },
    ],
  },
};

export const FLOOR_DATA = [
  null,
  { name: '灰骨墓廊・入口', short: '墓廊 I', theme: 'crypt', enemies: ['ashSlime', 'boneRat'], count: [1, 2] },
  { name: '灰骨墓廊・埋葬路', short: '墓廊 II', theme: 'crypt', enemies: ['ashSlime', 'boneRat', 'graveMoth'], count: [2, 2] },
  { name: '灰骨墓廊・騎士墓', short: '墓廊 III', theme: 'crypt', enemies: ['boneRat', 'graveMoth', 'hollowKnight'], count: [2, 3] },
  { name: '灰骨墓廊・鐘前', short: '墓廊 IV', theme: 'crypt', enemies: ['hollowKnight', 'candleMage', 'graveMoth'], count: [2, 3] },
  { name: '墓鐘守の間', short: '墓廊・最深部', theme: 'cryptBoss', boss: 'cryptWarden', count: [1, 1] },
  { name: '鎖された鐘楼・下層', short: '鐘楼 I', theme: 'belfry', enemies: ['chainGolem', 'candleMage'], count: [2, 2] },
  { name: '鎖された鐘楼・回廊', short: '鐘楼 II', theme: 'belfry', enemies: ['bellWraith', 'graveMoth', 'chainGolem'], count: [2, 3] },
  { name: '鎖された鐘楼・機関室', short: '鐘楼 III', theme: 'belfry', enemies: ['chainGolem', 'bellWraith', 'candleMage'], count: [3, 3] },
  { name: '鎖された鐘楼・天蓋', short: '鐘楼 IV', theme: 'belfry', enemies: ['bellWraith', 'chainGolem'], count: [2, 3] },
  { name: '喪鐘の祭壇', short: '鐘楼・頂', theme: 'belfryBoss', boss: 'dreadBell', count: [1, 1] },
];

export const THEMES = {
  crypt: { sky: '#111821', back: '#192129', floor: '#242a2e', accent: '#638788', haze: '#26353a' },
  cryptBoss: { sky: '#130f14', back: '#251a21', floor: '#2b2629', accent: '#b9664f', haze: '#49272b' },
  belfry: { sky: '#111016', back: '#211f28', floor: '#29272e', accent: '#a97a50', haze: '#3c312c' },
  belfryBoss: { sky: '#0c0a0c', back: '#231419', floor: '#2d2224', accent: '#d26c48', haze: '#56251e' },
};

export const TIPS = [
  '通常攻撃と防御で集中を溜め、強力な技を放とう。',
  '敵の体勢を削り切ると、次の行動を止められる。',
  '装備の強さは数値だけではない。吸命や幸運も重要だ。',
  '帰還すればHPと薬瓶が全回復する。引き際を見極めよう。',
  '不要な装備は灰片へ分解できる。',
];

export const STORY = {
  opening: [
    '百年前、王都の地下で「喪鐘」が鳴った。',
    '死者は灰となり、名と記憶だけが迷宮へ沈んだ。',
    'あなたは名を失った〈灰狩り〉。',
    '残された灯を手に、鐘の音が眠る深層へ向かう。',
  ],
};
