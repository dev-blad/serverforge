import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type APIInteractionGuildMember,
} from 'discord.js';
import { customId } from '../bot/customId.js';
import { guildContext } from '../bot/guildContext.js';
import { dmOwner, postSummary, buildSummaryEmbed } from '../bot/notifications.js';
import { interactionReporter } from '../bot/progress.js';
import type { AppContext, ComponentHandler, SlashCommand } from '../bot/types.js';
import { COLORS, errorEmbed, previewEmbed, successEmbed, tierLabel } from '../bot/ui.js';
import type { BuildMode } from '../db/types.js';
import { UserFacingError } from '../errors.js';
import type { BuildOutcome } from '../services/setup/setupService.js';
import { CLEAN_CONFIRMATION } from '../services/setup/setupService.js';

const AREA = 'setup';

export function requireGuild(interaction: { guild: Guild | null }): Guild {
  if (!interaction.guild) throw new UserFacingError('This command only works inside a server.');
  return interaction.guild;
}

/** /setup is restricted to the server owner or members with Administrator. */
export function assertOwnerOrAdmin(
  guild: Guild,
  userId: string,
  member: GuildMember | APIInteractionGuildMember | null,
): void {
  if (guild.ownerId === userId) return;
  const perms = member && 'permissions' in member ? member.permissions : null;
  const isAdmin =
    typeof perms === 'string'
      ? (BigInt(perms) & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
      : (perms?.has(PermissionFlagsBits.Administrator) ?? false);
  if (!isAdmin) {
    throw new UserFacingError('Only the server owner or an Administrator can run this.', {
      title: 'Permission needed',
    });
  }
}

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Build this server from your ServerForge package')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((o) =>
    o
      .setName('key')
      .setDescription('Your license key, e.g. FORGE-XXXX-XXXX-XXXX')
      .setRequired(true)
      .setMaxLength(40),
  )
  .addBooleanOption((o) =>
    o
      .setName('dry-run')
      .setDescription('Only preview what would be created — changes nothing')
      .setRequired(false),
  );

export const setupCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction: ChatInputCommandInteraction, ctx: AppContext) {
    const guild = requireGuild(interaction);
    assertOwnerOrAdmin(guild, interaction.user.id, interaction.member);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawKey = interaction.options.getString('key', true);
    const dryRun = interaction.options.getBoolean('dry-run') ?? false;
    const gctx = await guildContext(guild, ctx.logger);
    const { session, check, template } = await ctx.setup.start({
      guild: gctx,
      userId: interaction.user.id,
      rawKey,
      dryRun,
    });

    if (dryRun) {
      const preview = await ctx.setup.preview(session, gctx, interaction.channelId);
      await interaction.editReply({ embeds: [previewEmbed({ ...preview, dryRun: true })] });
      return;
    }

    const kindText =
      check.kind === 'upgrade'
        ? `This will **upgrade** the server from ${check.previousTier ? tierLabel(check.previousTier) : '—'} to **${tierLabel(template.tier)}**. Nothing existing is removed.`
        : check.kind === 'resync'
          ? 'This key is already active here, so this will **re-sync** the server: anything missing is re-created.'
          : `Key accepted: **${tierLabel(template.tier)}** package — *${template.name}*.`;

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle('🔑 ServerForge setup')
      .setDescription(
        [
          kindText,
          '',
          '**How should ServerForge build?**',
          '➕ **Build alongside existing** — keeps everything you already have and adds the package. Existing roles/channels with the same names are reused.',
          '🧹 **Clean build** — deletes existing channels & roles ServerForge can manage, then builds from scratch. *You will be asked to type a confirmation.*',
          '',
          'You will see a full preview before anything changes.',
        ].join('\n'),
      )
      .setFooter({ text: 'This setup session expires in 30 minutes.' });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId(AREA, 'mode', session.id, 'alongside'))
        .setLabel('Build alongside existing')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(customId(AREA, 'mode', session.id, 'clean'))
        .setLabel('Clean build')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(customId(AREA, 'cancel', session.id))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );
    // Upgrades and re-syncs never wipe the server.
    if (check.kind !== 'setup') buttons.components.splice(1, 1);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  },
};

function optionsModal(
  sessionId: string,
  mode: BuildMode,
  defaults: { name: string; color: string },
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(customId(AREA, 'options', sessionId, mode))
    .setTitle(mode === 'clean' ? 'Clean build options' : 'Build options');
  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('Server display name')
      .setDescription('Used in welcome/rules embeds')
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('serverName')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(100)
          .setRequired(true)
          .setValue(defaults.name.slice(0, 100)),
      ),
    new LabelBuilder()
      .setLabel('Brand colour (hex)')
      .setDescription('e.g. #5865F2 — used for embeds (and roles on Elite)')
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('brandColor')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(7)
          .setRequired(true)
          .setValue(defaults.color),
      ),
  );
  if (mode === 'clean') {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel(`Type ${CLEAN_CONFIRMATION} to confirm`)
        .setDescription('Existing channels & roles ServerForge can manage will be DELETED')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('confirmation')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(CLEAN_CONFIRMATION)
            .setRequired(true)
            .setMaxLength(20),
        ),
    );
  }
  return modal;
}

