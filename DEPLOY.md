# デプロイ設定

このリポジトリは、FastAPIをRender、React/ViteをVercelへデプロイする構成です。

## 1. Render（FastAPI）

RenderでBlueprintを作成し、このリポジトリのルートにある `render.yaml` を使用します。
環境変数のうち、値の入力を求められる次の2項目を設定します。

- `GEMINI_API_KEY`: Google AI Studioで発行したAPIキー
- `FRONTEND_ORIGINS`: Vercelで発行されたURL（例: `https://example.vercel.app`）

VercelのURLがまだない場合は仮の値で作成し、Vercelのデプロイ後に更新します。
RenderのURLに `/health` を付け、`{"status":"ok"}` が返れば起動成功です。

## 2. Vercel（React）

GitHubリポジトリをVercelへインポートし、次を設定します。

- Root Directory: `hakkutu`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- 環境変数 `VITE_API_URL`: Renderで発行されたURL（末尾の `/` は不要）

デプロイ後、Vercelの本番URLをRenderの `FRONTEND_ORIGINS` に設定してRenderを再デプロイします。

## ローカル開発

環境変数を設定しなくても、Reactは `http://localhost:8000`、FastAPIは
`http://localhost:5173` と `http://127.0.0.1:5173` を使用します。
デバッグAPIが必要な場合だけ `backend/.env` に `ENABLE_DEBUG_ROUTES=true` を設定します。

`.env` とGemini APIキーはGitHubへpushしません。
