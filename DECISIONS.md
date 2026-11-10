# Design decisions

Decisions made where the brief didn't specify, with the reasoning. Newest last.

## Stack & tooling

1. **Prisma 7 with the better-sqlite3 driver adapter.** Prisma 7 is current and engine-less (no
   Rust query engine download). The generated client goes to `src/generated/prisma` (git-ignored,
   regenerated on `npm install`) with `.js` import extensions so the compiled output runs on plain Node.
2. **JSON columns stored as `String`.** Keeps the schema identical on SQLite and Postgres.
3. **TypeScript 6.0, ESLint 9 + typescript-eslint (type-checked rules), vitest 4.** TypeScript 7
   (native) isn't supported by typescript-eslint yet.
4. **`.npmrc` sets `legacy-peer-deps=true`.** npm 10's resolver crashes on vitest 4's optional peer
   graph; this only affects peer resolution.
5. **`prisma` is a runtime dependency** so the Docker image can run `prisma migrate deploy` on start.

## Templates

6. **YAML (JSON also accepted)**, loaded recursively from `TEMPLATES_DIR` (so `themes/` and
   `captured/` work). Template ids, not file names, identify templates.
7. **Two-stage validation:** raw files may be partial (because of `extends`); the _merged_ result is
   validated with a strict zod schema (unknown fields rejected) plus semantic checks (references,
   Discord limits, Community requirements, placeholders). All problems across all templates are
   reported at once, with key-based paths like `categories[info].channels[rules].type`. A broken
   parent is reported once; its children are marked "skipped".
8. **Inheritance = keyed deep merge.** Lists of objects with `key` merge by key with
   `before`/`after`/`remove`; other lists replace. Generic, so new keyed structures need no code.
9. **Every template has a `tier`.** Keys carry tier + optional template id; base tier templates must
   use ids `starter`/`pro`/`elite`. Themed templates are sold by generating keys with `--template`.
10. **Placeholders** render in two phases: customer values up front, `{{channel:key}}`/`{{role:key}}`
    when messages are posted (they need Discord ids). Added `{{brandColorLight}}`/`{{brandColorDark}}`
    so Elite can derive a full colour scheme from one brand colour.
11. **Channel overwrites = category overwrites + channel overrides** (by role). Omitting `overwrites`
    means "synced with category", matching how people think about Discord permissions.
12. **Starter has an `autoRole` module** (Member for humans, Bots for bots). Without it Starter's
    Member role would never be assigned. Pro sets `memberRole: null` because verification grants it.
13. **The Bots role has basic permissions** so a customer's other bots keep working behind Pro's
    verification gate (which removes `ViewChannel` from @everyone).

## Licensing

14. **Keys: 12 chars from a 32-symbol alphabet** without look-alikes (0/O/1/I) → 60 bits from
    `crypto.randomInt`. Input is normalised (case, spaces, missing dashes).
15. **Stored as HMAC-SHA256 with `LICENSE_PEPPER`**, plus the last 4 characters for masked display.
    A leaked database can't be used to recover keys or brute-force them offline.
16. **The key binds at Confirm, not at `/setup`.** Previews, dry-runs and cancelled sessions never
    consume a key. Binding uses a conditional update (compare-and-set) so two servers can't race.
17. **Upgrade rules:** higher tier → upgrade; same tier + different themed template → additive theme
    switch; lower or identical package → refused _without_ consuming the key. Re-using an older key in
    an upgraded server re-syncs with the server's _current_ license (never downgrades).
18. **Failed-attempt rate limits are in memory** (sliding window, per user and per guild). Fine for
    the single-process deployment; the limiter's interface is small enough to back with Redis later.
    All user-facing activation failures (unknown, revoked, used elsewhere, downgrade) count.
19. **Seller tooling:** the CLI uses the same `LicenseService` as the bot. `/keys` is registered only
    in `ADMIN_GUILD_ID` _and_ checked against `OWNER_USER_ID` at runtime.

## Builder

20. **Planner is a pure diff** (template × guild snapshot × tracked resources → actions). Setup,
    upgrade, re-sync, dry-run and crash-resume all use it, which is what makes them consistent.
21. **Existing resources are never modified, except:** permission overwrites _for template roles_
    are repaired, @everyone base permissions follow the template when it defines them, and a plain
    text channel becomes an announcement channel on Elite. Role colours/names are not overwritten on
    re-sync, so customer tweaks survive.
22. **"Build alongside" adopts same-name resources** (roles case-insensitively; channels by
    Discord-normalised name _and_ expected parent category) instead of creating duplicates. Adopted
    resources are tracked with `created=false` and are never deleted by rollback.
