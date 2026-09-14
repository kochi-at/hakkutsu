# 聖遺物鑑定局

身の回りの物を撮影すると、架空の「伝説の秘宝」として鑑定するReactアプリです。3日間のハッカソンを想定し、React・Vite・TypeScriptで画面を、Vercel FunctionsでAI鑑定APIを構成しています。

## 実装した機能

- スマホ・PCカメラのプレビュー／撮影、権限拒否時の案内
- ファイル選択、ドラッグ＆ドロップ、画像の縮小とJPEG変換
- 魔法陣の待機演出と、希少度・伝承・能力・代償・鑑定根拠を載せた鑑定書
- OpenAI Responses APIによる画像鑑定とStructured Outputs／Zodによるデータ検証
- APIキー不要の「お試し鑑定」。**写真を解析せず、固定のスプーンのサンプルを表示します**
- IndexedDBを使う端末内図鑑：保存、一覧、再表示、削除
- 写真入りの鑑定書をPNGとしてダウンロード
- モバイル向けレイアウト、キーボード操作、動きを減らす設定への対応
- AI未設定、通信エラー、不正な画像、時間切れの案内
- APIの合言葉による保護（任意）、プロセス単位の簡易回数制限

履歴は同じ端末・同じブラウザ・同じオリジンだけで利用できます。Supabaseやユーザー登録は含めていません。ブラウザのデータ削除で図鑑は消えるため、大切な鑑定書はPNGでも保存してください。

## すぐに起動する

Node.js 22以上（推奨24）とnpmを用意し、このフォルダをターミナルで開きます。

```sh
npm install
npm run dev
```

表示される `http://localhost:5173` をブラウザで開いてください。APIキーがなくても「お試し」で、写真の選択→鑑定演出→結果表示→図鑑保存→PNG保存を確認できます。サンプル写真は同梱していないため、手元の写真を選択してください。

Viteの開発用プラグインで `/api/config` と `/api/appraise` を起動するため、**このプロジェクトでは `npm run dev` 一つで画面と開発用APIの両方が動きます**。以前の構成案で必要だった別のAPI起動を省いています。

## 実際のAI鑑定を有効にする

1. `.env.example` を `.env.local` にコピーします。
2. OpenAI APIで利用できるAPIキーを設定します。
3. 開発サーバーを再起動します。

```dotenv
OPENAI_API_KEY=自分のAPIキー
OPENAI_MODEL=gpt-4o-mini
APP_ACCESS_TOKEN=
```

設定を検出すると「AI鑑定」が選択されます。写真を選択して「聖遺物を鑑定する」を押すと、写真を外部AIに送信します。APIの利用には課金が発生します。APIキーはチャットやソースコードに貼り付けず、環境変数に保存してください。

`OPENAI_API_KEY` に **`VITE_` を付けないでください**。Viteで `VITE_` を付けた値はブラウザに公開されます。秘密のキーは `server/` と `api/` の処理だけで利用します。`.env.local` はGit管理対象から除外しています。

モデルは画像入力・Responses API・Structured Outputsに対応するものに変更できます。実際に利用できるモデルはAPIプロジェクトの権限を確認してください。

## スマホとカメラ

- カメラはHTTPSまたはlocalhostで利用できます。PCのLANアドレスをHTTPでスマホから開いた場合、通常はカメラを利用できません。実機確認にはHTTPSの公開URLを使用してください。
- カメラの許可は「カメラを開く」を押したときだけ求めます。閉じる・撮影する・収蔵庫へ移動する際に映像トラックを停止します。
- JPEG・PNG・WebPを受け付け、長辺1,280px以下のJPEGに変換します。HEIC／HEIFはブラウザが画像をデコードできる場合だけ変換できます。失敗したらJPEGに変換して選び直してください。
- 元画像は20MB以下、送信画像はおよそ950KB以下です。サーバーでも容量・形式・ファイル署名を検証します。ファイル署名の検証は完全な画像デコードではないため、壊れた画像はAI側で拒否されることがあります。

## Vercelに公開する

