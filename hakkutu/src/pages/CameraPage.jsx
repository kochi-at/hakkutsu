import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Camera from "./Camera";
import DigReveal from "../components/DigReveal";
import "./CameraPage.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function CameraPage({ onBack }) {
  const [photo, setPhoto] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [evaluationForReveal, setEvaluationForReveal] = useState(null);
  const navigate = useNavigate();

  const handleCapture = (imageData) => {
    setPhoto(imageData);
  };

  const sendPhoto = async () => {
    if (!photo) {
      return false;
    }

    try {
      // dataURL を Blob に変換
      const response = await fetch(photo);
      const blob = await response.blob();

      // FastAPIへ送るデータを作成
      const formData = new FormData();
      formData.append("file", blob, "photo.png");

      // FastAPIへ送信
      const result = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await result.json();
      if (!result.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "写真の鑑定に失敗しました");
      }

      console.log("FastAPIからの返答:", data);

      return data;
    } catch (error) {
      console.error("送信エラー:", error);
      setError(error.message === "Failed to fetch" ? "サーバーに接続できません。FastAPIが起動しているか確認してください。" : error.message);

      return false;
    }
  };

  const handleUsePhoto = async () => {
    if (isSending) return;
    setIsSending(true);
    setError("");
    setEvaluationForReveal(null);
    const data = await sendPhoto();
    setIsSending(false);
    if (data) {
      // 鑑定結果が届いたので、待機中だったDigRevealをフラッシュ以降へ進める
      setEvaluationForReveal(data.evaluation);
    }
  };

  const handleRevealComplete = () => {
    navigate("/result", {
      state: {
        photo,
        evaluation: evaluationForReveal,
      },
    });
  };

  return (
    <main className="camera-page">
      <button
        disabled={isSending}
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
        <div
          style={{
            width: "100%",
            maxWidth: "430px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <Camera onCapture={handleCapture} />
          {error && <p role="alert" style={{ color: "#ffaaaa" }}>{error}</p>}
        </div>
      ) : isSending || evaluationForReveal ? (
        <DigReveal evaluation={evaluationForReveal} onComplete={handleRevealComplete} />
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: "700px",
            textAlign: "center",
          }}
        >
          <img
            src={photo}
            alt="撮影した写真"
            style={{
              width: "100%",
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
              onClick={() => { setPhoto(null); setError(""); }}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              撮り直す
            </button>

            <button
              onClick={handleUsePhoto}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              この写真を鑑定する
            </button>
          </div>
          {error && <p role="alert" style={{ color: "#ffaaaa", marginTop: "16px" }}>{error}</p>}
        </div>
      )}
    </main>
  );
}

export default CameraPage;
