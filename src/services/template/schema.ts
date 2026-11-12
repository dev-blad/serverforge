import { PermissionFlagsBits } from 'discord.js';
import { z } from 'zod';

/**
 * Zod schema for a *fully resolved* template (after `extends` inheritance has been applied).
 * Raw template files may be partial when they extend another template; see inheritance.ts.
 *
 * Everything here is data — adding a new themed template never requires code changes.
 */

export const TIERS = ['starter', 'pro', 'elite'] as const;
export type Tier = (typeof TIERS)[number];
export const tierSchema = z.enum(TIERS);

export const TIER_RANK: Record<Tier, number> = { starter: 1, pro: 2, elite: 3 };

export const PERMISSION_NAMES = Object.keys(PermissionFlagsBits) as [
  keyof typeof PermissionFlagsBits,
  ...(keyof typeof PermissionFlagsBits)[],
];
export type PermissionName = keyof typeof PermissionFlagsBits;

/** Stable identifier used to reference roles / channels / messages across templates. */
export const keySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, 'keys must be lowercase letters, digits, "-" or "_"');

export const permissionSchema = z.enum(PERMISSION_NAMES, {
  error: (issue) =>
    `unknown permission "${String(issue.input)}" (use discord.js PermissionFlagsBits names, e.g. "SendMessages")`,
});

/** "#5865F2" or a colour placeholder like "{{brandColor}}". */
export const colorSchema = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{6}|\{\{\s*[a-zA-Z]+\s*\}\})$/,
    'colour must be "#RRGGBB" or a placeholder such as "{{brandColor}}"',
  );

export const overwriteSchema = z.strictObject({
  /** A role key from this template, or "everyone" for @everyone. */
  role: z.union([z.literal('everyone'), keySchema]),
  allow: z.array(permissionSchema).default([]),
  deny: z.array(permissionSchema).default([]),
});
export type OverwriteSpec = z.infer<typeof overwriteSchema>;

export const roleSchema = z.strictObject({
  key: keySchema,
  name: z.string().min(1).max(100),
  color: colorSchema.optional(),
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  permissions: z.array(permissionSchema).default([]),
});
export type RoleSpec = z.infer<typeof roleSchema>;

export const CHANNEL_TYPES = ['text', 'voice', 'forum', 'stage', 'announcement'] as const;
export type ChannelKind = (typeof CHANNEL_TYPES)[number];
export const TEXT_LIKE: readonly ChannelKind[] = ['text', 'announcement'];
export const COMMUNITY_ONLY: readonly ChannelKind[] = ['stage', 'announcement'];

export const forumTagSchema = z.strictObject({
  name: z.string().min(1).max(20),
  emoji: z.string().optional(),
  moderated: z.boolean().default(false),
});

export const channelSchema = z.strictObject({
  key: keySchema,
  name: z.string().min(1).max(100),
  type: z.enum(CHANNEL_TYPES).default('text'),
  topic: z.string().max(1024).optional(),
  /** Slowmode in seconds (0–21600). */
  slowmode: z.number().int().min(0).max(21600).default(0),
  nsfw: z.boolean().default(false),
  /** Voice/stage only. */
  userLimit: z.number().int().min(0).max(99).optional(),
  /** Voice/stage only, in bps. */
  bitrate: z.number().int().min(8000).max(384000).optional(),
  /** Forum only. */
  tags: z.array(forumTagSchema).max(20).optional(),
  /**
   * Per-role permission overwrites. If omitted, the channel inherits (syncs with) its
   * category's overwrites.
   */
  overwrites: z.array(overwriteSchema).optional(),
});
export type ChannelSpec = z.infer<typeof channelSchema>;

export const categorySchema = z.strictObject({
  key: keySchema,
  name: z.string().min(1).max(100),
  overwrites: z.array(overwriteSchema).default([]),
  channels: z.array(channelSchema).max(50).default([]),
});
export type CategorySpec = z.infer<typeof categorySchema>;

export const embedSchema = z.strictObject({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  color: colorSchema.optional(),
  url: z.string().optional(),
  fields: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(256),
        value: z.string().min(1).max(1024),
        inline: z.boolean().default(false),
      }),
    )
    .max(25)
    .default([]),
  footer: z.string().max(2048).optional(),
  image: z.string().optional(),
  thumbnail: z.string().optional(),
  author: z.string().max(256).optional(),
});
export type EmbedSpec = z.infer<typeof embedSchema>;

export const messageSchema = z.strictObject({
  key: keySchema,
  /** Channel key the message is posted in. */
  channel: keySchema,
  content: z.string().max(2000).optional(),
  embeds: z.array(embedSchema).max(10).default([]),
  /** Link buttons under the message (e.g. "Add TixBot"), up to 5 in one row. */
  links: z
    .array(
      z.strictObject({
        label: z.string().min(1).max(80),
        url: z.string().regex(/^https:\/\/\S+$/, 'must be an https:// link'),
        emoji: z.string().max(64).optional(),
      }),
    )
    .max(5)
    .default([]),
  /** Pin the message after posting. */
  pin: z.boolean().default(false),
});
export type MessageSpec = z.infer<typeof messageSchema>;

