import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import RelicCard from "../components/RelicCard";
import { deleteRelic } from "../lib/relicDb";
import "./ResultPage.css";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState("");
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
      <nav>
        <Link to="/CameraPage">別の写真を鑑定する</Link>
        <Link to="/collection">図鑑を見る</Link>
        <Link to="/">ホームへ戻る</Link>
        {state.fromCollection && state.relicId && (
          <button className="relic-delete-button" type="button" onClick={handleDelete}>図鑑から削除</button>
        )}
      </nav>
    </main>
  );
}
