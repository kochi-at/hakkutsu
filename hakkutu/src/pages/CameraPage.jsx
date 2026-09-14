import { useState } from "react";
import Camera from "./Camera";

function CameraPage({ onBack }) {
  const [photo, setPhoto] = useState(null);

  const handleCapture = (imageData) => {
    setPhoto(imageData);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px",
        boxSizing: "border-box",
        backgroundColor: "#060606",
      }}
    >
      <button
        onClick={onBack}
        style={{
          marginBottom: "20px",
          padding: "8px 16px",
          cursor: "pointer",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        ホームに戻る
      </button>


      {!photo ? (
        <Camera onCapture={handleCapture} />
      ) : (
        <div>
          <img
            src={photo}
            alt="撮影した写真"
            style={{
              width: "140%",
              maxWidth: "700px",
              borderRadius: "12px",
            }}
          />

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <button
              onClick={() => setPhoto(null)}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              撮り直す
            </button>

            <button
              onClick={() => {
                console.log("この写真を使用:", photo);
              }}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              この写真を使う
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraPage;