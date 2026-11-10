# ServerForge — Implementation Plan

ServerForge is a Discord bot that sells pre-built "community setup packages" (Starter / Pro / Elite).
A buyer receives a license key, invites the bot, runs `/setup key:<key>` and the bot builds the
server from a data-driven template.

## Architecture

```
            ┌──────────────┐   interactions   ┌──────────────────────┐
 Discord ──▶│ bot/ router  │────────────────▶│ commands/ (thin)      │
            └──────┬───────┘                  └─────────┬────────────┘
                   │ events / persistent custom IDs     │ calls
                   ▼                                    ▼
            ┌──────────────┐                  ┌──────────────────────┐
            │ modules/     │◀── config ──────│ services/             │
            │ verification │                  │  template  (load/zod/ │
            │ buttonRoles  │                  │    inherit/render)    │
            │ logging      │                  │  license   (keys)     │
            │ automod      │                  │  builder   (preflight,│
            │ tickets      │                  │    planner, executor, │
            │ memberStats  │                  │    queue, rollback)   │
            │ autoRole     │                  │  setup     (flow)     │
            └──────┬───────┘                  │  rateLimit, capture   │
                   │                          └─────────┬────────────┘
                   ▼                                    ▼
            ┌───────────────────────────────────────────────────────┐
            │ db/  repository interfaces + Prisma (SQLite) + memory │
            └───────────────────────────────────────────────────────┘
```

Key principles

- **Templates are data.** YAML files in `/templates`, validated by zod at startup (fail fast).
  Inheritance via `extends`, keyed-array deep merge, placeholders rendered from customer options.
- **The planner is pure.** `plan(desiredTemplate, guildSnapshot, trackedResources, mode)` → list of
  actions. Setup, re-sync, upgrades and dry-runs all use the same diff. Fully unit-testable with a
  mocked guild snapshot.
- **The executor is dumb.** It walks actions in phase order through a rate-limited retrying queue,
  talks to Discord through a `GuildGateway` interface (fakeable), records every created resource in
  the DB immediately (crash-safe / idempotent / rollback-able) and reports progress.
- **Commands are thin.** Command handlers parse input, call a service, render an embed.
- **Persistent interactions.** Every button/modal uses a `sf:<area>:<action>:<args>` custom ID and
  state lives in the DB — nothing depends on in-memory collectors.
- **Repositories behind interfaces.** Prisma for production, in-memory for tests.

## Folder structure

```
prisma/schema.prisma            DB schema (SQLite; swap provider for Postgres)
prisma.config.ts                Prisma 7 config
templates/                      starter.yaml, pro.yaml, elite.yaml, themes/*.yaml, captured/
src/
  index.ts                      entrypoint
  config.ts                     zod-validated env
  logger.ts                     pino
  errors.ts                     UserFacingError etc.
  container.ts                  wires services together (simple DI)
  bot/                          client, interaction router, custom IDs, ui (embeds)
  commands/                     setup, forge, help, keys (owner-only), registry
  modules/                      one folder per feature module + registry + types
  services/
    template/                   schema, loader, inheritance, placeholders, registry, capture
    license/                    keygen, hashing, service, payment webhook stub
    builder/                    preflight, snapshot, planner, executor, queue, rollback, gateway
    setup/                      setup flow orchestration (sessions, preview, confirm)
    rateLimit/                  sliding-window limiter
  db/                           repository interfaces, prisma impls, memory impls
scripts/                        keys CLI, validate-templates, deploy-commands
tests/                          vitest unit tests
```

## Milestones

- [x] M0 — PLAN.md
- [x] M1 — Project scaffold: package.json, TS strict, eslint+prettier, vitest, pino, dotenv/config,
      Prisma schema, Dockerfile, docker-compose, .env.example
- [x] M2 — Template system: zod schema, loader, inheritance resolver, placeholder renderer,
      registry, validate-templates script, starter/pro/elite + one themed template, tests
- [x] M3 — License system: keygen, hashing, repository, activation/upgrade/revoke rules,
      rate limiter, keys CLI, payment webhook stub, tests
- [x] M4 — Builder: guild snapshot, planner (diff), preflight, queue with backoff, executor with
      progress + resource tracking, rollback, Discord gateway, tests with mocked guild
- [x] M5 — Bot runtime + /setup flow: client, router, custom IDs, setup sessions, modal, preview,
      confirm/cancel, dry-run, progress, rollback button, summary + owner DM, resume on restart
- [x] M6 — Feature modules: autoRole, verification, buttonRoles, logging, automod, tickets
      (+ transcripts), memberStats
- [x] M7 — Other commands: /forge status|resync|capture, /help, owner-only /keys, deploy script
- [ ] M8 — Docs: README (tiers, buyer guide, seller guide, Railway/Docker), TEMPLATES.md,
      CHANGELOG.md, DECISIONS.md; final typecheck/lint/test pass
