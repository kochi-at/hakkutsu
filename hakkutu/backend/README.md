# 写真を受け取るFastAPI

## Geminiで聖遺物を鑑定する

`backend` フォルダで `.env.example` を `.env` にコピーして、APIキーを設定します。

```powershell
Copy-Item .env.example .env
```

`.env` の内容:

```dotenv
GEMINI_API_KEY=取得したAPIキー
GEMINI_MODEL=gemini-3.6-flash
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ENABLE_DEBUG_ROUTES=true
MOCK_GEMINI=false
```

`FRONTEND_ORIGINS` はCORSを許可する送信元(カンマ区切り)、`ENABLE_DEBUG_ROUTES` は
閾値調整用のデバッグAPIの有効化、`MOCK_GEMINI` はGeminiを呼ばない確認モードの切り替えです。
いずれも省略可能で、未設定時はそれぞれ localhost:5173 のみ許可・デバッグAPI無効・通常鑑定になります。

キーは [Google AI Studio](https://aistudio.google.com/apikey) で取得します。
`.env` はGit管理から除外しています。キーをReactのコードや `VITE_` 環境変数に入れないでください。
設定後、依存パッケージを再インストールしてFastAPIを再起動してください。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

写真を送ると、FastAPIがまず `appraisal.py` の `appraise()` で画素からレア度・属性・能力値を算出し、
その結果をGeminiへの依頼に含めて伝承を創作させ、検証・保存して返します。
`appraise()` はLLMを使わず、画像処理だけで完結します(同じ写真なら必ず同じ結果になります)。
成功レスポンスには `evaluation` が追加されます。

```json
{
  "evaluation": {
    "name": "紅蓮の聖杯",
    "name_parts": [
      { "text": "紅蓮", "reading": "ぐれん" },
      { "text": "の", "reading": "" },
      { "text": "聖杯", "reading": "せいはい" }
    ],
    "lore": "古代の王が使った架空の聖杯。",
    "lore_parts": [
      { "text": "古代", "reading": "こだい" },
      { "text": "の", "reading": "" },
      { "text": "王", "reading": "おう" }
    ],
    "rarity": 4,
    "element": "雷",
    "stats": { "attack": 70, "endurance": 41, "magic": 98 },
    "analysis": {
      "y": 0.6164,
      "i": 0.0694,
      "q": -0.0033,
      "saturation": 0.0694,
      "hueAngle": 357.94
    },
    "colorMap": {
      "points": [[-0.063, -0.022, "#e4ffff"], [-0.045, 0.009, "#a0abba"]],
      "clusters": [
        { "i": 0.1489, "q": -0.0054, "share": 0.5084, "dominant": true },
        { "i": -0.0037, "q": 0.0072, "share": 0.0925, "dominant": false },
        { "i": 0.0798, "q": -0.0116, "share": 0.3992, "dominant": false }
      ]
    }
  }
}
```

`rarity`(1〜5)・`element`(火・水・木・雷)・`stats`(攻撃・耐久・魔力、いずれも0〜100)は
すべて `appraisal.py` の画像解析で決まる値で、Geminiの応答では上書きしません。
Geminiに返させるのは `name_parts`・`lore_parts` の2つだけです。
`name_parts` と `lore_parts` は漢字に読み仮名を振るための分割で、FastAPIが各 `text` を連結して
`name`・`lore` を組み立てます。そのため、Geminiに本文とpartsを重複して生成させません。
`analysis` は判定の根拠となった数値で、フロントエンドの解析値表示に使います。
`colorMap` はカード裏面の色相図を描くためのデータです。`points` は対象領域から一様に間引いた
画素240個の `[I, Q, 色]`、`clusters` は属性判定に使ったk-meansの3クラスタで、`share` は
彩度合計の割合(円の大きさ)、`dominant` が属性を決めたクラスタです。同じ写真なら毎回同じ値になります。
判定の閾値は `appraisal.py` 冒頭の定数で調整できます。

Reactは `/result` に移動して写真と鑑定コメントを表示します。
人物は目に見える服装やポーズを観察し、守護者や継承者として物語に登場させます。
鑑定失敗時は画像を保存せず、Reactにエラー理由を返します。APIキー未設定は503、
利用上限は429、タイムアウトは504、Geminiの接続・応答エラーは502です。
結果は画面遷移時の状態で保持し、履歴の永続保存は行っていません。

## ステータスの算出方法

`appraise()` は写真を8x8ブロックに分けてDCTにかけ、高周波成分を間引いた画像(JPEG相当の劣化)を
鑑定対象にします。3つのステータスは、それぞれ次の特徴量から求めます。

| ステータス | 元にする特徴量 | 高くなる写真 |
| --- | --- | --- |
| 攻撃 | 輝度のエッジ密度(Sobel) | 輪郭や模様がくっきり細かい |
| 耐久 | DCTで捨てた高周波成分の割合の低さ | 表面がなめらかでざらつきがない |
| 魔力 | 彩度(I・Q平面の原点からの距離) | 色が鮮やか |

耐久だけはDCTの係数から求めます。輝度の分散を使うと影や照明のむらまで拾ってしまい
「光の当たり方が悪いだけで脆い」という判定になるためです。ブロック単位のDCTなら緩やかな
明暗差は各ブロックのDC成分に吸収されるので、表面そのもののざらつきだけを見られます。
また捨てた成分は劣化後の画像に含まれないため、攻撃(エッジ密度)とは独立した値になります。

3つとも0〜100に正規化したあと、レア度による補正(レア度1で0.62倍〜レア度5で1.10倍)を掛け、
`STAT_MAX_VALUE`(100)でクランプします。正規化の基準値 `EDGE_MAX`・`LOSS_MAX`・`SAT_MAX` は
実写真での実測分布に合わせた値で、`/debug/stat-constants` で調整できます。

## Geminiを使わない確認モード

`backend/.env`に次を設定してFastAPIを再起動すると、Gemini APIを呼ばず
`mock_gemini.py`の固定テンプレートを返します。APIキーや利用枠を使わずに結果画面を確認できます。

```dotenv
MOCK_GEMINI=true
```

通常の鑑定へ戻すときは`false`にしてFastAPIを再起動します。未設定時も`false`です。

```dotenv
MOCK_GEMINI=false
```

API仕様: [画像の理解](https://ai.google.dev/gemini-api/docs/image-understanding)、
[GenerateContent](https://ai.google.dev/api/generate-content)。

Python 3.10以上を使用します。プロジェクトの `hakkutu` フォルダから実行してください。

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

別のターミナルでフロントを `npm run dev` で起動し、撮影後に「この写真を鑑定する」を押すと送信されます。
フロントの既存の送信処理はそのまま使用できます。

## API

- `POST http://localhost:8000/upload`
- リクエスト: `multipart/form-data` の `file` フィールド
- 対応画像: PNG、JPEG、WebP（10MiB以下）
- 保存先: `backend/uploads/`。UUIDのファイル名で保存します。
- CORS許可: `http://localhost:5173` と `http://127.0.0.1:5173`

成功時はHTTP 201と次のJSONを返します。

```json
{
  "message": "写真を受け取りました",
  "photo_id": "生成されたUUID",
  "filename": "生成されたUUID.png",
  "content_type": "image/png",
  "size": 12345,
  "width": 900,
  "height": 1200
}
```

空ファイル・破損画像は400、サイズ超過は413、未対応の画像形式は415、
`file` フィールドがない場合は422を返します。エラー理由はJSONの `detail` に入ります。
Geminiの鑑定結果は `evaluation` に入ります。

手動確認は [Swagger UI](http://localhost:8000/docs) または次のコマンドで行えます。

```powershell
curl.exe -X POST http://localhost:8000/upload -F "file=@photo.png"
```

実装で使用するファイル受信とCORSの説明: [FastAPI公式ドキュメント](https://fastapi.tiangolo.com/tutorial/request-files/)、[CORS](https://fastapi.tiangolo.com/tutorial/cors/)。

## 閾値調整用のデバッグAPI

`appraisal.py` の閾値を調整するための開発用エンドポイントです。本番のフロントからは使用しません。
`backend/.env` に `ENABLE_DEBUG_ROUTES=true` を設定しないと登録されません(未設定時は無効)。

### 鑑定結果と根拠画像

- `POST http://localhost:8000/debug/appraise`
- リクエスト: `multipart/form-data` の `file` フィールド(`/upload` と同じ)

Geminiを呼ばずに画像解析だけを実行し、判定結果と、判定の根拠を確認できる画像のURLを返します。

```json
{
  "rarity": 4,
  "element": "雷",
  "luminance_ratio": 1.0882,
  "saturation": 0.0694,
  "hue_angle": 357.94,
  "attack": 70,
  "endurance": 41,
  "magic": 98,
  "edge_density": 0.1928,
  "detail_loss_ratio": 0.0431,
  "y": 0.6164,
  "i": 0.0694,
  "q": -0.0033,
  "visualization_url": "/debug/visualization/87efcb10....png"
}
```

`visualization_url` をブラウザで開くと、次の4枚が2×2で並んだ画像を確認できます。

- `DCT-degraded RGB + subject area`: DCT劣化後の画像と、対象領域として使った円(白い輪郭)
- `Y (luminance)`: 明るさ。`luminance_ratio` は円の内側の平均を全体の平均で割った値
- `I (orange <-> cyan)`: 橙が正、水色が負
- `Q (purple <-> green)`: 紫が正、黄緑が負

`hue_angle` は属性を決めた色相の角度で、`ELEMENT_SECTORS` のどの区間に入るかで属性が決まります。
対象領域の画素をI・Q平面上でk-meansにかけ、彩度の合計が最大のクラスタ(=最も目立つ色)から求めます。
単純平均だと多色の物体で色が打ち消し合い不安定になるため、この方式を使っています。
確認用画像は `backend/debug_images/` に溜まります(Git管理外)。不要になったらフォルダごと削除してください。

```powershell
curl.exe -X POST http://localhost:8000/debug/appraise -F "file=@photo.png"
```

### ステータスの正規化前の値

- `POST http://localhost:8000/debug/stat-constants`
- リクエスト: `multipart/form-data` の `file` フィールド

`EDGE_MAX`・`LOSS_MAX`・`SAT_MAX` を調整するためのエンドポイントです。
生の特徴量と、それを正規化した値(レア度補正は含まない)、現在の定数を並べて返します。

```json
{
  "raw": {
    "edge_density": 0.1928,
    "detail_loss_ratio": 0.0431,
    "saturation": 0.0694
  },
  "normalized": { "attack": 71.4, "endurance": 41.8, "magic": 100.0 },
  "constants": { "EDGE_MAX": 0.27, "LOSS_MAX": 0.074, "SAT_MAX": 0.062 }
}
```

複数の写真で `raw` を集め、その中央値が `normalized` で50付近に来るよう定数を決めると、
特定のステータスだけが常に高い/低いという偏りを避けられます。

## テスト

`backend` フォルダで実行します。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest -v
```
