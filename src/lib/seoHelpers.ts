// SEO helpers — keep the per-page Seo invocations short and consistent. The
// VideoGame JSON-LD here is also emitted by the prerender script, so static
// and SPA renders agree.

import type { CompetitionEntry } from '@data/registry';
import type { SeoProps } from '@/components/Seo';

const SITE = 'https://draftdogs.app';

const SPORT_LABEL: Record<CompetitionEntry['sport'], string> = {
  soccer: 'Soccer',
  nba: 'Basketball',
  nfl: 'Football',
  nhl: 'Hockey',
  mlb: 'Baseball',
};

export function competitionSeo(entry: CompetitionEntry): SeoProps {
  const title = `${entry.display} ${entry.recordLabel} Perfect Season — Draft Dogs Arcade`;
  const description = entry.blurb
    ?? `Spin a team × era and draft an XI. Simulate a perfect ${entry.recordLabel} season in ${entry.display}.`;
  const path = `/arcade/${entry.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: `Draft Dogs Arcade — ${entry.display} ${entry.recordLabel}`,
    description,
    url: `${SITE}${path}`,
    image: `${SITE}/icon-512.png`,
    applicationCategory: 'Game',
    operatingSystem: 'Web',
    genre: ['Sports', 'Strategy', 'Draft Simulator'],
    gamePlatform: 'Web Browser',
    inLanguage: 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    keywords: [
      entry.display,
      `${entry.display} perfect season`,
      `${entry.recordLabel} ${entry.display}`,
      `${SPORT_LABEL[entry.sport]} draft game`,
      'all-time XI builder',
      'fantasy draft',
    ].join(', '),
  };
  return { title, description, path, jsonLd };
}

export function hubSeo(): SeoProps {
  return {
    title: 'Draft Dogs Arcade — Perfect Season Draft Games',
    description: 'Spin a team × era, draft an XI, simulate a perfect season. 15 competitions across soccer, NBA, NFL, NHL, and MLB. Go undefeated or bust.',
    path: '/arcade',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Draft Dogs Arcade',
      url: `${SITE}/`,
      description: 'Spin a team × era, draft an XI, simulate a perfect season.',
    },
  };
}
