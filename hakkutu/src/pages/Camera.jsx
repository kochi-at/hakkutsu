import { useEffect, useRef, useState } from "react";
import "./Camera.css";

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 960;
const JPEG_QUALITY = 0.82;

function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const noisePreviewRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [noiseAmount, setNoiseAmount] = useState(30);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurAmount, setBlurAmount] = useState(30);
  const [colorEnabled, setColorEnabled] = useState(false);
  const [colorAmount, setColorAmount] = useState(30);
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);
  const [spotlightAmount, setSpotlightAmount] = useState(30);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      setError("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        if (active) {
          setCanSwitchCamera(cameras.length > 1);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError("カメラを起動できませんでした。");
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [facingMode]);

  useEffect(() => {
    const canvas = noisePreviewRef.current;
    if (!canvas || !noiseEnabled || noiseAmount === 0) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    const drawNoise = () => {
      const imageData = context.createImageData(canvas.width, canvas.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        const shade = Math.random() < 0.5 ? 0 : 255;
        imageData.data[index] = shade;
        imageData.data[index + 1] = shade;
        imageData.data[index + 2] = shade;
        imageData.data[index + 3] = 150;
      }
      context.putImageData(imageData, 0, 0);
    };

    drawNoise();
    const timer = window.setInterval(drawNoise, 90);
    return () => window.clearInterval(timer);
  }, [noiseEnabled, noiseAmount]);

  const switchCamera = () => {
    setFacingMode((current) => current === "environment" ? "user" : "environment");
  };

const applyNoise = (context, width, height) => {
  if (!noiseEnabled || noiseAmount === 0) {
    return;
  }

  const imageData = context.getImageData(0, 0, width, height);
  const strength = noiseAmount * 0.8;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const offset = (Math.random() * 2 - 1) * strength;
    imageData.data[index] += offset;
    imageData.data[index + 1] += offset;
    imageData.data[index + 2] += offset;
  }

  context.putImageData(imageData, 0, 0);
};

const applySpotlight = (context, width, height) => {
  if (!spotlightEnabled || spotlightAmount === 0) {
    return;
  }

  const strength = spotlightAmount / 100;
  const centerX = width / 2;
  const centerY = height / 2;
  const innerRadius = Math.min(width, height) * 0.2;
  const outerRadius = Math.hypot(width, height) / 2;

  context.save();
  const centerLight = context.createRadialGradient(
    centerX, centerY, 0, centerX, centerY, Math.min(width, height) * 0.48
  );
  centerLight.addColorStop(0, `rgba(255, 248, 218, ${0.38 * strength})`);
  centerLight.addColorStop(1, "rgba(255, 248, 218, 0)");
  context.fillStyle = centerLight;
  context.fillRect(0, 0, width, height);

  const edgeShade = context.createRadialGradient(
    centerX, centerY, innerRadius, centerX, centerY, outerRadius
  );
  edgeShade.addColorStop(0, "rgba(0, 0, 0, 0)");
  edgeShade.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  edgeShade.addColorStop(1, `rgba(0, 0, 0, ${0.58 * strength})`);
  context.fillStyle = edgeShade;
  context.fillRect(0, 0, width, height);
  context.restore();
};

