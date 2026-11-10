import type { ComponentHandler, SlashCommand } from '../bot/types.js';
import { forgeCommand } from './forge.js';
import { helpCommand } from './help.js';
import { keysCommand } from './keys.js';
import { setupCommand, setupComponents } from './setup.js';

/**
 * Slash commands. Handlers stay thin: parse options, call a service, render an embed.
 * scope "global" = registered everywhere; "admin" = only in ADMIN_GUILD_ID (seller tools).
 */
export const commands: SlashCommand[] = [setupCommand, forgeCommand, helpCommand, keysCommand];

export const componentHandlers: ComponentHandler[] = [setupComponents];
