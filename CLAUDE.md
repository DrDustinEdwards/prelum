# CLAUDE.md - prelum

Prelum is the family's publishing library (`@drdustinedwards/site-helpers`): the markdown pipeline, feeds, sitemaps, llms.txt and search, plus the specimen site at https://prelum.dustinedwards.info. README.md is the reference. Public repo.

## Rules every repo shares

- **Tests.** Reproduce a reported failure before fixing it, and report red before and green after. Keep the minimal set: a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives. Remove a test that pins design, repeats coverage or never caught a mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, "this page lets you" intros, hints a label already gives or empty-state essays. Labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, check https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md. Change shared code in place and delete what the change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md: Baseline Widely available freely, Newly available with a small fallback, Limited only feature-detected, no polyfills.
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Deploys.** A merge to the default branch deploys; never deploy from a session.
- **Releases.** A PR adds a changeset (`npx changeset`, `--empty` when nothing ships) and never edits the version or CHANGELOG.md. A release is its own PR running `npx changeset version` on main; merging it publishes. Nobody tags by hand; consumers pin a tag (Dustin, 2026-11-13).

## Rules for this repo

- `assertSafe` stays available and off by default; the specimen turns it on.
- The types are the JSDoc in each `*.mjs`; the release builds the declarations into `dist/` (`prepare`). There are no hand-written `*.d.mts` files.

## Commands

- `npm run lint`, `npm run typecheck`, `npm test`: what CI runs.
- `npm run specimen` builds the specimen; a merge to `main` deploys it once the Cloudflare secrets are set.
