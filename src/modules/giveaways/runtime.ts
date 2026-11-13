import { MessageFlags } from 'discord.js';
import { UserFacingError } from '../../errors.js';
import { brandColor } from '../common.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { toggleEntry, type GiveawayData } from './logic.js';
import { endGiveaway, giveawayMessage } from './service.js';

/** One entry update at a time per giveaway, so fast clicks don't overwrite each other. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

export const giveawaysRuntime: ModuleRuntime = {
  id: 'giveaways',
  components: [
    {
      area: 'give',
      async handle(interaction, id, ctx) {
        if (!interaction.isButton() || id.action !== 'enter' || !interaction.inCachedGuild())
          return;
        const number = Number(id.args[0]);
        const message = await withLock(`${interaction.guildId}:${number}`, async () => {
          const record = await ctx.db.records.findByNumber<GiveawayData>(
            interaction.guildId,
            'giveaway',
            number,
          );
          if (!record || record.status !== 'running')
            throw new UserFacingError('This giveaway has ended.');
          const { entrants, entered } = toggleEntry(record.data.entrants, interaction.user.id);
          const updated = await ctx.db.records.update<GiveawayData>(record.id, {
            data: { ...record.data, entrants },
          });
          await interaction.update(
            giveawayMessage(updated, false, await brandColor(ctx, interaction.guildId)),
          );
          return entered ? '🎉 You’re entered — good luck!' : 'You’ve left the giveaway.';
        });
        await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
      },
    },
  ],
  register(client, ctx) {
    // Check for finished giveaways every 20 seconds.
    const timer = setInterval(() => {
      void (async () => {
        const running = await ctx.db.records.listByStatus<GiveawayData>('giveaway', 'running');
        const now = Date.now();
        for (const record of running) {
          if (new Date(record.data.endsAt).getTime() > now) continue;
          await withLock(`${record.guildId}:${record.number}`, async () => {
            const fresh = await ctx.db.records.get<GiveawayData>(record.id);
            if (fresh?.status === 'running') await endGiveaway({ ...ctx, client }, fresh);
          });
        }
      })().catch((error: unknown) => ctx.logger.warn({ err: error }, 'giveaway sweep failed'));
    }, 20_000);
    timer.unref();
  },
};
