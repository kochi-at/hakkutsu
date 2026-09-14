import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BODY_LIMIT, getConfig, handleAppraisal } from '../server/appraise';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POSTで送信してください。' }); }
  if (!String(req.headers['content-type']).startsWith('application/json')) return res.status(415).json({ error: 'JSON形式で送信してください。' });
  if (Number(req.headers['content-length']) > BODY_LIMIT || Buffer.byteLength(JSON.stringify(req.body ?? null)) > BODY_LIMIT) return res.status(413).json({ error: '画像が大きすぎます。' });
  const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
  const ip = String(req.headers['x-vercel-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0];
  const result = await handleAppraisal(req.body, getConfig(), ip, token);
  for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
  return res.status(result.status).json(result.body);
}
