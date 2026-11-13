import type { ComponentHandler, SlashCommand } from '../bot/types.js';
import { forgeCommand } from './forge.js';
import { helpCommand } from './help.js';
import { keysCommand, keysComponents } from './keys.js';
import { setupCommand, setupComponents } from './setup.js';
import { announceCommand, announceComponents } from '../modules/announcements/command.js';
import { statusCommand } from '../modules/status/command.js';
import { vouchCommand } from '../modules/vouches/command.js';
import { orderCommand, productCommand } from '../modules/store/command.js';
import { giveawayCommand } from '../modules/giveaways/command.js';
import { backupCommand, backupComponents } from '../modules/backup/command.js';

/**
 * Slash commands. Handlers stay thin: parse options, call a service, render an embed.
 * scope "global" = registered everywhere; "admin" = only in ADMIN_GUILD_ID (seller tools).
 */
export const commands: SlashCommand[] = [
  setupCommand,
  forgeCommand,
  helpCommand,
  keysCommand,
  // Shop modules (each checks the server's package before doing anything)
  statusCommand,
  vouchCommand,
  announceCommand,
  productCommand,
  orderCommand,
  giveawayCommand,
  backupCommand,
];

export const componentHandlers: ComponentHandler[] = [
  setupComponents,
  keysComponents,
  announceComponents,
  backupComponents,
];
