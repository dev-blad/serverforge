import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { brandColor, discordTime, parseDuration, requireStaff } from '../common.js';
import { requireModule } from '../shared.js';
import type { GiveawaysRuntimeConfig } from './install.js';
import type { GiveawayData } from './logic.js';
import { endGiveaway, giveawayMessage } from './service.js';

const MAX_DURATION = 60 * 24 * 3_600_000; // 60 days

const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('[Staff] Run giveaways')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('start')
      .setDescription('Start a giveaway')
      .addStringOption((o) =>
        o
          .setName('prize')
          .setDescription('What are you giving away?')
          .setRequired(true)
          .setMaxLength(200),
      )
      .addStringOption((o) =>
        o
          .setName('duration')
          .setDescription('How long, e.g. 30m, 2h, 3d')
          .setRequired(true)
          .setMaxLength(20),
      )
      .addIntegerOption((o) =>
        o
          .setName('winners')
          .setDescription('Number of winners (default 1)')
          .setMinValue(1)
          .setMaxValue(20),
      )
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Where to post it')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('end')
      .setDescription('End a giveaway now and draw winners')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Giveaway number').setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('reroll')
      .setDescription('Draw new winners for an ended giveaway')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Giveaway number').setRequired(true).setMinValue(1),
      ),
  );

export const giveawayCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<GiveawaysRuntimeConfig>(
      ctx,
      interaction.guildId,
      'giveaways',
    );
    requireStaff(interaction, config.staffRoleIds);
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const duration = parseDuration(interaction.options.getString('duration', true));
      if (!duration)
        throw new UserFacingError('Use a duration like `30m`, `2h`, `1d 12h` or `1w`.');
      if (duration > MAX_DURATION)
        throw new UserFacingError('Giveaways can run for up to 60 days.');
      const channelId = interaction.options.getChannel('channel')?.id ?? config.channelId;
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.isSendable()) throw new UserFacingError('I can’t post in that channel.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const giveaway: GiveawayData = {
        prize: interaction.options.getString('prize', true),
        winners: interaction.options.getInteger('winners') ?? 1,
        endsAt: new Date(Date.now() + duration).toISOString(),
        entrants: [],
        channelId,
        messageId: null,
        hostId: interaction.user.id,
        winnerIds: [],
      };
      const record = await ctx.db.records.create({
        guildId: interaction.guildId,
        kind: 'giveaway',
        userId: interaction.user.id,
        status: 'running',
        data: giveaway,
      });
      const color = await brandColor(ctx, interaction.guildId);
      const message = giveawayMessage(record, false, color);
      const sent = await channel.send({
        ...message,
        ...(config.pingRoleId ? { content: `<@&${config.pingRoleId}>` } : {}),
        allowedMentions: { roles: config.pingRoleId ? [config.pingRoleId] : [] },
      });
      await ctx.db.records.update(record.id, { data: { ...giveaway, messageId: sent.id } });
      await interaction.editReply(
        `🎉 Giveaway #${record.number} started in <#${channelId}> — it ends ${discordTime(new Date(giveaway.endsAt))}.`,
      );
      return;
    }

    const number = interaction.options.getInteger('number', true);
    const record = await ctx.db.records.findByNumber<GiveawayData>(
      interaction.guildId,
      'giveaway',
      number,
    );
    if (!record) throw new UserFacingError(`There’s no giveaway #${number}.`);
    if (sub === 'end' && record.status !== 'running')
      throw new UserFacingError('That giveaway has already ended.');
    if (sub === 'reroll' && record.status !== 'ended')
      throw new UserFacingError('That giveaway is still running — end it first.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const updated = await endGiveaway(ctx, record, { reroll: sub === 'reroll' });
    await interaction.editReply(
      updated.data.winnerIds.length
        ? `🏆 Winner${updated.data.winnerIds.length > 1 ? 's' : ''}: ${updated.data.winnerIds.map((w) => `<@${w}>`).join(', ')}`
        : 'No eligible entries to draw from.',
    );
  },
};
