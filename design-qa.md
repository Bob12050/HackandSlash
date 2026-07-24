# Design QA — こもれびギルド物語

**Findings**

- 最終比較で、対応が必要な P0 / P1 / P2 の差分はありません。
- 参照作品の情報設計（上部ステージ、HP/EXP、行動、ログ）を保ちつつ、名称、キャラクター、背景、配色、文言は本作独自の明るく可愛い表現に置き換えています。この差分は意図したオマージュ範囲です。

**Comparison Target**

- Source visual truth — guild: `C:\Users\rei49\.codex\codex-remote-attachments\019f8ef1-9b95-7563-b12b-a6877c9839cb\B9DD1187-BFA4-443F-8133-F0A8D495A9FC\1-写真1.jpg`
- Source visual truth — auto battle: `C:\Users\rei49\.codex\codex-remote-attachments\019f8ef1-9b95-7563-b12b-a6877c9839cb\B9DD1187-BFA4-443F-8133-F0A8D495A9FC\2-写真2.jpg`
- Implementation — guild: `C:\Users\rei49\OneDrive\ドキュメント\hach\design-qa-assets\guild-implementation-final.png`
- Implementation — auto battle: `C:\Users\rei49\OneDrive\ドキュメント\hach\design-qa-assets\adventure-implementation-final.png`
- Local implementation URL: `http://127.0.0.1:53710/`
- States: ギルド待機、自動戦闘、装備一覧、依頼報酬受取

**Viewport and Normalization**

- Source: 1179 × 2556 px、iPhone の 3x キャプチャ。393 × 852 CSS px として正規化しました。端末クロームを含む点は比較時に除外要因として扱っています。
- Implementation: 393 × 852 CSS px、devicePixelRatio 1、393 × 852 px。393 × 852 の iframe 内で `innerWidth=393`、`innerHeight=852`、`clientWidth=393` を実測しました。
- Theme: light。ギルド画面と戦闘画面は同じ保存データ・同じ表示幅で比較しました。

**Full-view Comparison Evidence**

- Guild side-by-side: `C:\Users\rei49\OneDrive\ドキュメント\hach\design-qa-assets\guild-comparison-final.png`
- Auto battle side-by-side: `C:\Users\rei49\OneDrive\ドキュメント\hach\design-qa-assets\battle-comparison-final.png`
- 構成順、ステージ比率、HP/EXPカード、行動グリッド、帰還ボタン、ログの密度を確認しました。

**Focused Region Evidence**

- Equipment dialog: `C:\Users\rei49\OneDrive\ドキュメント\hach\design-qa-assets\equipment-implementation-final.png`
- 閉じるボタン 44 × 44 px、装備操作ボタン 48 × 44 px を実測。ダイアログ名は `aria-labelledby="modal-title"` で関連付け済みです。
- アイコンは Font Awesome に統一し、生成画像の透過縁、背景クロップ、キャラクターの縮尺、文字の切れを目視確認しました。

**Required Fidelity Surfaces**

- Fonts and typography: 丸みのある日本語書体、太さ、行間、数値の視認性、見出し階層に破綻なし。小文字も 393 px 幅で重なり・不自然な折返しなし。
- Spacing and layout rhythm: 参照の縦型カード構成と操作順を維持。ステージ、ステータス、操作、ログの間隔と角丸を揃え、永続操作が画面外に隠れないことを確認。
- Colors and tokens: クリーム、ミント、コーラル、バイオレットの独自トークンで明るい可愛さへ変更。HP、EXP、警告、無効状態の意味は一貫。
- Image quality and asset fidelity: 背景・主人公・受付嬢・敵・宝箱は専用のラスター画像を使用。引き伸ばし、透過ハロー、低解像度化、CSS代替アートなし。
- Copy and content: ギルド、冒険、自動戦闘、帰還、装備、依頼の流れが単体で理解でき、参照作品の固有名称や文章は複製していません。
- Icons and accessibility: アイコン体系を統一。キーボードフォーカス、44 px級タップ領域、dialogラベル、ログ用live region、`prefers-reduced-motion` のPhaser演出抑制を確認。
- Responsiveness: 393 × 852 を主対象として検証。ページスクロールは維持しつつ装飾スクロールバーを非表示にし、横方向のはみ出しなし。

**Comparison History**

1. Pass 1 — [P2] 16:9 のステージが参照より浅く、画面の主役領域が弱かった。
   - Fix: Phaser の論理キャンバスを 960 × 585 に変更し、背景を比率維持のまま中央クロップ。キャラクターの接地位置も下げた。
   - Post-fix evidence: `guild-comparison-final.png` と `battle-comparison-final.png` で約 1.64:1 のステージ比率と参照同等の主従関係を確認。
2. Pass 2 — [P1] 戦闘更新ごとの操作パネル再生成でフォーカスが失われる可能性があった。[P2] 敵・宝箱の基準スケール、ダイアログのタップ領域、Phaserの低モーション対応にも不足があった。
   - Fix: モード変更時だけ操作パネルを再生成し、数値は差分更新。基準スケールを保持したTween、撃破後の次敵切替、44 px級操作、dialogラベル、Phaser側の低モーション分岐を実装。
   - Post-fix evidence: 自動戦闘を複数更新後も「ギルドへ帰還」が一意に操作でき、装備変更と依頼受取も成功。コンソールの error / warn は 0 件。
3. Final pass — 393 × 852 のギルド・戦闘を再キャプチャし、参照と同一比較面に配置。対応が必要な P0 / P1 / P2 は残っていません。

**Primary Interactions Tested**

- 冒険開始 → 自動攻撃・被ダメージ → EXP/Gold/装備ドロップ
- 複数回の戦闘更新後に手動帰還
- 敗北時の自動帰還
- 装備モーダル表示・装備変更・売却ボタン表示
- クエスト達成報酬の受取
- ブラウザコンソール error / warn: 0

**Open Questions**

- なし。

**Implementation Checklist**

- [x] 参照の縦型情報設計を独自アートで再構成
- [x] 自動戦闘の主要ループを操作確認
- [x] 393 × 852 でギルド・戦闘を比較
- [x] キーボード、タップ領域、低モーション、dialogを確認
- [x] 型チェック、単体テスト、プロダクションビルドを実行

**Follow-up Polish**

- P3: 次回以降、攻撃SEや装備比較表示を追加すると収集の手応えをさらに強められます。

final result: passed
