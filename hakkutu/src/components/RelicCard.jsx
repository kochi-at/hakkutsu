import { useState } from "react";
import ColorMapChart from "./ColorMapChart";
import { digTier } from "./digTier";

const STAT_LABELS = { attack: "攻撃", endurance: "耐久", magic: "魔力" };

const ELEMENT_ICON_PATHS = {
  火: "M12 2c2 4-3 5-3 9a3 3 0 006 0c0-1-.5-1.8-1-2 .3 1.6-1 2.4-2 1.4-.8-.8-.4-2 .4-2.8-2 .6-3.4 2.6-3.4 4.9a5 5 0 1010 0C19 8 12 6 12 2z",
  水: "M12 2c4 5 7 9 7 13a7 7 0 11-14 0c0-4 3-8 7-13z",
  木: "M4 20C4 10 12 4 20 4c0 10-8 16-16 16z",
  雷: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
};

const TIER_SPARKLE = {
  一般資料級: "none",
  貴重資料級: "sheen",
  重要文化財級: "sheen",
  国宝級: "holo",
};

function RubyText({ parts, fallback }) {
  if (!Array.isArray(parts)) return fallback;
  return parts.map((part, index) => part.reading ? (
    <ruby key={`${part.text}-${index}`}>
      {part.text}<rp>（</rp><rt>{part.reading}</rt><rp>）</rp>
    </ruby>
  ) : <span key={`${part.text}-${index}`}>{part.text}</span>);
}

function ElementIcon({ element, className }) {
  const d = ELEMENT_ICON_PATHS[element];
  if (!d) return null;
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function EnduranceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 5-3.2 8-7 9-3.8-1-7-4-7-9V6l7-3z" />
    </svg>
  );
}

function MagicIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
    </svg>
  );
}

function RarityStars({ rarity }) {
  return (
    <span className="relic-card-rarity" role="img" aria-label={`星評価 ${rarity.toFixed(1)} / 5`}>
      <span className="relic-card-rarity-stars">
        <span className="relic-card-rarity-empty" aria-hidden="true">★★★★★</span>
        <span className="relic-card-rarity-filled" aria-hidden="true" style={{ width: `${(rarity / 5) * 100}%` }}>
          ★★★★★
        </span>
      </span>
    </span>
  );
}

function SealIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
    </svg>
  );
}

function CardFooter({ tier, sparkle }) {
  return (
    <div className="relic-card-footer">
      <span className="relic-card-tier">{tier}</span>
      <span className={`relic-card-seal relic-card-seal--${sparkle}`} aria-hidden="true"><SealIcon /></span>
    </div>
  );
}

function CardFront({ evaluation, photo, tier, sparkle }) {
  return (
    <div className="relic-card-inner" data-element={evaluation.element}>
      <div className="relic-card-header">
        <span className="relic-card-badge">
          <span className="relic-card-badge-icon"><ElementIcon element={evaluation.element} /></span>
          {evaluation.element}属性
        </span>
        <RarityStars rarity={evaluation.rarity} />
      </div>

      <h1 className="relic-card-name"><RubyText parts={evaluation.name_parts} fallback={evaluation.name} /></h1>

      {photo && (
        <div className="relic-card-art" data-grayscale={evaluation.rarity === 1 ? "true" : undefined}>
          <img src={photo} alt="鑑定した写真" />
          {sparkle === "sheen" && <div className="relic-card-sheen" aria-hidden="true" />}
          {sparkle === "holo" && <><div className="relic-card-holo" aria-hidden="true" /><div className="relic-card-holo-grain" aria-hidden="true" /></>}
        </div>
      )}

      <div className="relic-card-stats">
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <div className="relic-card-stat" key={key}>
            <span className={`relic-card-stat-icon relic-card-stat-icon--${key}`}>
              {key === "attack" && <ElementIcon element={evaluation.element} />}
              {key === "endurance" && <EnduranceIcon />}
              {key === "magic" && <MagicIcon />}
            </span>
            <span className="relic-card-stat-label">{label}</span>
            <span className="relic-card-stat-bar"><span className="relic-card-stat-fill" style={{ width: `${Math.min(evaluation.stats[key], 100)}%` }} /></span>
            <span className="relic-card-stat-value">{evaluation.stats[key]}</span>
          </div>
        ))}
      </div>

      <div className="relic-card-lore">
        <p className="relic-card-lore-label">解説</p>
        <p className="relic-card-lore-text"><RubyText parts={evaluation.lore_parts} fallback={evaluation.lore} /></p>
      </div>

      <CardFooter tier={tier} sparkle={sparkle} />
    </div>
  );
}

