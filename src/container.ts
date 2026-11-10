import { Client, GatewayIntentBits, Partials } from 'discord.js';
import type { AppContext } from './bot/types.js';
import type { BotConfig } from './config.js';
import { createPrismaClient, createPrismaDatabase } from './db/prisma.js';
import type { Database } from './db/types.js';
import type { Logger } from './logger.js';
import { ModuleConfigStore } from './modules/configStore.js';
import { moduleInstallers } from './modules/index.js';
import { LicenseService } from './services/license/licenseService.js';
import { KeyAttemptGuard } from './services/rateLimit/rateLimiter.js';
import { SetupService } from './services/setup/setupService.js';
import { StatusService } from './services/setup/statusService.js';
import { CaptureService } from './services/template/captureService.js';
import { loadTemplates } from './services/template/loader.js';
import { TemplateRegistry } from './services/template/registry.js';

/** Gateway intents ServerForge needs. GuildMembers is privileged — enable it in the dev portal. */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.AutoModerationExecution,
];

/** Wire every service together (simple manual dependency injection). */
export async function createContainer(
  config: BotConfig,
  logger: Logger,
  db?: Database,
): Promise<AppContext> {
  // Templates are validated at startup — an invalid template stops the bot with a readable error.
  const templates = new TemplateRegistry(await loadTemplates(config.TEMPLATES_DIR));
  logger.info({ templates: templates.list().map((t) => t.id) }, 'templates loaded');

  const database = db ?? createPrismaDatabase(createPrismaClient(config.DATABASE_URL));
  const keyGuard = new KeyAttemptGuard({
    perUser: config.KEY_ATTEMPTS_PER_USER,
    perGuild: config.KEY_ATTEMPTS_PER_GUILD,
    windowMs: config.KEY_ATTEMPT_WINDOW_SECONDS * 1000,
  });
  const licenses = new LicenseService(
    database.licenses,
    database.guilds,
    config.LICENSE_PEPPER,
    templates,
  );
  const setup = new SetupService({
    db: database,
    licenses,
    templates,
    keyGuard,
    installers: moduleInstallers,
    logger,
  });

  const client = new Client({
    intents: INTENTS,
    // Partial messages let the logging module report deletes of uncached messages.
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  return {
    config,
    logger,
    db: database,
    templates,
    licenses,
    keyGuard,
    setup,
    status: new StatusService(database, templates),
    capture: new CaptureService(config.TEMPLATES_DIR, logger),
    moduleConfig: new ModuleConfigStore(database),
    client,
  };
}
