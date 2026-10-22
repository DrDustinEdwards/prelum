# CLAUDE.md - prelum

Prelum is the family's publishing library (`@drdustinedwards/site-helpers`): the markdown pipeline, feeds, sitemaps, llms.txt and search, plus the specimen site at https://prelum.dustinedwards.info. README.md is the reference. Public repo.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behaviour, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- `assertSafe` stays available and off by default; the specimen turns it on.
- A change to rendered HTML bumps `RENDER_VERSION` and the golden hashes together.
- Every `*.mjs` module has a hand-written `*.d.mts` twin; change both.

## Commands

- `npm run lint`, `npm run typecheck`, `npm test`: what CI runs.
- `npm run specimen` builds the specimen; a merge to `main` deploys it once the Cloudflare secrets are set.

## Releases

Every change goes in `CHANGELOG.md`. Sites pin a tag (`github:DrDustinEdwards/prelum#vX.Y.Z`); Dustin makes the tags.
