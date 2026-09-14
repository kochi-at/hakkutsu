import { useEffect, useRef, useState } from "react";
import { digTier } from "./digTier";
import "./DigReveal.css";

const TIMING = { inspect: 1200, flash: 180, rollDuration: 1100, holdAfterRoll: 700 };

export default function DigReveal({ evaluation, onComplete }) {
  const rarityRef = useRef(null);
  const starsRef = useRef(null);
  const [phase, setPhase] = useState("inspecting"); // inspecting -> flash -> rolling -> done
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function run() {
      await sleep(TIMING.inspect);
      if (cancelled) return;
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
  }, [evaluation]);

  const handleSkip = () => finish();

  return (
    <div className="dig-reveal" data-phase={phase}>
      <button type="button" className="dig-reveal-skip" onClick={handleSkip}>
        スキップ
      </button>
      <div className="dig-reveal-rays" aria-hidden="true" />
      <div className="dig-reveal-flash" aria-hidden="true" />

      <div className="dig-reveal-inspect">
        <div className="dig-reveal-scanline" aria-hidden="true" />
        <span className="dig-pick" aria-hidden="true">🔍</span>
        <p className="dig-label">鑑定中...</p>
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
}

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
