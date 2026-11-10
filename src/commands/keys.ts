import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import type { SlashCommand } from '../bot/types.js';
import { COLORS, successEmbed, truncate } from '../bot/ui.js';
import type { LicenseRecord, LicenseStatus } from '../db/types.js';
import { UserFacingError } from '../errors.js';
import { LicenseService } from '../services/license/licenseService.js';
import { TIERS, type Tier } from '../services/template/schema.js';

const tierChoices = TIERS.map((t) => ({ name: t, value: t }));

/** Seller-only: registered only in ADMIN_GUILD_ID and checked against OWNER_USER_ID at runtime. */
const data = new SlashCommandBuilder()
  .setName('keys')
  .setDescription('[Seller] Manage ServerForge license keys')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((s) =>
    s
      .setName('generate')
      .setDescription('Generate new license keys')
      .addStringOption((o) =>
        o
          .setName('tier')
          .setDescription('Tier')
          .setRequired(true)
          .addChoices(...tierChoices),
      )
      .addIntegerOption((o) =>
        o.setName('count').setDescription('How many (default 1)').setMinValue(1).setMaxValue(100),
      )
      .addStringOption((o) =>
        o.setName('note').setDescription('Buyer note, e.g. "fiverr order 123"').setMaxLength(200),
      )
      .addStringOption((o) =>
        o.setName('template').setDescription('Themed template id (optional)').setMaxLength(64),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('list')
      .setDescription('List recent keys')
      .addStringOption((o) =>
        o
          .setName('status')
          .setDescription('Filter by status')
          .addChoices(...['unused', 'active', 'revoked'].map((v) => ({ name: v, value: v }))),
      )
      .addStringOption((o) =>
        o
          .setName('tier')
          .setDescription('Filter by tier')
          .addChoices(...tierChoices),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('inspect')
      .setDescription('Show details for a key')
      .addStringOption((o) =>
        o.setName('key').setDescription('Key or license id').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('revoke')
      .setDescription('Revoke a key')
      .addStringOption((o) =>
        o.setName('key').setDescription('Key or license id').setRequired(true),
      ),
  );

function describe(l: LicenseRecord): string {
  return `\`${LicenseService.mask(l)}\` · ${l.tier}${l.templateId ? `/${l.templateId}` : ''} · **${l.status}**${
    l.guildId ? ` · guild ${l.guildId}` : ''
  }${l.note ? ` · ${l.note}` : ''}`;
}

export const keysCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'admin',
  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    switch (interaction.options.getSubcommand()) {
      case 'generate': {
        const tier = interaction.options.getString('tier', true) as Tier;
        const generated = await ctx.licenses.generate({
          tier,
          count: interaction.options.getInteger('count') ?? 1,
          note: interaction.options.getString('note'),
          templateId: interaction.options.getString('template'),
        });
        const keys = generated.map((g) => g.key).join('\n');
        ctx.logger.info(
          { tier, count: generated.length, by: interaction.user.id },
          'keys generated via slash command',
        );
        await interaction.editReply({
          embeds: [
            successEmbed(
              `Generated **${generated.length}** ${tier} key(s). They are shown **only once** — copy them now.\n\`\`\`\n${truncate(keys, 3900)}\n\`\`\``,
              'Keys generated',
            ),
          ],
          files:
            generated.length > 20
              ? [new AttachmentBuilder(Buffer.from(keys), { name: `keys-${tier}.txt` })]
              : [],
        });
        return;
      }
      case 'list': {
        const list = await ctx.licenses.list({
          limit: 25,
          ...(interaction.options.getString('status')
            ? { status: interaction.options.getString('status') as LicenseStatus }
            : {}),
          ...(interaction.options.getString('tier')
            ? { tier: interaction.options.getString('tier') as Tier }
            : {}),
        });
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.info)
              .setTitle(`License keys (${list.length})`)
              .setDescription(truncate(list.map(describe).join('\n') || 'No keys found.', 4000)),
          ],
        });
        return;
      }
      case 'inspect': {
        const license = await ctx.licenses.find(interaction.options.getString('key', true));
        if (!license) throw new UserFacingError('No license found for that key or id.');
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.info)
              .setTitle(LicenseService.mask(license))
              .addFields(
                { name: 'ID', value: license.id },
                {
                  name: 'Tier',
                  value: `${license.tier}${license.templateId ? ` (${license.templateId})` : ''}`,
                  inline: true,
                },
                { name: 'Status', value: license.status, inline: true },
                { name: 'Note', value: license.note ?? '—' },
                {
                  name: 'Created',
                  value: time(license.createdAt, TimestampStyles.LongDateTime),
                  inline: true,
                },
                {
                  name: 'Activated',
                  value: license.activatedAt
                    ? `${time(license.activatedAt, TimestampStyles.LongDateTime)} by <@${license.activatedBy ?? '?'}>`
                    : '—',
                  inline: true,
                },
                { name: 'Guild', value: license.guildId ?? '—' },
              ),
          ],
        });
        return;
      }
      case 'revoke': {
        const license = await ctx.licenses.revoke(interaction.options.getString('key', true));
        ctx.logger.info(
          { licenseId: license.id, by: interaction.user.id },
          'key revoked via slash command',
        );
        await interaction.editReply({ embeds: [successEmbed(describe(license), 'Key revoked')] });
        return;
      }
      default:
        throw new UserFacingError('Unknown subcommand.');
    }
  },
};
