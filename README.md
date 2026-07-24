# こもれびギルド物語

TypeScriptとPhaser 4で作る、スマートフォン向けの可愛い縦型自動戦闘RPGです。

[GitHub Pagesで遊ぶ](https://bob12050.github.io/HackandSlash/)

## ゲームの流れ

1. ギルドから「冒険に出る」を選ぶ
2. そよかぜ草原で自動戦闘を見守る
3. 敵を倒してEXP・Gold・装備を獲得する
4. ギルドへ帰還し、手に入れた装備で冒険者を強くする
5. クエストを達成しながらSランク冒険者を目指す

歩行や複雑な操作はなく、タップだけで遊べます。冒険の記録はブラウザへ自動保存されます。

## 現在のプレイ要素

- ギルドと冒険画面を切り替える縦型モバイルUI
- 敵との自動戦闘、ダメージ演出、敗北時の自動帰還
- 経験値、レベルアップ、Gold、装備ドロップ
- 装備の比較・付け替え・売却
- 討伐クエストと報酬受け取り
- ローカルストレージによるオートセーブ

## ローカルで起動

```bash
npm install
npm run dev
```

表示されたURLをブラウザで開いてください。

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
- Font Awesome Free

`main` ブランチへpushすると、GitHub Actionsが検証とビルドを行い、成功後にGitHub Pagesへ自動公開します。
