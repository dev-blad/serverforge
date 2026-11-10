import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import { customId } from '../bot/customId.js';
import { assertSeller } from '../bot/router.js';
import type { ComponentHandler, SlashCommand } from '../bot/types.js';
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

const MAX_COPY_BUTTONS = 25;

/**
 * Generated keys as plain message text (embeds can't be long-pressed → Copy Text on mobile)
 * plus one button per key that replies with just that key, so it can be copied on its own.
 */
export function keyCopyView(keys: readonly string[]): {
  content: string;
  buttons: ActionRowBuilder<ButtonBuilder>[];
  attachAll: boolean;
  allKeys: string;
} {
  const allKeys = keys.join('\n');
  const fits = allKeys.length <= 2000;
  const buttons: ActionRowBuilder<ButtonBuilder>[] = [];
  keys.slice(0, MAX_COPY_BUTTONS).forEach((key, i) => {
    if (i % 5 === 0) buttons.push(new ActionRowBuilder<ButtonBuilder>());
    buttons.at(-1)?.addComponents(
      new ButtonBuilder()
        .setCustomId(customId(KEYS_AREA, 'copy', key))
        .setLabel(`Key ${i + 1}`)
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
    );
  });
  return {
    content: fits ? allKeys : 'Too many keys to show here — they are in the attached file.',
    buttons,
    attachAll: !fits || keys.length > MAX_COPY_BUTTONS,
    allKeys,
  };
}

const KEYS_AREA = 'keys';

/** "📋 Key N" buttons: reply privately with only that key, as plain copyable text. */
export const keysComponents: ComponentHandler = {
  area: KEYS_AREA,
  async handle(interaction, id, ctx) {
    if (!interaction.isButton() || id.action !== 'copy') return;
    assertSeller(interaction.guildId, interaction.user.id, ctx);
    const key = id.args[0] ?? '';
    await interaction.reply({ content: key, flags: MessageFlags.Ephemeral });
  },
};

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
        ctx.logger.info(
          { tier, count: generated.length, by: interaction.user.id },
          'keys generated via slash command',
        );
        const view = keyCopyView(generated.map((g) => g.key));
        await interaction.editReply({
          content: view.content,
          embeds: [
            successEmbed(
              `Generated **${generated.length}** ${tier} key(s). They are shown **only once**.\n\n` +
                '📋 **To copy on mobile:** long-press the message above → *Copy Text*, or tap a **Key** button below to get that key on its own.',
              'Keys generated',
            ),
          ],
          components: view.buttons,
          files: view.attachAll
            ? [new AttachmentBuilder(Buffer.from(view.allKeys), { name: `keys-${tier}.txt` })]
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
