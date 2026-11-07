# AGENTS.md

悪質商法みやぶり：まちの相談窓口に来た人の話から、悪質商法の手口を見抜き、どうすればよいか・クーリング・オフができるかを選ぶ1日5件の学習ゲーム。`index.html` と `data.js`（手口・相談・判断・問題の作り方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # データの形・字数・出典・日付の問題（3000問を別の数え方で）・今日の5件と上級（3年分）・通しで遊ぶ・続きから・とことん（400回）・おさらい・手口帳・実績・カレンダー・あとから・古いタブ・スマホ幅・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 手口と決まりは公的機関（消費者庁・国民生活センター・自治体・警察）のページで確かめ、`data.js` の `SRC` に出典を足す（QA が go.jp・lg.jp・pref/city のページだけか見る）。確かめられない決まりは問題にしない。人物と話は作り話。法律相談にしない（「このゲームについて」と README に書く）。
- クーリング・オフの日数は「書面を受け取った日を1日目」に数える（堺市・三重県のページ）。8日：訪問販売（キャッチ・アポ・会場の販売を含む）・電話勧誘販売・特定継続的役務提供・訪問購入。20日：連鎖販売取引・業務提供誘引販売取引。通信販売・自分から店に出向いた契約・乗用車・現金3,000円未満は対象外。
- 詐欺を見抜くゲーム（satou-aaaaa/sagi-minuki：架空請求・還付金・フィッシング・SNS型投資など）と重ねない。ここは特定商取引法の取引と悪質商法・クーリング・オフを扱う。
- 相談（`CASES`）・判断（`JUDGE`）は最後に足すだけにし、並べ替え・途中の削除をしない（今日の5件・上級は決まった並びの番号で選ぶので、過去の日の問題が変わる）。足すと並び（`ORD`）も変わるので、足す PR には一言書き、過去の日が変わってよいか決める。話は80字・選び肢は30字・理由は80字・ヒントは30字以内。どうする？の正解は `o` の先頭（画面では種で混ぜる）。手口を当てる問題にしない相談は `nn: 1`。
- 今日の5件・上級は日本時間の日付の種（`seedOf`・`rng`）で決まり、だれでも同じ。`Math.random()` は練習・とことんの並びと日付の問題の種と回の名札だけ（QA が数を見る）。乱数は sort の比較の中で引かない。
- 好きなだけ遊べる：チケット・回数制限・🔒で開くモードを入れない（2026-11-06 satou さん。寄付で成り立たせるため）。上級・とことん・練習ははじめての日から遊べる。とことんはまちがえてもヒントを使っても続き、「ここで降りる」で終わる。自己ベスト `ebest` は一度で正解した件数。別のタブで終えた回は `edone` で書き戻さない。
- 記録 `miyaburi-v1`：`days`・`hdays`・`adays`（あとから）・`dex`（手口帳）・`co`（クーリング・オフの問題の数）・`miss`（おさらい、12まで）・`runs`（モードごとの途中経過 `d`・`h`・`p`・`e`・`a:日付`）・`kofi`・`ach`・`ebest`・`edone`。`load` は両側を `fresh()` で補って合わせ、`tidy` で形を直す（壊れた札・数の所の文字を捨てる）。答える・ヒントは、保存した回の id と問題の番号がこの画面と同じときだけ書き込む（`same`）。ヒント・まちがいは別のタブの分より減らさない（`keep`）。記録の形を変えたら QA の引き継ぎの `sample` も合わせる。
- 実績（`ACH`、14個）はいまの記録から毎回数える。続けるは合計の日数。連続は1日以上のときだけ出す。取りこぼした日（過去7日・`EPOCH` から）はあとから遊べ、連続・今日の記録・シェア・Ko-fi には数えない。
- 文字は少なめ・一画面一件。お笑いの言葉は入れない。ほかの作品の名前・キャラ、実在の会社名は使わない。人物は名字＋年代で、男女・年代を混ぜる（だまされるのを高齢の女性に寄せない）。
- 共有は遊ぶ人が押したときに開くリンクだけ。シェアの文に手口・答えを出さない。
- 感想は Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、shared-workflows `template/` の写し）へのリンクだけ。名前・メールは聞かない。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンク。今日の5件・上級を初めて全部一度で正解したときだけ結果の画面に1行。遊ぶのは無料のまま。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。
- 見やすさ：`</head>` の前の `<!-- a11y:begin -->`〜`end` は shared-workflows `template/a11y/a11y.html` の写し、`qa/a11y.mjs` は `template/qa/a11y.mjs` の写しで、ここでは直さない。色だけで分けない（正解 ✓・まちがい ✕ と破線・星は ☆・カレンダーは ★ ↺ ▲・日付の問題の数えた日は番号と「最後」）。知らせは `#msg`（role=status）と `.verdict`。
- 引き継ぎ：`transfer.js` と `qa/transfer-check.mjs` は shared-workflows `template/` の写し。`data-keys` は `miyaburi-v1`。
- 大きく出てから縮む・揺れる動き（判の `stamp` など）は、入れ物に `overflow:hidden` を付けて横にはみ出させない（2026-11-07 CI でだけ 5px はみ出した。QA が動きの途中も測る）。
- 一行に書いた処理の途中にコメント `//` を足さない。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回・何年分も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` に足し、中身や取り方を変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の相談を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js`（法律の事実）を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
