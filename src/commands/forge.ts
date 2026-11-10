import {
  AttachmentBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import { assertSeller } from '../bot/router.js';
import { guildContext } from '../bot/guildContext.js';
import { interactionReporter } from '../bot/progress.js';
import type { AppContext, SlashCommand } from '../bot/types.js';
import { COLORS, infoEmbed, statusField, summaryLines } from '../bot/ui.js';
import { UserFacingError } from '../errors.js';
import { captureSourceFromGuild } from '../services/template/captureDiscord.js';
import { TIERS, type Tier } from '../services/template/schema.js';
import { assertOwnerOrAdmin, reportOutcome, requireGuild } from './setup.js';

const data = new SlashCommandBuilder()
  .setName('forge')
  .setDescription('Manage your ServerForge build')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s.setName('status').setDescription("Show this server's package, key and enabled modules"),
  )
  .addSubcommand((s) =>
    s
      .setName('resync')
      .setDescription(
        'Re-create anything from your package that was deleted (never removes your own additions)',
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('capture')
      .setDescription('[Seller only] Export a server you designed into a new template file')
      .addStringOption((o) =>
        o
          .setName('id')
          .setDescription('Template id, e.g. crypto-pro')
          .setRequired(true)
          .setMaxLength(64),
      )
      .addStringOption((o) => o.setName('name').setDescription('Display name').setMaxLength(100))
      .addStringOption((o) =>
        o
          .setName('tier')
          .setDescription('Tier this template is sold as (default starter)')
          .addChoices(...TIERS.map((t) => ({ name: t, value: t }))),
      )
      .addStringOption((o) =>
        o
          .setName('guild-id')
          .setDescription('Server to capture (default: this server)')
          .setMaxLength(20),
      ),
  );

async function status(interaction: Parameters<SlashCommand['execute']>[0], ctx: AppContext) {
  const guild = requireGuild(interaction);
  const s = await ctx.status.get(guild.id);
  if (!s.setUp) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "This server hasn't been built with ServerForge yet.\nRun `/setup key:<your key>` to start, or `/setup key:<key> dry-run:true` to preview.",
          'ServerForge status',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(`ServerForge status — ${guild.name}`)
    .addFields(
      { name: 'Package', value: `**${s.tierLabel}** — ${s.templateName}`, inline: true },
      {
        name: 'License key',
        value: `\`${s.maskedKey ?? 'unknown'}\` (${s.keyStatus ?? 'unknown'})`,
        inline: true,
      },
      {
        name: 'Built',
        value: s.builtAt ? time(s.builtAt, TimestampStyles.LongDateTime) : 'Not completed yet',
        inline: true,
      },
      { name: 'Enabled modules', value: statusField(s.modules) },
    );
  if (s.lastRun) {
    embed.addFields({
      name: 'Last build',
      value: `${s.lastRun.kind} — **${s.lastRun.status}** ${time(s.lastRun.startedAt, TimestampStyles.RelativeTime)}${
        s.lastRun.error ? `\n> ${s.lastRun.error.slice(0, 300)}` : ''
      }`,
    });
  }
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function resync(interaction: Parameters<SlashCommand['execute']>[0], ctx: AppContext) {
  const guild = requireGuild(interaction);
  assertOwnerOrAdmin(guild, interaction.user.id, interaction.member);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const gctx = await guildContext(guild, ctx.logger);
  const preview = await ctx.setup.previewResync(gctx);
  await interaction.editReply({
    embeds: [
      infoEmbed(summaryLines(preview.plan.summary).join('\n'), '🔧 Re-syncing…').setFooter({
        text: 'Only missing template items are re-created. Your own channels and roles are never touched.',
      }),
    ],
  });
  const outcome = await ctx.setup.resync(
    gctx,
    interaction.user.id,
    interactionReporter(interaction, ctx.logger, { title: '🔧 Re-syncing…' }),
  );
  await reportOutcome(interaction, guild, outcome, ctx);
}

async function capture(interaction: Parameters<SlashCommand['execute']>[0], ctx: AppContext) {
  assertSeller(interaction.guildId, interaction.user.id, ctx);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.options.getString('guild-id') ?? interaction.guildId;
  const target = guildId ? await ctx.client.guilds.fetch(guildId).catch(() => null) : null;
  if (!target) throw new UserFacingError('ServerForge is not in that server (or the id is wrong).');
  const tier = (interaction.options.getString('tier') ?? 'starter') as Tier;
  const outcome = await ctx.capture.capture(await captureSourceFromGuild(target), {
    id: interaction.options.getString('id', true),
    name: interaction.options.getString('name'),
    tier,
  });
  const lines = [
    `Captured **${target.name}** as a **${tier}** template.`,
    outcome.writtenTo
      ? `Saved to \`${outcome.writtenTo}\`. It becomes available after the next restart (run \`npm run validate-templates\` first).`
      : 'Could not write to the templates folder (read-only filesystem?) — download the attached file and add it to `templates/` in your repo.',
    '',
    'Next: add welcome/rules `messages` and `modules` (see TEMPLATES.md), or make it `extends: pro` and keep only the differences.',
  ];
  if (outcome.warnings.length)
    lines.push('', '**Notes**', ...outcome.warnings.map((w) => `• ${w}`));
  await interaction.editReply({
    embeds: [infoEmbed(lines.join('\n'), '📸 Template captured')],
    files: [new AttachmentBuilder(Buffer.from(outcome.yaml, 'utf8'), { name: outcome.fileName })],
  });
}

export const forgeCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    switch (interaction.options.getSubcommand()) {
      case 'status':
        return status(interaction, ctx);
      case 'resync':
        return resync(interaction, ctx);
      case 'capture':
        return capture(interaction, ctx);
      default:
        throw new UserFacingError('Unknown subcommand.');
    }
  },
};