23. **Overwrites are applied when channels are created** (not in a later pass) so private channels
    are never briefly public. The separate "permissions" phase only repairs existing channels.
24. **Community is enabled automatically** when a template needs it (Elite). If Discord refuses,
    announcement → text and stage → voice with a warning, rather than failing the build.
25. **Clean build** deletes every channel/role the bot can delete, but keeps: the channel `/setup` was
    run in (so the progress message survives), Community rules/updates channels (Discord forbids
    deleting them), categories still holding kept channels, managed roles and roles above the bot.
    It requires typing `CLEAN BUILD` in the options modal.
26. **Queue:** concurrency 1, 250 ms spacing, 4 retries with exponential backoff + jitter, honouring
    `retry-after`. discord.js already handles per-route 429s; the queue adds pacing and retries for
    5xx/network errors. Permission/validation errors fail immediately.
27. **Every created resource is written to the DB immediately with the run id.** Rollback deletes
    only what that run created (reverse dependency order) and restores modified settings (@everyone
    permissions, Community). Resources deleted by a clean build can't be restored — the preview says so.
28. **Crash resume is automatic:** on startup, runs still marked `running` are marked `interrupted`
    and re-executed by re-planning (the planner skips what exists). The owner is DM'd when done.
    Re-running `/setup` with the same key also resumes.
29. **One build per guild at a time** (in-process lock).
30. **Preflight requires Administrator or every permission the template grants**, because Discord
    only lets a bot grant permissions it has. Since shipped templates create Administrator roles,
    the invite link requests Administrator.

## Setup flow & UX

31. **Flow:** `/setup` → mode buttons (Alongside / Clean / Cancel) → options modal (name, colour,
    - typed confirmation for clean) → preview with Confirm/Cancel → live progress → summary.
      Upgrades and re-syncs don't offer Clean build.
32. **Setup sessions are stored in the DB** (30-minute TTL) and referenced from custom IDs, so the
    flow survives restarts. Only the user who ran `/setup` can press its buttons.
33. **Dry-run** uses defaults (guild name, template colour, alongside) and skips the modal.
34. **Summary embed** goes to the template's `summaryChannel` (staff-only: mod-log on Pro, staff-chat
    on Elite; none on Starter) — never a public channel. The owner gets a DM with next steps
    (silently skipped if their DMs are closed).
35. **Unexpected errors** show a generic embed with a short reference code that is logged with
    full context, so support can find it.

## Modules

36. **Each module = installer + runtime + pure logic.** Installers are idempotent and track panels /
    AutoMod rules like any other resource (resync re-posts deleted panels; rollback removes them).
    Runtime handlers read per-guild config (Discord ids) from the DB through a 30 s TTL cache.
37. **Verification grants the verified role to existing members once** when the gate is first
    enabled, so turning on Pro doesn't lock out the current community. Done sequentially via the
    members list (fine for typical customer servers; very large servers will take a while).
38. **AutoMod rules Discord refuses** (e.g. the server already has its own spam rule; Discord allows
    one) are skipped with a warning instead of failing the build.
39. **Ticket transcripts are plain `.txt`** (readable anywhere, no HTML sanitising concerns), posted
    to the ticket log channel with a summary embed and DM'd to the opener. Openers, staff roles and
    anyone with Manage Channels can close; closing asks for confirmation.
40. **Member count updates are coalesced** to one rename per ~5.5 min per guild (Discord allows ~2
    renames per 10 min per channel), plus a catch-up on startup.
41. **Privileged intents:** Server Members (auto roles, logs, member count, verifying existing members)
    and Message Content (transcripts, edit/delete logs). Documented in the README.
42. **Button role panels aren't edited in place** when a template changes; delete the panel message
    and run `/forge resync` to re-post it. Keeps installers simple and avoids clobbering customer edits.

## Capture

43. **`/forge capture` writes `templates/captured/<id>.yaml` _and_ attaches the file**, because
    container filesystems (Railway) may be ephemeral or read-only. It refuses to overwrite an
    existing file or clash with an existing template id, and validates the result with the real
    loader. Per-user overwrites and managed roles are dropped (with a note); channels whose
    permissions match their category are emitted as "synced". New templates load on restart.
44. Capture targets the current server by default, or any server the bot is in via `guild-id`, so
    you can design in a separate server and capture from your admin server.

## Payments

45. **Payments are a documented seam only** (`src/services/license/payments.ts`): `PaymentProvider`,
    `KeyDelivery`, `fulfilPurchase` (tested with fakes) and a Stripe stub that throws.