const takePhoto = () => {
  const video = videoRef.current;

  if (!video) {
    return;
  }

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  if (videoWidth === 0 || videoHeight === 0) {
    return;
  }

  const targetRatio = 3 / 4;
  const videoRatio = videoWidth / videoHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (videoRatio > targetRatio) {
    // 元映像の方が横長
    // 左右を切り取る
    sourceWidth = videoHeight * targetRatio;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    // 元映像の方が縦長
    // 上下を切り取る
    sourceHeight = videoWidth / targetRatio;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  const canvas = document.createElement("canvas");

  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const blurRadius = blurEnabled ? blurAmount * 0.12 : 0;
  const saturation = colorEnabled ? 1 + colorAmount * 0.02 : 1;
  const blurPadding = Math.ceil(blurRadius * 2);
  context.filter = `blur(${blurRadius}px) saturate(${saturation})`;
  context.drawImage(
    video,

    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,

    -blurPadding,
    -blurPadding,
    canvas.width + blurPadding * 2,
    canvas.height + blurPadding * 2
  );
  context.filter = "none";

  applySpotlight(context, canvas.width, canvas.height);
  applyNoise(context, canvas.width, canvas.height);

  const imageData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  stopCamera();

  onCapture(imageData);
};

const handleFileSelect = async (event) => {
  const file = event.target.files?.[0];

  // 同じファイルを続けて選んでもchangeイベントが発火するようにリセットしておく。
  event.target.value = "";

  if (!file) {
    return;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, Math.max(OUTPUT_WIDTH, OUTPUT_HEIGHT) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("画像を処理できませんでした。");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    stopCamera();
    onCapture(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  } catch (fileError) {
    console.error(fileError);
    setError("ファイルを読み込めませんでした。");
  }
};

  return (
    <div className="camera">
      {error ? (
        <p>{error}</p>
      ) : (
        <>
          <div className="camera-filter-toolbar">
            <button
              className={`camera-noise-button${noiseEnabled ? " is-active" : ""}`}
              type="button"
              onClick={() => setNoiseEnabled((current) => !current)}
              aria-label={noiseEnabled ? "ノイズフィルタを解除" : "ノイズフィルタを使用"}
              aria-pressed={noiseEnabled}
              title="ノイズフィルタ"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6" cy="7" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="18" cy="8" r="1" />
                <circle cx="8" cy="13" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="5" cy="18" r="1" />
                <circle cx="12" cy="19" r="1" />
                <circle cx="19" cy="17" r="1" />
              </svg>
            </button>

            <button
              className={`camera-blur-button${blurEnabled ? " is-active" : ""}`}
              type="button"
              onClick={() => setBlurEnabled((current) => !current)}
              aria-label={blurEnabled ? "ぼかしフィルタを解除" : "ぼかしフィルタを使用"}
              aria-pressed={blurEnabled}
              title="ぼかしフィルタ"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.5c3 3.8 6.2 7.1 6.2 10.7A6.2 6.2 0 0 1 12 20.5a6.2 6.2 0 0 1-6.2-6.3C5.8 10.6 9 7.3 12 3.5z" />
                <path d="M9.2 15.2c.5 1.1 1.4 1.7 2.8 1.9" />
              </svg>
            </button>

            <button
              className={`camera-color-button${colorEnabled ? " is-active" : ""}`}
              type="button"
              onClick={() => setColorEnabled((current) => !current)}
              aria-label={colorEnabled ? "カラーフィルタを解除" : "カラーフィルタを使用"}
              aria-pressed={colorEnabled}
              title="カラーフィルタ"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="9" cy="9.5" r="1.5" />
                <circle cx="15" cy="9.5" r="1.5" />
                <circle cx="12" cy="15" r="1.5" />
              </svg>
            </button>

            <button
              className={`camera-spotlight-button${spotlightEnabled ? " is-active" : ""}`}
              type="button"
              onClick={() => setSpotlightEnabled((current) => !current)}
              aria-label={spotlightEnabled ? "スポットライトを解除" : "スポットライトを使用"}
              aria-pressed={spotlightEnabled}
              title="スポットライト"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
              </svg>
            </button>
          </div>

          <div className="camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                filter: `${blurEnabled ? `blur(${blurAmount * 0.12}px)` : ""} ${colorEnabled ? `saturate(${1 + colorAmount * 0.02})` : ""}`.trim() || "none",
              }}
            />
            {spotlightEnabled && spotlightAmount > 0 && (
              <div
                className="camera-spotlight-preview"
                style={{ "--spotlight-strength": spotlightAmount / 100 }}
                aria-hidden="true"
              />
            )}
            {noiseEnabled && noiseAmount > 0 && (
              <canvas
                ref={noisePreviewRef}
                className="camera-noise-preview"
                width="108"
                height="144"
                style={{ opacity: noiseAmount / 100 * 0.55 }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="camera-controls">
            <button
              className="camera-file-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="ファイルから選択"
              title="ファイルから選択"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="7" width="13" height="13" rx="2.5" />
                <path d="M4 15V6a2 2 0 0 1 2-2h9" />
              </svg>
            </button>

            <button
              className="camera-capture-button"
              onClick={takePhoto}
            >
              撮影
              <svg className="camera-capture-button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8h3l1.7-2.2a1 1 0 0 1 .8-.4h5a1 1 0 0 1 .8.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13.3" r="3.4" />
              </svg>
            </button>

            {canSwitchCamera && (
              <button
                className="camera-switch-button"
                type="button"
                onClick={switchCamera}
                aria-label={facingMode === "environment" ? "内カメラに切り替え" : "外カメラに切り替え"}
                title={facingMode === "environment" ? "内カメラに切り替え" : "外カメラに切り替え"}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7.5 7.5A6 6 0 0 1 18 11" />
                  <path d="m15.5 8.5 2.5 2.5 2.5-2.5" />
                  <path d="M16.5 16.5A6 6 0 0 1 6 13" />
                  <path d="m8.5 15.5-2.5-2.5-2.5 2.5" />
                </svg>
              </button>
            )}

          </div>

          {noiseEnabled && (
            <div className="camera-noise-settings">
              <label htmlFor="camera-noise-amount">
                ノイズ量
                <output>{noiseAmount}%</output>
              </label>
              <input
                id="camera-noise-amount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={noiseAmount}
                onChange={(event) => setNoiseAmount(Number(event.target.value))}
              />
            </div>
          )}

          {blurEnabled && (
            <div className="camera-blur-settings">
              <label htmlFor="camera-blur-amount">
                ぼかし量
                <output>{blurAmount}%</output>
              </label>
              <input
                id="camera-blur-amount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={blurAmount}
                onChange={(event) => setBlurAmount(Number(event.target.value))}
              />
            </div>
          )}

          {colorEnabled && (
            <div className="camera-color-settings">
              <label htmlFor="camera-color-amount">
                鮮やかさ
                <output>{colorAmount}%</output>
              </label>
              <input
                id="camera-color-amount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={colorAmount}
                onChange={(event) => setColorAmount(Number(event.target.value))}
              />
            </div>
          )}

          {spotlightEnabled && (
            <div className="camera-spotlight-settings">
              <label htmlFor="camera-spotlight-amount">
                スポットライト
                <output>{spotlightAmount}%</output>
              </label>
              <input
                id="camera-spotlight-amount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={spotlightAmount}
                onChange={(event) => setSpotlightAmount(Number(event.target.value))}
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </>
      )}
    </div>
  );
}

export default Camera;
