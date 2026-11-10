import { MessageFlags, type RepliableInteraction } from 'discord.js';
import type { AppContext } from '../bot/types.js';
import { UserFacingError } from '../errors.js';
import type { MessagePayload } from '../services/builder/gateway.js';
import type { ModuleId } from '../services/template/schema.js';
import type { ModuleInstallContext } from './types.js';

/**
 * Post a module panel (verification / roles / tickets) once. If the tracked panel message
 * still exists in the same channel it's left alone; otherwise it's (re-)posted and tracked.
 */
export async function ensurePanel(
  ctx: ModuleInstallContext,
  key: string,
  channelId: string,
  payload: MessagePayload,
): Promise<string> {
  const tracked = await ctx.tracked(key);
  if (tracked && tracked.channelId === channelId) {
    const exists = await ctx.queue.run(`check ${key}`, () =>
      ctx.gateway.messageExists(channelId, tracked.discordId),
    );
    if (exists) return tracked.discordId;
  }
  const messageId = await ctx.queue.run(`post ${key}`, () =>
    ctx.gateway.sendMessage(channelId, payload),
  );
  await ctx.track({ key, kind: 'message', discordId: messageId, channelId });
  return messageId;
}

/** Resolve a template key to an id or fail the module install with a clear message. */
export function requireId(map: Record<string, string>, key: string, what: string): string {
  const id = map[key];
  if (!id) throw new Error(`${what} "${key}" was not created, so the module can't be installed`);
  return id;
}

/** Load a module's config for a guild or tell the user the feature isn't active. */
export async function requireModule<T extends object>(
  ctx: AppContext,
  guildId: string | null,
  moduleId: ModuleId,
): Promise<T> {
  if (!guildId) throw new UserFacingError('This only works inside a server.');
  const config = await ctx.moduleConfig.get<T>(guildId, moduleId);
  if (!config) {
    throw new UserFacingError("This feature isn't enabled on this server's ServerForge package.", {
      title: 'Not available',
    });
  }
  return config;
}

export async function ephemeral(interaction: RepliableInteraction, content: string): Promise<void> {
  if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