function confirmButtons(sessionId: string, canConfirm: boolean): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (canConfirm) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(customId(AREA, 'confirm', sessionId))
        .setLabel('Confirm & build')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Success),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(customId(AREA, 'cancel', sessionId))
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
  return row;
}

function rollbackButton(runId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId(AREA, 'rollback', runId))
      .setLabel('Roll back this build')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Danger),
  );
}

/** Render the result of a build in the interaction + summary channel + owner DM. */
export async function reportOutcome(
  interaction: { editReply: ChatInputCommandInteraction['editReply'] },
  guild: Guild,
  outcome: BuildOutcome,
  ctx: AppContext,
): Promise<void> {
  ctx.moduleConfig.invalidate(guild.id);
  if (outcome.result.status === 'succeeded') {
    await interaction
      .editReply({
        embeds: [buildSummaryEmbed(outcome, outcome.run.options.serverName)],
        components: [],
      })
      .catch(() => undefined);
    await postSummary(guild, outcome, ctx.logger);
    if (outcome.run.kind !== 'resync')
      await dmOwner(guild, outcome, ctx.logger, ctx.config.SUPPORT_URL);
    return;
  }
  await interaction
    .editReply({
      embeds: [
        errorEmbed(
          `${outcome.result.error ?? 'The build stopped.'}\n\nCompleted **${outcome.result.completed}/${outcome.result.total}** steps. Everything created so far is tracked:\n• Fix the problem and run \`/setup\` again with the same key to **resume**, or\n• press **Roll back** to remove everything this build created.`,
          'Build failed',
        ),
      ],
      components: [rollbackButton(outcome.run.id)],
    })
    .catch(() => undefined);
}

export const setupComponents: ComponentHandler = {
  area: AREA,
  async handle(interaction, id, ctx) {
    const guild = requireGuild(interaction);
    const [sessionOrRunId = '', arg] = id.args;

    switch (id.action) {
      case 'mode': {
        if (!interaction.isButton()) return;
        const mode: BuildMode = arg === 'clean' ? 'clean' : 'alongside';
        const session = await ctx.setup.getSession(sessionOrRunId, guild.id, interaction.user.id);
        const license = await ctx.db.licenses.findById(session.licenseId);
        const template = ctx.templates.forLicense(license?.tier ?? 'starter', license?.templateId);
        await interaction.showModal(
          optionsModal(session.id, mode, { name: guild.name, color: template.defaults.brandColor }),
        );
        return;
      }

      case 'options': {
        if (!interaction.isModalSubmit()) return;
        const mode: BuildMode = arg === 'clean' ? 'clean' : 'alongside';
        const options = ctx.setup.parseOptions({
          serverName: interaction.fields.getTextInputValue('serverName'),
          brandColor: interaction.fields.getTextInputValue('brandColor'),
          mode,
          ...(mode === 'clean'
            ? { confirmation: interaction.fields.getTextInputValue('confirmation') }
            : {}),
        });
        if (interaction.isFromMessage()) await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const gctx = await guildContext(guild, ctx.logger);
        const preview = await ctx.setup.submitOptions(
          sessionOrRunId,
          gctx,
          interaction.user.id,
          options,
          interaction.channelId,
        );
        await interaction.editReply({
          embeds: [previewEmbed({ ...preview, dryRun: false })],
          components: [confirmButtons(preview.session.id, preview.preflight.ok)],
        });
        return;
      }

      case 'confirm': {
        if (!interaction.isButton()) return;
        await ctx.setup.getSession(sessionOrRunId, guild.id, interaction.user.id);
        await interaction.deferUpdate();
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.brand)
              .setTitle('🔨 Starting build…')
              .setDescription('Running final checks.'),
          ],
          components: [],
        });
        const gctx = await guildContext(guild, ctx.logger);
        const outcome = await ctx.setup.confirm({
          sessionId: sessionOrRunId,
          guild: gctx,
          userId: interaction.user.id,
          reporter: interactionReporter(interaction, ctx.logger),
          preserveChannelId: interaction.channelId,
        });
        await reportOutcome(interaction, guild, outcome, ctx);
        return;
      }

      case 'cancel': {
        if (!interaction.isButton()) return;
        await ctx.setup.cancel(sessionOrRunId, guild.id, interaction.user.id);
        await interaction.update({
          embeds: [
            successEmbed(
              'Setup cancelled — nothing was changed and your key was not used.',
              'Cancelled',
            ),
          ],
          components: [],
        });
        return;
      }

      case 'rollback': {
        if (!interaction.isButton()) return;
        await interaction.deferUpdate();
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle('↩️ Rolling back…')],
          components: [],
        });
        const gctx = await guildContext(guild, ctx.logger);
        const result = await ctx.setup.rollback(sessionOrRunId, gctx, interaction.user.id);
        ctx.moduleConfig.invalidate(guild.id);
        await interaction.editReply({
          embeds: [
            successEmbed(
              `Removed **${result.deleted}** created item(s) and restored **${result.restored}** setting(s).${
                result.failed.length
                  ? `\n\n⚠️ Could not remove: ${result.failed.join(', ')} — please delete them manually.`
                  : ''
              }\n\nYour key stays linked to this server — run \`/setup\` again whenever you're ready.`,
              'Rolled back',
            ),
          ],
          components: [],
        });
        return;
      }
    }
  },
};
