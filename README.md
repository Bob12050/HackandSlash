# 灰燼の迷宮 — ASHEN RELICS

正面視点のターン制コマンドバトルと、ランダム性能の装備収集を組み合わせたモバイルファーストRPGです。

公開先: <https://bob12050.github.io/HackandSlash/>

## ゲーム概要

プレイヤーは名を失った「灰狩り」となり、喪鐘の鳴る迷宮を進みます。

1. 敵の次行動を示す「予兆」を読む
2. 攻撃・戦技・防御・薬瓶からコマンドを選ぶ
3. 体勢ゲージを削り、ブレイクで敵の行動を止める
4. 戦闘後にランダム装備を獲得する
5. 現在の装備と比較し、その場で装備または保管する
6. 次の深度へ進むか、祭壇へ帰還する

現在のプロローグ版には10深度、通常敵7種、ボス2体、装備3部位、5段階の希少度と11種類の追加効果が含まれます。

## 操作

スマートフォンの縦画面を基準にしています。すべての操作はタップまたはクリックで行えます。

- **攻撃**: 単体攻撃。集中が1増える
- **技**: 集中を消費して戦技を使用する
- **防御**: 次の敵ターンの被害を60%軽減し、集中が2増える
- **薬瓶**: 最大HPの約40%を回復する。探索ごとに3回
- **敵のカード**: 攻撃対象を切り替える

## ローカル起動

外部ライブラリやビルド工程はありません。Node.jsだけで起動できます。

```bash
npm run dev
```

ブラウザーで <http://localhost:4173/> を開きます。

## 検証

```bash
npm run check     # JavaScript構文チェック
npm test          # ゲームロジックの自動テスト
npm run validate  # 上記をまとめて実行
npm run balance   # 10深度を多数回シミュレーション
```

## 技術構成

- HTML / CSS / JavaScript（ES Modules）
- Canvas 2Dによる戦闘背景・敵・攻撃演出
- LocalStorageによる自動セーブとバックアップ
- Service Worker / Web App Manifestによるオフライン対応
- Node.js組み込みテストランナー
- GitHub ActionsからGitHub Pagesへ自動公開

## 主なファイル

```text
index.html          アプリシェルとタイトル画面
styles.css          全画面のビジュアルとレスポンシブ対応
src/app.js          画面遷移とゲーム進行
src/engine.js       戦闘・装備・ドロップ・成長ロジック
src/data.js         敵、階層、戦技、装備効果の定義
src/renderer.js     Canvas戦闘レンダラー
src/storage.js      セーブ管理
src/audio.js        Web Audio効果音
tests/              ロジックテスト
```

## 公開設定

`main` ブランチへのpushで `.github/workflows/pages.yml` が検証後に公開します。初回のみGitHubリポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定してください。
