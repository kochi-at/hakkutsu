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
```

キーは [Google AI Studio](https://aistudio.google.com/apikey) で取得します。
`.env` はGit管理から除外しています。キーをReactのコードや `VITE_` 環境変数に入れないでください。
設定後、依存パッケージを再インストールしてFastAPIを再起動してください。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

写真を送ると、FastAPIがまず `appraisal.py` の `appraise()` で画素からレア度と属性を算出し、
その結果をGeminiへの依頼に含めて伝承を創作させ、検証・保存して返します。
成功レスポンスには `evaluation` が追加されます。

```json
{
  "evaluation": {
    "name": "紅蓮の聖杯",
    "origin_era": "灰燼暦の末期",
    "lore": "古代の王が使った架空の聖杯。",
    "stats": { "power": 92, "mystery": 70, "preservation": 55 },
    "rarity": 4,
    "element": "炎"
  }
}
```

`rarity`(1〜5)と `element`(炎・水・風・雷・闇・無)は画像解析で決まる値で、
Geminiの応答では上書きしません。Geminiに返させるのは `name`・`origin_era`・`lore`・`stats` のみです。
判定の閾値は `appraisal.py` 冒頭の定数で調整できます。

Reactは `/result` に移動して写真と鑑定コメントを表示します。
人物は目に見える服装やポーズを観察し、守護者や継承者として物語に登場させます。
鑑定失敗時は画像を保存せず、Reactにエラー理由を返します。APIキー未設定は503、
利用上限は429、タイムアウトは504、Geminiの接続・応答エラーは502です。
結果は画面遷移時の状態で保持し、履歴の永続保存は行っていません。

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

- `POST http://localhost:8000/debug/appraise`
- リクエスト: `multipart/form-data` の `file` フィールド(`/upload` と同じ)

Geminiを呼ばずに画像解析だけを実行し、判定結果と、判定の根拠を確認できる画像のURLを返します。

```json
{
  "rarity": 5,
  "element": "炎",
  "luminance_ratio": 1.666,
  "saturation": 0.141,
  "hue_angle": 15.7,
  "visualization_url": "/debug/visualization/87efcb10....png"
}
```

`visualization_url` をブラウザで開くと、次の4枚が2×2で並んだ画像を確認できます。

- `RGB + subject area`: 元画像と、対象領域として使った円(白い輪郭)
- `Y (luminance)`: 明るさ。`luminance_ratio` は円の内側の平均を全体の平均で割った値
- `I (orange <-> cyan)`: 橙が正、水色が負
- `Q (purple <-> green)`: 紫が正、黄緑が負

`hue_angle` は `atan2(Q, I)` を度に直した値で、`ELEMENT_SECTORS` のどの区間に入るかで属性が決まります。
`saturation` が `ACHROMATIC_SATURATION` 未満なら角度によらず「無」になります。
確認用画像は `backend/debug_images/` に溜まります(Git管理外)。不要になったらフォルダごと削除してください。

```powershell
curl.exe -X POST http://localhost:8000/debug/appraise -F "file=@photo.png"
```

## テスト

`backend` フォルダで実行します。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest -v
```
