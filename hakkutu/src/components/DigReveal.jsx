import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { digTier } from "./digTier";
import "./DigReveal.css";

const TIMING = { flash: 180, rollDuration: 1100, holdAfterRoll: 700 };

// 鑑定中アイコン: 実際の走査位置ではなく、1枚のアイコンとしてジグザグ格子を描くだけ。
const ZIGZAG_GRID = 6;
const ZIGZAG_CELL = 20;
const ZIGZAG_SIZE = ZIGZAG_GRID * ZIGZAG_CELL;
const ZIGZAG_LINES = Array.from({ length: ZIGZAG_GRID + 1 }, (_, i) => i * ZIGZAG_CELL);
const ZIGZAG_STROKES = Array.from({ length: ZIGZAG_GRID * ZIGZAG_GRID }, (_, index) => {
  const row = Math.floor(index / ZIGZAG_GRID);
  const col = index % ZIGZAG_GRID;
  const x = col * ZIGZAG_CELL;
  const y = row * ZIGZAG_CELL;
  return { index, x1: x, y1: y + ZIGZAG_CELL, x2: x + ZIGZAG_CELL, y2: y };
});

function ZigzagScanIcon() {
  return (
    <svg className="dig-zigzag" viewBox={`0 0 ${ZIGZAG_SIZE} ${ZIGZAG_SIZE}`} aria-hidden="true">
      <rect className="dig-zigzag-frame" x="1" y="1" width={ZIGZAG_SIZE - 2} height={ZIGZAG_SIZE - 2} />
      {ZIGZAG_LINES.map((pos) => (
        <g key={pos} className="dig-zigzag-grid">
          <line x1={pos} y1="0" x2={pos} y2={ZIGZAG_SIZE} />
          <line x1="0" y1={pos} x2={ZIGZAG_SIZE} y2={pos} />
        </g>
      ))}
      {ZIGZAG_STROKES.map(({ index, x1, y1, x2, y2 }) => (
        <line
          key={index}
          className="dig-zigzag-stroke"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          style={{ "--i": index }}
        />
      ))}
    </svg>
  );
}

const DigReveal = forwardRef(function DigReveal({ evaluation, revealStarted = true, onReveal, onComplete, onCancel }, ref) {
  const rarityRef = useRef(null);
  const starsRef = useRef(null);
  // 実際の鑑定結果(evaluation)が届くまでは "inspecting" のまま待機し続ける。
  // 待ち時間は呼び出し側の非同期処理の長さがそのまま演出時間になる。
  const [phase, setPhase] = useState("inspecting"); // inspecting -> flash -> rolling -> done
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  };

  useEffect(() => {
    if (!evaluation || !revealStarted) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function run() {
      setPhase("flash");
      await sleep(TIMING.flash);
      if (cancelled) return;
      setPhase("rolling");
      await animateRarity(evaluation.rarity, TIMING.rollDuration, rarityRef, starsRef);
      if (cancelled) return;

      setPhase("done");
      await sleep(TIMING.holdAfterRoll);
      if (cancelled) return;
      finish();
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation, revealStarted]);

  // スキップボタンはCameraPage側(Homeボタンと対称の位置)に表示するため、
  // 実行だけをrefごしに外部へ公開する
  useImperativeHandle(ref, () => ({
    skip: () => {
      // 通信待ち中(evaluation未到着)はスキップ対象がまだ無いので何もしない
      if (!evaluation || !revealStarted) return;
      finish();
    },
  }), [evaluation, revealStarted]);

  return (
    <div
      className="dig-reveal"
      data-phase={phase}
      data-tier={evaluation ? digTier(evaluation.rarity) : undefined}
    >
      <div className="dig-reveal-rays" aria-hidden="true" />
      <div className="dig-reveal-flash" aria-hidden="true" />

      <div className="dig-reveal-inspect">
        <ZigzagScanIcon />
        <p className="dig-label">{evaluation ? "鑑定完了" : "鑑定中..."}</p>
        {evaluation && !revealStarted && (
          <button type="button" className="dig-reveal-result" onClick={onReveal}>
            結果を表示
          </button>
        )}
        {onCancel && (
          <button type="button" className="dig-reveal-cancel" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>

      <div className="dig-reveal-rarity">
        <div className="dig-rarity-num" ref={rarityRef}>0.0</div>
        <span className="dig-stars" aria-hidden="true">
          <span className="dig-stars-empty">★★★★★</span>
          <span className="dig-stars-filled" ref={starsRef}>★★★★★</span>
        </span>
        {phase === "done" && <p className="dig-tier">{digTier(evaluation.rarity)}</p>}
      </div>
    </div>
  );
});

export default DigReveal;

function animateRarity(target, duration, numberRef, starsRef) {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      if (numberRef.current) numberRef.current.textContent = value.toFixed(1);
      if (starsRef.current) starsRef.current.style.width = `${(value / 5) * 100}%`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}
