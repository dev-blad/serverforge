import {
  ActionRowBuilder,
  AttachmentBuilder,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildExplicitContentFilter,
  GuildFeature,
  GuildVerificationLevel,
  OverwriteType,
  PermissionFlagsBits,
  type AutoModerationActionOptions,
  type Guild,
  type GuildBasedChannel,
  type GuildChannelCreateOptions,
  type MessageCreateOptions,
  type OverwriteResolvable,
} from 'discord.js';
import type { ResourceRecord } from '../../db/types.js';
import type { Logger } from '../../logger.js';
import type { ChannelKind } from '../template/schema.js';
import { isUnknownResource } from './discordErrors.js';
import type {
  AutomodRulePayload,
  ButtonStyleName,
  ChannelPayload,
  EmbedPayload,
  GuildGateway,
  MessagePayload,
  OverwritePayload,
  RolePayload,
} from './gateway.js';
import type { GuildSnapshot, SnapshotChannelType } from './types.js';

const REASON = 'ServerForge setup';

const KIND_TO_TYPE = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
  announcement: ChannelType.GuildAnnouncement,
  category: ChannelType.GuildCategory,
} as const satisfies Record<ChannelKind | 'category', ChannelType>;

export function channelTypeToKind(type: ChannelType): SnapshotChannelType {
  switch (type) {
    case ChannelType.GuildText:
      return 'text';
    case ChannelType.GuildVoice:
      return 'voice';
    case ChannelType.GuildForum:
      return 'forum';
    case ChannelType.GuildStageVoice:
      return 'stage';
    case ChannelType.GuildAnnouncement:
      return 'announcement';
    case ChannelType.GuildCategory:
      return 'category';
    default:
      return 'other';
  }
}

const BUTTON_STYLES: Record<ButtonStyleName, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

/** Bot member overwrite added to every created channel when the bot lacks Administrator. */
const BOT_CHANNEL_ALLOW =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.Connect;

export function toDiscordEmbed(embed: EmbedPayload): EmbedBuilder {
  const builder = new EmbedBuilder();
  if (embed.title) builder.setTitle(embed.title);
  if (embed.description) builder.setDescription(embed.description);
  if (embed.color !== undefined) builder.setColor(embed.color);
  if (embed.url) builder.setURL(embed.url);
  if (embed.fields?.length)
    builder.addFields(
      embed.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })),
    );
  if (embed.footer) builder.setFooter({ text: embed.footer });
  if (embed.image) builder.setImage(embed.image);
  if (embed.thumbnail) builder.setThumbnail(embed.thumbnail);
  if (embed.author) builder.setAuthor({ name: embed.author });
  if (embed.timestamp) builder.setTimestamp(new Date());
  return builder;
}

export function toDiscordMessage(payload: MessagePayload): MessageCreateOptions {
  const options: MessageCreateOptions = {};
  if (payload.content) options.content = payload.content;
  if (payload.embeds?.length) options.embeds = payload.embeds.map(toDiscordEmbed);
  if (payload.buttons?.length) {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    payload.buttons.slice(0, 25).forEach((b, i) => {
      if (i % 5 === 0) rows.push(new ActionRowBuilder<ButtonBuilder>());
      const button = new ButtonBuilder()
        .setCustomId(b.customId)
        .setLabel(b.label)
        .setStyle(BUTTON_STYLES[b.style]);
      if (b.emoji) button.setEmoji(b.emoji);
      rows.at(-1)?.addComponents(button);
    });
    options.components = rows;
  }
  if (payload.files?.length)
    options.files = payload.files.map((f) => new AttachmentBuilder(f.data, { name: f.name }));
  if (payload.silentMentions) options.allowedMentions = { parse: [] };
  return options;
}

/**
 * Compute new role positions so `orderedIds` sit directly below the bot's highest role in that
 * order, followed by every other role below the bot in its current order. Only roles strictly
 * below the bot are touched (Discord forbids moving anything at or above it), positions form a
 * contiguous block, and only roles whose position actually changes are returned.
 */
export function computeRolePositions(
  roles: readonly { id: string; position: number }[],
  ctx: { everyoneId: string; botPosition: number },
  orderedIds: readonly string[],
): { role: string; position: number }[] {
  const below = roles.filter((r) => r.id !== ctx.everyoneId && r.position < ctx.botPosition);
  const belowIds = new Set(below.map((r) => r.id));
  const first = orderedIds.filter((id) => belowIds.has(id));
  const rest = below
    .filter((r) => !first.includes(r.id))
    .sort((a, b) => b.position - a.position)
    .map((r) => r.id);
  const desired = [...first, ...rest];
  const current = new Map(below.map((r) => [r.id, r.position]));
  return desired
    .map((id, i) => ({ role: id, position: desired.length - i }))
    .filter((u) => current.get(u.role) !== u.position);
}

