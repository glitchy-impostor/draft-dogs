import { Link } from 'react-router-dom';

const CONTACT = 'info@draftdogs.app';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__line">
        Draft Dogs Arcade is an independent fan project, not affiliated with or endorsed by the
        NFL, NBA, NHL, MLB, FIFA, UEFA, or any league, club, or player. Team and player names
        used under nominative fair use.
      </p>
      <nav className="site-footer__nav" aria-label="Site links">
        <Link to="/privacy">Privacy</Link>
        <span className="site-footer__sep" aria-hidden="true">·</span>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </nav>
    </footer>
  );
}
