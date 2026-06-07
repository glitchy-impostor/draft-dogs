// Postbuild SEO step. Three jobs:
//   1) For each live competition, write dist/arcade/<slug>/index.html — a
//      copy of dist/index.html with the <head> rewritten for that specific
//      game (title, meta description, canonical, OG/Twitter, JSON-LD).
//      Googlebot, Bingbot, etc. read this *without* executing JS, so each
//      game URL becomes a real indexable landing page rather than the
//      generic SPA shell.
//   2) Write dist/sitemap.xml listing every URL.
//   3) Write dist/robots.txt pointing at the sitemap.
// All three run after `vite build` so the bundle hash references inside
// the shared <body> stay correct (we never touch the body).

import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const SITE = 'https://draftdogs.app';
const TODAY = new Date().toISOString().slice(0, 10);

// Keep this list in sync with data/registry.ts. Each entry is the SEO surface
// only — title, blurb, sport, status. The actual app reads the real registry.
const COMPS = [
  { slug: 'worldcup',   display: 'World Cup',         record: '8-0',   sport: 'soccer', live: true,
    blurb: 'Spin a nation × era. Build an XI. Win the World Cup 8-0.' },
  { slug: 'epl',        display: 'Premier League',    record: '38-0',  sport: 'soccer', live: true,
    blurb: 'Spin a club × era. Draft an XI. Go unbeaten across 38 games — table position included.' },
  { slug: 'laliga',     display: 'LaLiga',            record: '38-0',  sport: 'soccer', live: true,
    blurb: 'Spin a club × era. El Clásico-era picks. 38 invencible.' },
  { slug: 'seriea',     display: 'Serie A',           record: '38-0',  sport: 'soccer', live: true,
    blurb: 'Calcio across the decades. Scudetto-era greats.' },
  { slug: 'bundesliga', display: 'Bundesliga',        record: '34-0',  sport: 'soccer', live: true,
    blurb: 'Meisterschale chaser. Bayern + BVB at full strength.' },
  { slug: 'ligue1',     display: 'Ligue 1',           record: '34-0',  sport: 'soccer', live: true,
    blurb: 'Spin a French club × era. Mbappé to Papin and back.' },
  { slug: 'mls',        display: 'MLS',               record: '34-0',  sport: 'soccer', live: true,
    blurb: 'From Beckham’s Galaxy to Chicharito. 34-0 in the new league.' },
  { slug: 'ucl',        display: 'Champions League',  record: '15-0',  sport: 'soccer', live: true,
    blurb: 'Spin a European super-club × era. League phase + KO. Win 15 straight.' },
  { slug: 'euros',      display: 'Euros',             record: '7-0',   sport: 'soccer', live: true,
    blurb: 'Spin a European nation × era. 7 games to lift the trophy.' },
  { slug: 'copa',       display: 'Copa América',      record: '6-0',   sport: 'soccer', live: true,
    blurb: 'Spin a South American nation × era. Win the Copa.' },
  { slug: 'mixedbag',   display: 'World League',      record: '38-0',  sport: 'soccer', live: true,
    blurb: 'Fictional 20-team World League: any club, any era. 38-0 or bust.' },
  { slug: 'nba',        display: 'NBA',               record: '82-0',  sport: 'nba',    live: true,
    blurb: 'Spin a franchise × decade. Decades Rule: no repeats. Five picks, no positions. Win all 82.' },
  { slug: 'nfl',        display: 'NFL',               record: '17-0',  sport: 'nfl',    live: true,
    blurb: 'Spin a franchise × era. 8 typed slots (QB, RB, WR×2, TE, OL, Front-7, DB). Go 17-0.' },
  { slug: 'nhl',        display: 'NHL',               record: '82-0',  sport: 'nhl',    live: true,
    blurb: 'Spin a franchise × era. 6 slots (LW, C, RW, D, D, G). Sweep the season.' },
  { slug: 'mlb',        display: 'MLB',               record: '162-0', sport: 'mlb',    live: true,
    blurb: 'Spin a franchise × era. 10 typed slots (SP, C, 4 IF, 3 OF, DH). 162-0 is mythic.' },
];

const SPORT_LABEL = {
  soccer: 'Soccer', nba: 'Basketball', nfl: 'Football', nhl: 'Hockey', mlb: 'Baseball',
};

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function gameHead(c) {
  const title = `${c.display} ${c.record} Perfect Season — Draft Dogs Arcade`;
  const desc  = c.blurb;
  const url   = `${SITE}/arcade/${c.slug}`;
  const image = `${SITE}/icon-512.png`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: `Draft Dogs Arcade — ${c.display} ${c.record}`,
    description: desc,
    url,
    image,
    applicationCategory: 'Game',
    operatingSystem: 'Web',
    genre: ['Sports', 'Strategy', 'Draft Simulator'],
    gamePlatform: 'Web Browser',
    inLanguage: 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    keywords: [
      c.display, `${c.display} perfect season`, `${c.record} ${c.display}`,
      `${SPORT_LABEL[c.sport]} draft game`, 'all-time XI builder', 'fantasy draft',
    ].join(', '),
  };
  return `
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Draft Dogs Arcade" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(desc)}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  `.trim();
}

// Replace whatever sits between <!-- seo:start --> and <!-- seo:end --> with
// the game-specific SEO block. The markers live in index.html (next to the
// homepage default), and Vite passes them through to dist/index.html
// untouched, so they're stable anchors.
const SEO_BLOCK_RE = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;

function rewriteHead(tpl, headFragment) {
  const wrapped = `<!-- seo:start -->\n    ${headFragment}\n    <!-- seo:end -->`;
  if (!SEO_BLOCK_RE.test(tpl)) {
    throw new Error('postbuild-seo: <!-- seo:start --> / <!-- seo:end --> markers missing from dist/index.html');
  }
  return tpl.replace(SEO_BLOCK_RE, wrapped);
}

const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
let written = 0;

for (const c of COMPS) {
  if (!c.live) continue;
  const dir = path.join(DIST, 'arcade', c.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = rewriteHead(index, gameHead(c));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  written++;
}

// Sitemap
const urls = [
  { loc: `${SITE}/arcade`, priority: '1.0' },
  ...COMPS.filter(c => c.live).map(c => ({
    loc: `${SITE}/arcade/${c.slug}`,
    priority: '0.9',
  })),
  { loc: `${SITE}/privacy`, priority: '0.3' },
];
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => (
    `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`
  )).join('\n') + `\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

// robots.txt
const robots =
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots);

console.log(`postbuild-seo: ${written} per-game pages, sitemap.xml (${urls.length} urls), robots.txt`);
