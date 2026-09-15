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
      <span className="relic-card-rarity-empty" aria-hidden="true">★★★★★</span>
      <span className="relic-card-rarity-filled" aria-hidden="true" style={{ width: `${(rarity / 5) * 100}%` }}>
        ★★★★★
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

export default function RelicCard({ evaluation, photo }) {
  const tier = digTier(evaluation.rarity);
  const sparkle = TIER_SPARKLE[tier];

  return (
    <div className="relic-card" data-tier={tier}>
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
          <div className="relic-card-art">
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

        <div className="relic-card-footer">
          <span className="relic-card-tier">{tier}</span>
          <span className={`relic-card-seal relic-card-seal--${sparkle}`} aria-hidden="true"><SealIcon /></span>
        </div>
      </div>
    </div>
  );
}
