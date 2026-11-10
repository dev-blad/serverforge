# ServerForge

**ServerForge** is a Discord bot that sells ready-made _community setup packages_. A buyer gets a
license key, invites the bot, runs `/setup`, and ServerForge builds a complete, consistent,
professional server — roles, categories, channels, permissions, welcome & rules embeds and
feature modules — in a couple of minutes.

Everything is driven by **data templates** (`templates/*.yaml`), so every customer gets an identical
build and new themed packages can be added without touching code.

- [Packages](#packages)
- [For buyers: setting up your server](#for-buyers-setting-up-your-server)
- [For the seller](#for-the-seller)
  - [1. Create the Discord application](#1-create-the-discord-application)
  - [2. Configure & run locally](#2-configure--run-locally)
  - [3. Sell keys](#3-sell-keys)
  - [4. Deploy (Docker / Railway)](#4-deploy)
  - [5. Add or change templates](#5-add-or-change-templates)
  - [Commands reference](#commands-reference)
  - [Architecture](#architecture)
  - [Manual test checklist](#manual-test-checklist)

Other docs: [TEMPLATES.md](TEMPLATES.md) (template format) · [DECISIONS.md](DECISIONS.md) ·
[CHANGELOG.md](CHANGELOG.md) · [PLAN.md](PLAN.md)

---

## Packages

|                                                                                     | **Starter** |   **Pro**   |  **Elite**   |
| ----------------------------------------------------------------------------------- | :---------: | :---------: | :----------: |
| Core roles (Owner, Admin, Moderator, Member, Bots)                                  |     ✅      |     ✅      |      ✅      |
| Welcome, rules, announcements, general, off-topic, media                            |     ✅      |     ✅      |      ✅      |
| Voice lounge                                                                        |     ✅      |     ✅      |      ✅      |
| Sensible default permissions (read-only info channels, staff overrides)             |     ✅      |     ✅      |      ✅      |
| Rules & welcome embeds in your brand colour                                         |     ✅      |     ✅      |      ✅      |
| Auto-role for new members & bots                                                    |     ✅      |  bots only  |  bots only   |
| Button **verification gate** (unverified users only see #verify)                    |             |     ✅      |      ✅      |
| **Self-assign roles** — pronouns, regions, notification pings                       |             |     ✅      |      ✅      |
| **Mod-log** & **join/leave log** with logging enabled                               |             |     ✅      |      ✅      |
| Discord-native **AutoMod** (slurs/sexual content, spam, mention spam, invite links) |             |     ✅      |      ✅      |
| Suggestions channel                                                                 |             |     ✅      |      ✅      |
| **Ticket system** — panel, private channels, close + transcript to a log channel    |             |             |      ✅      |
| Staff-only category (staff chat, staff voice, ticket logs)                          |             |             |      ✅      |
| Events category with **stage** channel                                              |             |             |      ✅      |
| Support **forum** (FAQ with tags)                                                   |             |             |      ✅      |
| **Followable announcement** channel (Community enabled automatically)               |             |             |      ✅      |
| Live **member-count** stats channel                                                 |             |             |      ✅      |
| Full **brand colour scheme** on staff roles and embeds                              |             |             |      ✅      |
| Roles / categories / channels                                                       |  5 / 3 / 7  | 17 / 5 / 12 | 19 / 10 / 20 |

Themed variants ship as examples: **Gaming Community** (Elite: LFG, squad voice, clips forum, game
roles) and **Study Group** (Pro: subject channels, resources forum, focus rooms). Upgrading is
additive — activating a higher-tier key in an already-built server adds only what's missing.

---

## For buyers: setting up your server

You'll need: the **license key** you received (`FORGE-XXXX-XXXX-XXXX`) and to be the **server
owner** or have **Administrator**.

1. **Invite ServerForge** with the link the seller gave you. Keep the _Administrator_ box ticked —
   ServerForge needs it to create roles and private channels.
2. **Move the ServerForge role to the top.** Open _Server Settings → Roles_ and drag **ServerForge**
   above every other role. (ServerForge can only manage roles below its own.)
3. In any channel, type **`/setup`** and paste your key into the `key` box.
   _Want to look first?_ Use `/setup key:<your key> dry-run:True` — it only shows what would be
   created.
4. Choose how to build:
   - **➕ Build alongside existing** — keeps everything you have and adds the package. If you
     already have a role or channel with the same name (e.g. `#general`), it's reused instead of
     duplicated.
   - **🧹 Clean build** — deletes the existing channels and roles ServerForge is able to delete,
     then builds from scratch. You'll have to type `CLEAN BUILD` to confirm. _This can't be undone._
5. Enter your **server display name** and **brand colour** (e.g. `#5865F2`).
6. Check the **preview** — it lists exactly how many roles, channels and embeds will be created and
   warns you about anything important. Press **Confirm & build**.
7. Watch the live progress. When it's done you'll get a summary, and ServerForge DMs the owner a
   short "what to do next" guide.

**After setup**

- `/forge status` — shows your package, key (masked), build date and enabled features.
- `/forge resync` — someone deleted a channel or role from the package? This re-creates anything
  missing. It never touches channels or roles you added yourself.
- `/help` — explains the features active in your server.
- **Upgrading:** run `/setup` with your new higher-tier key. Only the new things are added.

**Troubleshooting**

| Message                                                 | What to do                                                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _ServerForge is missing permissions_                    | Give the ServerForge role **Administrator** (Server Settings → Roles), or re-invite with the link.                                                               |
| _…is above ServerForge's role_                          | Drag the **ServerForge** role higher in Server Settings → Roles, then run `/setup` again.                                                                        |
| _This key has already been activated in another server_ | Each key works in one server. Contact the seller.                                                                                                                |
| _Too many invalid key attempts_                         | Wait the time shown, then check the key was copied exactly.                                                                                                      |
| Build failed part-way                                   | Fix the reason shown and run `/setup` again with the same key — it **resumes** where it stopped. Or press **Roll back** to remove everything that build created. |

---

## For the seller

### 1. Create the Discord application

1. Go to <https://discord.com/developers/applications> → **New Application** → name it _ServerForge_.
2. **General Information** → copy the **Application ID** → `DISCORD_CLIENT_ID`.
3. **Bot** → **Reset Token** → copy → `DISCORD_TOKEN`. Under **Privileged Gateway Intents** enable:
   - **Server Members Intent** — auto roles, join/leave logs, verifying existing members, member count;
   - **Message Content Intent** — ticket transcripts and edit/delete logs include message text.

   (Bots in more than 100 servers need Discord's approval for these.)

4. Turn on Developer Mode in Discord (_User Settings → Advanced_) and copy:
   your **user ID** → `OWNER_USER_ID`, and the ID of your private **admin server** → `ADMIN_GUILD_ID`.

The **invite link** for buyers (Administrator + slash commands):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&integration_type=0&scope=bot+applications.commands
```

`npm run invite-url` prints it with your client ID filled in.

### 2. Configure & run locally

Requirements: **Node.js 20.19+** (22 LTS recommended).

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # then fill it in (see below)
npm run db:migrate            # create/upgrade the SQLite database
npm run validate-templates    # check all templates
npm run dev                   # start with auto-reload (or: npm run build && npm start)
```

Slash commands are **registered automatically when the bot starts**. Global commands can take up to
an hour to appear. For testing, set `DEV_GUILD_ID` to your test server: every command then appears
there instantly (and nowhere else). Remove it when you start selling.

| Variable                                                                          | Required | Description                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                                                                   |    ✅    | Bot token.                                                                                                                                                                                                             |
| `DISCORD_CLIENT_ID`                                                               |    ✅    | Application ID.                                                                                                                                                                                                        |
| `OWNER_USER_ID`                                                                   |    ✅    | Your Discord user ID — the only user allowed to use seller commands.                                                                                                                                                   |
| `ADMIN_GUILD_ID`                                                                  |    ✅    | Your private server; seller commands (`/keys`, `/forge capture`) only work here.                                                                                                                                       |
| `LICENSE_PEPPER`                                                                  |    ✅    | Secret (≥16 chars) used to hash keys. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never change it after selling keys** — existing keys would stop working. Back it up. |
| `DATABASE_URL`                                                                    |          | Default `file:./data/serverforge.db`.                                                                                                                                                                                  |
| `DEV_GUILD_ID`                                                                    |          | Test mode: all commands appear instantly in this server only. Remove it before selling.                                                                                                                                |
| `LOG_LEVEL`                                                                       |          | `trace`…`fatal`, default `info`.                                                                                                                                                                                       |
| `LOG_PRETTY`                                                                      |          | `true` for human-readable logs (needs dev dependencies).                                                                                                                                                               |
| `TEMPLATES_DIR`                                                                   |          | Default `./templates`.                                                                                                                                                                                                 |
| `KEY_ATTEMPTS_PER_USER` / `KEY_ATTEMPTS_PER_GUILD` / `KEY_ATTEMPT_WINDOW_SECONDS` |          | Failed-key rate limits (default 5 / 15 per 900 s).                                                                                                                                                                     |
| `SUPPORT_URL`                                                                     |          | Shown in `/help` and the owner DM.                                                                                                                                                                                     |

### 3. Sell keys

Each key is `FORGE-XXXX-XXXX-XXXX`, generated with a cryptographically secure RNG. Only an HMAC
hash is stored, so **the key is shown once** — copy it into your order message.

**CLI** (run where the database lives — locally, `docker compose exec`, or Railway's shell):

```bash
npm run keys -- generate --tier pro --count 5 --note "fiverr order 123"
npm run keys -- generate --tier elite --template gaming --note "etsy 9981"   # themed package
npm run keys -- list --status unused --tier pro
npm run keys -- inspect FORGE-ABCD-EFGH-JKMN          # or a license id
npm run keys -- revoke  FORGE-ABCD-EFGH-JKMN
```

In Docker the compiled CLI is `node dist/scripts/keys.js …` (e.g.
`docker compose exec serverforge node dist/scripts/keys.js list`).

**Slash commands** (only for `OWNER_USER_ID`, only in `ADMIN_GUILD_ID`): `/keys generate`,
`/keys list`, `/keys inspect`, `/keys revoke`.

**Key rules**

- Single use: the first successful `/setup` binds the key to that server. Re-running `/setup` there
  with the same key re-syncs; any other server is rejected.
- A higher-tier key in an already-built server **upgrades** it (only the difference is added).
  A same-tier key for a different themed template switches theme additively. Lower/same-tier keys
  are refused **without** being consumed, so the buyer can use them elsewhere.
- Failed attempts are rate-limited per user and per server.
- Revoked keys can't be used for new setups or re-syncs.

**Automatic delivery (future):** `src/services/license/payments.ts` defines the seam for a payment
webhook (`PaymentProvider`, `KeyDelivery`, `fulfilPurchase`, `PRODUCT_TIERS`) with step-by-step
notes for Stripe. No payment code is implemented.

### 4. Deploy

#### Docker / docker compose

```bash
cp .env.example .env    # fill it in
docker compose up -d --build
docker compose logs -f
docker compose exec serverforge node dist/scripts/keys.js generate --tier pro --note "order 1"
```

The image runs `prisma migrate deploy` on start, then the bot. The SQLite database lives in the
`serverforge-data` volume (`/app/data`), and `./templates` is mounted so you can add templates
without rebuilding (restart to load them). Slash commands register automatically on startup.

#### Railway

1. Push this repo to GitHub. In Railway: **New Project → Deploy from GitHub repo**. Railway detects
   the `Dockerfile` automatically.
2. **Variables**: add everything from `.env.example` (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`,
   `OWNER_USER_ID`, `ADMIN_GUILD_ID`, `LICENSE_PEPPER`, …) and set
   `DATABASE_URL=file:/app/data/serverforge.db`.
3. **Volume** (essential for SQLite): service → **Settings → Volumes → Add volume**, mount path
   **`/app/data`**. Without it the database — and every sold key — is lost on each deploy.
4. No public domain/port is needed (the bot only makes outbound connections).
5. Deploy. Check **Deployments → Logs** for `ServerForge is online`.
6. Slash commands register automatically when the bot starts (set `DEV_GUILD_ID` to your test server to see them instantly).
7. Generate keys from Railway's shell: service → **⋯ → Shell** (or `railway ssh`) →
   `node dist/scripts/keys.js generate --tier pro --note "order 1"`.

Run a **single replica** — build sessions and rate limits are per process.

#### Moving to Postgres

Change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, install
`@prisma/adapter-pg`, swap the adapter in `src/db/prisma.ts` (`new PrismaPg({ connectionString })`),
point `DATABASE_URL` at Postgres and create a fresh migration (`npx prisma migrate dev --name postgres`).
All JSON is stored as text, so no other changes are needed.

### 5. Add or change templates

See **[TEMPLATES.md](TEMPLATES.md)** for the full format. In short:

1. Add `templates/themes/<name>.yaml` with `extends: pro` (or another tier) and only the differences.
2. `npm run validate-templates`.
3. Restart the bot, then `npm run keys -- generate --tier pro --template <id>`.

Never rename a role/channel **key** in a template you've already sold (renaming `name` is fine):
keys are how re-syncs and upgrades recognise existing resources.

#### Capturing a server you designed

Design a server by hand, invite ServerForge to it, then in your **admin server** run:

```
/forge capture id:crypto-pro tier:pro name:"Crypto Pro" guild-id:<design server id>
```

ServerForge snapshots roles (colours, permissions, order), categories, channels (type, topic,
slowmode, NSFW, voice limits, forum tags) and role permission overwrites into a validated YAML file.
It's saved to `templates/captured/<id>.yaml` and attached to the reply. Add `messages` and `modules`
(or turn it into an `extends:` template), validate, restart.

### Commands reference

| Command                                 | Who                          | What                                                             |
| --------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `/setup key:<key> [dry-run]`            | Server owner / Administrator | Build, upgrade or re-sync the server; `dry-run` only previews.   |
| `/forge status`                         | Manage Server                | Tier, masked key, build date, modules, last build.               |
| `/forge resync`                         | Owner / Administrator        | Re-create deleted package items; never touches custom additions. |
| `/forge capture`                        | Seller, admin server         | Export a server into a template file.                            |
| `/help`                                 | Everyone                     | Tier-aware help and upgrade info.                                |
| `/keys generate\|list\|inspect\|revoke` | Seller, admin server         | Manage license keys.                                             |

| Script                                             |                                             |
| -------------------------------------------------- | ------------------------------------------- |
| `npm run dev` / `build` / `start`                  | Run with tsx watch / compile / run compiled |
| `npm run typecheck` / `lint` / `test` / `coverage` | Quality gates                               |
| `npm run validate-templates [-- --dir path]`       | Validate templates                          |
| `npm run deploy-commands [-- --clear]`             | Register (or clear) slash commands manually |
| `npm run keys -- …`                                | License key CLI                             |
| `npm run invite-url`                               | Print the buyer invite link                 |
| `npm run db:migrate`                               | Apply database migrations                   |

### Architecture

```
src/
  index.ts              entrypoint: config → container → router → login, resume interrupted builds
  container.ts          wires services (manual DI)
  config.ts, logger.ts  zod-validated env, pino
  bot/                  router, persistent custom ids, embeds/ui, progress reporter, notifications
  commands/             thin slash command handlers (setup, forge, help, keys)
  modules/<module>/     install.ts (build time) · runtime.ts (buttons/events) · logic.ts (pure)
  services/
    template/           zod schema, loader, inheritance, placeholders, validation, capture
    license/            keygen + HMAC hashing, activation/upgrade/revoke, payment seam
    builder/            planner (pure diff), preflight, queue, executor, rollback, Discord gateway
    setup/              /setup orchestration, status
    rateLimit/          sliding-window limiter for failed key attempts
  db/                   repository interfaces, Prisma (SQLite) + in-memory implementations
templates/              starter, pro, elite + themes/ + captured/
scripts/                keys CLI, validate-templates, deploy-commands, invite-url
tests/                  vitest suites (fake guild, in-memory DB)
```

How a build works: the **planner** diffs the rendered template against a snapshot of the guild and
the resources ServerForge already tracks, producing ordered actions (roles → categories → channels →
Community → permission repairs → embeds → modules). The **executor** runs them through a paced,
retrying **queue** and records every created resource in the database immediately — which makes
builds idempotent, resumable after a crash (interrupted builds resume automatically on startup) and
roll-back-able. All buttons use persistent custom IDs backed by the database, so they keep working
across restarts.

Tests: `npm test` runs ~130 unit tests, including full builds against an in-memory fake guild
(setup, upgrade, resync, clean mode, failure + rollback, crash resume, all module installers).

### Manual test checklist

Things unit tests can't cover — try them in a throwaway server before selling:

1. `/setup` with a **Starter** key on an empty server → alongside → check roles order, read-only info
   channels, pinned rules embed, owner DM.
2. Activate a **Pro** key in the same server (upgrade) → only new items appear; a second account
   only sees `#verify`; clicking **Verify** unlocks the server; existing members kept access.
3. Pro features: role buttons (exclusive regions), edit/delete a message → mod-log, join/leave →
   join-leave log, post an invite link → blocked by AutoMod with an alert in mod-log.
4. **Elite** upgrade → Community enabled, `#announcements` is followable, stage + forum exist,
   member count channel renames (may take ~5 min), staff category hidden from members.
5. Tickets: open (one per user), talk, close → confirm → transcript `.txt` in `#ticket-logs` and DM.
6. Restart the bot → old Verify / role / ticket buttons still work.
7. Delete a channel and a role → `/forge resync` re-creates them; your own custom channel is untouched.
8. Kill the bot mid-build → restart → the build resumes and the owner gets a DM.
9. Force a failure (e.g. drag ServerForge's role to the bottom mid-build) → **Roll back** removes
   what that run created.
10. **Clean build** in a cluttered server: confirmation text required, the channel you ran
    `/setup` in survives, roles above ServerForge are kept and reported.
11. Key misuse: same key in a second server → rejected; 5 wrong keys → rate-limited; revoked key → rejected.
12. `/forge capture` a hand-built server → validate the YAML → restart → generate a key for it → build.
