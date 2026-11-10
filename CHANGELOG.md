# Changelog

All notable changes to ServerForge are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-11-10

### Added

- **Templates:** data-driven YAML/JSON templates validated with zod at startup, `extends`
  inheritance with keyed merging (`before` / `after` / `remove`), customer and reference
  placeholders, semantic validation (references, Discord limits, Community, AutoMod limits).
- **Packages:** Starter, Pro and Elite base templates; Gaming Community (Elite) and Study Group (Pro)
  themed examples.
- **Licensing:** `FORGE-XXXX-XXXX-XXXX` keys from a CSPRNG stored as HMAC hashes; single-use binding,
  re-sync, additive upgrades, revocation; per-user and per-guild rate limits on failed attempts.
- **Seller tools:** `npm run keys -- generate|list|inspect|revoke` and owner-only `/keys` in the admin
  server; payment webhook seam for automatic key delivery (not implemented).
- **`/setup`:** permission/hierarchy/limit pre-flight checks, Alongside or Clean build (typed
  confirmation), options modal, preview with Confirm/Cancel, `dry-run`, live progress, summary embed,
  owner DM, rollback button, automatic resume of interrupted builds.
- **Builder:** pure planner (diff of template vs guild + tracked resources), paced retrying queue,
  executor recording every resource for idempotency and rollback, Community enablement, announcement
  conversion on upgrade, permission repair for template roles.
- **Modules:** auto roles, button verification gate, self-assign button roles, mod & join/leave
  logging, native Discord AutoMod rules, tickets with transcripts, member-count stats channel — all
  with persistent buttons that survive restarts.
- **Commands:** `/forge status`, `/forge resync`, `/forge capture` (export a hand-built server to a
  template), tier-aware `/help`.
- **Ops:** Dockerfile, docker-compose, Railway guide, `deploy-commands`, `validate-templates`,
  `invite-url` scripts; pino structured logging; Prisma (SQLite, Postgres-ready).
- **Tests:** ~130 vitest unit tests covering templates, licensing, rate limiting, the planner,
  executor, rollback, queue, preflight, setup flow and module installers against a fake guild.
