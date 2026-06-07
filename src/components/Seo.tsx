// Per-route SEO helper. Updates <title>, meta description, canonical, OG/Twitter
// tags, and optionally injects a JSON-LD VideoGame blob. Modern Googlebot
// executes JS and reads these client-side updates, so this covers the
// search-engine path even when a route wasn't prerendered.

import { Helmet } from 'react-helmet-async';

export interface SeoProps {
  title: string;
  description: string;
  path: string;           // canonical path, e.g. "/arcade/nfl"
  image?: string;         // absolute or root-relative URL; defaults to /icon-512.png
  jsonLd?: object;        // optional structured-data blob
  noindex?: boolean;
}

const SITE = 'https://draftdogs.app';

export function Seo({ title, description, path, image, jsonLd, noindex }: SeoProps) {
  const url = `${SITE}${path}`;
  const img = image
    ? (image.startsWith('http') ? image : `${SITE}${image}`)
    : `${SITE}/icon-512.png`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
