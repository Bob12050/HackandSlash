# RIFTBORNE // 深淵を裂く者

TypeScriptとPhaser 4でゼロから作る、ブラウザ向けトップダウン・ハクスラです。

## 現在のプレイ要素

- WASD移動、マウス照準、左クリック／Spaceで斬撃
- Shiftダッシュと短時間の無敵
- 複数タイプの敵、エリート、遠距離攻撃
- 経験値、レベルアップ3択、装備ドロップ
- ウェーブ進行、HUD、ゲームオーバー、リトライ

## 起動

```bash
npm install
npm run dev
```

## 検証

```bash
npm run test
npm run typecheck
npm run build
npm run validate
```

## 技術構成

- TypeScript 7
- Phaser 4.2.1
- Vite 8
- Vitest 4
- Phaser Arcade Physics

画像素材はまだ使わず、PhaserのGraphicsから実行時に生成しています。
