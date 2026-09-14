import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { BODY_LIMIT, handleAppraisal, publicConfig, type ServerConfig } from './server/appraise';

// The same server-side handler is used in local development and Vercel Functions.
function localApi(config: ServerConfig): Plugin {
  return {
    name: 'relic-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/api/config' && path !== '/api/appraise') return next();
        const send = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        };
        if (path === '/api/config') {
          if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'GETを使用してください。' }); }
          return send(200, publicConfig(config));
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POSTを使用してください。' }); }
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON形式で送信してください。' });
        const chunks: Buffer[] = []; let size = 0;
        try {
          for await (const chunk of req) {
            size += Buffer.byteLength(chunk);
            if (size > BODY_LIMIT) return send(413, { error: '画像が大きすぎます。' });
            chunks.push(Buffer.from(chunk));
          }
          let body: unknown;
          try { body = JSON.parse(Buffer.concat(chunks).toString()); }
          catch { return send(400, { error: '送信データを読み取れません。' }); }
          const result = await handleAppraisal(body, config, req.socket.remoteAddress ?? 'local', String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
          for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
          return send(result.status, result.body);
        } catch { return send(500, { error: '鑑定の受付に失敗しました。' }); }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), localApi({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, accessToken: env.APP_ACCESS_TOKEN })],
    server: { port: 5173, strictPort: true },
  };
});