/** GuildGateway backed by a live discord.js Guild. */
export class DiscordGuildGateway implements GuildGateway {
  constructor(
    private readonly guild: Guild,
    private readonly logger?: Logger,
  ) {}

  get guildId(): string {
    return this.guild.id;
  }

  private async me() {
    return this.guild.members.me ?? (await this.guild.members.fetchMe());
  }

  private async channel(id: string): Promise<GuildBasedChannel> {
    const channel = this.guild.channels.cache.get(id) ?? (await this.guild.channels.fetch(id));
    if (!channel) throw Object.assign(new Error(`Unknown channel ${id}`), { code: 10003 });
    return channel;
  }

  async createRole(role: RolePayload): Promise<string> {
    const created = await this.guild.roles.create({
      name: role.name,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions,
      ...(role.color !== undefined ? { colors: { primaryColor: role.color } } : {}),
      reason: REASON,
    });
    return created.id;
  }

  async deleteRole(id: string): Promise<void> {
    await this.guild.roles.delete(id, REASON);
  }

  async setEveryonePermissions(bits: bigint): Promise<bigint> {
    const everyone = this.guild.roles.everyone;
    const previous = everyone.permissions.bitfield;
    await everyone.setPermissions(bits, REASON);
    return previous;
  }

  async orderRoles(orderedIds: string[]): Promise<void> {
    // Fresh data: right after creating roles, cached positions can be stale, and sending a
    // position at/above the bot's own role makes Discord answer "Missing Permissions".
    const roles = await this.guild.roles.fetch(undefined, { force: true });
    const me = await this.guild.members.fetchMe({ force: true });
    const updates = computeRolePositions(
      [...roles.values()].map((r) => ({ id: r.id, position: r.position })),
      { everyoneId: this.guild.id, botPosition: me.roles.highest.position },
      orderedIds,
    );
    if (updates.length) await this.guild.roles.setPositions(updates);
  }

  private botOverwrite(): Promise<OverwriteResolvable | null> {
    return this.me().then((me) =>
      me.permissions.has(PermissionFlagsBits.Administrator)
        ? null
        : { id: me.id, type: OverwriteType.Member, allow: BOT_CHANNEL_ALLOW },
    );
  }

  async createChannel(channel: ChannelPayload): Promise<string> {
    const overwrites: OverwriteResolvable[] = channel.overwrites.map((o) => ({
      id: o.id,
      type: o.type === 'role' ? OverwriteType.Role : OverwriteType.Member,
      allow: o.allow,
      deny: o.deny,
    }));
    const bot = await this.botOverwrite();
    if (bot) overwrites.push(bot);

    const textLike =
      channel.kind === 'text' || channel.kind === 'announcement' || channel.kind === 'forum';
    const voiceLike = channel.kind === 'voice' || channel.kind === 'stage';
    const options: GuildChannelCreateOptions = {
      name: channel.name,
      type: KIND_TO_TYPE[channel.kind],
      permissionOverwrites: overwrites,
      reason: REASON,
      ...(channel.parentId ? { parent: channel.parentId } : {}),
      ...(textLike && channel.topic ? { topic: channel.topic } : {}),
      ...(textLike && channel.slowmode ? { rateLimitPerUser: channel.slowmode } : {}),
      ...(textLike && channel.nsfw ? { nsfw: true } : {}),
      ...(voiceLike && channel.userLimit !== undefined ? { userLimit: channel.userLimit } : {}),
      ...(voiceLike && channel.bitrate !== undefined ? { bitrate: channel.bitrate } : {}),
      ...(channel.kind === 'forum' && channel.tags
        ? {
            availableTags: channel.tags.map((t) => ({
              name: t.name,
              moderated: t.moderated ?? false,
              ...(t.emoji ? { emoji: { id: null, name: t.emoji } } : {}),
            })),
          }
        : {}),
    };
    const created = await this.guild.channels.create(options);
    return created.id;
  }

  async deleteChannel(id: string): Promise<void> {
    await this.guild.channels.delete(id, REASON);
  }

  async channelExists(id: string): Promise<boolean> {
    try {
      return Boolean(await this.guild.channels.fetch(id));
    } catch (error) {
      if (isUnknownResource(error)) return false;
      throw error;
    }
  }

  async renameChannel(id: string, name: string): Promise<void> {
    const channel = await this.channel(id);
    await channel.setName(name, 'ServerForge stats update');
  }

