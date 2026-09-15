import { useEffect, useRef, useState } from "react";
import "./Camera.css";

function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

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

  const switchCamera = () => {
    setFacingMode((current) => current === "environment" ? "user" : "environment");
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

  canvas.width = 900;
  canvas.height = 1200;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.drawImage(
    video,

    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,

    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = canvas.toDataURL("image/png");

  stopCamera();

  onCapture(imageData);
};

const handleFileSelect = (event) => {
  const file = event.target.files?.[0];

  // 同じファイルを続けて選んでもchangeイベントが発火するようにリセットしておく。
  event.target.value = "";

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    stopCamera();
    onCapture(reader.result);
  };

  reader.onerror = () => {
    setError("ファイルを読み込めませんでした。");
  };

  reader.readAsDataURL(file);
};

  return (
    <div className="camera">
      {error ? (
        <p>{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
                width: "100%",
                maxWidth: "430px",
                aspectRatio: "3 / 4",
                objectFit: "cover",
                borderRadius: "20px",
                backgroundColor: "black",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: "12px",
            }}
          >
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
