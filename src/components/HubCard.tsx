import { Link } from 'react-router-dom';
import type { CompetitionEntry } from '@data/registry';

const SPORT_GLYPH: Record<string, string> = {
  soccer: '⚽',
  nba: '🏀',
  nfl: '🏈',
  nhl: '🏒',
  mlb: '⚾',
};

export function HubCard({ entry }: { entry: CompetitionEntry }) {
  const live = entry.status === 'live';
  const Inner = (
    <div className={`hub-card hub-card--${entry.sport} ${live ? '' : 'hub-card--soon'}`}>
      <div className="hub-card__record" aria-hidden>{entry.recordLabel}</div>
      <div className="hub-card__sport-glyph" aria-hidden>{SPORT_GLYPH[entry.sport] ?? '★'}</div>
      <div className="hub-card__name">{entry.display}</div>
      <div className="hub-card__status">{live ? 'PLAY' : 'SOON'}</div>
    </div>
  );
  if (!live) return <div className="hub-card__wrap">{Inner}</div>;
  return (
    <Link to={`/arcade/${entry.slug}`} className="hub-card__wrap">
      {Inner}
    </Link>
  );
}
