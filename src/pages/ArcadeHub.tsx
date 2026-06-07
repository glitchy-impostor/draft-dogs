import { COMPETITIONS } from '@data/registry';
import { HubCard } from '@/components/HubCard';
import { Seo } from '@/components/Seo';
import { hubSeo } from '@/lib/seoHelpers';
import '@/styles/hub.css';

export default function ArcadeHub() {
  const live = COMPETITIONS.filter(c => c.status === 'live');
  const soon = COMPETITIONS.filter(c => c.status === 'soon');

  return (
    <main className="hub">
      <Seo {...hubSeo()} />
      <header className="hub__head">
        <span className="chip chip--live hub__live-chip">ON AIR</span>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Draft Dogs"
          className="hub__logo"
          width={88}
          height={88}
        />
        <div className="hub__brand">DRAFT DOGS</div>
        <h1 className="hub__title">ARCADE</h1>
        <p className="hub__tagline">
          Draft a dream team. Simulate a perfect season. <strong>TOP DOG</strong> or bust.
        </p>
      </header>

      {live.length > 0 && (
        <section className="hub__section">
          <h2 className="hub__section-title">
            Live
            <span className="hub__section-count">{live.length}</span>
          </h2>
          <div className="hub__grid">
            {live.map(c => <HubCard key={c.slug} entry={c} />)}
          </div>
        </section>
      )}

      <section className="hub__section">
        <h2 className="hub__section-title">
          Coming Soon
          <span className="hub__section-count">{soon.length}</span>
        </h2>
        <div className="hub__grid">
          {soon.map(c => <HubCard key={c.slug} entry={c} />)}
        </div>
      </section>

      <footer className="hub__foot">
        <p>
          Draft Dogs is an independent project, not affiliated with, endorsed by, or sponsored by
          any league, club, federation, or governing body.
        </p>
      </footer>
    </main>
  );
}
