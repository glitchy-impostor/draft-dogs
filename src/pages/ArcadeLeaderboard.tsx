// Leaderboard page. Global tab (no day filter) + Daily tab (today's UTC
// date). The 30s edge-cache mentioned in §8 lives at the CDN; this client
// just refetches on tab change.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/arcadeApi';
import { getCompetition } from '@data/registry';
import '@/styles/leaderboard.css';

type Tab = 'global' | 'daily';
type Mode = 'classic' | 'expert' | 'hard' | 'daily';

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function ArcadeLeaderboard() {
  const { slug = '' } = useParams();
  const entry = getCompetition(slug);
  const [tab, setTab] = useState<Tab>('global');
  const [mode, setMode] = useState<Mode>('classic');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = useMemo(() => (tab === 'daily' ? todayUTC() : null), [tab]);
  const queryMode = tab === 'daily' ? 'daily' : mode;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLeaderboard({ competition: slug, mode: queryMode, day, limit: 100 })
      .then(res => { if (!cancelled) setRows(res.rows); })
      .catch(e => { if (!cancelled) setError(String(e.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, queryMode, day]);

  if (!entry) {
    return (
      <main className="leaderboard">
        <h1>Unknown competition</h1>
        <Link to="/arcade">← Back to arcade</Link>
      </main>
    );
  }

  return (
    <main className={`leaderboard sport-${entry.sport}`}>
      <header className="leaderboard__head">
        <Link to={`/arcade/${slug}`} className="leaderboard__back">←</Link>
        <div className="leaderboard__title">
          <span className="leaderboard__record">{entry.recordLabel}</span>
          <span className="leaderboard__name">{entry.display}</span>
        </div>
        <div />
      </header>

      <div className="leaderboard__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'global'}
          className={`leaderboard__tab ${tab === 'global' ? 'leaderboard__tab--on' : ''}`}
          onClick={() => setTab('global')}
        >
          Global
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'daily'}
          className={`leaderboard__tab ${tab === 'daily' ? 'leaderboard__tab--on' : ''}`}
          onClick={() => setTab('daily')}
        >
          Daily {day && <span className="leaderboard__day">· {day}</span>}
        </button>
      </div>

      {tab === 'global' && (
        <div className="leaderboard__modepicker" role="radiogroup" aria-label="Mode filter">
          {(['classic', 'expert', 'hard'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`leaderboard__modechip ${mode === m ? 'leaderboard__modechip--on' : ''}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="leaderboard__loading">Loading…</div>}
      {error && <div className="leaderboard__error">No connection to the leaderboard service. Local play still works.</div>}

      {!loading && !error && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Record</th><th>R</th><th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="leaderboard__empty">No runs yet. Be the first.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.nonce}>
                <td>{r.rank}</td>
                <td>{r.username}</td>
                <td className="leaderboard__record-cell">{r.record}</td>
                <td>{r.team_rating.toFixed(1)}</td>
                <td className="leaderboard__score-cell">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
