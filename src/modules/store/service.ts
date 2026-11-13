import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild,
  type MessageCreateOptions,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import type { AppContext } from '../../bot/types.js';
import type { FeatureRecord } from '../../db/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { vouchButtonId } from '../vouches/runtime.js';
import type { StoreRuntimeConfig } from './install.js';
import {
  ORDER_STATUS,
  canTransition,
  loyaltyRoles,
  nextActions,
  orderBoardEmbed,
  orderCompletedEmbed,
  orderUpdateEmbed,
  type OrderData,
  type OrderStatus,
} from './logic.js';

const ACTION_BUTTONS: Record<OrderStatus, { label: string; style: ButtonStyle }> = {
  received: { label: 'Received', style: ButtonStyle.Secondary },
  in_progress: { label: 'Start', style: ButtonStyle.Primary },
  completed: { label: 'Complete', style: ButtonStyle.Success },
  cancelled: { label: 'Cancel', style: ButtonStyle.Danger },
};

function boardMessage(
  record: FeatureRecord<OrderData>,
  currency: string,
): Pick<MessageCreateOptions, 'embeds' | 'components' | 'allowedMentions'> {
  const status = (record.status ?? 'received') as OrderStatus;
  const actions = nextActions(status);
  return {
    embeds: [
      toDiscordEmbed(
        orderBoardEmbed({
          number: record.number,
          order: record.data,
          status,
          customerId: record.userId ?? '',
          currency,
          createdAt: record.createdAt,
        }),
      ),
    ],
    components: actions.length
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            actions.map((next) =>
              new ButtonBuilder()
                .setCustomId(customId('store', 'status', String(record.number), next))
                .setLabel(ACTION_BUTTONS[next].label)
                .setEmoji(ORDER_STATUS[next].emoji)
                .setStyle(ACTION_BUTTONS[next].style),
            ),
          ),
        ]
      : [],
    allowedMentions: { parse: [] },
  };
}

async function dmCustomer(
  ctx: AppContext,
  guild: Guild,
  record: FeatureRecord<OrderData>,
  config: StoreRuntimeConfig,
  status: OrderStatus,
  withVouchButton: boolean,
): Promise<boolean> {
  const user = await ctx.client.users.fetch(record.userId ?? '').catch(() => null);
  if (!user) return false;
  const embed = toDiscordEmbed(
    orderUpdateEmbed({
      serverName: guild.name,
      number: record.number,
      order: record.data,
      status,
      customerId: user.id,
      currency: config.currency,
    }),
  );
  const components = withVouchButton
    ? [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(vouchButtonId(guild.id, record.number))
            .setLabel('Leave a vouch')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Success),
        ),
      ]
    : [];
  return user
    .send({ embeds: [embed], components })
    .then(() => true)
    .catch(() => false);
}

/** Create an order, post it to the staff board and send the customer a receipt. */
export async function createOrder(
  ctx: AppContext,
  guild: Guild,
  config: StoreRuntimeConfig,
  input: {
    customerId: string;
    item: string;
    price: number | null;
    notes: string | null;
    productNumber: number | null;
    channelId: string | null;
    createdBy: string;
  },
): Promise<FeatureRecord<OrderData>> {
  const data: OrderData = {
    item: input.item,
    price: input.price,
    notes: input.notes,
    productNumber: input.productNumber,
    workerId: null,
    channelId: input.channelId,
    boardMessageId: null,
    history: [{ status: 'received', by: input.createdBy, at: new Date().toISOString() }],
  };
  let record = await ctx.db.records.create({
    guildId: guild.id,
    kind: 'order',
    userId: input.customerId,
    status: 'received',
    data,
  });
  const board = await guild.channels.fetch(config.ordersChannelId).catch(() => null);
  if (board?.isSendable()) {
    const sent = await board.send(boardMessage(record, config.currency));
    record = await ctx.db.records.update(record.id, { data: { ...data, boardMessageId: sent.id } });
  }
  await dmCustomer(ctx, guild, record, config, 'received', false);
  return record;
}

/** Move an order to a new status: update the board, tell the customer, reward loyalty. */
export async function setOrderStatus(
  ctx: AppContext,
  guild: Guild,
  config: StoreRuntimeConfig,
  record: FeatureRecord<OrderData>,
  status: OrderStatus,
  byUserId: string,
): Promise<FeatureRecord<OrderData>> {
  const from = (record.status ?? 'received') as OrderStatus;
  if (!canTransition(from, status)) {
    throw new UserFacingError(
      `Order #${record.number} is already ${ORDER_STATUS[from].label.toLowerCase()}.`,
    );
  }
  const data: OrderData = {
    ...record.data,
    workerId:
      status === 'in_progress' || (status === 'completed' && !record.data.workerId)
        ? byUserId
        : record.data.workerId,
    history: [...record.data.history, { status, by: byUserId, at: new Date().toISOString() }],
  };
  const updated = await ctx.db.records.update<OrderData>(record.id, { status, data });

  // Staff board card
  const board = await guild.channels.fetch(config.ordersChannelId).catch(() => null);
  if (board?.isTextBased() && data.boardMessageId) {
    const message = await board.messages.fetch(data.boardMessageId).catch(() => null);
    await message?.edit(boardMessage(updated, config.currency)).catch(() => undefined);
  }

  const vouchesOn = !!(await ctx.moduleConfig.get(guild.id, 'vouches'));
  await dmCustomer(ctx, guild, updated, config, status, status === 'completed' && vouchesOn);

  if (status === 'completed') {
    // Completion card where the order was made (e.g. the customer's ticket)
    if (data.channelId) {
      const channel = await guild.channels.fetch(data.channelId).catch(() => null);
      if (channel?.isSendable()) {
        await channel
          .send({
            content: `<@${updated.userId}>`,
            embeds: [
              toDiscordEmbed(
                orderCompletedEmbed({
                  number: updated.number,
                  order: data,
                  customerId: updated.userId ?? '',
                  currency: config.currency,
                  askForVouch: vouchesOn,
                }),
              ),
            ],
            components: vouchesOn
              ? [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId(vouchButtonId(guild.id, updated.number))
                      .setLabel('Leave a vouch')
                      .setEmoji('⭐')
                      .setStyle(ButtonStyle.Success),
                  ),
                ]
              : [],
          })
          .catch(() => undefined);
      }
    }
    // Loyalty roles
    const completed = await ctx.db.records.count(guild.id, 'order', {
      userId: updated.userId ?? '',
      status: 'completed',
    });
    const roles = loyaltyRoles(completed, config);
    if (roles.length) {
      const member = await guild.members.fetch(updated.userId ?? '').catch(() => null);
      await member?.roles.add(roles, 'ServerForge: completed order').catch(() => undefined);
    }
  }
  return updated;
}
