import { useId } from "react";
import { digTier } from "./digTier";
import "./ColorMapChart.css";

// 実写真51枚の画素彩度のp99(0.174)付近。これより鮮やかな画素は外周に置く。
// カードごとに拡大率を変えると鮮やかさを比べられなくなるため、全カード共通の固定値にする。
const DISPLAY_SATURATION_MAX = 0.18;
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 120;
const LABEL_RADIUS = 146;

// バックエンドのELEMENT_SECTORSと同じ区切り。色はカード表面の属性色に揃える。
const SECTORS = [
  { element: "火", from: 0, to: 90, color: "#ff9466" },
  { element: "水", from: 90, to: 180, color: "#7fc4ff" },
  { element: "木", from: 180, to: 270, color: "#8fe07f" },
  { element: "雷", from: 270, to: 360, color: "#ffe066" },
];

const TICK_DEGREES = Array.from({ length: 24 }, (_, index) => index * 15);

// 粒の塗り方はカード外枠の格の色に揃える。カス級は表面の写真と同じく白黒にする。
const TIER_DOT_STYLE = {
  カス: "gray",
  ブロンズ: "bronze",
  シルバー: "silver",
  ゴールド: "gold",
  レジェンド: "rainbow",
};

// [暗い画素の色, 明るい画素の色]。元の画素の明るさで間を補間し、単色でも濃淡を残す。
const METAL_PALETTES = {
  gray: [[46, 46, 46], [242, 242, 242]],
  bronze: [[70, 32, 12], [236, 146, 84]],
  silver: [[61, 67, 74], [245, 248, 251]],
  gold: [[90, 61, 5], [255, 241, 179]],
};

function dotStyleFor(rarity) {
  return TIER_DOT_STYLE[digTier(rarity)];
}

function polar(radius, degrees) {
  const radians = (degrees * Math.PI) / 180;
  // SVGはy軸が下向きなので、Q+(90度)が上に来るよう反転する。
  return [radius * Math.cos(radians), -radius * Math.sin(radians)];
}

function toChart(i, q) {
  // 実写真の彩度は小さく中心に固まるため、距離だけ平方根で広げる。角度(=属性)は変えない。
  const radius = RADIUS * Math.sqrt(Math.min(Math.hypot(i, q) / DISPLAY_SATURATION_MAX, 1));
  return polar(radius, (Math.atan2(q, i) * 180) / Math.PI);
}

function sectorPath(from, to) {
  const [x0, y0] = polar(RADIUS, from);
  const [x1, y1] = polar(RADIUS, to);
  return `M0 0L${x0} ${y0}A${RADIUS} ${RADIUS} 0 0 0 ${x1} ${y1}Z`;
}

function metalFill(hex, [dark, light]) {
  const value = parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  // 真っ黒な画素も暗い盤面の上で見えるよう、明るさに下限を持たせる。
  const t = 0.25 + 0.75 * luminance;
  return `rgb(${dark.map((channel, index) => Math.round(channel + (light[index] - channel) * t)).join(",")})`;
}

// 虹は「粒がある向きの色」で塗る。I・Q平面のその向きの色をYIQ→RGBの逆変換で求め、色相だけを取り出す。
// 全チャンネルに同じ値を足しても色相は変わらないので、明るさYは計算に含めなくてよい。
function rainbowFill(i, q) {
  const angle = Math.atan2(q, i);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const red = 0.956 * cosine + 0.621 * sine;
  const green = -0.272 * cosine - 0.647 * sine;
  const blue = -1.106 * cosine + 1.703 * sine;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let sextant;
  if (max === red) sextant = (green - blue) / delta;
  else if (max === green) sextant = (blue - red) / delta + 2;
  else sextant = (red - green) / delta + 4;
  return `hsl(${Math.round((sextant * 60 + 360) % 360)} 95% 66%)`;
}

