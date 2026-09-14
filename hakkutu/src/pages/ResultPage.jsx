import { Link, useLocation } from "react-router-dom";
import "./ResultPage.css";

export default function ResultPage() {
  const { state } = useLocation();
  const evaluation = state?.evaluation;

  return (
    <main className="relic-result">
      {!evaluation ? (
        <>
          <h1>まだ鑑定結果がありません</h1>
          <Link to="/CameraPage">写真を撮って鑑定する</Link>
        </>
      ) : (
        <>
          <p className="relic-eyebrow">伝説の聖遺物 鑑定書</p>
          <h1>{evaluation.relic_name}</h1>
          {state.photo && <img className="relic-photo" src={state.photo} alt="鑑定した写真" />}
          <p className="relic-score">ランク {evaluation.rarity} ・ {evaluation.score} / 100点</p>
          <section>
            <h2>写真に写っているもの</h2>
            <p>{evaluation.recognized_subject}</p>
          </section>
          <section>
            <h2>語り継がれる伝説</h2>
            <p>{evaluation.legend}</p>
          </section>
          <section>
            <h2>鑑定士のコメント</h2>
            <p>{evaluation.comment}</p>
          </section>
          <p className="relic-note">この鑑定は写真をもとにAIが作った架空の物語です。</p>
          <nav><Link to="/CameraPage">別の写真を鑑定する</Link><Link to="/">ホームへ戻る</Link></nav>
        </>
      )}
    </main>
  );
}