1. このフォルダをGitHub等のリポジトリに登録し、Vercelにインポートします。
2. Framework Presetを **Vite** にします。
3. Build Commandを `npm run build`、Output Directoryを `dist` にします。
4. VercelのEnvironment Variablesに `OPENAI_API_KEY`、`OPENAI_MODEL` を登録します。必要なら `APP_ACCESS_TOKEN` も登録します。
5. デプロイ後、HTTPSのURLをスマホで開きます。

`api/appraise.ts` と `api/config.ts` がVercel Functionsとして動きます。HTMLを配信するだけの静的ホスティングでは実際のAI鑑定は動きません。`npm run preview` も静的ビルドの確認用で、開発用APIは含みません。

公開デモでは `APP_ACCESS_TOKEN` に長いランダムな合言葉を設定して、参加者だけに共有することをおすすめします。合言葉は画面の入力欄から送信され、ブラウザの永続ストレージには保存しません。

簡易回数制限は **同一プロセス・同一IPにつき毎分5回** です。サーバーレスの複数インスタンスをまたぐ厳密な課金上限ではありません。一般公開まで進める場合は、Vercelのアクセス制御や共有ストアでの制限を追加してください。

## ファイル構成

```text
src/
  App.tsx                         画面全体、鑑定室と収蔵庫
  styles.css                      世界観・スマホ対応・アニメーション
  components/CameraCapture.tsx    カメラとシャッター
  components/RelicCard.tsx        鑑定書
  hooks/useAppraisal.ts           API呼び出し・中止・待機状態
  lib/image.ts                   画像読み込み・縮小
  lib/history.ts                 IndexedDB保存
  lib/export.ts                  鑑定書PNG出力
  lib/demo.ts                    固定サンプル
shared/schema.ts                 鑑定結果の型と検証ルール
server/appraise.ts               AIへの指示とサーバー処理
server/validation.ts             画像入力の検証
api/                            Vercel Functionsの入口
vite.config.ts                  開発用APIの接続
tests/                          画像検証・鑑定APIのテスト
```

装飾は追加のCSSフレームワークを使わずCSSで実装しています。和文フォントはGoogle Fontsを参照し、ネット接続がないときは端末の標準フォントにフォールバックします。

## API

- `GET /api/config` → `{ aiAvailable, requiresAccessToken }`。秘密の値は返しません。
- `POST /api/appraise` → JSON `{ image: "data:image/jpeg;base64,..." }`。合言葉が設定されている場合は `Authorization: Bearer ...` が必要です。
- 成功：`{ appraisal: { name, rarity, category, observedFeatures, lore, ability, drawback, rarityReason, appraiserComment } }`
- 失敗：`{ error: "利用者向けの説明" }`

鑑定の再表示・PNG保存・図鑑保存ではAIを再呼び出しません。保存に失敗しても鑑定結果は画面に残ります。AIが失敗したとき、勝手にデモの結果へ切り替えることはありません。

## テストとビルド

```sh
npm test
npm run build
```

APIテストはモックを使用し、APIキーや課金を必要としません。

依存パッケージがない状態でもNode.js 24なら画像入力検証だけを実行できます。

```sh
node --test tests/validation.test.ts
```

作成環境ではこの画像検証4件は成功しました。ネットワーク制限により依存パッケージをインストールできず、全体の型チェック・ビルド・ブラウザ動作確認・モックAPIテストは未実施です。実際のAI APIへの接続も未検証です。

ハッカソン前には、少なくとも次を実機で確認してください。

- 写真を選択して、お試し鑑定→図鑑保存→再読み込み→PNG保存ができる
- カメラ許可／拒否／カメラなし端末から操作を続けられる
- AIの設定なし／誤った合言葉／通信失敗で説明が表示される
- iPhone Safari、Android Chromeで撮影・縦横画像・文字表示を確認する

## 次の拡張

クラウド履歴を追加する場合は `src/lib/history.ts` を保存先の境界として利用できます。Supabase Authで所有者を識別し、Databaseに鑑定JSON、非公開Storageに画像を保存する形に拡張してください。その際はDB・Storage両方の所有者権限を設定します。

## 参考にした公式ドキュメント

- [React / Viteでの作成](https://react.dev/learn/build-a-react-app-from-scratch)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Viteの環境変数](https://vite.dev/guide/env-and-mode)
- [VercelのNode.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
