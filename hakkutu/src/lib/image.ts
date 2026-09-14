const MAX_BYTES = 950_000;

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像を開けません。JPEG・PNG・WebPで選び直してください。'));
    image.src = src;
  });
}

export function canvasImage(canvas: HTMLCanvasElement): string {
  let quality = 0.86;
  let result = canvas.toDataURL('image/jpeg', quality);
  while ((result.length * 0.75) > MAX_BYTES && quality > 0.3) {
    quality -= 0.1;
    result = canvas.toDataURL('image/jpeg', quality);
  }
  if (result.length * 0.75 > MAX_BYTES) throw new Error('写真を小さくできませんでした。別の画像をお試しください。');
  return result;
}

export function resizeSource(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) throw new Error('カメラの準備ができていません。少し待って撮影してください。');
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('このブラウザでは画像を処理できません。');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasImage(canvas);
}

export async function prepareImage(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB以下の画像を選択してください。');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error('JPEG・PNG・WebPの写真を選択してください。');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return resizeSource(image, image.naturalWidth, image.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}
