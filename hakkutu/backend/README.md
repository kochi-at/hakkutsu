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

写真を送ると、FastAPIがGeminiへ画像を送信し、結果を検証・保存して返します。
成功レスポンスには `evaluation` が追加されます。

```json
{
  "evaluation": {
    "recognized_subject": "赤いコップ",
    "relic_name": "紅蓮の聖杯",
    "rarity": "SS",
    "score": 92,
    "legend": "古代の王が使った架空の聖杯。",
    "comment": "この赤い輝きは炎の魔力を秘めているに違いない。"
  }
}
```

Reactは `/result` に移動して写真と鑑定コメントを表示します。
人物は目に見える服装やポーズを観察し、守護者や継承者として物語に登場させます。
鑑定失敗時は画像を保存せず、Reactにエラー理由を返します。APIキー未設定は503、
利用上限は429、タイムアウトは504、Geminiの接続・応答エラーは502です。
結果は画面遷移時の状態で保持し、履歴の永続保存は行っていません。

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

## テスト

`backend` フォルダで実行します。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest -v
```
