import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, CircleHelp, Diamond, ImagePlus, LoaderCircle, ScanLine, Sparkles, Trash2, Upload, X } from 'lucide-react';
import CameraCapture from './components/CameraCapture';
import RelicCard from './components/RelicCard';
import { useAppraisal } from './hooks/useAppraisal';
import { prepareImage } from './lib/image';
import { deleteRelic, getHistory, saveRelic } from './lib/history';
import { downloadCard } from './lib/export';
import { rarityNames, type Mode, type RelicRecord } from '../shared/schema';

const phases = ['残された気配を読み取っています', '失われた年代記をひもといています', '秘められた伝承を照合しています', '鑑定書をしたためています'];

function Sigil({ small = false }: { small?: boolean }) {
  return <div className={`sigil ${small ? 'sigil-small' : ''}`} aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="sigil-diamond" /><Sparkles className="sigil-star" strokeWidth={1} /><span className="sigil-mark mark-top">✦</span><span className="sigil-mark mark-bottom">✦</span><span className="sigil-mark mark-left">＋</span><span className="sigil-mark mark-right">＋</span></div>;
}

export default function App() {
  const [tab, setTab] = useState<'appraise' | 'history'>('appraise');
  const [image, setImage] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [mode, setMode] = useState<Mode>('demo');
  const [config, setConfig] = useState<{ aiAvailable: boolean; requiresAccessToken: boolean } | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [history, setHistory] = useState<RelicRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RelicRecord | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const modeTouched = useRef(false);
  const preparationLock = useRef(false);
  const section = useRef<HTMLElement>(null);
  const { loading, result, error: appraisalError, appraise, reset, cancel, setResult, clearError } = useAppraisal();
  const busy = loading || preparing;

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/config', { signal: controller.signal }).then(res => {
      if (!res.ok) throw new Error(); return res.json();
    }).then(value => {
      const next = { aiAvailable: value.aiAvailable === true, requiresAccessToken: value.requiresAccessToken === true };
      setConfig(next); if (next.aiAvailable && !modeTouched.current) setMode('ai');
    }).catch(() => { if (!controller.signal.aborted) setConfig({ aiAvailable: false, requiresAccessToken: false }); });
    void getHistory().then(setHistory).catch(() => setError('このブラウザでは図鑑を開けません。鑑定と画像保存は利用できます。'));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!loading) { setPhase(0); return; }
    const interval = window.setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 1700);
    return () => window.clearInterval(interval);
  }, [loading]);
  useEffect(() => { if (result && window.innerWidth < 900) section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [result]);
  useEffect(() => { if (deleteTarget) deleteDialog.current?.showModal(); }, [deleteTarget]);

  async function acceptFile(file?: File) {
    if (!file || loading || preparationLock.current) return;
    preparationLock.current = true; setPreparing(true); setError(''); setNotice('');
    try { const photo = await prepareImage(file); setCamera(false); setImage(photo); reset(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '画像を読み込めませんでした。'); }
    finally { setPreparing(false); preparationLock.current = false; if (fileInput.current) fileInput.current.value = ''; }
  }
  async function save() {
    if (!result || saving) return;
    setSaving(true); setError('');
    try { await saveRelic(result); setHistory(items => [result, ...items.filter(item => item.id !== result.id)]); setNotice('図鑑に収蔵しました。このブラウザでいつでも見返せます。'); }
    catch { setError('図鑑に保存できませんでした。空き容量をご確認ください。鑑定書の画像保存も利用できます。'); }
    finally { setSaving(false); }
  }
  async function download() {
    if (!result) return;
    try { await downloadCard(result); setNotice('鑑定書の画像を作成しました。ダウンロード先をご確認ください。'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '画像保存に失敗しました。'); }
  }
  function switchTab(next: 'appraise' | 'history') { if (!busy) { setCamera(false); setTab(next); setError(''); clearError(); setNotice(''); } }
  function openRecord(record: RelicRecord) { setImage(record.image); setMode(record.mode); setResult(record); setTab('appraise'); setNotice(''); setError(''); clearError(); }
  async function confirmDelete() {
    if (!deleteTarget) return;
    try { await deleteRelic(deleteTarget.id); setHistory(items => items.filter(item => item.id !== deleteTarget.id)); setNotice('図鑑から取り出しました。'); }
    catch { setError('削除できませんでした。もう一度お試しください。'); }
    deleteDialog.current?.close(); setDeleteTarget(null);
  }

  return <div className="app-shell">
    <header className="site-header"><a href="#" className="brand" onClick={event => { event.preventDefault(); switchTab('appraise'); }} aria-label="聖遺物鑑定局 鑑定室へ"><span className="brand-symbol"><Sparkles size={23} strokeWidth={1.3} /></span><span><strong>聖遺物鑑定局</strong><small>RELIC APPRAISAL BUREAU</small></span></a>
      <nav aria-label="メインメニュー"><button className={tab === 'appraise' ? 'nav-link active' : 'nav-link'} aria-current={tab === 'appraise' ? 'page' : undefined} disabled={busy} onClick={() => switchTab('appraise')}><ScanLine size={17} />鑑定室</button><button className={tab === 'history' ? 'nav-link active' : 'nav-link'} aria-current={tab === 'history' ? 'page' : undefined} disabled={busy} onClick={() => switchTab('history')}><BookOpen size={17} />収蔵庫<span className="count">{history.length}</span></button></nav>
      <button className="help-button" onClick={() => helpDialog.current?.showModal()}><CircleHelp size={18} /><span>ご利用案内</span></button>
    </header>

    <main>
      <div className="intro"><div><p className="eyebrow"><span />{tab === 'appraise' ? 'THE APPRAISAL CHAMBER' : 'YOUR PRIVATE COLLECTION'}</p><h1>{tab === 'appraise' ? <>その日常に、<em>伝説</em>を。</> : <>あなたの<em>聖遺物図鑑</em>。</>}</h1><p className="intro-copy">{tab === 'appraise' ? '見慣れた道具も、名もなき欠片も。写真一枚から、眠れる物語を読み解きます。' : '発見した伝説を、ここに。収蔵した鑑定書をいつでも読み返せます。'}</p></div><div className="edition"><Diamond size={18} strokeWidth={1} /><span>日常遺物研究室</span><small>EST. MMXXVI</small></div></div>
      {(error || appraisalError) && <div className="message error" role="alert"><span>{error || appraisalError}</span><button className="icon-button" onClick={() => { setError(''); clearError(); }} aria-label="エラーを閉じる"><X size={16} /></button></div>}
      {notice && <div className="message success" role="status"><Check size={17} /><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="通知を閉じる"><X size={16} /></button></div>}

      {tab === 'appraise' ? <>
        <div className="workspace">
          <section className="intake panel" aria-labelledby="intake-title"><div className="panel-heading"><span className="step-number">01</span><h2 id="intake-title">聖遺物を持ち込む</h2><span className="panel-meta">RECEPTION</span></div>
            <div className={`capture-area ${image ? 'has-image' : ''} ${loading ? 'is-reading' : ''} ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy && !camera) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy && !camera) void acceptFile(event.dataTransfer.files[0]); }}>
              {camera ? <CameraCapture onClose={() => setCamera(false)} onCapture={photo => { setImage(photo); setCamera(false); reset(); setError(''); }} />
                : image ? <><img src={image} className="photo-preview" alt="鑑定する物の写真" />{!busy && <button className="image-remove icon-button" aria-label="写真を取り消す" onClick={() => { setImage(null); reset(); }}><X size={18} /></button>}<span className="photo-caption"><ScanLine size={14} />{loading ? '鑑定中' : '鑑定対象を確認'}</span></>
                : <div className="empty-capture"><Sigil /><p className="capture-title">ここに、まだ見ぬ秘宝を。</p><p className="capture-hint">カメラで撮影するか、写真を選んでください</p><span className="drop-hint">ドラッグ＆ドロップにも対応</span></div>}
              {preparing && <div className="reading-overlay"><LoaderCircle className="spin" size={30} /><p>写真を整えています…</p></div>}
              {loading && <div className="reading-overlay"><Sigil small /><p role="status">{phases[phase]}</p><span>{mode === 'demo' ? 'サンプルの鑑定書を準備しています' : '写真から、伝説を読み解いています'}</span><button className="text-button" onClick={cancel}>鑑定を中止</button></div>}
              <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
            </div>
            <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event => void acceptFile(event.target.files?.[0])} aria-label="鑑定する画像を選択" tabIndex={-1} />
            <div className="capture-actions"><button className="button secondary" disabled={busy} onClick={() => { setCamera(true); setError(''); }}><Camera size={18} />カメラを開く</button><button className="button secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={18} />画像を選択</button></div>
            <div className="mode-row"><span className="field-label">鑑定方法</span><div className="mode-switch" role="group" aria-label="鑑定方法"><button aria-pressed={mode === 'demo'} disabled={busy} className={mode === 'demo' ? 'selected' : ''} onClick={() => { modeTouched.current = true; setMode('demo'); }}>お試し</button><button aria-pressed={mode === 'ai'} disabled={busy} className={mode === 'ai' ? 'selected' : ''} onClick={() => { modeTouched.current = true; setMode('ai'); }}><Sparkles size={14} />AI鑑定</button></div></div>
            <p className="mode-description">{mode === 'demo' ? '写真を外部に送信せず、固定の鑑定サンプルで体験できます。' : config?.aiAvailable ? '写真をAIに送り、見た目の特徴から伝説を創作します。' : config === null ? 'AI鑑定の準備状況を確認しています…' : 'AI鑑定は未設定です。まずは「お試し」で体験できます。'}</p>
            {mode === 'ai' && config?.requiresAccessToken && <label className="token-field">鑑定局の合言葉<input type="password" autoComplete="off" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="運営者から受け取った合言葉" disabled={busy} /></label>}
            <button className="button primary appraise-button" disabled={!image || busy || camera || (mode === 'ai' && (!config?.aiAvailable || (config.requiresAccessToken && !accessToken)))} onClick={() => { if (image) { setNotice(''); setError(''); void appraise(image, mode, accessToken); } }}>{loading ? <LoaderCircle className="spin" size={19} /> : <Sparkles size={19} />}<span>{loading ? '伝説を読み解いています' : mode === 'demo' ? 'お試し鑑定をはじめる' : '聖遺物を鑑定する'}</span>{!loading && <ArrowRight size={19} />}</button>
            <p className="intake-note">{image ? '写真の向きや被写体を確認してから鑑定してください。' : '明るい場所で、物をひとつ大きく写すのがおすすめです。'}</p>
          </section>

          <section className="result-section" aria-labelledby="result-label" ref={section}><div className="panel-heading result-label"><span className="step-number">02</span><h2 id="result-label">伝説を読み解く</h2><span className="panel-meta">APPRAISAL</span></div>
            {result ? <RelicCard record={result} saved={history.some(item => item.id === result.id)} saving={saving} onSave={() => void save()} onDownload={download} /> : <div className={`empty-result ${loading ? 'waiting' : ''}`}><div className="certificate-top"><span>APPRAISAL CERTIFICATE</span><span>— — —</span></div><div className="empty-result-body"><div className="empty-icon"><BookOpen size={39} strokeWidth={1} /></div><p className="empty-eyebrow">EVERY OBJECT HAS A STORY</p><h3>{loading ? 'まもなく、伝説が目を覚ます。' : 'まだ、名もなき秘宝。'}</h3><p>{loading ? '鑑定が終わると、ここに鑑定書が届きます。' : <>あなたの発見を、お待ちしています。<br />物に眠る名前、力、そして物語。<br />鑑定ののち、そのすべてが明らかに。</>}</p><div className="unrevealed-fields"><span>真名</span><span>希少度</span><span>伝承</span><span>能力</span></div></div><div className="empty-certificate-foot"><span>✦</span> 聖遺物鑑定局 公認 <span>✦</span></div></div>}
          </section>
        </div>
        <div className="rarity-guide"><div><Diamond size={19} /><span>伝説の希少度</span></div><div className="rarity-scale">{(['N', 'R', 'SR', 'SSR', 'UR'] as const).map((rarity, i) => <span className={`rarity-step rarity-${rarity}`} key={rarity}><strong>{rarity}</strong><small>{rarityNames[rarity]}</small>{i < 4 && <ChevronRight size={13} />}</span>)}</div><p>ありふれた物にも、唯一の物語がある。</p></div>
      </> : <section className="collection" aria-label="収蔵した聖遺物"><div className="collection-heading"><span>{history.length} 点の聖遺物</span><span>このブラウザに保存されています</span></div>
        {history.length ? <div className="collection-grid">{history.map(record => <article key={record.id} className={`collection-card rarity-${record.appraisal.rarity}`}><button className="collection-open" onClick={() => openRecord(record)}><div className="collection-image"><img src={record.image} alt={record.appraisal.name} /><span className="collection-rarity">{record.appraisal.rarity}</span>{record.mode === 'demo' && <span className="collection-demo">お試し</span>}</div><div className="collection-text"><span>{record.appraisal.category}</span><h2>{record.appraisal.name}</h2><p>{record.appraisal.ability}</p><span className="open-certificate">鑑定書を開く <ArrowRight size={16} /></span></div></button><div className="collection-footer"><time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleDateString('ja-JP')}</time><button className="icon-button" aria-label={`${record.appraisal.name}を図鑑から削除`} onClick={() => setDeleteTarget(record)}><Trash2 size={17} /></button></div></article>)}</div>
          : <div className="empty-collection"><BookOpen size={45} strokeWidth={1} /><h2>最初の一品を、収蔵しましょう。</h2><p>鑑定書の「図鑑に収める」から、ここに保存できます。</p><button className="button primary" onClick={() => switchTab('appraise')}><ImagePlus size={18} />聖遺物を鑑定する<ArrowRight size={18} /></button></div>}
      </section>}
    </main>

    <footer><span>✦ 聖遺物鑑定局</span><p>この鑑定は、架空の伝説を楽しむためのものです。</p><small>THE ORDINARY, REIMAGINED.</small></footer>

    <dialog ref={helpDialog} className="help-dialog" onClick={e => { if (e.target === e.currentTarget) helpDialog.current?.close(); }}><div className="dialog-content"><button className="icon-button dialog-close" onClick={() => helpDialog.current?.close()} aria-label="案内を閉じる"><X size={22} /></button><p className="eyebrow">A GUIDE FOR EXPLORERS</p><h2>鑑定局へようこそ。</h2><ol><li><strong>身近な物を、一枚。</strong><p>カメラで撮影するか、保存済みの画像を選びます。明るい場所で、物が大きく写るように。</p></li><li><strong>眠れる伝説を、読み解く。</strong><p>「AI鑑定」は写真を外部AIに送信して創作します。「お試し」は画像解析をせず、固定のサンプルを表示します。</p></li><li><strong>発見を、手元に。</strong><p>「図鑑に収める」でこのブラウザに保存。「画像保存」で鑑定書を持ち出せます。ブラウザのデータを消すと図鑑も消えます。</p></li></ol><p className="guide-note">JPEG・PNG・WebPに対応。HEICはブラウザが読める場合のみ変換します。撮影はHTTPSまたはlocalhostで利用できます。</p><button className="button primary" onClick={() => helpDialog.current?.close()}>鑑定室に戻る<ArrowRight size={18} /></button></div></dialog>
    <dialog ref={deleteDialog} className="help-dialog" onCancel={() => setDeleteTarget(null)} onClose={() => setDeleteTarget(null)}><div className="dialog-content"><h2>図鑑から取り出しますか？</h2><p>「{deleteTarget?.appraisal.name}」の保存された写真と鑑定結果を、このブラウザの図鑑から削除します。</p><div className="capture-actions"><button className="button secondary" onClick={() => { deleteDialog.current?.close(); setDeleteTarget(null); }}><ArrowLeft size={16} />戻る</button><button className="button primary" onClick={() => void confirmDelete()}><Trash2 size={16} />削除する</button></div></div></dialog>
  </div>;
}
