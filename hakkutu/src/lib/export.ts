import type { RelicRecord } from '../../shared/schema';
import { loadImage } from './image';

export async function downloadCard(record: RelicRecord) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('鑑定書を保存できませんでした。');
  const lines: { value: string; y: number; font: string; color: string }[] = [];
  let y = 84;
  function text(value: string, size: number, color = '#282d25', serif = false) {
    const font = `${size}px ${serif ? 'serif' : 'sans-serif'}`;
    ctx!.font = font;
    let line = '';
    for (const character of value) {
      if (character === '\n' || ctx!.measureText(line + character).width > 756) {
        lines.push({ value: line, y, font, color }); y += size * 1.65;
        line = character === '\n' ? '' : character;
      } else line += character;
    }
    if (line) { lines.push({ value: line, y, font, color }); y += size * 1.65; }
  }
  text('聖遺物鑑定局  /  RELIC APPRAISAL BUREAU', 22, '#6e654e');
  y += 18;
  if (record.mode === 'demo') { text('お試し鑑定 — 写真を解析しないサンプルです', 21, '#90642c'); y += 12; }
  text(record.appraisal.name, 44, '#282d25', true);
  text(`${record.appraisal.rarity}  ·  ${record.appraisal.category}`, 26, '#886e3e'); y += 20;
  const image = await loadImage(record.image);
  const ratio = Math.min(756 / image.width, 440 / image.height);
  const w = image.width * ratio; const h = image.height * ratio;
  const imageY = y;
  y += 495;
  for (const [label, value] of [
    ['伝承', record.appraisal.lore], ['秘められた力', record.appraisal.ability],
    ['代償', record.appraisal.drawback], ['鑑定の根拠', record.appraisal.observedFeatures.join(' / ')],
    ['希少度の理由', record.appraisal.rarityReason], ['鑑定官のひとこと', record.appraisal.appraiserComment],
  ]) {
    text(label, 20, '#886e3e'); text(value, 25); y += 28;
  }
  text(`${new Date(record.createdAt).toLocaleDateString('ja-JP')} 発行 · 架空の伝説を楽しむ鑑定書`, 18, '#6e654e');
  const output = document.createElement('canvas'); output.width = 900; output.height = Math.ceil(y + 60);
  const out = output.getContext('2d')!;
  out.fillStyle = '#efeadb'; out.fillRect(0, 0, output.width, output.height);
  out.fillStyle = '#ded9ca'; out.fillRect(72, imageY, 756, 440);
  out.drawImage(image, 72 + (756 - w) / 2, imageY + (440 - h) / 2, w, h);
  for (const line of lines) { out.font = line.font; out.fillStyle = line.color; out.fillText(line.value, 72, line.y); }
  out.strokeStyle = '#b5a27c'; out.lineWidth = 2; out.strokeRect(30, 30, 840, output.height - 60);
  const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('鑑定書の画像を作成できませんでした。');
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `聖遺物鑑定書_${record.appraisal.name.replace(/[\\/:*?"<>|]/g, '_')}.png`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
