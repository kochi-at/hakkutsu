import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DigReveal from "../components/DigReveal";
import "./ResultPage.css";

const STAT_LABELS = { attack: "攻撃", endurance: "耐久", magic: "魔力" };

export default function ResultPage() {
  const { state } = useLocation();
  const evaluation = state?.evaluation;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [state]);

  const showReveal = Boolean(evaluation) && !revealed;

  return (
    <main className="relic-result">
      {!evaluation ? (
        <>
          <h1>まだ鑑定結果がありません</h1>
          <Link to="/CameraPage">写真を撮って鑑定する</Link>
        </>
      ) : showReveal ? (
        <DigReveal evaluation={evaluation} onComplete={() => setRevealed(true)} />
      ) : (
        <>
          <p className="relic-eyebrow">伝説の聖遺物 鑑定書</p>
          <h1>{evaluation.name}</h1>
          <p className="relic-name-reading">{evaluation.name_reading}</p>
          {state.photo && <img className="relic-photo" src={state.photo} alt="鑑定した写真" />}
          <p className="relic-score">
            <span
              className="relic-rarity"
              role="img"
              aria-label={`星評価 ${evaluation.rarity.toFixed(1)} / 5`}
            >
              <span className="relic-rarity-empty" aria-hidden="true">★★★★★</span>
              <span
                className="relic-rarity-filled"
                aria-hidden="true"
                style={{ width: `${(evaluation.rarity / 5) * 100}%` }}
              >
                ★★★★★
              </span>
            </span>
            <span className="relic-rarity-value">{evaluation.rarity.toFixed(1)}</span>
            <span className="relic-element">{evaluation.element}属性</span>
          </p>
          <section>
            <h2>語り継がれる伝説</h2>
            <p>{evaluation.lore}</p>
            <p className="relic-lore-reading">よみ：{evaluation.lore_reading}</p>
          </section>
          <section className="relic-stats">
            <h2>能力値</h2>
            {Object.entries(STAT_LABELS).map(([key, label]) => (
              <div className="relic-stat" key={key}>
                <span className="relic-stat-label">{label}</span>
                <span className="relic-stat-bar">
                  <span
                    className="relic-stat-fill"
                    style={{ width: `${Math.min(evaluation.stats[key], 100)}%` }}
                  />
                </span>
                <span className="relic-stat-value">{evaluation.stats[key]}</span>
              </div>
            ))}
          </section>
          <p className="relic-note">この鑑定は写真をもとにAIが作った架空の物語です。</p>
          <p className="relic-analysis">
            Y {evaluation.analysis.y.toFixed(2)} / I {evaluation.analysis.i.toFixed(2)} / Q {evaluation.analysis.q.toFixed(2)} / θ {Math.round(evaluation.analysis.hueAngle)}°
          </p>
          <nav><Link to="/CameraPage">別の写真を鑑定する</Link><Link to="/">ホームへ戻る</Link></nav>
        </>
      )}
    </main>
  );
}
