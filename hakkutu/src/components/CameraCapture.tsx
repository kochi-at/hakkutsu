import { useEffect, useRef, useState } from 'react';
import { Camera, LoaderCircle, X } from 'lucide-react';
import { resizeSource } from '../lib/image';

export default function CameraCapture({ onCapture, onClose }: { onCapture: (image: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; let stream: MediaStream | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('カメラを利用できません。HTTPSで開くか、画像選択をご利用ください。');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'カメラが許可されていません。ブラウザで許可するか、画像選択をご利用ください。'
          : cause instanceof DOMException && cause.name === 'NotFoundError'
          ? 'カメラが見つかりません。画像選択をご利用ください。'
          : cause instanceof Error ? cause.message : 'カメラを起動できませんでした。');
      }
    }
    void start();
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); };
  }, []);

  function takePhoto() {
    if (!video.current) return;
    try { onCapture(resizeSource(video.current, video.current.videoWidth, video.current.videoHeight)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '撮影に失敗しました。'); }
  }
  return <div className="camera-view">
    <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} aria-label="カメラのプレビュー" />
    <button className="icon-button camera-close" onClick={onClose} aria-label="カメラを閉じる"><X size={20} /></button>
    {error ? <div className="camera-message"><p role="alert">{error}</p><button className="button secondary" onClick={onClose}>画像選択に戻る</button></div>
      : <><div className="camera-frame" aria-hidden="true" />{!ready && <div className="camera-message"><LoaderCircle className="spin" /><p>カメラを準備しています</p></div>}
        <button className="shutter" onClick={takePhoto} disabled={!ready} aria-label="写真を撮る"><Camera size={28} /></button></>}
  </div>;
}
