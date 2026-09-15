import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRelics } from "../lib/relicDb";
import RelicCard from "../components/RelicCard";
import "./ResultPage.css";
import "./CollectionPage.css";

export default function CollectionPage() {
  const [relics, setRelics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    getRelics()
      .then((items) => {
        if (active) setRelics(items);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const openRelic = (relic) => {
    navigate("/result", {
      state: {
        photo: relic.photo,
        evaluation: relic.evaluation,
        relicId: relic.id,
        fromCollection: true,
      },
    });
  };

  return (
    <main className="collection-page">
      <header className="collection-header">
        <div>
          <p className="collection-eyebrow">発掘記録</p>
          <h1>聖遺物図鑑</h1>
        </div>
        <Link to="/">ホームへ戻る</Link>
      </header>

      {loading && <p className="collection-status">図鑑を読み込んでいます…</p>}
      {error && <p className="collection-error" role="alert">{error}</p>}

      {!loading && relics.length === 0 && (
        <section className="collection-empty">
          <p>まだ聖遺物が登録されていません。</p>
          <Link to="/CameraPage">最初の聖遺物を鑑定する</Link>
        </section>
      )}

      <section className="collection-grid" aria-label="保存した聖遺物">
        {relics.map((relic) => (
          <article className="collection-card" key={relic.id}>
            <div className="collection-card-preview">
              <RelicCard evaluation={relic.evaluation} photo={relic.photo} />
              <button className="collection-card-open" type="button" onClick={() => openRelic(relic)} aria-label={`${relic.evaluation.name}を大きく表示`} />
            </div>
            <footer className="collection-card-actions">
              <time dateTime={new Date(relic.createdAt).toISOString()}>{new Date(relic.createdAt).toLocaleString("ja-JP")}</time>
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}
