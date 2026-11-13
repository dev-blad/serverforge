import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client } from 'discord.js';
import { customId } from '../../bot/customId.js';
import type { AppContext } from '../../bot/types.js';
import type { FeatureRecord } from '../../db/types.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { brandColor } from '../common.js';
import { giveawayEmbed, pickWinners, type GiveawayData } from './logic.js';

export function giveawayMessage(
  record: FeatureRecord<GiveawayData>,
  ended: boolean,
  color: number,
) {
  return {
    embeds: [
      toDiscordEmbed(giveawayEmbed({ number: record.number, data: record.data, ended, color })),
    ],
    components: ended
      ? []
      : [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(customId('give', 'enter', String(record.number)))
              .setLabel(`Enter (${record.data.entrants.length})`)
              .setEmoji('🎉')
              .setStyle(ButtonStyle.Primary),
          ),
        ],
    allowedMentions: { parse: [] as never[] },
  };
}

/** Draw winners (or re-draw, excluding previous winners) and announce them. */
export async function endGiveaway(
  ctx: Pick<AppContext, 'db' | 'logger'> & { client: Client },
  record: FeatureRecord<GiveawayData>,
  options: { reroll?: boolean } = {},
): Promise<FeatureRecord<GiveawayData>> {
  const winnerIds = pickWinners(
    record.data.entrants,
    record.data.winners,
    undefined,
    options.reroll ? record.data.winnerIds : [],
  );
  const data: GiveawayData = { ...record.data, winnerIds };
  const updated = await ctx.db.records.update<GiveawayData>(record.id, { status: 'ended', data });

  const channel = await ctx.client.channels.fetch(data.channelId).catch(() => null);
  if (channel?.isSendable() && 'messages' in channel) {
    const color = await brandColor(ctx, record.guildId);
    if (data.messageId) {
      const message = await channel.messages.fetch(data.messageId).catch(() => null);
      await message?.edit(giveawayMessage(updated, true, color)).catch(() => undefined);
    }
    const link = data.messageId
      ? `https://discord.com/channels/${record.guildId}/${data.channelId}/${data.messageId}`
      : '';
    await channel
      .send({
        content: winnerIds.length
          ? `🎉 ${options.reroll ? 'New winner' : 'Congratulations'} ${winnerIds.map((w) => `<@${w}>`).join(', ')}! You won **${data.prize}**. ${link}`
          : `The giveaway for **${data.prize}** ended with no entries. ${link}`,
        allowedMentions: { users: winnerIds },
      })
      .catch(() => undefined);
  }
  return updated;
}
