import { useEffect, useRef, useState } from "react";
import "./Camera.css";

function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [error, setError] = useState("");

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setError("カメラを起動できませんでした。");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }
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
              onClick={takePhoto}
              style={{
                padding: "12px 30px",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              撮影
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "12px 30px",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ファイルから選択
            </button>
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