import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { BotConfig } from '../config.js';
import type { Database } from '../db/types.js';
import type { Logger } from '../logger.js';
import type { ModuleConfigStore } from '../modules/configStore.js';
import type { LicenseService } from '../services/license/licenseService.js';
import type { KeyAttemptGuard } from '../services/rateLimit/rateLimiter.js';
import type { SetupService } from '../services/setup/setupService.js';
import type { TemplateRegistry } from '../services/template/registry.js';
import type { ParsedCustomId } from './customId.js';

/** Shared services available to every command, component and module handler. */
export interface AppContext {
  config: BotConfig;
  logger: Logger;
  db: Database;
  templates: TemplateRegistry;
  licenses: LicenseService;
  keyGuard: KeyAttemptGuard;
  setup: SetupService;
  moduleConfig: ModuleConfigStore;
  client: Client;
}

/** "global" commands are registered everywhere; "admin" only in the seller's admin guild. */
export type CommandScope = 'global' | 'admin';

export interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  scope: CommandScope;
  execute(interaction: ChatInputCommandInteraction, ctx: AppContext): Promise<void>;
}

export type ComponentInteraction =
  ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction;

export interface ComponentHandler {
  /** The custom id area this handler owns (`sf:<area>:…`). */
  area: string;
  handle(interaction: ComponentInteraction, id: ParsedCustomId, ctx: AppContext): Promise<void>;
}
