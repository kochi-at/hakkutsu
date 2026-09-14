import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig, publicConfig } from '../server/appraise';
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  return res.status(200).json(publicConfig(getConfig()));
}
