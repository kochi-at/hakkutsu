import { useEffect, useState } from "react";
import "./ScrollOpening.css";

const ANIMATION_MS = 800;

export default function ScrollOpening({ onDone }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone?.();
      return;
    }

    const raf = requestAnimationFrame(() => setPlay(true));
    const timer = setTimeout(() => onDone?.(), ANIMATION_MS + 80);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`scroll-opening${play ? " scroll-opening--play" : ""}`} aria-hidden="true">
      <div className="scroll-opening-panel scroll-opening-panel--top" />
      <div className="scroll-opening-panel scroll-opening-panel--bottom" />
    </div>
  );
}
