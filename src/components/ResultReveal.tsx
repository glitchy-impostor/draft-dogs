// Reveals the run match-by-match. Tournament mode gets a stage ticker;
// season mode gets a faster match scroll and ends with the league table.
// Per §9: the "L" moment hurts — screen shake + record freeze on a loss.

import { useEffect, useState, type ReactNode } from 'react';
import type { CompetitionConfig, Match, RunResult, SeasonResult, TournamentResult } from '@engine/types';
import type { MvpPick } from '@engine/sim';

interface Props {
  result: RunResult;
  config: CompetitionConfig;
  onShare: () => void;
  onRestart: () => void;
  statTable?: ReactNode;
  mvp?: MvpPick | null;
}

const TICK_MS_TOURNAMENT = 600;
const TICK_MS_SEASON = 80;

export function ResultReveal({ result, config, onShare, onRestart, statTable, mvp }: Props) {
  const [shown, setShown] = useState(0);
  const [revealing, setRevealing] = useState(true);
  const [shake, setShake] = useState(false);
  const tick = result.mode === 'tournament' ? TICK_MS_TOURNAMENT : TICK_MS_SEASON;

  useEffect(() => {
    if (!revealing) return;
    if (shown >= result.matches.length) {
      setRevealing(false);
      return;
    }
    const id = window.setTimeout(() => {
      setShown(n => n + 1);
      const m = result.matches[shown];
      if (m && m.outcome === 'L') {
        setShake(true);
        window.setTimeout(() => setShake(false), 280);
      }
    }, tick);
    return () => window.clearTimeout(id);
  }, [shown, revealing, result.matches, tick]);

  const visible = result.matches.slice(0, shown);
  const wins = visible.filter(m => m.outcome === 'W').length;
  const draws = visible.filter(m => m.outcome === 'D').length;
  const losses = visible.filter(m => m.outcome === 'L').length;
  const liveRecord = config.sport === 'soccer' ? `${wins}-${draws}-${losses}` : `${wins}-${losses}`;
  const broken = losses > 0 || (config.sport === 'soccer' && draws > 0);

  return (
    <section className={`result-reveal ${shake ? 'result-reveal--shake' : ''}`}>
      <header className="result-reveal__head">
        <div className="result-reveal__brand">DRAFT DOGS · {config.target.label}</div>
        <div className={`result-reveal__record ${broken ? 'result-reveal__record--broken' : ''}`}>
          {liveRecord}
        </div>
        <div className="result-reveal__name">{config.name}</div>
      </header>

      {result.mode === 'tournament' ? (
        <TournamentTicker result={result} visible={visible} config={config} revealing={revealing} />
      ) : (
        <SeasonTicker result={result} visible={visible} config={config} revealing={revealing} />
      )}

      {!revealing && (
        <>
          <RunVerdict result={result} config={config} onShare={onShare} onRestart={onRestart} />
          {mvp && <MvpBanner mvp={mvp} />}
          {statTable}
          {result.mode === 'season' && result.table && (
            config.sport === 'soccer' ? (
              <SoccerLeagueTable rows={result.table} />
            ) : config.tableLayout ? (
              <DivisionalLeagueTable rows={result.table} layout={config.tableLayout} />
            ) : (
              <FlatUsLeagueTable rows={result.table} />
            )
          )}
        </>
      )}
    </section>
  );
}

const STAGE_LABEL: Record<string, string> = {
  group: 'Group', league: 'League Phase',
  r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', final: 'Final',
};
function stageLabel(raw: string): string {
  return STAGE_LABEL[raw] ?? raw;
}

