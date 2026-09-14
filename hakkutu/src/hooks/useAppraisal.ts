import { useEffect, useRef, useState } from 'react';
import { ValidatedAppraisalSchema, type Mode, type RelicRecord } from '../../shared/schema';
import { demoAppraisal } from '../lib/demo';

export function useAppraisal() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RelicRecord | null>(null);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function appraise(image: string, mode: Mode, accessToken: string) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setError(''); setLoading(true); setResult(null);
    const timeout = window.setTimeout(() => controller.abort('timeout'), 50_000);
    try {
      let appraisal = demoAppraisal;
      if (mode === 'demo') {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 2400);
          controller.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new Error('cancelled')); }, { once: true });
        });
      } else {
        const response = await fetch('/api/appraise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify({ image }), signal: controller.signal,
        });
        const data = await response.json().catch(() => { throw new Error('鑑定サービスに接続できません。サーバーの起動を確認してください。'); });
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '鑑定に失敗しました。');
        const parsed = ValidatedAppraisalSchema.safeParse(data.appraisal);
        if (!parsed.success) throw new Error('鑑定書を読み取れませんでした。もう一度お試しください。');
        appraisal = parsed.data;
      }
      if (!controller.signal.aborted) setResult({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode, image, appraisal });
    } catch (cause) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === 'timeout') setError('鑑定に時間がかかっています。もう一度お試しください。');
      } else setError(cause instanceof Error ? cause.message : '鑑定に失敗しました。');
    } finally { window.clearTimeout(timeout); active.current = null; setLoading(false); }
  }

  function reset() { setResult(null); setError(''); }
  function cancel() { active.current?.abort(); }
  return { loading, result, error, appraise, reset, cancel, setResult, clearError: () => setError('') };
}
