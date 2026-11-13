import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { SlashCommand } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { cleanImageUrl } from '../announcements/logic.js';
import {
  box,
  brandColor,
  discordTime,
  money,
  padNumber,
  parsePrice,
  requireStaff,
} from '../common.js';
import { requireModule } from '../shared.js';
import type { StoreRuntimeConfig } from './install.js';
import {
  ORDER_STATUS,
  orderBoardEmbed,
  productEmbed,
  type OrderData,
  type OrderStatus,
  type ProductData,
} from './logic.js';
import { orderButtonId } from './runtime.js';
import { createOrder } from './service.js';

const productData = new SlashCommandBuilder()
  .setName('product')
  .setDescription('[Staff] Manage the product catalogue')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Post a product card with an Order button')
      .addStringOption((o) =>
        o.setName('name').setDescription('Product name').setRequired(true).setMaxLength(100),
      )
      .addStringOption((o) =>
        o
          .setName('price')
          .setDescription('Price, e.g. 10 or 24.99')
          .setRequired(true)
          .setMaxLength(20),
      )
      .addStringOption((o) =>
        o
          .setName('description')
          .setDescription('What’s included')
          .setRequired(true)
          .setMaxLength(1500),
      )
      .addStringOption((o) =>
        o.setName('delivery').setDescription('Delivery time, e.g. "24 hours"').setMaxLength(60),
      )
      .addStringOption((o) =>
        o.setName('image').setDescription('Image link (https://…)').setMaxLength(500),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Remove a product card')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Product number').setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) => s.setName('list').setDescription('List products'));

export const productCommand: SlashCommand = {
  data: productData.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<StoreRuntimeConfig>(ctx, interaction.guildId, 'store');
    requireStaff(interaction, config.staffRoleIds);
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const price = parsePrice(interaction.options.getString('price', true));
      if (price === null)
        throw new UserFacingError('Please enter the price as a number, e.g. `10` or `24.99`.');
      const channel = await interaction.guild.channels
        .fetch(config.catalogueChannelId)
        .catch(() => null);
      if (!channel?.isSendable())
        throw new UserFacingError('The shop channel is missing. Run `/forge resync`.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const data: ProductData = {
        name: interaction.options.getString('name', true),
        price,
        description: interaction.options.getString('description', true).replace(/\\n/g, '\n'),
        delivery: interaction.options.getString('delivery'),
        image: cleanImageUrl(interaction.options.getString('image')),
        channelId: channel.id,
        messageId: null,
      };
      const record = await ctx.db.records.create({
        guildId: interaction.guildId,
        kind: 'product',
        data,
      });
      const sent = await channel.send({
        embeds: [
          toDiscordEmbed(
            productEmbed({
              number: record.number,
              product: data,
              currency: config.currency,
              color: await brandColor(ctx, interaction.guildId),
            }),
          ),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(orderButtonId(record.number))
              .setLabel(`Order — ${money(price, config.currency)}`)
              .setEmoji('🛒')
              .setStyle(ButtonStyle.Success),
          ),
        ],
      });
      await ctx.db.records.update(record.id, { data: { ...data, messageId: sent.id } });
      await interaction.editReply(`🛒 Product ${padNumber(record.number)} posted: ${sent.url}`);
      return;
    }

    if (sub === 'remove') {
      const number = interaction.options.getInteger('number', true);
      const record = await ctx.db.records.findByNumber<ProductData>(
        interaction.guildId,
        'product',
        number,
      );
      if (!record) throw new UserFacingError(`There’s no product #${number}.`);
      if (record.data.channelId && record.data.messageId) {
        const channel = await interaction.guild.channels
          .fetch(record.data.channelId)
          .catch(() => null);
        if (channel?.isTextBased())
          await channel.messages.delete(record.data.messageId).catch(() => undefined);
      }
      await ctx.db.records.delete(record.id);
      await interaction.reply({
        content: `🗑️ Product #${number} removed.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const products = await ctx.db.records.list<ProductData>(interaction.guildId, 'product');
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: products.length
        ? products
            .reverse()
            .map(
              (p) =>
                `**${padNumber(p.number)}** ${p.data.name} — ${money(p.data.price, config.currency)}`,
            )
            .join('\n')
        : 'No products yet — add one with `/product add`.',
    });
  },
};

const orderData = new SlashCommandBuilder()
  .setName('order')
  .setDescription('[Staff] Track customer orders')
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName('create')
      .setDescription('Log an order for a customer (e.g. from a ticket)')
      .addUserOption((o) =>
        o.setName('customer').setDescription('Who is it for?').setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('item')
          .setDescription('What did they order?')
          .setRequired(true)
          .setMaxLength(200),
      )
      .addStringOption((o) => o.setName('price').setDescription('Price, e.g. 100').setMaxLength(20))
      .addStringOption((o) =>
        o.setName('notes').setDescription('Details for the team').setMaxLength(1000),
      ),
  )
  .addSubcommand((s) => s.setName('list').setDescription('Show open orders'))
  .addSubcommand((s) =>
    s
      .setName('view')
      .setDescription('Show one order')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Order number').setRequired(true).setMinValue(1),
      ),
  );

export const orderCommand: SlashCommand = {
  data: orderData.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<StoreRuntimeConfig>(ctx, interaction.guildId, 'store');
    requireStaff(interaction, config.staffRoleIds);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const customer = interaction.options.getUser('customer', true);
      if (customer.bot) throw new UserFacingError('Orders are for people, not bots.');
      const priceText = interaction.options.getString('price');
      const price = priceText ? parsePrice(priceText) : null;
      if (priceText && price === null)
        throw new UserFacingError('Please enter the price as a number, e.g. `100`.');
      await interaction.deferReply();
      const order = await createOrder(ctx, interaction.guild, config, {
        customerId: customer.id,
        item: interaction.options.getString('item', true),
        price,
        notes: interaction.options.getString('notes'),
        productNumber: null,
        channelId: interaction.channelId,
        createdBy: interaction.user.id,
      });
      await interaction.editReply({
        content: [
          `📥 **Order ${padNumber(order.number)}** logged for ${customer.toString()}.`,
          box('Item', order.data.item),
          ...(price !== null ? [box('Price', money(price, config.currency))] : []),
          `Track it in <#${config.ordersChannelId}>. A completion card will be posted here when it’s done.`,
        ].join('\n'),
        allowedMentions: { users: [customer.id] },
      });
      return;
    }

    if (sub === 'list') {
      const open = await ctx.db.records.list<OrderData>(interaction.guildId, 'order', {
        status: ['received', 'in_progress'],
        limit: 25,
      });
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
        content: open.length
          ? open
              .map((o) => {
                const s = ORDER_STATUS[(o.status ?? 'received') as OrderStatus];
                return `${s.emoji} **${padNumber(o.number)}** ${o.data.item} — <@${o.userId}> · ${discordTime(o.createdAt)}`;
              })
              .join('\n')
          : '🎉 No open orders.',
      });
      return;
    }

    const number = interaction.options.getInteger('number', true);
    const order = await ctx.db.records.findByNumber<OrderData>(
      interaction.guildId,
      'order',
      number,
    );
    if (!order) throw new UserFacingError(`There’s no order #${number}.`);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
      embeds: [
        toDiscordEmbed(
          orderBoardEmbed({
            number: order.number,
            order: order.data,
            status: (order.status ?? 'received') as OrderStatus,
            customerId: order.userId ?? '',
            currency: config.currency,
            createdAt: order.createdAt,
          }),
        ),
      ],
    });
  },
};
