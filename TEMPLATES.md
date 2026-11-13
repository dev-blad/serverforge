# Template format reference

Every ServerForge package is a **template file** in `templates/` (YAML or JSON, any sub-folder).
Templates are validated with zod when the bot starts — an invalid template stops the bot with a
readable error — and by `npm run validate-templates`.

- [Quick start: add a themed template](#quick-start-add-a-themed-template)
- [Top-level fields](#top-level-fields)
- [Inheritance (`extends`)](#inheritance-extends)
- [Roles](#roles)
- [Categories & channels](#categories--channels)
- [Permission overwrites](#permission-overwrites)
- [Messages / embeds](#messages--embeds)
- [Placeholders](#placeholders)
- [Modules](#modules)
- [Community features](#community-features)
- [How builds use a template](#how-builds-use-a-template)
- [Full example](#full-example)

---

## Quick start: add a themed template

1. Create `templates/themes/crypto.yaml`:

   ```yaml
   id: crypto
   extends: pro # inherit everything from Pro
   name: Crypto Community
   tier: pro # keys for this template are Pro keys
   defaults:
     brandColor: '#F7931A'
   categories:
     - key: markets
       name: '📈 Markets'
       after: community
       channels:
         - { key: price-talk, name: price-talk, slowmode: 10 }
         - { key: alpha, name: alpha, topic: 'Share research. No financial advice.' }
   ```

2. `npm run validate-templates` — fix anything it reports.
3. Restart the bot (templates load at startup).
4. Sell it: `npm run keys -- generate --tier pro --template crypto --note "order 42"`.

No code changes are needed. Prefer designing visually? Build the server by hand in Discord and run
`/forge capture id:crypto tier:pro` in your admin server — see [README](README.md#capturing-a-server-you-designed).

---

## Top-level fields

| Field                 | Type                            | Default                  | Notes                                                                                |
| --------------------- | ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `id`                  | key                             | **required**             | Unique. Base tiers must be `starter`, `pro`, `elite`.                                |
| `name`                | string                          | **required**             | Shown to buyers in previews and `/forge status`.                                     |
| `tier`                | `starter` \| `pro` \| `elite`   | **required** (inherited) | Which keys can build it.                                                             |
| `extends`             | template id                     | —                        | See [inheritance](#inheritance-extends).                                             |
| `abstract`            | boolean                         | `false`                  | Abstract templates exist only to be extended; keys can't target them. Not inherited. |
| `description`         | string                          | `''`                     | Not inherited.                                                                       |
| `version`             | integer                         | `1`                      | Informational.                                                                       |
| `defaults.brandColor` | `#RRGGBB`                       | `#5865F2`                | Pre-filled in the setup modal.                                                       |
| `community`           | object                          | `{ enabled: false }`     | See [community](#community-features).                                                |
| `everyone`            | `{ permissions: Permission[] }` | —                        | Base permissions for @everyone. Omit to leave the server's @everyone alone.          |
| `roles`               | Role[]                          | `[]`                     | Highest first.                                                                       |
| `categories`          | Category[]                      | `[]`                     | In display order.                                                                    |
| `channels`            | Channel[]                       | `[]`                     | Channels without a category.                                                         |
| `messages`            | Message[]                       | `[]`                     | Embeds posted after channels exist.                                                  |
| `modules`             | object                          | `{}`                     | See [modules](#modules).                                                             |
| `summaryChannel`      | channel key                     | —                        | Where the "server ready" summary is posted (keep it staff-only).                     |

A **key** is lowercase letters, digits, `-` or `_` (max 64). Keys are how templates reference each
other and how ServerForge tracks what it built — **never rename a key in a template that has
already been sold**, or re-syncs will treat it as a brand-new item. Renaming `name` is fine.

Unknown fields are rejected (typos like `colour:` fail validation instead of being ignored).

---

## Inheritance (`extends`)

`extends: <id>` starts from the parent's fully-resolved template and deep-merges the child on top:

- **Objects** merge recursively; the child wins.
- **Lists of objects with a `key`** (roles, categories, channels, messages, panels, buttons, AutoMod
  rules…) merge **by key**:
  - same key → the entry is merged in place (only list the fields you change),
  - new key → appended, or positioned with `before: <sibling key>` / `after: <sibling key>`,
  - `remove: true` → the inherited entry is dropped.
- **Any other list** (permission lists, keywords, `overwrites`, `staffRoles`…) is **replaced** wholesale.
- `null` replaces a value (e.g. `memberRole: null`).
- `id`, `name`, `description`, `extends` and `abstract` are never inherited.

Chains can be any depth (`elite → pro → starter`); cycles and unknown parents are reported. If a
parent is invalid, its children are reported as "skipped — extends invalid template".

```yaml
# Child of pro: rename a channel, add one after another, drop a role, re-colour a role.

id: my-theme
extends: pro
name: My Theme
categories:
  - key: community
    channels:
      - { key: media, name: art-gallery } # rename (key unchanged)
      - { key: memes, name: memes, after: off-topic } # insert
roles:
  - { key: region-oc, remove: true }
  - { key: moderator, color: '#E91E63' }
modules:
  buttonRoles:
    panels:
      - key: regions
        buttons:
          - { key: oc, remove: true } # the button referenced the removed role
```

Validation runs on the merged result, so removing something that is still referenced elsewhere is
reported (here, without the last block: `buttons[oc].role: unknown role "region-oc"`).

---

## Roles

```yaml
roles:
  - key: moderator # required
    name: Moderator # required, ≤100 chars
    color: '#3498DB' # "#RRGGBB" or a colour placeholder like '{{brandColor}}'
    hoist: true # show separately in the member list (default false)
    mentionable: true # default false
    permissions: [KickMembers, BanMembers, ModerateMembers] # default []
```

- List order = hierarchy (first = highest). ServerForge places template roles directly below its
  own role, in this order.
- `permissions` uses discord.js `PermissionFlagsBits` names: `Administrator`, `ViewChannel`,
  `SendMessages`, `ManageMessages`, `KickMembers`, `BanMembers`, `ModerateMembers`, `Connect`,
  `Speak`, `ManageEvents`, `MentionEveryone`, `UseApplicationCommands`, … Unknown names fail
  validation with a hint.
- The key `everyone` is reserved for @everyone.

---

## Categories & channels

```yaml
categories:
  - key: community
    name: '💬 Community'
    overwrites: [] # optional, see below
    channels:
      - key: general
        name: general
        type: text # text | voice | forum | stage | announcement (default text)
        topic: 'Chat about anything' # text/announcement/forum (forum: post guidelines), ≤1024
        slowmode: 5 # seconds, 0–21600
        nsfw: false
      - key: lounge
        name: Lounge
        type: voice
        userLimit: 0 # voice/stage only, 0 = unlimited
        bitrate: 64000 # voice/stage only
      - key: faq
        name: faq
        type: forum
        tags: # forum only, ≤20
          - { name: Question, emoji: '❓' }
          - { name: Answered, emoji: '✅', moderated: true }

channels: [] # channels outside any category (rarely needed)
```

- Channel and category keys share one namespace and must be unique across the template.
- Max 50 channels per category; max 500 channels and 250 roles per server (checked before building).
- `stage` and `announcement` need [Community](#community-features).

---

## Permission overwrites

```yaml
overwrites:
  - role: everyone # "everyone" or a role key
    allow: [ViewChannel]
    deny: [SendMessages]
  - role: moderator
    allow: [SendMessages]
```

- **Category overwrites** apply to the category.
- A **channel without `overwrites`** syncs with its category.
- A **channel with `overwrites`** gets the category's overwrites **plus** its own; an entry for the
  same role replaces the category's entry for that role.
- On re-sync, ServerForge repairs overwrites **for template roles only**. Overwrites a customer adds
  for their own roles or members are never touched.

> Discord merges role overwrites so that any **allow beats any deny** across a member's roles.
> To hide a staff area from verified members, deny `ViewChannel` for `member` and allow it for
> `moderator` — moderators who also have Member still see it.

---

## Messages / embeds

```yaml
messages:
  - key: rules
    channel: rules # a text or announcement channel key
    pin: true # pin after posting (default false)
    content: 'Optional plain text, ≤2000 chars'
    embeds: # up to 10
      - title: '📜 {{serverName}} Rules'
        description: 'Ask {{role:moderator}} in {{channel:general}}'
        color: '{{brandColor}}'
        url: https://example.com
        author: Optional author line
        thumbnail: https://…/thumb.png
        image: https://…/banner.png
        fields:
          - { name: '1. Be kind', value: 'No harassment.', inline: false }
        footer: '{{serverName}} • {{year}}'
    links: # optional link buttons, up to 5 (https:// only)
      - label: Add TixBot
        emoji: '🎫'
        url: 'https://discord.com/oauth2/authorize?client_id=…&scope=bot&guild_id={{guildId}}&disable_guild_select=true'
```

Each message needs `content` or at least one embed. Messages are tracked: re-sync re-posts a
message only if it was deleted. Discord embed limits are enforced (title 256, description 4096,
25 fields, field value 1024…).

---

## Placeholders

| Placeholder           | Value                                                           |
| --------------------- | --------------------------------------------------------------- |
| `{{serverName}}`      | Server display name the buyer typed in the setup modal          |
| `{{brandColor}}`      | Buyer's brand colour (`#RRGGBB`)                                |
| `{{brandColorLight}}` | Brand colour mixed 35% towards white                            |
| `{{brandColorDark}}`  | Brand colour mixed 35% towards black                            |
| `{{ownerMention}}`    | Mention of the server owner                                     |
| `{{ownerName}}`       | Server owner's display name                                     |
| `{{tierName}}`        | `Starter` / `Pro` / `Elite`                                     |
| `{{year}}`            | Current year                                                    |
| `{{guildId}}`         | Id of the server being built (e.g. to pre-select it in invites) |
| `{{channel:key}}`     | Clickable mention of a template channel (`<#id>`)               |
| `{{role:key}}`        | Mention of a template role (`<@&id>`)                           |
| `{{user}}`            | Tickets `welcomeMessage` only: the member who opened the ticket |
| `{count}`             | `memberStats.format` only: the member count                     |

Placeholders work in **every string** (names, topics, embeds, module text). Unknown placeholders and
references to keys that don't exist fail validation. Colour fields accept `#RRGGBB` or a colour
placeholder.

---

## Modules

Modules are only active in servers whose template enables them. Each has `enabled` (default
`true` when the block is present). Keys refer to roles/channels in the same template.

### `autoRole`

```yaml
autoRole:
  memberRole: member # given to humans on join; null to disable (e.g. when verification is on)
  botRole: bots # given to bots on join
```

### `verification` — button gate

```yaml
verification:
  channel: verify # where the panel is posted
  verifiedRole: member # granted by the button
  buttonLabel: '✅ Verify me'
  verifyExistingMembers: true # give the role to current members once, when first enabled
  embed: { title: 'Welcome!', description: 'Click below to verify.', color: '{{brandColor}}' }
```

Pair with `everyone.permissions` **without** `ViewChannel`, a `ViewChannel` allow for @everyone on the
verify channel, and `ViewChannel` on the verified role (see `templates/pro.yaml`).

### `buttonRoles` — self-assign roles

```yaml
buttonRoles:
  panels:
    - key: regions
      channel: get-roles
      exclusive: true # picking one removes the panel's other roles
      embed: { title: '🌍 Region', description: 'Pick one' }
      buttons: # 1–25, shown 5 per row
        - { key: eu, role: region-eu, label: Europe, emoji: '🌍', style: secondary }
```

`style`: `primary`, `secondary`, `success`, `danger`. Clicking a role you have removes it.

### `logging`

```yaml
logging:
  modLog: mod-log # edits, deletes, bans/unbans, timeouts, role changes, tickets
  joinLeaveLog: join-leave # joins (with account age), leaves, verifications
```

### `automod` — Discord's native AutoMod

```yaml
automod:
  rules:
    - key: invite-links
      name: 'ServerForge: Invite links'
      type: keyword # keyword | spam | mentionSpam | keywordPreset
      keywords: ['*badword*'] # keyword: up to 1000
      regex: ['discord\.gg/\S+']
      allowList: []
      presets: [] # keywordPreset: profanity | sexualContent | slurs
      mentionLimit: 5 # mentionSpam
      blockMessage: true
      customMessage: 'Shown to the member when blocked (≤150)'
      alertChannel: mod-log
      timeoutSeconds: 600 # keyword & mentionSpam only
      exemptRoles: [moderator]
```

Discord allows at most 6 `keyword` rules and 1 each of `spam`, `mentionSpam`, `keywordPreset` per
server (validated). If a customer server already has a rule of a limited type, that rule is skipped
with a warning instead of failing the build.

### `tickets`

```yaml
tickets:
  panelChannel: open-ticket # "Open a ticket" panel
  category: tickets # a CATEGORY key; private ticket channels go here
  logChannel: ticket-logs # transcripts (.txt) are posted here on close
  staffRoles: [moderator, support]
  buttonLabel: '🎫 Open a ticket'
  maxOpenPerUser: 1
  transcriptLimit: 1000 # max messages in a transcript
  welcomeMessage: 'Hi {{user}}! Describe your issue.'
  panelEmbed: { title: 'Need help?', description: '…' }
```

### `memberStats`

```yaml
memberStats:
  channel: member-count # a VOICE channel key (locked with a Connect deny)
  format: '👥 Members: {count}'
  includeBots: false
```

Discord only allows ~2 renames per channel per 10 minutes, so updates are coalesced (at most one every
~5.5 minutes per server).

### `tixbot` — tickets run by TixBot

```yaml
tixbot:
  setupChannel: staff-chat # staff embed with "Add TixBot" + "Set up tickets now"
  panelChannel: support-info # where the ticket dropdown is posted
  staffRole: support-agent # TixBot's support role
  escalationRole: team # optional
  ticketCategory: support-tickets # new tickets open here
  escalationCategory: escalated # optional
  closedCategory: closed-tickets # optional
  transcriptChannel: transcripts # optional
  notificationsChannel: bot-logs # optional
  placeholder: Choose Ticket
  panelEmbed: { author: '{{serverName}}', title: '{{serverName}} Support', description: '…' }
  ticketTypes: # 1–25 dropdown options
    - key: sales
      name: Sales Enquiries
      emoji: '🛒'
      description: '…' # shown under the option in the menu
      category: sales # TixBot Pro: tickets of this type open here
      notification: '{support} — new sale from {user}' # first message (ping)
      welcome: # embed posted inside each new ticket
        title: '🛒 Sales Enquiry'
        description: "Hi {user}!\n`Ticket :` #{ticket_number}"
```

`welcome` and `notification` use **TixBot's** variables (single braces), filled when a ticket
opens: `{user}`, `{user.name}`, `{ticket_number}`, `{server}`, `{support}`. ServerForge
placeholders (`{{serverName}}`, `{{brandColor}}`…) still work alongside them.

ServerForge posts the staff embed during the build. When TixBot joins (or an admin clicks **Set up
tickets now**), ServerForge configures TixBot through its API — roles, categories, transcripts,
ticket types — and posts the dropdown panel, then reports back in `setupChannel`. Re-running is
safe: once setup has succeeded, a re-run only fills in what's missing (empty settings, new
ticket types) and never overwrites changes made in the TixBot dashboard or posts a second menu. Per-type `category` needs TixBot Pro; on the free plan every
ticket opens in `ticketCategory`. Requires `TIXBOT_API_URL` and `TIXBOT_API_KEY` on the bot.

### Shop modules

All of these store their data (vouches, orders, products…) in the ServerForge database and only
work in servers whose template enables them. "Staff" means `staffRoles`, or anyone with **Manage
Server**.

| Module          | Config                                                                                                               | What it does                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`        | `channel`, `staffRoles`, `renameChannel`                                                                             | `/status open\|busy\|closed [note]` edits the status message and prefixes the channel name with 🟢/🟡/🔴.                                                                 |
| `vouches`       | `channel`, `staffRoles`, `cooldownHours`                                                                             | `/vouch submit` (1–5 stars + review), `/vouch stats`, `/vouch remove`. Completed orders DM a **Leave a vouch** button.                                                    |
| `announcements` | `channel`, `staffRoles`                                                                                              | `/announce [ping] [channel]` opens a form and posts a branded embed.                                                                                                      |
| `store`         | `catalogueChannel`, `ordersChannel`, `staffRoles`, `currency`, `customerRole`, `vipRole`, `vipAfterOrders`           | `/product add` cards with an **Order** button; `/order create/list/view`; a staff order board with Start/Complete/Cancel; customer DMs; Customer/VIP roles on completion. |
| `giveaways`     | `channel`, `staffRoles`, `pingRole`                                                                                  | `/giveaway start/end/reroll` with an **Enter** button; winners drawn automatically.                                                                                       |
| `applications`  | `panelChannel`, `reviewChannel`, `staffRoles`, `acceptRole`, `title`, `buttonLabel`, `panelEmbed`, `questions` (1–5) | An **Apply** button opens a form; answers go to staff with Accept/Deny; the applicant is DM'd.                                                                            |
| `reports`       | `channel`, `day`, `hour` (UTC)                                                                                       | Weekly summary: members, orders, revenue, vouches, giveaways, applications.                                                                                               |
| `raidAlert`     | `channel`, `pingRole`, `joins`, `seconds`                                                                            | Alerts staff when `joins` accounts arrive within `seconds`.                                                                                                               |
| `backup`        | `keep`                                                                                                               | `/backup create/list/restore` — snapshots roles, categories, channels and permissions; restore only re-creates what's missing.                                            |

---

## Community features

```yaml
community:
  enabled: true
  rulesChannel: rules # text channel keys
  updatesChannel: staff-chat
```

Announcement (followable) and stage channels require Discord's **Community** feature. When enabled
in the template, ServerForge turns Community on during the build (this also sets verification level
to at least _Low_ and the explicit media filter to _all members_, which Discord requires). If Discord
refuses, announcement channels are created as text and stage channels as voice, with a warning.
Upgrading a server whose `announcements` channel is plain text converts it in place.

---

## How builds use a template

1. Placeholders are rendered with the buyer's options.
2. The **planner** compares the template to the server and to what ServerForge already tracks:
   - tracked items that still exist are kept as-is,
   - missing items are matched **by name** to existing ones ("adopted") or created,
   - nothing outside the template is ever modified (except in _Clean build_ mode, which first
     deletes everything the bot can delete).
3. Build order: cleanup → roles → categories → channels → Community → permission repairs →
   embeds → modules.

This is why upgrades, re-syncs and resumes are safe: they all re-run the same diff.

---

## Full example

```yaml
id: book-club
extends: starter
name: Book Club
tier: starter
description: Starter package themed for reading groups.
defaults:
  brandColor: '#8E44AD'

roles:
  - key: librarian
    name: Librarian
    after: moderator
    color: '{{brandColorDark}}'
    hoist: true
    permissions: [ViewChannel, SendMessages, ManageMessages, ManageThreads]

categories:
  - key: reading
    name: '📚 Reading'
    after: community
    channels:
      - key: current-book
        name: current-book
        topic: "This month's pick — spoilers in threads please!"
        overwrites:
          - role: everyone
            deny: [SendMessages]
          - role: librarian
            allow: [SendMessages]
      - key: reviews
        name: reviews
        type: forum
        tags:
          - { name: Fiction, emoji: '🐉' }
          - { name: Non-fiction, emoji: '🧠' }
      - key: reading-room
        name: Reading Room
        type: voice

messages:
  - key: book-of-the-month
    channel: current-book
    pin: true
    embeds:
      - title: '📖 Book of the month'
        color: '{{brandColor}}'
        description: |-
          Welcome to **{{serverName}}**'s book club!
          Discuss in {{channel:reviews}} and ask a {{role:librarian}} to suggest next month's pick.
```
