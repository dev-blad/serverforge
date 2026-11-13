import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../bot/types.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { requireStaff } from '../common.js';
import { requireModule } from '../shared.js';
import type { StatusRuntimeConfig } from './install.js';
import { STATUS_STATES, statusChannelName, statusEmbed, type StatusState } from './logic.js';

const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Update the shop status board')
  .setDMPermission(false)
  .addStringOption((o) =>
    o
      .setName('state')
      .setDescription('Are you taking orders?')
      .setRequired(true)
      .addChoices(
        { name: '🟢 Open', value: 'open' },
        { name: '🟡 Busy', value: 'busy' },
        { name: '🔴 Closed', value: 'closed' },
      ),
  )
  .addStringOption((o) =>
    o
      .setName('note')
      .setDescription('Optional note, e.g. "Back on Monday" or "Delivery delays this week"')
      .setMaxLength(500),
  );

export const statusCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<StatusRuntimeConfig>(ctx, interaction.guildId, 'status');
    requireStaff(interaction, config.staffRoleIds);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const state = interaction.options.getString('state', true) as StatusState;
    const note = interaction.options.getString('note');
    const embed = toDiscordEmbed(
      statusEmbed({
        state,
        note,
        updatedBy: interaction.user.toString(),
        at: new Date(),
        serverName: config.serverName,
      }),
    );

    const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply(
        'The status channel no longer exists. Run `/forge resync` to restore it.',
      );
      return;
    }
    const existing = await channel.messages.fetch(config.messageId).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      const sent = await channel.send({ embeds: [embed] });
      const record = await ctx.db.modules.get(interaction.guildId, 'status');
      if (record) {
        await ctx.db.modules.upsert({
          ...record,
          config: { ...record.config, messageId: sent.id },
        });
        ctx.moduleConfig.invalidate(interaction.guildId);
      }
    }

    let renameNote = '';
    if (config.renameChannel && 'setName' in channel) {
      const name = statusChannelName(channel.name || config.baseName, state);
      if (name !== channel.name) {
        // Discord allows ~2 renames per 10 minutes; don't make the user wait for it.
        void channel
          .setName(name, 'ServerForge status board')
          .catch((error: unknown) => ctx.logger.warn({ err: error }, 'status rename failed'));
        renameNote =
          '\nThe channel name updates too (Discord may delay this if it changed recently).';
      }
    }
    const s = STATUS_STATES[state];
    await interaction.editReply(
      `${s.emoji} Status set to **${s.label}** in <#${config.channelId}>.${renameNote}`,
    );
  },
};
