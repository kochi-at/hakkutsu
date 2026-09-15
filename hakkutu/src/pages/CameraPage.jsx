import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Camera from "./Camera";
import DigReveal from "../components/DigReveal";
import { saveRelic } from "../lib/relicDb";
import "./CameraPage.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function CameraPage({ onBack }) {
  const [photo, setPhoto] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [evaluationForReveal, setEvaluationForReveal] = useState(null);
  const abortControllerRef = useRef(null);
  const saveStartedRef = useRef(false);
  const digRevealRef = useRef(null);
  const navigate = useNavigate();

  const handleCapture = (imageData) => {
    saveStartedRef.current = false;
    setPhoto(imageData);
  };

  const sendPhoto = async (signal) => {
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
        signal,
      });

      const data = await result.json();
      if (!result.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "写真の鑑定に失敗しました");
      }

      console.log("FastAPIからの返答:", data);

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        // ユーザーによるキャンセル。エラー表示はしない
        return false;
      }
      console.error("送信エラー:", error);
      setError(error.message === "Failed to fetch" ? "サーバーに接続できません。FastAPIが起動しているか確認してください。" : error.message);

      return false;
    }
  };

  const handleUsePhoto = async () => {
    if (isSending) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSending(true);
    setError("");
    setEvaluationForReveal(null);
    const data = await sendPhoto(controller.signal);
    setIsSending(false);
    if (data) {
      // 鑑定結果が届いたので、待機中だったDigRevealをフラッシュ以降へ進める
      setEvaluationForReveal(data.evaluation);
    }
  };

  const handleRevealComplete = async () => {
    if (saveStartedRef.current) return;
    saveStartedRef.current = true;

    let collectionSaved = false;
    let collectionSaveError = "";
    try {
      await saveRelic({ photo, evaluation: evaluationForReveal });
      collectionSaved = true;
    } catch (saveError) {
      console.error("図鑑への保存に失敗しました:", saveError);
      collectionSaveError = saveError.message;
    }

    navigate("/result", {
      state: {
        photo,
        evaluation: evaluationForReveal,
        collectionSaved,
        collectionSaveError,
      },
    });
  };

  const handleCancelReveal = () => {
    abortControllerRef.current?.abort();
    setIsSending(false);
    setEvaluationForReveal(null);
    saveStartedRef.current = false;
    setError("");
    setPhoto(null);
  };

  return (
    <main className="camera-page">
      <button
        className="camera-page-home-button"
        type="button"
        disabled={isSending}
        onClick={onBack}
        aria-label="ホームに戻る"
        title="ホームに戻る"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </button>

      {evaluationForReveal && (
        <button
          type="button"
          className="camera-page-skip-button"
          onClick={() => digRevealRef.current?.skip()}
          aria-label="演出をスキップ"
          title="演出をスキップ"
        >
          スキップ
        </button>
      )}

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
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: "700px",
            textAlign: "center",
          }}
        >
          <div className="camera-photo-frame">
            <img
              src={photo}
              alt="撮影した写真"
              style={{
                width: "100%",
                borderRadius: "12px",
              }}
            />
            {(isSending || evaluationForReveal) && (
              <div className="camera-dig-overlay">
                <DigReveal
                  ref={digRevealRef}
                  evaluation={evaluationForReveal}
                  onComplete={handleRevealComplete}
                  onCancel={handleCancelReveal}
                />
              </div>
            )}
          </div>

          {!(isSending || evaluationForReveal) && (
            <>
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
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default CameraPage;
