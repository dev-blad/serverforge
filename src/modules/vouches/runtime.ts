import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import { UserFacingError } from '../../errors.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { VouchesRuntimeConfig } from './install.js';
import { parseRating } from './logic.js';
import { submitVouch } from './service.js';

/** "Leave a vouch" button (works in DMs too, so the guild id is part of the custom id). */
export function vouchButtonId(guildId: string, orderNumber?: number): string {
  return orderNumber
    ? customId('vouch', 'open', guildId, String(orderNumber))
    : customId('vouch', 'open', guildId);
}

export function vouchModal(guildId: string, orderNumber?: number | null): ModalBuilder {
  const id = orderNumber
    ? customId('vouch', 'modal', guildId, String(orderNumber))
    : customId('vouch', 'modal', guildId);
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(orderNumber ? `Vouch for order #${orderNumber}` : 'Leave a vouch')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('rating')
          .setLabel('Rating (1–5 stars)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('5')
          .setMinLength(1)
          .setMaxLength(5)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('review')
          .setLabel('Your review')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('How was your experience?')
          .setMinLength(5)
          .setMaxLength(1000)
          .setRequired(true),
      ),
    );
}

export const vouchesRuntime: ModuleRuntime = {
  id: 'vouches',
  components: [
    {
      area: 'vouch',
      async handle(interaction, id, ctx) {
        const [guildId, order] = id.args;
        if (!guildId) return;
        const orderNumber = order ? Number(order) : null;
        if (interaction.isButton() && id.action === 'open') {
          await interaction.showModal(vouchModal(guildId, orderNumber));
          return;
        }
        if (!interaction.isModalSubmit() || id.action !== 'modal') return;

        const config = await ctx.moduleConfig.get<VouchesRuntimeConfig>(guildId, 'vouches');
        const guild = ctx.client.guilds.cache.get(guildId);
        if (!config || !guild)
          throw new UserFacingError('Vouches aren’t available for that server any more.');
        const rating = parseRating(interaction.fields.getTextInputValue('rating'));
        if (!rating) throw new UserFacingError('Please give a rating from 1 to 5.');
        const review = interaction.fields.getTextInputValue('review');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await submitVouch(ctx, guild, interaction.user, config, {
          rating,
          review,
          orderNumber,
        });
        await interaction.editReply(
          `⭐ Thanks! Your vouch (#${result.number}) has been posted in <#${result.channelId}>.`,
        );
      },
    },
  ],
};
