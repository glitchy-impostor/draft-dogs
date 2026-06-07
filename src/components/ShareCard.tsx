// Canvas-rendered share card. 1080×1920 story format + a tighter 1200×630
// for OG. Per §9 we render typography + era badges + entity color pairs —
// NO logos, no kits, no player photos. Wordle-style emoji block alongside.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompetitionConfig, Pick, Player, RunResult, TeamRating } from '@engine/types';

interface Props {
  config: CompetitionConfig;
  picks: Array<Pick | null>;
  playersById: Map<string, Player>;
  result: RunResult;
  rating: TeamRating;
  mode: string;
}

function emojiLine(result: RunResult): string {
  return result.matches
    .map(m => (m.outcome === 'W' ? '🟩' : m.outcome === 'D' ? '🟨' : '🟥'))
    .join('');
}

function buildShareText(config: CompetitionConfig, result: RunResult, mode: string): string {
  const head = `Draft Dogs · ${config.target.label} · ${config.name}`;
  const subtitle = `${result.tier}${result.perfectRun ? ' 🐾 TOP DOG' : ''}`;
  const line = emojiLine(result);
  const recordLine = `${result.record}${result.mode === 'tournament' ? ` · out at ${result.stageReached}` : ''}`;
  return `${head}\n${subtitle}\n${recordLine}\n${line}\n[${mode.toUpperCase()} mode]`;
}

function drawCard(
  canvas: HTMLCanvasElement,
  config: CompetitionConfig,
  result: RunResult,
  rating: TeamRating,
  picks: Array<Pick | null>,
  playersById: Map<string, Player>,
  mode: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  // Scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  const accent = result.perfectRun ? '#ffd400' : '#ffd400';
  const danger = '#ff3860';

  // Header
  ctx.fillStyle = accent;
  ctx.font = 'bold 28px ui-monospace, Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DRAFT DOGS', W / 2, 90);

  // Big record
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(W * 0.22)}px ui-monospace, Courier New, monospace`;
  ctx.fillText(config.target.label, W / 2, H * 0.22);

  // Competition name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px ui-monospace, Courier New, monospace';
  ctx.fillText(config.name.toUpperCase(), W / 2, H * 0.26);

  // Tier
  ctx.fillStyle = result.perfectRun ? accent : '#fff';
  ctx.font = `bold ${Math.round(W * 0.05)}px ui-monospace, Courier New, monospace`;
  ctx.fillText(result.tier.toUpperCase(), W / 2, H * 0.34);

  // Paw if perfect
  if (result.perfectRun) {
    ctx.font = `${Math.round(W * 0.16)}px ui-monospace`;
    ctx.fillText('🐾', W / 2, H * 0.46);
  }

  // Record + rating
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '30px ui-monospace, Courier New, monospace';
  ctx.fillText(`${result.record} · R ${rating.R.toFixed(1)}`, W / 2, H * 0.52);

  // Emoji ticker (drawn as boxes for canvas reliability)
  const matches = result.matches;
  const boxW = Math.min(36, (W - 80) / matches.length);
  const boxH = boxW;
  const gap = 4;
  const totalW = matches.length * boxW + (matches.length - 1) * gap;
  let x = (W - totalW) / 2;
  const y0 = H * 0.58;
  for (const m of matches) {
    ctx.fillStyle = m.outcome === 'W' ? '#00d26a' : m.outcome === 'D' ? '#ffd400' : danger;
    ctx.fillRect(x, y0, boxW, boxH);
    x += boxW + gap;
  }

  // XI roster grid
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px ui-monospace, Courier New, monospace';
  ctx.textAlign = 'left';
  const startY = H * 0.66;
  const colW = (W - 80) / 2;
  picks.forEach((p, i) => {
    if (!p) return;
    const player = playersById.get(p.playerId);
    if (!player) return;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = 40 + col * colW;
    const py = startY + row * 50;
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '20px ui-monospace';
    ctx.fillText(p.slotKey.padEnd(4), px, py);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px ui-monospace';
    const name = player.name + (mode === 'expert' ? '' : ` · ${player.ovr}`);
    ctx.fillText(name, px + 60, py);
    ctx.fillStyle = accent;
    ctx.font = '18px ui-monospace';
    ctx.fillText(player.era, px + 60, py + 22);
  });

  // Footer + nominative disclaimer (per §11)
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '20px ui-monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`[${mode.toUpperCase()} mode] · draftdogs.app/arcade`, W / 2, H - 80);
  ctx.fillStyle = '#6a6a6a';
  ctx.font = '14px ui-monospace';
  ctx.fillText('Independent project — not affiliated with any league or federation.', W / 2, H - 50);
}

export function ShareCard({ config, picks, playersById, result, rating, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(
    () => buildShareText(config, result, mode),
    [config, result, mode],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = 1080;
    c.height = 1920;
    drawCard(c, config, result, rating, picks, playersById, mode);
    setDataURL(c.toDataURL('image/png'));
  }, [config, picks, playersById, result, rating, mode]);

  const onCopyText = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  };

  return (
    <div className="share-card">
      <canvas ref={canvasRef} className="share-card__canvas" />
      <pre className="share-card__text">{shareText}</pre>
      <div className="share-card__actions">
        <button type="button" className="share-card__btn" onClick={onCopyText}>
          {copied ? 'Copied!' : 'Copy text'}
        </button>
        {dataURL && (
          <a href={dataURL} download={`draftdogs-${config.slug}.png`} className="share-card__btn">
            Download PNG
          </a>
        )}
      </div>
    </div>
  );
}
