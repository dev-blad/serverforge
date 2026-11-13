import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import { UserFacingError } from '../../errors.js';
import { padNumber, requireStaff } from '../common.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import type { StoreRuntimeConfig } from './install.js';
import type { OrderData, OrderStatus, ProductData } from './logic.js';
import { createOrder, setOrderStatus } from './service.js';

export const orderButtonId = (productNumber: number) =>
  customId('store', 'order', String(productNumber));

const STATUSES: OrderStatus[] = ['received', 'in_progress', 'completed', 'cancelled'];

export const storeRuntime: ModuleRuntime = {
  id: 'store',
  components: [
    {
      area: 'store',
      async handle(interaction, id, ctx) {
        if (!interaction.inCachedGuild()) return;
        const config = await requireModule<StoreRuntimeConfig>(ctx, interaction.guildId, 'store');

        // Customer clicked "Order" on a product card → ask for details.
        if (interaction.isButton() && id.action === 'order') {
          const number = Number(id.args[0]);
          const product = await ctx.db.records.findByNumber<ProductData>(
            interaction.guildId,
            'product',
            number,
          );
          if (!product) throw new UserFacingError('Sorry, that product is no longer available.');
          await interaction.showModal(
            new ModalBuilder()
              .setCustomId(customId('store', 'place', String(number)))
              .setTitle(`Order: ${product.data.name}`.slice(0, 45))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setCustomId('notes')
                    .setLabel('Anything we should know?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Quantity, options, deadline, account details we’ll need…')
                    .setMaxLength(1000)
                    .setRequired(false),
                ),
              ),
          );
          return;
        }

        if (interaction.isModalSubmit() && id.action === 'place') {
          const number = Number(id.args[0]);
          const product = await ctx.db.records.findByNumber<ProductData>(
            interaction.guildId,
            'product',
            number,
          );
          if (!product) throw new UserFacingError('Sorry, that product is no longer available.');
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const order = await createOrder(ctx, interaction.guild, config, {
            customerId: interaction.user.id,
            item: product.data.name,
            price: product.data.price,
            notes: interaction.fields.getTextInputValue('notes') || null,
            productNumber: number,
            channelId: null,
            createdBy: interaction.user.id,
          });
          await interaction.editReply(
            `📥 **Order ${padNumber(order.number)} received!** Our team has been notified and will be in touch soon. We’ll also DM you as your order progresses.`,
          );
          return;
        }

        // Staff moved an order along on the board.
        if (interaction.isButton() && id.action === 'status') {
          requireStaff(interaction, config.staffRoleIds);
          const [numberArg, next] = id.args;
          if (!STATUSES.includes(next as OrderStatus)) return;
          const record = await ctx.db.records.findByNumber<OrderData>(
            interaction.guildId,
            'order',
            Number(numberArg),
          );
          if (!record) throw new UserFacingError('That order no longer exists.');
          await interaction.deferUpdate();
          await setOrderStatus(
            ctx,
            interaction.guild,
            config,
            record,
            next as OrderStatus,
            interaction.user.id,
          );
        }
      },
    },
  ],
};