// ─── Feature modules ────────────────────────────────────────────────────────

const moduleBase = { enabled: z.boolean().default(true) };

export const autoRoleModuleSchema = z.strictObject({
  ...moduleBase,
  /** Role given to every human that joins (null disables, e.g. when verification is used). */
  memberRole: keySchema.nullable().optional(),
  /** Role given to every bot that joins. */
  botRole: keySchema.nullable().optional(),
});

export const verificationModuleSchema = z.strictObject({
  ...moduleBase,
  channel: keySchema,
  verifiedRole: keySchema,
  embed: embedSchema,
  buttonLabel: z.string().min(1).max(80).default('Verify'),
  /** Give the verified role to existing members when the module is first enabled. */
  verifyExistingMembers: z.boolean().default(true),
});

export const buttonStyleSchema = z.enum(['primary', 'secondary', 'success', 'danger']);

export const buttonRolePanelSchema = z.strictObject({
  key: keySchema,
  channel: keySchema,
  embed: embedSchema,
  /** When true, picking one role in this panel removes the others (e.g. regions). */
  exclusive: z.boolean().default(false),
  buttons: z
    .array(
      z.strictObject({
        key: keySchema,
        role: keySchema,
        label: z.string().min(1).max(80),
        emoji: z.string().optional(),
        style: buttonStyleSchema.default('secondary'),
      }),
    )
    .min(1)
    .max(25),
});
export type ButtonRolePanelSpec = z.infer<typeof buttonRolePanelSchema>;

export const buttonRolesModuleSchema = z.strictObject({
  ...moduleBase,
  panels: z.array(buttonRolePanelSchema).default([]),
});

export const loggingModuleSchema = z.strictObject({
  ...moduleBase,
  /** Moderation events: message edits/deletes, bans, timeouts, role changes. */
  modLog: keySchema.optional(),
  /** Member joins and leaves. */
  joinLeaveLog: keySchema.optional(),
});

export const automodRuleSchema = z.strictObject({
  key: keySchema,
  name: z.string().min(1).max(100),
  type: z.enum(['keyword', 'spam', 'mentionSpam', 'keywordPreset']),
  keywords: z.array(z.string().min(1).max(60)).max(1000).default([]),
  regex: z.array(z.string().min(1).max(260)).max(10).default([]),
  allowList: z.array(z.string().min(1).max(60)).default([]),
  presets: z.array(z.enum(['profanity', 'sexualContent', 'slurs'])).default([]),
  mentionLimit: z.number().int().min(1).max(50).default(5),
  blockMessage: z.boolean().default(true),
  customMessage: z.string().max(150).optional(),
  /** Channel key to send alerts to. */
  alertChannel: keySchema.optional(),
  /** Timeout duration (keyword / mentionSpam only). */
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(60 * 60 * 24 * 28)
    .optional(),
  exemptRoles: z.array(keySchema).default([]),
});
export type AutomodRuleSpec = z.infer<typeof automodRuleSchema>;

export const automodModuleSchema = z.strictObject({
  ...moduleBase,
  rules: z.array(automodRuleSchema).default([]),
});

export const ticketsModuleSchema = z.strictObject({
  ...moduleBase,
  /** Channel where the "Open a ticket" panel is posted. */
  panelChannel: keySchema,
  /** Category where private ticket channels are created. */
  category: keySchema,
  /** Channel transcripts are posted to on close. */
  logChannel: keySchema,
  /** Role keys that can see and manage every ticket. */
  staffRoles: z.array(keySchema).min(1),
  panelEmbed: embedSchema,
  buttonLabel: z.string().min(1).max(80).default('Open a ticket'),
  /** Message posted inside a freshly opened ticket. Supports {{user}}. */
  welcomeMessage: z
    .string()
    .max(2000)
    .default('Hi {{user}}! Describe your issue and a staff member will be with you shortly.'),
  maxOpenPerUser: z.number().int().min(1).max(10).default(1),
  /** Max messages included in a transcript. */
  transcriptLimit: z.number().int().min(10).max(5000).default(1000),
});

export const memberStatsModuleSchema = z.strictObject({
  ...moduleBase,
  /** Voice channel key that gets renamed with the member count. */
  channel: keySchema,
  /** Name format; {count} is replaced with the human member count. */
  format: z.string().min(1).max(90).default('👥 Members: {count}'),
  /** Count bots as members. */
  includeBots: z.boolean().default(false),
});

