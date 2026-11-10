import type { Interaction } from 'discord.js';
import { UserFacingError } from '../errors.js';
import { parseCustomId } from './customId.js';
import { replyWithError } from './replies.js';
import type { AppContext, ComponentHandler, SlashCommand } from './types.js';

/** Routes slash commands by name and components/modals by custom id area. */
export class InteractionRouter {
  private readonly commands = new Map<string, SlashCommand>();
  private readonly components = new Map<string, ComponentHandler>();

  constructor(private readonly ctx: AppContext) {}

  addCommand(command: SlashCommand): this {
    this.commands.set(command.data.name, command);
    return this;
  }

  addComponent(handler: ComponentHandler): this {
    if (this.components.has(handler.area))
      throw new Error(`Duplicate component area "${handler.area}"`);
    this.components.set(handler.area, handler);
    return this;
  }

  async handle(interaction: Interaction): Promise<void> {
    const { logger } = this.ctx;
    if (interaction.isChatInputCommand()) {
      const command = this.commands.get(interaction.commandName);
      if (!command) return;
      const started = Date.now();
      try {
        if (command.scope === 'admin')
          assertSeller(interaction.guildId, interaction.user.id, this.ctx);
        await command.execute(interaction, this.ctx);
        logger.debug(
          { command: interaction.commandName, ms: Date.now() - started },
          'command handled',
        );
      } catch (error) {
        await replyWithError(interaction, error, logger, {
          command: interaction.commandName,
          subcommand: interaction.options.getSubcommand(false),
        });
      }
      return;
    }

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
      const parsed = parseCustomId(interaction.customId);
      if (!parsed) return; // not ours
      const handler = this.components.get(parsed.area);
      if (!handler) {
        logger.warn({ customId: interaction.customId }, 'no handler for component');
        return;
      }
      try {
        await handler.handle(interaction, parsed, this.ctx);
      } catch (error) {
        await replyWithError(interaction, error, logger, { customId: interaction.customId });
      }
    }
  }
}

/** Seller-only commands: the configured owner, inside the configured admin guild. */
export function assertSeller(
  guildId: string | null,
  userId: string,
  ctx: Pick<AppContext, 'config'>,
): void {
  if (userId !== ctx.config.OWNER_USER_ID || guildId !== ctx.config.ADMIN_GUILD_ID) {
    throw new UserFacingError('This command is only available to the ServerForge seller.', {
      title: 'Not allowed',
    });
  }
}
