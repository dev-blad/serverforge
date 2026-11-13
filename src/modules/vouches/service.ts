import type { Guild, User } from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { formatDuration } from '../common.js';
import type { VouchesRuntimeConfig } from './install.js';
import { vouchEmbed, vouchStats, type VouchData } from './logic.js';

export async function currentStats(ctx: AppContext, guildId: string) {
  const all = await ctx.db.records.list<VouchData>(guildId, 'vouch');
  return vouchStats(all.map((v) => v.data.rating));
}

/** Record a vouch and post it to the vouch channel. Returns the vouch number. */
export async function submitVouch(
  ctx: AppContext,
  guild: Guild,
  user: User,
  config: VouchesRuntimeConfig,
  input: { rating: number; review: string; staffId?: string | null; orderNumber?: number | null },
): Promise<{ number: number; channelId: string }> {
  if (input.orderNumber) {
    const forOrder = await ctx.db.records.list<VouchData>(guild.id, 'vouch', { userId: user.id });
    if (forOrder.some((v) => v.data.orderNumber === input.orderNumber)) {
      throw new UserFacingError('You’ve already left a vouch for this order — thank you!');
    }
  } else if (config.cooldownHours > 0) {
    const since = new Date(Date.now() - config.cooldownHours * 3_600_000);
    const recent = await ctx.db.records.count(guild.id, 'vouch', { userId: user.id, since });
    if (recent > 0) {
      throw new UserFacingError(
        `You can leave one vouch every ${formatDuration(config.cooldownHours * 3_600_000)}. Thanks for the support!`,
      );
    }
  }

  const data: VouchData = {
    rating: input.rating,
    review: input.review,
    staffId: input.staffId ?? null,
    orderNumber: input.orderNumber ?? null,
    channelId: config.channelId,
    messageId: null,
  };
  const record = await ctx.db.records.create({
    guildId: guild.id,
    kind: 'vouch',
    userId: user.id,
    data,
  });
  const stats = await currentStats(ctx, guild.id);
  const member = await guild.members.fetch(user.id).catch(() => null);

  const channel = await guild.channels.fetch(config.channelId).catch(() => null);
  if (channel?.isSendable()) {
    const sent = await channel.send({
      embeds: [
        toDiscordEmbed(
          vouchEmbed({
            number: record.number,
            data,
            customerId: user.id,
            customerName: member?.displayName ?? user.username,
            avatarUrl: user.displayAvatarURL({ size: 128 }),
            stats,
          }),
        ),
      ],
      allowedMentions: { parse: [] },
    });
    await ctx.db.records.update(record.id, { data: { ...data, messageId: sent.id } });
  }
  return { number: record.number, channelId: config.channelId };
}
