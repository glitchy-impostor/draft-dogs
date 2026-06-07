import { Link } from 'react-router-dom';
import '@/styles/legal.css';

const CONTACT = 'info@draftdogs.app';

export default function PrivacyPolicy() {
  return (
    <main className="legal">
      <header className="legal__head">
        <Link to="/arcade" className="legal__back" aria-label="Back to arcade">← Arcade</Link>
        <h1 className="legal__title">Privacy Policy</h1>
        <p className="legal__updated">Last updated: 2026-06-07</p>
      </header>

      <section className="legal__section">
        <h2>Who we are</h2>
        <p>
          Draft Dogs Arcade ("we", "us") is an independent, non-commercial fan project. We are not
          affiliated with, endorsed by, or sponsored by the NFL, NBA, NHL, MLB, FIFA, UEFA, the
          Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, or any club, association,
          or player. All team and player names are used under nominative fair use for editorial
          and gameplay purposes.
        </p>
        <p>
          Contact for privacy questions, data-deletion requests, or DMCA / takedown:{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>

      <section className="legal__section">
        <h2>What we collect</h2>
        <p>When you submit a run to the leaderboard, we store:</p>
        <ul>
          <li><strong>Username</strong> (chosen by you, 1–20 chars from A–Z 0–9 _ - .) — identifies your entry.</li>
          <li><strong>Competition, mode, day</strong> — to group entries on the right leaderboard.</li>
          <li><strong>Draft picks</strong> (player IDs and slot keys) — shown alongside your entry.</li>
          <li><strong>Score, record, team rating</strong> — for ranking.</li>
          <li><strong>Submission timestamp</strong> — for tie-breaking and audit.</li>
          <li><strong>Pool / sim version</strong> — to invalidate stale entries when the engine changes.</li>
        </ul>
        <p>
          When you play <em>without</em> submitting, nothing leaves your browser. Spin history,
          formation choice, and draft progress live in your browser's <code>localStorage</code>
          and on the server only as HMAC-signed state passed back and forth during the round.
        </p>
        <p>We do <strong>not</strong> collect:</p>
        <ul>
          <li>Email addresses, real names, phone numbers, or any identifying detail you don't enter as a username</li>
          <li>Passwords (there is no account system)</li>
          <li>Payment information (the project is free)</li>
          <li>Advertising or analytics cookies</li>
          <li>Third-party trackers</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>IP addresses</h2>
        <p>
          Your IP is briefly used in server memory to enforce a daily submission cap (fair play /
          spam prevention). It is <strong>not persisted to disk</strong> and is wiped whenever
          the backend restarts. We do not forward IPs to external services.
        </p>
        <p>
          Our hosting provider (Railway) may see your IP as a normal consequence of routing
          traffic; we don't control or store that data. See{' '}
          <a href="https://railway.app/legal/privacy" target="_blank" rel="noreferrer">Railway's privacy policy</a>.
        </p>
      </section>

      <section className="legal__section">
        <h2>Local storage in your browser</h2>
        <p>We use your browser's <code>localStorage</code> to remember:</p>
        <ul>
          <li>Your chosen username (so you don't retype it every game)</li>
          <li>The seed and nonce of an in-progress round (so a refresh doesn't lose your draft)</li>
        </ul>
        <p>
          This data never leaves your device unless you submit a run. You can clear it any time
          via your browser's site-data controls.
        </p>
      </section>

      <section className="legal__section">
        <h2>Where data is stored</h2>
        <p>
          The leaderboard is stored in a SQLite database on a persistent volume hosted by Railway
          (United States). Backups, if any, are managed by Railway under their security controls.
          No data is transferred to other third parties.
        </p>
      </section>

      <section className="legal__section">
        <h2>How long we keep it</h2>
        <p>
          Leaderboard entries are kept indefinitely so historical results stay visible. To delete
          your entries, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with your username and
          the approximate submission date; we'll remove them within 30 days.
        </p>
      </section>

      <section className="legal__section">
        <h2>Your rights</h2>
        <p>Depending on where you live, you may have rights to:</p>
        <ul>
          <li><strong>Access</strong> the data we hold about you.</li>
          <li><strong>Rectify</strong> inaccurate data (e.g. request a username change).</li>
          <li><strong>Erase</strong> your data ("right to be forgotten").</li>
          <li><strong>Object</strong> to processing or restrict it.</li>
          <li><strong>Portability</strong> — receive your entries in a machine-readable format (JSON on request).</li>
          <li><strong>Withdraw consent</strong> at any time, where processing is consent-based.</li>
          <li><strong>Lodge a complaint</strong> with your local data-protection authority.</li>
        </ul>
        <p>
          To exercise any of these, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Because we
          don't collect identifying details beyond a username, please include the username and
          approximate submission date so we can locate your entries.
        </p>
      </section>

      <section className="legal__section">
        <h2>Legal basis for processing (GDPR)</h2>
        <ul>
          <li><strong>Performance of the service</strong>: storing your leaderboard entry is necessary to provide the leaderboard feature you opted into by clicking "Submit".</li>
          <li><strong>Legitimate interest</strong>: ephemeral IP-based rate limiting protects the service from abuse. The processing is balanced against minimal privacy impact (no persistence, no profiling).</li>
        </ul>
      </section>

      <section className="legal__section">
        <h2>Children</h2>
        <p>
          Draft Dogs Arcade is not directed at children under 13 and we do not knowingly collect
          data from children under 13. If you believe a child has submitted an entry, email{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we'll remove it.
        </p>
        <p>
          For users between 13 and 16 in the EU/UK, parental consent may be required by local
          law. Please obtain parental consent before submitting if you fall in that range.
        </p>
      </section>

      <section className="legal__section">
        <h2>Security</h2>
        <ul>
          <li>All traffic is encrypted in transit via HTTPS (TLS terminates at Railway / GitHub Pages).</li>
          <li>Server-side run state is signed with HMAC-SHA256 using a server-only secret, so submitted runs can't be tampered with in flight.</li>
          <li>Database queries are parameterized throughout, eliminating SQL-injection vectors.</li>
          <li>The leaderboard database is not encrypted at rest. Given the minimal sensitivity of the data (username + gameplay), we consider this proportionate.</li>
        </ul>
        <p>If you discover a vulnerability, please report it to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </section>

      <section className="legal__section">
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as the project evolves. Material changes will be reflected by
          updating the "Last updated" date at the top. Previous versions are preserved in the
          project's git history.
        </p>
      </section>

      <section className="legal__section legal__section--summary">
        <h2>One-sentence summary</h2>
        <p>
          We store the username you choose and the team you drafted so the leaderboard works; we
          don't track you, sell anything, or share with anyone; email{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to delete your entries.
        </p>
      </section>
    </main>
  );
}
