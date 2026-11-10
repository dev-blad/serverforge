import { Events } from 'discord.js';
import { guildContext } from './bot/guildContext.js';
import { dmOwner, postSummary } from './bot/notifications.js';
import { InteractionRouter } from './bot/router.js';
import { commands, componentHandlers } from './commands/index.js';
import { loadBotConfig } from './config.js';
import { createContainer } from './container.js';
import { TemplateError } from './errors.js';
import { createLogger } from './logger.js';
import { moduleRuntimes } from './modules/index.js';

async function main(): Promise<void> {
  const config = loadBotConfig();
  const logger = createLogger({ level: config.LOG_LEVEL, pretty: config.LOG_PRETTY });
  const ctx = await createContainer(config, logger);
  const { client } = ctx;

  const router = new InteractionRouter(ctx);
  commands.forEach((c) => router.addCommand(c));
  componentHandlers.forEach((h) => router.addComponent(h));
  for (const runtime of moduleRuntimes) {
    runtime.components?.forEach((h) => router.addComponent(h));
    runtime.register?.(client, ctx);
  }

  client.on(Events.InteractionCreate, (interaction) => {
    void router.handle(interaction);
  });

  client.once(Events.ClientReady, (ready) => {
    logger.info({ user: ready.user.tag, guilds: ready.guilds.cache.size }, 'ServerForge is online');
    // Resume builds that were running when the bot stopped (crash, deploy, restart).
    void ctx.setup
      .resumeInterrupted(
        async (guildId) => {
          const guild = await ready.guilds.fetch(guildId).catch(() => null);
          return guild ? guildContext(guild, logger) : null;
        },
        async (outcome, gctx) => {
          ctx.moduleConfig.invalidate(gctx.id);
          const guild = await ready.guilds.fetch(gctx.id);
          if (outcome.result.status === 'succeeded') await postSummary(guild, outcome, logger);
          await dmOwner(guild, outcome, logger, config.SUPPORT_URL);
        },
      )
      .then((n) => n > 0 && logger.info({ resumed: n }, 'resumed interrupted builds'))
      .catch((error: unknown) => logger.error({ err: error }, 'resume failed'));
  });

  client.on(Events.Error, (error) => logger.error({ err: error }, 'discord client error'));
  client.on(Events.Warn, (message) => logger.warn(message));

  // Housekeeping: drop expired rate-limit entries and setup sessions.
  const housekeeping = setInterval(() => {
    ctx.keyGuard.sweep();
    void ctx.db.sessions.purgeExpired(new Date()).catch(() => undefined);
  }, 10 * 60_000);
  housekeeping.unref();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    clearInterval(housekeeping);
    await client.destroy();
    await ctx.db.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) =>
    logger.error({ err: reason }, 'unhandled rejection'),
  );

  await client.login(config.DISCORD_TOKEN);
}

main().catch((error: unknown) => {
  if (
    error instanceof TemplateError ||
    (error instanceof Error && error.message.startsWith('Invalid configuration'))
  ) {
    console.error(`\n✖ ${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