function TournamentTicker({ result, visible, config, revealing }: { result: TournamentResult; visible: Match[]; config: CompetitionConfig; revealing: boolean }) {
  // Render a row for every configured stage, not just the ones played.
  // While revealing, un-played rows render as pending so the ticker doesn't
  // spoil the elimination point. Once the reveal completes, un-played stages
  // flip to DNQ to show exactly how far the team fell short of the trophy.
  const allStages = config.stages ?? result.matches.map(m => m.stage ?? '');
  return (
    <ol className="ticker ticker--tournament">
      {allStages.map((rawStage, i) => {
        const m: Match | undefined = result.matches[i];
        const seen = !!m && i < visible.length;
        if (!m) {
          if (revealing) {
            return (
              <li key={i} className="ticker-row ticker-row--hidden">
                <span className="ticker-row__stage">{stageLabel(rawStage)}</span>
                <span className="ticker-row__line">· · ·</span>
                <span className="ticker-row__outcome"></span>
              </li>
            );
          }
          return (
            <li key={i} className="ticker-row ticker-row--unreached">
              <span className="ticker-row__stage">{stageLabel(rawStage)}</span>
              <span className="ticker-row__line">—</span>
              <span className="ticker-row__outcome">DNQ</span>
            </li>
          );
        }
        const cls = seen ? `ticker-row ticker-row--${m.outcome}` : 'ticker-row ticker-row--hidden';
        return (
          <li key={i} className={cls}>
            <span className="ticker-row__stage">{m.stage ?? stageLabel(rawStage)}</span>
            <span className="ticker-row__line">{seen ? m.scoreLine ?? m.outcome : '· · ·'}</span>
            <span className="ticker-row__outcome">{seen ? m.outcome : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SeasonTicker({ result, visible, config, revealing }: { result: SeasonResult; visible: Match[]; config: CompetitionConfig; revealing: boolean }) {
  const regularCount = config.target.games;
  const playoffStages = config.sim.playoffStages ?? [];
  const playedPlayoffMatches = result.matches.slice(regularCount);
  const showPlayoffs = playoffStages.length > 0;
  // Wait until the regular season has finished ticking before revealing the
  // "Missed Playoffs" tag — otherwise it spoils whether the team qualified
  // before the user even sees their final W-L record.
  const regularSeasonRevealed = visible.length >= regularCount;
  const showMissedPlayoffs = showPlayoffs && !result.madePlayoffs && regularSeasonRevealed;
  return (
    <div className="ticker ticker--season">
      <div className="ticker__matches">
        {result.matches.slice(0, regularCount).map((m, i) => {
          const seen = i < visible.length;
          return (
            <span
              key={i}
              className={`ticker__box ${seen ? `ticker__box--${m.outcome}` : 'ticker__box--hidden'}`}
              aria-label={`Game ${i + 1}: ${seen ? m.outcome : 'pending'}`}
            />
          );
        })}
      </div>
      {showPlayoffs && (
        <div className="ticker__playoffs">
          <div className="ticker__playoffs-label">
            ▸ Playoffs {showMissedPlayoffs && <span className="ticker__playoffs-dnq">— Missed Playoffs</span>}
          </div>
          <ul className="ticker__playoffs-list">
            {playoffStages.map((ps, idx) => {
              const i = regularCount + idx;
              const m = playedPlayoffMatches[idx];
              const seen = !!m && i < visible.length;
              if (!m) {
                // During reveal, show pending dots so the playoff track doesn't
                // spoil the elimination point. After reveal, flip to DNQ.
                if (revealing) {
                  return (
                    <li key={idx} className="ticker-row ticker-row--hidden">
                      <span className="ticker-row__stage">{ps.label}</span>
                      <span className="ticker-row__line">· · ·</span>
                      <span className="ticker-row__outcome"></span>
                    </li>
                  );
                }
                return (
                  <li key={idx} className="ticker-row ticker-row--unreached">
                    <span className="ticker-row__stage">{ps.label}</span>
                    <span className="ticker-row__line">—</span>
                    <span className="ticker-row__outcome">DNQ</span>
                  </li>
                );
              }
              const cls = seen ? `ticker-row ticker-row--${m.outcome}` : 'ticker-row ticker-row--hidden';
              return (
                <li key={idx} className={cls}>
                  <span className="ticker-row__stage">{ps.label}</span>
                  <span className="ticker-row__line">{seen ? m.scoreLine ?? m.outcome : '· · ·'}</span>
                  <span className="ticker-row__outcome">{seen ? m.outcome : ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SoccerLeagueTable({ rows }: { rows: import('@engine/types').TableRow[] }) {
  return (
    <table className="league-table">
      <thead>
        <tr>
          <th>#</th><th>Team</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id} className={row.isYou ? 'league-table__you' : ''}>
            <td>{i + 1}</td>
            <td>{row.name}</td>
            <td>{row.W}</td><td>{row.D}</td><td>{row.L}</td>
            <td>{row.GD > 0 ? `+${row.GD}` : row.GD}</td>
            <td>{row.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FlatUsLeagueTable({ rows }: { rows: import('@engine/types').TableRow[] }) {
  const leader = rows[0];
  return (
    <table className="league-table league-table--us">
      <thead>
        <tr>
          <th>#</th><th>Team</th><th>W</th><th>L</th><th>Pct</th><th>GB</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const gb = i === 0 ? '—' : ((leader.W - row.W + (row.L - leader.L)) / 2).toFixed(1);
          return (
            <tr key={row.id} className={row.isYou ? 'league-table__you' : ''}>
              <td>{i + 1}</td>
              <td>{row.name}</td>
              <td>{row.W}</td><td>{row.L}</td>
              <td>{((row.pct ?? 0) * 1000).toFixed(0).padStart(3, '0')}</td>
              <td>{gb}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DivisionalLeagueTable({
  rows, layout,
}: { rows: import('@engine/types').TableRow[]; layout: import('@engine/types').TableLayout }) {
  // Group rows by (conference, division) tuple — AFC and NFC both have an
  // "East" division, so the division name alone is not unique. Within each
  // division the rank column shows divisional position; GB is computed
  // against the divisional leader.
  const byDivision = new Map<string, import('@engine/types').TableRow[]>();
  for (const row of rows) {
    const key = `${row.conference ?? ''}::${row.division ?? '__unassigned'}`;
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(row);
  }
  return (
    <div className="league-table-divisional">
      {layout.conferences.map(conf => (
        <div key={conf.name} className="league-table-divisional__conf">
          <h4 className="league-table-divisional__conf-title">{conf.name}</h4>
          <div className="league-table-divisional__divs">
            {conf.divisions.map(div => {
              const divRows = byDivision.get(`${conf.name}::${div.name}`) ?? [];
              const leader = divRows[0];
              return (
                <div key={div.name} className="league-table-divisional__div">
                  <h5 className="league-table-divisional__div-title">{div.name}</h5>
                  <table className="league-table league-table--us league-table--compact">
                    <thead>
                      <tr>
                        <th>#</th><th>Team</th><th>W</th><th>L</th><th>Pct</th><th>GB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divRows.map((row, i) => {
                        const gb = !leader || i === 0
                          ? '—'
                          : ((leader.W - row.W + (row.L - leader.L)) / 2).toFixed(1);
                        return (
                          <tr key={row.id} className={row.isYou ? 'league-table__you' : ''}>
                            <td>{i + 1}</td>
                            <td>{row.name}</td>
                            <td>{row.W}</td><td>{row.L}</td>
                            <td>{((row.pct ?? 0) * 1000).toFixed(0).padStart(3, '0')}</td>
                            <td>{gb}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MvpBanner({ mvp }: { mvp: MvpPick }) {
  return (
    <section className="mvp-banner">
      <div className="mvp-banner__head">
        <span className="mvp-banner__chip">▸ Player of the Season</span>
      </div>
      <div className="mvp-banner__body">
        <div className="mvp-banner__name">{mvp.player.name}</div>
        <div className="mvp-banner__meta">
          <span className="mvp-banner__slot">{mvp.slot.key}</span>
          <span className="mvp-banner__ovr">OVR {mvp.player.ovr}</span>
        </div>
        <div className="mvp-banner__reason">{mvp.reason}</div>
      </div>
    </section>
  );
}

function RunVerdict({ result, config, onShare, onRestart }: { result: RunResult; config: CompetitionConfig; onShare: () => void; onRestart: () => void; }) {
  const perfect = result.perfectRun;
  return (
    <div className="result-verdict">
      <div className={`result-verdict__tier ${perfect ? 'result-verdict__tier--top-dog' : ''}`}>
        {result.tier}
      </div>
      {perfect && <div className="result-verdict__paw">🐾</div>}
      {result.mode === 'tournament' && (
        <div className="result-verdict__summary">Out at: <strong>{result.stageReached}</strong></div>
      )}
      {result.mode === 'season' && result.position !== undefined && (
        <div className="result-verdict__summary">Final position: <strong>{result.position}</strong> of {result.table?.length}</div>
      )}
      <div className="result-verdict__actions">
        <button type="button" className="result-verdict__share" onClick={onShare}>Share</button>
        <button type="button" className="result-verdict__restart" onClick={onRestart}>Play again</button>
      </div>
      <p className="result-verdict__disclaimer">{config.disclaimer}</p>
    </div>
  );
}
