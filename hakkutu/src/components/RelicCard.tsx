import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Download, Feather, Sparkles, TriangleAlert } from 'lucide-react';
import { rarityNames, type RelicRecord } from '../../shared/schema';

export default function RelicCard({ record, saved, saving, onSave, onDownload }: {
  record: RelicRecord; saved: boolean; saving: boolean; onSave: () => void; onDownload: () => Promise<void>;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [record.id]);
  const a = record.appraisal;
  return <article className={`relic-card rarity-${a.rarity}`}>
    <div className="certificate-top"><span>OFFICIAL APPRAISAL</span><span>No. {record.id.slice(0, 8).toUpperCase()}</span></div>
    {record.mode === 'demo' && <p className="demo-stamp">お試し鑑定 · 写真を解析しないサンプルです</p>}
    <div className="relic-heading"><div><p className="category">{a.category}</p><h2 ref={title} tabIndex={-1}>{a.name}</h2></div>
      <div className="rarity-seal"><strong>{a.rarity}</strong><span>{rarityNames[a.rarity]}</span></div></div>
    <div className="certificate-rule"><span>✦</span></div>
    <section className="lore"><h3>受け継がれし伝承</h3><p>{a.lore}</p></section>
    <div className="powers"><section><h3><Sparkles size={16} />秘められた力</h3><p>{a.ability}</p></section><section><h3><TriangleAlert size={16} />その代償</h3><p>{a.drawback}</p></section></div>
    <section className="evidence"><h3>鑑定の根拠</h3><div className="feature-list">{a.observedFeatures.map((feature, i) => <span key={i}>{feature}</span>)}</div><p>{a.rarityReason}</p></section>
    <blockquote><Feather size={20} /><div><p>{a.appraiserComment}</p><cite>聖遺物鑑定局・記録官</cite></div></blockquote>
    <div className="certificate-bottom"><span>{new Date(record.createdAt).toLocaleDateString('ja-JP')} 発行</span><span>鑑定局認証印 <span className="small-seal">認</span></span></div>
    <div className="result-actions"><button className="button ink" onClick={onSave} disabled={saved || saving}>{saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? '図鑑に収蔵済み' : saving ? '収蔵しています…' : '図鑑に収める'}</button>
      <button className="button paper" disabled={downloading} onClick={async () => { setDownloading(true); try { await onDownload(); } finally { setDownloading(false); } }}><Download size={17} />{downloading ? '作成中…' : '鑑定書を画像保存'}</button></div>
  </article>;
}