function CardBack({ evaluation, tier, sparkle, chartKey }) {
  const { analysis, colorMap, element } = evaluation;
  const hueAngle = Math.round(analysis.hueAngle);

  return (
    <div className="relic-card-inner relic-card-back" data-element={element}>
      <div className="relic-card-header">
        <span className="relic-card-badge">
          <span className="relic-card-badge-icon"><ElementIcon element={element} /></span>
          計測記録
        </span>
        <span className="relic-card-back-angle">θ {hueAngle}°</span>
      </div>

      <h2 className="relic-card-back-title">色相星図</h2>
      <p className="relic-card-back-lead">写真の色を I・Q 平面に並べた図です。針の先が属性です。</p>

      <div className="relic-card-back-chart">
        {/* 初めて裏返すまで描画しない。裏返すたびにkeyが変わり、演出が最初から再生される。 */}
        {chartKey > 0 && (
          <ColorMapChart
            key={chartKey}
            colorMap={colorMap}
            hueAngle={analysis.hueAngle}
            element={element}
            rarity={evaluation.rarity}
          />
        )}
      </div>

      <ul className="relic-card-back-legend" data-rarity={evaluation.rarity}>
        <li><span className="relic-card-legend-mark relic-card-legend-mark--dot" aria-hidden="true" />写真の画素</li>
        <li><span className="relic-card-legend-mark relic-card-legend-mark--cluster" aria-hidden="true" />色のまとまり(大きいほど目立つ)</li>
        <li><span className="relic-card-legend-mark relic-card-legend-mark--needle" aria-hidden="true" />属性を決めた色相</li>
      </ul>

      <dl className="relic-card-back-readout">
        <div><dt>属性</dt><dd>{element}</dd></div>
        <div><dt>色相</dt><dd>{hueAngle}°</dd></div>
        <div><dt>彩度</dt><dd>{analysis.saturation.toFixed(3)}</dd></div>
        <div><dt>明るさ</dt><dd>{analysis.y.toFixed(2)}</dd></div>
      </dl>

      <CardFooter tier={tier} sparkle={sparkle} />
    </div>
  );
}

export default function RelicCard({ evaluation, photo, flippable = false }) {
  const tier = digTier(evaluation.rarity);
  const sparkle = TIER_SPARKLE[tier];
  const [flipped, setFlipped] = useState(false);
  const [chartKey, setChartKey] = useState(0);

  // 色相図のデータが無い(機能追加前に図鑑へ保存された)遺物は裏返せない。
  if (!flippable || !evaluation.colorMap) {
    return (
      <div className="relic-card" data-tier={tier}>
        <CardFront evaluation={evaluation} photo={photo} tier={tier} sparkle={sparkle} />
      </div>
    );
  }

  const toggle = () => {
    if (!flipped) setChartKey((key) => key + 1);
    setFlipped(!flipped);
  };

  return (
    <div className="relic-card-scene">
      {/* 一度も操作していない間は回転アニメーションを付けず、表示直後に勝手に回らないようにする。 */}
      <div className="relic-card-flipper" data-flipped={flipped} data-animate={chartKey > 0 || undefined} onClick={toggle}>
        <div className="relic-card relic-card-face relic-card-face--front" data-tier={tier} aria-hidden={flipped}>
          <CardFront evaluation={evaluation} photo={photo} tier={tier} sparkle={sparkle} />
          <span className="relic-card-glint" aria-hidden="true" />
        </div>
        <div className="relic-card relic-card-face relic-card-face--back" data-tier={tier} aria-hidden={!flipped}>
          <CardBack evaluation={evaluation} tier={tier} sparkle={sparkle} chartKey={chartKey} />
          <span className="relic-card-glint" aria-hidden="true" />
        </div>
      </div>
      <button className="relic-card-flip-button" type="button" onClick={toggle} aria-pressed={flipped}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" />
          <path d="M20 4v4.7h-4.7" />
          <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" />
          <path d="M4 20v-4.7h4.7" />
        </svg>
        {flipped ? "表に戻す" : "裏面の計測記録を見る"}
      </button>
    </div>
  );
}
