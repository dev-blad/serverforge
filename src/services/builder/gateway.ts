import type { ChannelKind } from '../template/schema.js';

/**
 * Everything the builder and module installers need from Discord, as a small interface.
 * The production implementation wraps a discord.js Guild (discordGateway.ts); tests use a fake.
 * Payloads are plain data so callers never depend on discord.js builders.
 */

export interface EmbedPayload {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
  image?: string;
  thumbnail?: string;
  author?: string;
  timestamp?: boolean;
}

export type ButtonStyleName = 'primary' | 'secondary' | 'success' | 'danger';

export interface ButtonPayload {
  customId: string;
  label: string;
  emoji?: string;
  style: ButtonStyleName;
}

export interface LinkButtonPayload {
  label: string;
  url: string;
  emoji?: string;
}

export interface MessagePayload {
  content?: string;
  embeds?: EmbedPayload[];
  /** Buttons; automatically split into rows of 5. */
  buttons?: ButtonPayload[];
  /** Link buttons, shown in a row after any other buttons. */
  links?: LinkButtonPayload[];
  files?: { name: string; data: Buffer }[];
  /** Don't ping anyone mentioned in content. */
  silentMentions?: boolean;
}

export interface OverwritePayload {
  id: string;
  type: 'role' | 'member';
  allow: bigint;
  deny: bigint;
}

export interface ChannelPayload {
  name: string;
  kind: ChannelKind | 'category';
  parentId?: string | null;
  topic?: string;
  slowmode?: number;
  nsfw?: boolean;
  userLimit?: number;
  bitrate?: number;
  tags?: { name: string; emoji?: string; moderated?: boolean }[];
  overwrites: OverwritePayload[];
}

export interface RolePayload {
  name: string;
  color?: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: bigint;
}

export interface AutomodRulePayload {
  name: string;
  type: 'keyword' | 'spam' | 'mentionSpam' | 'keywordPreset';
  keywords: string[];
  regex: string[];
  allowList: string[];
  presets: ('profanity' | 'sexualContent' | 'slurs')[];
  mentionLimit: number;
  blockMessage: boolean;
  customMessage?: string;
  alertChannelId?: string;
  timeoutSeconds?: number;
  exemptRoleIds: string[];
}

export interface GuildGateway {
  readonly guildId: string;

  createRole(role: RolePayload): Promise<string>;
  deleteRole(id: string): Promise<void>;
  /** Returns the previous @everyone permission bitfield. */
  setEveryonePermissions(bits: bigint): Promise<bigint>;
  /** Re-order roles so `orderedIds` (highest first) sit directly below the bot's role. */
  orderRoles(orderedIds: string[]): Promise<void>;

  createChannel(channel: ChannelPayload): Promise<string>;
  deleteChannel(id: string): Promise<void>;
  channelExists(id: string): Promise<boolean>;
  renameChannel(id: string, name: string): Promise<void>;
  convertToAnnouncement(id: string): Promise<void>;
  /** Replace the overwrites for the given targets only (other overwrites are untouched). */
  setOverwrites(channelId: string, overwrites: OverwritePayload[]): Promise<void>;
  /** Order categories, and channels within categories, as listed (unlisted ones go after). */
  orderChannels(categoryIds: string[], channelsByParent: Record<string, string[]>): Promise<void>;
  /** Enable the Community feature. Returns false if Discord refused. */
  enableCommunity(rulesChannelId: string, updatesChannelId: string): Promise<boolean>;
  disableCommunity(): Promise<void>;

  sendMessage(
    channelId: string,
    message: MessagePayload,
    options?: { pin?: boolean },
  ): Promise<string>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  messageExists(channelId: string, messageId: string): Promise<boolean>;

  createAutomodRule(rule: AutomodRulePayload): Promise<string>;
  deleteAutomodRule(id: string): Promise<void>;
  automodRuleExists(id: string): Promise<boolean>;

  /** Give a role to every human member that doesn't have it. Returns how many were updated. */
  addRoleToAllHumans(roleId: string): Promise<number>;
  /** Count members (humans only unless includeBots). */
  memberCount(includeBots: boolean): Promise<number>;
}