  async convertToAnnouncement(id: string): Promise<void> {
    const channel = await this.channel(id);
    if (channel.type === ChannelType.GuildText)
      await channel.setType(ChannelType.GuildAnnouncement, REASON);
  }

  async setOverwrites(channelId: string, overwrites: OverwritePayload[]): Promise<void> {
    const channel = await this.channel(channelId);
    if (channel.isThread()) return;
    const targets = new Set(overwrites.map((o) => o.id));
    const kept: OverwriteResolvable[] = channel.permissionOverwrites.cache
      .filter((o) => !targets.has(o.id))
      .map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));
    const next: OverwriteResolvable[] = overwrites.map((o) => ({
      id: o.id,
      type: o.type === 'role' ? OverwriteType.Role : OverwriteType.Member,
      allow: o.allow,
      deny: o.deny,
    }));
    await channel.permissionOverwrites.set([...kept, ...next], REASON);
  }

  async orderChannels(
    categoryIds: string[],
    channelsByParent: Record<string, string[]>,
  ): Promise<void> {
    await this.guild.channels.fetch();
    const updates: { channel: string; position: number }[] = [];
    const order = (wanted: string[], all: GuildBasedChannel[]) => {
      const sorted = [...all].sort((a, b) =>
        'position' in a && 'position' in b ? a.position - b.position : 0,
      );
      const rest = sorted.filter((c) => !wanted.includes(c.id)).map((c) => c.id);
      [...wanted.filter((id) => all.some((c) => c.id === id)), ...rest].forEach((id, position) =>
        updates.push({ channel: id, position }),
      );
    };
    const channels = [...this.guild.channels.cache.values()].filter((c) => !c.isThread());
    order(
      categoryIds,
      channels.filter((c) => c.type === ChannelType.GuildCategory),
    );
    for (const [parentId, ids] of Object.entries(channelsByParent)) {
      if (ids.length === 0) continue;
      order(
        ids,
        channels.filter(
          (c) => c.type !== ChannelType.GuildCategory && (c.parentId ?? '') === parentId,
        ),
      );
    }
    if (updates.length) await this.guild.channels.setPositions(updates);
  }

  async enableCommunity(rulesChannelId: string, updatesChannelId: string): Promise<boolean> {
    try {
      const verificationLevel = Math.max(
        this.guild.verificationLevel,
        GuildVerificationLevel.Low,
      ) as GuildVerificationLevel;
      await this.guild.edit({
        features: [
          ...new Set([...this.guild.features, GuildFeature.Community]),
        ] as `${GuildFeature}`[],
        verificationLevel,
        explicitContentFilter: GuildExplicitContentFilter.AllMembers,
        rulesChannel: rulesChannelId,
        publicUpdatesChannel: updatesChannelId,
        reason: REASON,
      });
      return true;
    } catch (error) {
      this.logger?.warn({ err: error, guildId: this.guild.id }, 'could not enable Community');
      return false;
    }
  }

  async disableCommunity(): Promise<void> {
    await this.guild.edit({
      features: this.guild.features.filter((f) => String(f) !== String(GuildFeature.Community)),
      reason: 'ServerForge rollback',
    });
  }

  async sendMessage(
    channelId: string,
    message: MessagePayload,
    options?: { pin?: boolean },
  ): Promise<string> {
    const channel = await this.channel(channelId);
    if (!channel.isTextBased() || !channel.isSendable()) {
      throw new Error(`Channel ${channelId} cannot receive messages`);
    }
    const sent = await channel.send(toDiscordMessage(message));
    if (options?.pin) {
      try {
        await sent.pin(REASON);
      } catch (error) {
        this.logger?.warn({ err: error }, 'could not pin message');
      }
    }
    return sent.id;
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    const channel = await this.channel(channelId);
    if (channel.isTextBased()) await channel.messages.delete(messageId);
  }

  async messageExists(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.channel(channelId);
      if (!channel.isTextBased()) return false;
      await channel.messages.fetch(messageId);
      return true;
    } catch (error) {
      if (isUnknownResource(error)) return false;
      throw error;
    }
  }

  async createAutomodRule(rule: AutomodRulePayload): Promise<string> {
    const triggerType = {
      keyword: AutoModerationRuleTriggerType.Keyword,
      spam: AutoModerationRuleTriggerType.Spam,
      mentionSpam: AutoModerationRuleTriggerType.MentionSpam,
      keywordPreset: AutoModerationRuleTriggerType.KeywordPreset,
    }[rule.type];
    const presets = {
      profanity: AutoModerationRuleKeywordPresetType.Profanity,
      sexualContent: AutoModerationRuleKeywordPresetType.SexualContent,
      slurs: AutoModerationRuleKeywordPresetType.Slurs,
    };
    const actions: AutoModerationActionOptions[] = [];
    if (rule.blockMessage) {
      actions.push({
        type: AutoModerationActionType.BlockMessage,
        ...(rule.customMessage ? { metadata: { customMessage: rule.customMessage } } : {}),
      });
    }
    if (rule.alertChannelId) {
      actions.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: rule.alertChannelId },
      });
    }
    if (rule.timeoutSeconds && (rule.type === 'keyword' || rule.type === 'mentionSpam')) {
      actions.push({
        type: AutoModerationActionType.Timeout,
        metadata: { durationSeconds: rule.timeoutSeconds },
      });
    }
    const triggerMetadata =
      rule.type === 'keyword'
        ? { keywordFilter: rule.keywords, regexPatterns: rule.regex, allowList: rule.allowList }
        : rule.type === 'keywordPreset'
          ? { presets: rule.presets.map((p) => presets[p]), allowList: rule.allowList }
          : rule.type === 'mentionSpam'
            ? { mentionTotalLimit: rule.mentionLimit, mentionRaidProtectionEnabled: true }
            : undefined;
    const created = await this.guild.autoModerationRules.create({
      name: rule.name,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType,
      actions,
      enabled: true,
      exemptRoles: rule.exemptRoleIds,
      reason: REASON,
      ...(triggerMetadata ? { triggerMetadata } : {}),
    });
    return created.id;
  }

  async deleteAutomodRule(id: string): Promise<void> {
    await this.guild.autoModerationRules.delete(id, REASON);
  }

  async automodRuleExists(id: string): Promise<boolean> {
    try {
      await this.guild.autoModerationRules.fetch({ autoModerationRule: id, force: true });
      return true;
    } catch (error) {
      if (isUnknownResource(error)) return false;
      throw error;
    }
  }

  async addRoleToAllHumans(roleId: string): Promise<number> {
    const members = await this.guild.members.fetch();
    let updated = 0;
    for (const member of members.values()) {
      if (member.user.bot || member.roles.cache.has(roleId)) continue;
      try {
        await member.roles.add(roleId, 'ServerForge: verify existing members');
        updated += 1;
      } catch (error) {
        this.logger?.warn({ err: error, memberId: member.id }, 'could not add role to member');
      }
    }
    return updated;
  }

  async memberCount(includeBots: boolean): Promise<number> {
    if (includeBots) return this.guild.memberCount;
    const members = await this.guild.members.fetch();
    return members.filter((m) => !m.user.bot).size;
  }
}

