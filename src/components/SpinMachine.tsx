// Two-reel spin machine. Engine determines the result before we animate —
// the animation is decoration. Three phases:
//   idle      → big SPIN button
//   spinning  → reels animate, controls locked
//   landed    → locked banner + Reroll Nation / Reroll Era + Pick Player CTA
// Reroll buttons live ONLY in the landed state (there's nothing to reroll
// before a spin). User explicitly clicks "Pick Player" to advance — no
// auto-advance, since rerolls require deliberation.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompetitionConfig, SpinResult } from '@engine/types';

interface Props {
  config: CompetitionConfig;
  pendingResult: SpinResult | null;
  onProceed: () => void;
  rerollsLeft: { entity: number; era: number };
  onSpin: () => void;
  onRerollEntity: () => boolean;
  onRerollEra: () => boolean;
  roundLabel: string;
}

const ITEM_HEIGHT = 72;
const LOOPS = 6;
const SPIN_MS = 1600;

function tickHaptic() {
  if (typeof navigator === 'undefined') return;
  try {
    if ('vibrate' in navigator) (navigator as Navigator).vibrate?.(8);
  } catch { /* ignore */ }
}

function Reel({ items, targetIndex, animKey, label, locked, idle }: {
  items: string[];
  targetIndex: number;
  animKey: number;
  label: string;
  locked: boolean;
  idle: boolean;
}) {
  const finalY = -((LOOPS * items.length + targetIndex) * ITEM_HEIGHT);
  const stripItems = useMemo(
    () => Array.from({ length: LOOPS + 2 }, () => items).flat(),
    [items],
  );
  return (
    <div className={`reel ${locked ? 'reel--locked' : ''} ${idle ? 'reel--idle' : ''}`} aria-label={`${label} reel`}>
      <div className="reel__window">
        <div className="reel__fade reel__fade--top" aria-hidden />
        <div className="reel__fade reel__fade--bottom" aria-hidden />
        {idle ? (
          // Between rounds: static "SPIN" placeholder; no animation.
          <div className="reel__static">SPIN</div>
        ) : (
          <>
            <div
              key={animKey}
              className="reel__strip"
              style={{
                transform: `translateY(${finalY}px)`,
                animation: `reel-spin-${animKey} ${SPIN_MS}ms cubic-bezier(0.22, 0.94, 0.31, 1) forwards`,
              }}
            >
              {stripItems.map((item, i) => (
                <div key={i} className="reel__item" style={{ height: ITEM_HEIGHT }}>{item}</div>
              ))}
            </div>
            <style>{`
              @keyframes reel-spin-${animKey} {
                from { transform: translateY(0); }
                to { transform: translateY(${finalY}px); }
              }
            `}</style>
          </>
        )}
        <span className="reel__chevron reel__chevron--left" aria-hidden>▶</span>
        <span className="reel__chevron reel__chevron--right" aria-hidden>◀</span>
        <div className="reel__line" aria-hidden />
      </div>
      <div className="reel__label">{label}</div>
    </div>
  );
}

export function SpinMachine({
  config,
  pendingResult,
  onProceed,
  rerollsLeft,
  onSpin,
  onRerollEntity,
  onRerollEra,
  roundLabel,
}: Props) {
  const entityItems = useMemo(() => Array.from(new Set(config.spinTable.map(c => c.entity))), [config]);
  const eraItems = useMemo(() => Array.from(new Set(config.spinTable.map(c => c.era))), [config]);

  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landed'>('idle');
  const lastResultRef = useRef<SpinResult | null>(null);

  useEffect(() => {
    if (!pendingResult) {
      setPhase('idle');
      lastResultRef.current = null;
      return;
    }
    if (lastResultRef.current === pendingResult) return;
    lastResultRef.current = pendingResult;
    setAnimKey(k => k + 1);
    setPhase('spinning');

    const tickInterval = window.setInterval(tickHaptic, 80);
    const tickStop = window.setTimeout(() => window.clearInterval(tickInterval), SPIN_MS);
    const landed = window.setTimeout(() => setPhase('landed'), SPIN_MS + 40);

    return () => {
      window.clearTimeout(landed);
      window.clearTimeout(tickStop);
      window.clearInterval(tickInterval);
    };
  }, [pendingResult]);

  const entityIdx = pendingResult ? Math.max(0, entityItems.indexOf(pendingResult.entity)) : 0;
  const eraIdx = pendingResult ? Math.max(0, eraItems.indexOf(pendingResult.era)) : 0;

  const entityName = (id: string) => config.entities.find(e => e.id === id)?.name ?? id;
  const cellLabel = pendingResult ? `${entityName(pendingResult.entity)} · ${pendingResult.era}` : '';

  const hint =
    phase === 'spinning' ? 'spinning…'
    : phase === 'landed' ? 'LOCKED'
    : 'tap SPIN';

  return (
    <div className={`spinmachine spinmachine--${phase}`}>
      <div className="spinmachine__head">
        <span className="spinmachine__round">{roundLabel}</span>
        <span className={`spinmachine__hint spinmachine__hint--${phase}`}>{hint}</span>
      </div>
      <div className="spinmachine__reels">
        <Reel
          items={entityItems.map(entityName)}
          targetIndex={entityIdx}
          animKey={animKey * 2 + 1}
          label={config.axisLabels?.entity ?? 'Nation'}
          locked={phase === 'landed'}
          idle={phase === 'idle'}
        />
        <Reel
          items={eraItems}
          targetIndex={eraIdx}
          animKey={animKey * 2}
          label={config.axisLabels?.era ?? 'Era'}
          locked={phase === 'landed'}
          idle={phase === 'idle'}
        />
      </div>

      {phase === 'idle' && (
        <button
          type="button"
          className="spinmachine__spin"
          onClick={onSpin}
        >
          SPIN
        </button>
      )}

      {phase === 'spinning' && (
        <button type="button" className="spinmachine__spin" disabled>· · ·</button>
      )}

      {phase === 'landed' && (
        <>
          <div className="spinmachine__banner" aria-live="polite">
            <span className="spinmachine__banner-flash">{cellLabel}</span>
          </div>
          <div className="spinmachine__rerolls">
            <button
              type="button"
              disabled={rerollsLeft.entity <= 0}
              onClick={() => onRerollEntity()}
              className="spinmachine__reroll"
            >
              ↻ {config.axisLabels?.entity ?? 'Team'} <span className="spinmachine__budget">{rerollsLeft.entity}</span>
            </button>
            <button
              type="button"
              disabled={rerollsLeft.era <= 0}
              onClick={() => onRerollEra()}
              className="spinmachine__reroll"
            >
              ↻ {config.axisLabels?.era ?? 'Era'} <span className="spinmachine__budget">{rerollsLeft.era}</span>
            </button>
          </div>
          <button
            type="button"
            className="spinmachine__proceed"
            onClick={onProceed}
          >
            PICK PLAYER →
          </button>
        </>
      )}
    </div>
  );
}
