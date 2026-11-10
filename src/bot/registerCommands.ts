import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { SlashCommand } from './types.js';

export interface CommandRegistrationPlan {
  /** Commands registered globally (every server; can take up to an hour to appear). */
  global: RESTPostAPIChatInputApplicationCommandsJSONBody[];
  /** Commands registered per guild (appear instantly). */
  guilds: Record<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]>;
}

/**
 * Decide where each slash command is registered.
 *  • Normal: customer commands globally, seller commands only in ADMIN_GUILD_ID.
 *  • DEV_GUILD_ID set (test mode): everything in the dev guild only — instant, and no
 *    duplicate global copies. Global commands are cleared so they don't show twice.
 */
export function planCommandRegistration(
  commands: readonly SlashCommand[],
  options: { adminGuildId: string; devGuildId?: string | undefined },
): CommandRegistrationPlan {
  const customer = commands.filter((c) => c.scope === 'global').map((c) => c.data);
  const seller = commands.filter((c) => c.scope === 'admin').map((c) => c.data);
  if (options.devGuildId) {
    const guilds: CommandRegistrationPlan['guilds'] = {
      [options.devGuildId]: [...customer, ...seller],
    };
    if (options.adminGuildId !== options.devGuildId) guilds[options.adminGuildId] = seller;
    return { global: [], guilds };
  }
  return { global: customer, guilds: { [options.adminGuildId]: seller } };
}
