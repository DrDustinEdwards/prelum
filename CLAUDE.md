# CLAUDE.md - prelum

Prelum is the family's publishing library (`@drdustinedwards/site-helpers`): the markdown pipeline, feeds, sitemaps, llms.txt and search, plus the specimen site at https://prelum.dustinedwards.info. README.md is the reference. Public repo.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- `assertSafe` stays available and off by default; the specimen turns it on.
- Every `*.mjs` module has a hand-written `*.d.mts` twin; change both.

## Commands

- `npm run lint`, `npm run typecheck`, `npm test`: what CI runs.
- `npm run specimen` builds the specimen; a merge to `main` deploys it once the Cloudflare secrets are set.

## Releases

A pull request adds a changeset (`npx changeset`; `--empty` when there is nothing to release) and never sets the version or writes `CHANGELOG.md`. A release is its own pull request, `npx changeset version` on main, made when a site needs what has merged; merging it is the release (`.github/workflows/release.yml` tags it and publishes it; nobody tags by hand). Sites pin a tag (`github:DrDustinEdwards/prelum#vX.Y.Z`). Dustin's ruling, 2026-11-13.
