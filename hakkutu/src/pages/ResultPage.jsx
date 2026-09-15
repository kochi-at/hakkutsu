import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import RelicCard from "../components/RelicCard";
import DigReveal from "../components/DigReveal";
import { deleteRelic } from "../lib/relicDb";
import "./ResultPage.css";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 図鑑から開いたときだけ、鑑定時の演出をもう一度再生する
  const [showReveal, setShowReveal] = useState(Boolean(state?.fromCollection));
  const digRevealRef = useRef(null);
  const evaluation = state?.evaluation;

  const handleDelete = async () => {
    if (!state?.relicId) return;
    try {
      await deleteRelic(state.relicId);
      navigate("/collection", { replace: true });
    } catch (error) {
      setDeleteError(error.message);
    }
  };

  if (!evaluation) {
    return (
      <main className="relic-result">
        <h1>まだ鑑定結果がありません</h1>
        <Link to="/CameraPage">写真を撮って鑑定する</Link>
      </main>
    );
  }

  if (showReveal) {
    return (
      <main className="relic-result">
        <div className="relic-reveal-wrap">
          <DigReveal ref={digRevealRef} evaluation={evaluation} onComplete={() => setShowReveal(false)} />
          <button type="button" className="dig-reveal-skip" onClick={() => digRevealRef.current?.skip()}>
            スキップ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relic-result">
      {state.fromCollection && (
        <Link className="relic-back-button" to="/collection" aria-label="図鑑に戻る">
          <span aria-hidden="true">←</span> 図鑑に戻る
        </Link>
      )}
      <RelicCard evaluation={evaluation} photo={state.photo} />

      <p className="relic-note">この鑑定は写真をもとにAIが作った架空の伝説である...</p>
      {state.collectionSaved && <p className="relic-save-status">図鑑に保存しました。</p>}
      {state.collectionSaveError && <p className="relic-save-error" role="alert">{state.collectionSaveError}</p>}
      {deleteError && <p className="relic-save-error" role="alert">{deleteError}</p>}
      <p className="relic-analysis">
        Y {evaluation.analysis.y.toFixed(2)} / I {evaluation.analysis.i.toFixed(2)} / Q {evaluation.analysis.q.toFixed(2)} / θ {Math.round(evaluation.analysis.hueAngle)}°
      </p>
      {state.fromCollection ? (
        <nav className="relic-collection-nav">
          <Link className="relic-nav-secondary" to="/collection">図鑑を見る</Link>
          <Link className="relic-nav-home" to="/" aria-label="ホームへ戻る" title="ホームへ戻る">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11.5 12 4l8 7.5" />
              <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </Link>
          {state.relicId && (
            <button className="relic-delete-button" type="button" onClick={() => setConfirmingDelete(true)}>
              図鑑から削除
            </button>
          )}
        </nav>
      ) : (
        <nav>
          <Link className="relic-nav-primary" to="/CameraPage">別の写真を鑑定する</Link>
          <Link className="relic-nav-secondary" to="/collection">図鑑を見る</Link>
          <Link className="relic-nav-home" to="/" aria-label="ホームへ戻る" title="ホームへ戻る">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11.5 12 4l8 7.5" />
              <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </Link>
        </nav>
      )}

      {confirmingDelete && (
        <div className="relic-delete-overlay" onClick={() => setConfirmingDelete(false)}>
          <div
            className="relic-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="削除の確認"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="relic-delete-dialog-title">この聖遺物を図鑑から削除しますか?</p>
            <p className="relic-delete-dialog-body">この操作は取り消せません。</p>
            <div className="relic-delete-dialog-actions">
              <button type="button" className="relic-delete-cancel" onClick={() => setConfirmingDelete(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="relic-delete-confirm"
                onClick={() => {
                  setConfirmingDelete(false);
                  handleDelete();
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
