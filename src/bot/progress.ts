import type { RepliableInteraction } from 'discord.js';
import type { Logger } from '../logger.js';
import type { ProgressReporter, ProgressUpdate } from '../services/builder/types.js';
import { progressEmbed } from './ui.js';

/**
 * Edits the ephemeral interaction reply with live progress ("Creating channels 12/34"),
 * throttled so we never spam Discord with edits. Failures (e.g. the 15-minute interaction
 * token expiring on huge builds) are swallowed — the build itself carries on.
 */
export function interactionReporter(
  interaction: RepliableInteraction,
  logger: Logger,
  options: { title?: string; intervalMs?: number } = {},
): ProgressReporter {
  const interval = options.intervalMs ?? 1500;
  let lastEdit = 0;
  let disabled = false;
  return {
    async update(progress: ProgressUpdate) {
      if (disabled) return;
      const now = Date.now();
      const phaseBoundary = progress.phaseDone === 1;
      if (now - lastEdit < interval && !phaseBoundary) return;
      lastEdit = now;
      try {
        await interaction.editReply({
          embeds: [progressEmbed(progress, options.title)],
          components: [],
        });
      } catch (error) {
        disabled = true;
        logger.debug({ err: error }, 'progress edits disabled');
      }
    },
  };
}
