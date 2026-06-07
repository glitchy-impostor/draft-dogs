# Privacy Policy — Draft Dogs Arcade

**Last updated**: 2026-06-07

> **Notice**: This document is a draft template prepared for an indie hobby project. It is not legal advice. Before relying on it for a public-facing service, verify with a privacy-policy generator (Termly, Iubenda, PrivacyPolicies.com) or a lawyer, especially if your audience includes the EU, UK, California, or under-13s.

## Who we are

Draft Dogs Arcade ("we", "us") is an independent, non-commercial fan project. We are not affiliated with, endorsed by, or sponsored by the NFL, NBA, NHL, MLB, FIFA, UEFA, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, or any club, association, or player. All team and player names are used under nominative fair use for editorial and gameplay purposes.

Contact for privacy questions, data-deletion requests, or DMCA / takedown:
**info@draftdogs.app**

## What we collect

When you submit a run to the leaderboard, the following is stored:

| Field | Purpose |
|---|---|
| **Username** (chosen by you, 1–20 chars from A–Z 0–9 _ - .) | Identify entries on the leaderboard. |
| **Competition, mode, day** | Group entries on the correct leaderboard. |
| **Draft picks** (player IDs and slot keys) | Show the team behind each entry; verify the run is valid. |
| **Score, record, team rating** | Rank entries. |
| **Submission timestamp** (epoch seconds) | Tie-breaking and audit. |
| **Pool / sim version** | Invalidate stale entries when the engine changes. |

When you play *without* submitting, nothing leaves your browser. Spin history, formation choice, and draft progress live in your browser's `localStorage` and on the server only as HMAC-signed state passed back and forth during the round.

We do **not** collect:

- Email addresses, real names, phone numbers, or any other identifying detail you don't enter as a username
- Passwords (there is no account system)
- Payment information (the project is free)
- Cookies for advertising or analytics
- Third-party trackers

## IP addresses

Your IP is briefly used in server memory to enforce a daily submission cap (fair play; prevent leaderboard spam). The IP is **not persisted to disk** and is wiped whenever the backend restarts. We do not log full request bodies or IPs to any external service.

Our hosting provider (Railway) and any CDN in front of us may see your IP as a normal consequence of routing traffic; we don't control or store that data. See Railway's privacy policy at [railway.app/legal/privacy](https://railway.app/legal/privacy).

## Local storage in your browser

We use your browser's `localStorage` to remember:

- Your chosen username (so you don't retype it every game)
- The seed and nonce of an in-progress round (so a refresh doesn't lose your draft)

This data never leaves your device unless you submit a run. You can clear it at any time via your browser's site-data controls.

## Where data is stored

The leaderboard is stored in a SQLite database on a persistent volume hosted by **Railway** (United States). Backups, if any, are managed by Railway under their security controls. No data is transferred to other third parties.

## How long we keep it

Leaderboard entries are kept indefinitely so historical results remain visible. If you'd like your entries deleted, email the contact address above with your username and the approximate date; we'll remove them within 30 days. There is no automatic deletion at this time.

## Your rights

Depending on where you live, you may have rights to:

- **Access** the data we hold about you (your leaderboard entries, identified by username).
- **Rectify** inaccurate data (e.g., request a username change).
- **Erase** your data ("right to be forgotten").
- **Object** to processing or restrict it.
- **Portability** — receive your entries in a machine-readable format (JSON export available on request).
- **Withdraw consent** at any time, where processing is consent-based.
- **Lodge a complaint** with your local data-protection authority (e.g., the ICO in the UK, your state Data Protection Authority in the EU, the California Attorney General's office in California).

To exercise any of these, email the contact address. Because we don't collect identifying details beyond a username, you'll need to provide enough context for us to locate your entries (username + approximate submission date).

## Legal basis for processing (GDPR)

- **Performance of the service**: storing your leaderboard entry is necessary to provide the leaderboard feature you opted into by clicking "Submit".
- **Legitimate interest**: ephemeral IP-based rate limiting protects the service from abuse. This processing is balanced against the minimal privacy impact (no persistence, no profiling).

## Children

Draft Dogs Arcade is not directed at children under 13 and we do not knowingly collect data from children under 13. If you believe a child has submitted an entry, email the contact address and we'll remove it.

For users between 13 and 16 in the EU/UK, parental consent may be required by local law for processing. If you fall in that range, please obtain parental consent before submitting.

## Security

- All traffic between your browser and our backend is encrypted in transit via HTTPS (TLS terminates at Railway).
- Server-side run state is signed with HMAC-SHA256 using a server-only secret, so submitted runs can't be tampered with in flight.
- The database uses parameterized queries throughout, eliminating SQL-injection vectors.
- The leaderboard database is not encrypted at rest. Given the minimal sensitivity of the data (chosen username + gameplay), we consider this proportionate.

No system is perfectly secure. If you discover a vulnerability, please report it to the contact address.

## Changes to this policy

We may update this policy as the project evolves. Material changes will be reflected by updating the "Last updated" date at the top. The previous version is preserved in the project's git history.

## Jurisdiction

This policy is provided as-is. The project is operated as a hobby and does not target users in any particular jurisdiction. If you visit from a region with stricter privacy requirements (EU, UK, California, etc.), the protections of your local law apply.

## Summary in one sentence

We store the username you choose and the team you drafted so the leaderboard works; we don't track you, sell anything, or share with anyone; email us to delete your entries.