export default function ColorMapChart({ colorMap, hueAngle, element, rarity }) {
  const glowId = useId();
  const accent = SECTORS.find((sector) => sector.element === element)?.color ?? "#f1d48d";
  const dotStyle = dotStyleFor(rarity);

  return (
    <svg
      className="cmap"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`色相図。一番目立つ色の色相は${Math.round(hueAngle)}度で、${element}属性の範囲に入っています`}
      style={{ "--cmap-accent": accent }}
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={`translate(${CENTER} ${CENTER})`}>
        <circle className="cmap-plate" r={RADIUS + 8} />

        {SECTORS.map((sector) => (
          <path
            key={sector.element}
            className="cmap-sector"
            data-active={sector.element === element || undefined}
            d={sectorPath(sector.from, sector.to)}
            fill={sector.color}
            filter={sector.element === element ? `url(#${glowId})` : undefined}
          />
        ))}

        {[0.25, 0.5, 0.75].map((fraction) => (
          <circle key={fraction} className="cmap-ring" r={RADIUS * fraction} />
        ))}
        <circle className="cmap-ring cmap-ring--outer" r={RADIUS} />

        {TICK_DEGREES.map((degrees) => {
          const major = degrees % 90 === 0;
          const [x0, y0] = polar(RADIUS, degrees);
          const [x1, y1] = polar(RADIUS + (major ? 8 : 4), degrees);
          return <line key={degrees} className="cmap-tick" data-major={major || undefined} x1={x0} y1={y0} x2={x1} y2={y1} />;
        })}

        <line className="cmap-axis" x1={-RADIUS} y1="0" x2={RADIUS} y2="0" />
        <line className="cmap-axis" x1="0" y1={-RADIUS} x2="0" y2={RADIUS} />
        <text className="cmap-axis-label" x={RADIUS - 4} y="-6" textAnchor="end">I</text>
        <text className="cmap-axis-label" x="6" y={-RADIUS + 12}>Q</text>

        <g className="cmap-dots" data-dot-style={dotStyle}>
          {colorMap.points.map(([i, q, color], index) => {
            const [x, y] = toChart(i, q);
            // 中心に近い点から順に広がるよう、距離に応じて開始を遅らせる。
            const delay = 120 + (Math.hypot(x, y) / RADIUS) * 420 + (index % 7) * 12;
            return (
              <circle
                key={index}
                className="cmap-dot"
                r="2.3"
                fill={dotStyle === "rainbow" ? rainbowFill(i, q) : metalFill(color, METAL_PALETTES[dotStyle])}
                style={{ "--x": `${x}px`, "--y": `${y}px`, "--delay": `${delay}ms` }}
              />
            );
          })}
        </g>

        {colorMap.clusters.map((cluster, index) => {
          const [x, y] = toChart(cluster.i, cluster.q);
          return (
            <g
              key={index}
              className="cmap-cluster"
              data-dominant={cluster.dominant || undefined}
              style={{ "--x": `${x}px`, "--y": `${y}px` }}
            >
              <circle className="cmap-cluster-halo" r={7 + 20 * Math.sqrt(cluster.share)} />
              <circle className="cmap-cluster-core" r="2.6" />
            </g>
          );
        })}

        <g className="cmap-needle" style={{ "--angle": `${-hueAngle}deg` }}>
          <line x1="0" y1="0" x2={RADIUS + 4} y2="0" />
          <circle cx={RADIUS + 4} cy="0" r="4" />
        </g>
        <circle className="cmap-hub" r="4.5" />

        {SECTORS.map((sector) => {
          const [x, y] = polar(LABEL_RADIUS, (sector.from + sector.to) / 2);
          return (
            <g
              key={sector.element}
              className="cmap-label"
              data-active={sector.element === element || undefined}
              transform={`translate(${x} ${y})`}
            >
              <circle r="13" />
              <text dy="0.36em" textAnchor="middle">{sector.element}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