export const tixbotTicketTypeSchema = z.strictObject({
  key: keySchema,
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(64).default('🎫'),
  /** Shown under the option in the dropdown (Discord limit 100). */
  description: z.string().max(100).optional(),
  /** Category key tickets of this type open in (TixBot Pro; free TixBot uses ticketCategory). */
  category: keySchema.optional(),
});
export type TixbotTicketTypeSpec = z.infer<typeof tixbotTicketTypeSchema>;

/**
 * Tickets run by TixBot. ServerForge posts an "Add TixBot" embed for staff; once TixBot is in
 * the server it configures TixBot through its API (roles, categories, ticket types) and posts a
 * dropdown ticket panel.
 */
export const tixbotModuleSchema = z.strictObject({
  ...moduleBase,
  /** Staff channel for the "Add TixBot / Set up tickets" embed and the result. */
  setupChannel: keySchema,
  /** Channel the dropdown ticket panel is posted in. */
  panelChannel: keySchema,
  /** Role that handles tickets (TixBot level-1 support role). */
  staffRole: keySchema,
  /** Role tickets are escalated to. */
  escalationRole: keySchema.optional(),
  /** Category new tickets open in. */
  ticketCategory: keySchema,
  escalationCategory: keySchema.optional(),
  /** Category closed tickets are moved to. */
  closedCategory: keySchema.optional(),
  transcriptChannel: keySchema.optional(),
  /** Channel TixBot posts its notifications to. */
  notificationsChannel: keySchema.optional(),
  placeholder: z.string().min(1).max(150).default('Choose Ticket'),
  panelEmbed: embedSchema,
  ticketTypes: z.array(tixbotTicketTypeSchema).min(1).max(25),
});

export const modulesSchema = z
  .strictObject({
    autoRole: autoRoleModuleSchema.optional(),
    verification: verificationModuleSchema.optional(),
    buttonRoles: buttonRolesModuleSchema.optional(),
    logging: loggingModuleSchema.optional(),
    automod: automodModuleSchema.optional(),
    tickets: ticketsModuleSchema.optional(),
    memberStats: memberStatsModuleSchema.optional(),
    tixbot: tixbotModuleSchema.optional(),
  })
  .default({});

export type ModulesSpec = z.infer<typeof modulesSchema>;
export type ModuleId = keyof ModulesSpec;
export const MODULE_IDS: ModuleId[] = [
  'autoRole',
  'verification',
  'buttonRoles',
  'logging',
  'automod',
  'tickets',
  'memberStats',
  'tixbot',
];
export type AutoRoleConfig = z.infer<typeof autoRoleModuleSchema>;
export type VerificationConfig = z.infer<typeof verificationModuleSchema>;
export type ButtonRolesConfig = z.infer<typeof buttonRolesModuleSchema>;
export type LoggingConfig = z.infer<typeof loggingModuleSchema>;
export type AutomodConfig = z.infer<typeof automodModuleSchema>;
export type TicketsConfig = z.infer<typeof ticketsModuleSchema>;
export type MemberStatsConfig = z.infer<typeof memberStatsModuleSchema>;
export type TixbotConfig = z.infer<typeof tixbotModuleSchema>;

// ─── Template ───────────────────────────────────────────────────────────────

export const templateSchema = z.strictObject({
  /** Unique template id. Base tiers use "starter", "pro", "elite". */
  id: keySchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  tier: tierSchema,
  /** Id of the template this one inherits from (already applied once resolved). */
  extends: keySchema.optional(),
  /** Abstract templates exist only to be extended; keys can't be generated for them. */
  abstract: z.boolean().default(false),
  version: z.number().int().positive().default(1),
  defaults: z
    .strictObject({
      brandColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default('#5865F2'),
    })
    .default({ brandColor: '#5865F2' }),
  /**
   * Enable the Discord "Community" feature (required for announcement & stage channels).
   * rulesChannel / updatesChannel are channel keys.
   */
  community: z
    .strictObject({
      enabled: z.boolean().default(false),
      rulesChannel: keySchema.optional(),
      updatesChannel: keySchema.optional(),
    })
    .default({ enabled: false }),
  /** Base permissions for @everyone (omit to leave the server's existing @everyone alone). */
  everyone: z.strictObject({ permissions: z.array(permissionSchema) }).optional(),
  /** Roles, highest first. */
  roles: z.array(roleSchema).max(200).default([]),
  /** Categories (in display order) and their channels. */
  categories: z.array(categorySchema).max(50).default([]),
  /** Channels without a category (shown above all categories). */
  channels: z.array(channelSchema).default([]),
  /** Embeds / messages to post after channels exist. */
  messages: z.array(messageSchema).default([]),
  modules: modulesSchema,
  /** Channel key the build summary is posted to on success. */
  summaryChannel: keySchema.optional(),
});

export type Template = z.infer<typeof templateSchema>;
/** Template input shape (before zod defaults are applied). */
export type TemplateInput = z.input<typeof templateSchema>;