/** Capture the current state of a guild as plain data for the planner. */
export async function snapshotGuild(
  guild: Guild,
  tracked: readonly ResourceRecord[],
): Promise<GuildSnapshot> {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const gateway = new DiscordGuildGateway(guild);

  const existingMessages: string[] = [];
  for (const record of tracked) {
    if (record.kind !== 'message' || !record.channelId) continue;
    if (!guild.channels.cache.has(record.channelId)) continue;
    if (await gateway.messageExists(record.channelId, record.discordId))
      existingMessages.push(record.key);
  }

  let automodRuleIds: string[] = [];
  try {
    automodRuleIds = [...(await guild.autoModerationRules.fetch()).keys()];
  } catch {
    automodRuleIds = [];
  }

  return {
    id: guild.id,
    name: guild.name,
    ownerId: guild.ownerId,
    everyonePermissions: guild.roles.everyone.permissions.bitfield.toString(),
    features: [...guild.features],
    roles: [...guild.roles.cache.values()].map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      managed: r.managed,
      editable: r.editable && !r.managed && r.id !== guild.id,
      permissions: r.permissions.bitfield.toString(),
    })),
    channels: [...guild.channels.cache.values()]
      .filter((c) => !c.isThread())
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: channelTypeToKind(c.type),
        parentId: c.parentId,
        position: 'position' in c ? c.position : 0,
        deletable: c.deletable,
        overwrites:
          'permissionOverwrites' in c
            ? [...c.permissionOverwrites.cache.values()].map((o) => ({
                id: o.id,
                type: o.type === OverwriteType.Role ? ('role' as const) : ('member' as const),
                allow: o.allow.bitfield.toString(),
                deny: o.deny.bitfield.toString(),
              }))
            : [],
      })),
    bot: {
      userId: me.id,
      highestRolePosition: me.roles.highest.position,
      isAdmin: me.permissions.has(PermissionFlagsBits.Administrator),
      permissions: me.permissions.toArray(),
    },
    rulesChannelId: guild.rulesChannelId,
    publicUpdatesChannelId: guild.publicUpdatesChannelId,
    existingMessages,
    automodRuleIds,
  };
}
