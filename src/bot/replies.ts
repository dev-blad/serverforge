import { randomBytes } from 'node:crypto';
import { MessageFlags, type EmbedBuilder, type RepliableInteraction } from 'discord.js';
import { isUserFacing } from '../errors.js';
import type { Logger } from '../logger.js';
import { errorEmbed } from './ui.js';

/** Reply (or edit/follow up) ephemerally, whatever state the interaction is in. */
export async function respond(
  interaction: RepliableInteraction,
  payload: { embeds: EmbedBuilder[]; components?: [] },
): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply({ embeds: payload.embeds, components: payload.components ?? [] });
  } else if (interaction.replied) {
    await interaction.followUp({ embeds: payload.embeds, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ embeds: payload.embeds, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Every user-facing error becomes a friendly ephemeral embed. Anything unexpected is logged
 * with context and a short reference code the customer can quote to support.
 */
export async function replyWithError(
  interaction: RepliableInteraction,
  error: unknown,
  logger: Logger,
  context: Record<string, unknown> = {},
): Promise<void> {
  let embed: EmbedBuilder;
  if (isUserFacing(error)) {
    embed = errorEmbed(
      error.message,
      error.options.title ?? "That didn't work",
      error.options.details ?? [],
    );
  } else {
    const ref = randomBytes(3).toString('hex').toUpperCase();
    logger.error(
      {
        err: error,
        ref,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        ...context,
      },
      'unexpected interaction error',
    );
    embed = errorEmbed(
      `An unexpected error occurred. Please try again in a moment. If it keeps happening, contact support with reference **${ref}**.`,
    );
  }
  try {
    await respond(interaction, { embeds: [embed], components: [] });
  } catch (replyError) {
    logger.warn({ err: replyError }, 'could not send error reply');
  }
}
