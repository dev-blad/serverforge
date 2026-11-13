import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { customId } from '../../bot/customId.js';
import type { ComponentHandler, SlashCommand } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { discordTime } from '../common.js';
import { requireModule } from '../shared.js';
import { applyRestore, currentServer, takeSnapshot } from './discord.js';
import type { BackupRuntimeConfig } from './install.js';
import { planRestore, snapshotSummary, type ServerSnapshot } from './logic.js';

function requireManager(interaction: {
  memberPermissions: Readonly<{ has(p: bigint): boolean }> | null;
}) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new UserFacingError('Backups need the **Manage Server** permission.', {
      title: 'Not allowed',
    });
  }
}

const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Back up and restore your roles, channels and permissions')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName('create').setDescription('Take a snapshot of the server now'))
  .addSubcommand((s) => s.setName('list').setDescription('Show saved snapshots'))
  .addSubcommand((s) =>
    s
      .setName('restore')
      .setDescription('Re-create anything deleted since a snapshot (nothing is removed)')
      .addIntegerOption((o) =>
        o.setName('number').setDescription('Snapshot number (default: latest)').setMinValue(1),
      ),
  );

export const backupCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    if (!interaction.inCachedGuild()) return;
    const config = await requireModule<BackupRuntimeConfig>(ctx, interaction.guildId, 'backup');
    requireManager(interaction);
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (sub === 'create') {
      const snapshot = await takeSnapshot(interaction.guild, interaction.user.id);
      const record = await ctx.db.records.create({
        guildId: interaction.guildId,
        kind: 'backup',
        userId: interaction.user.id,
        data: snapshot,
      });
      const all = await ctx.db.records.list(interaction.guildId, 'backup');
      for (const old of all.slice(config.keep)) await ctx.db.records.delete(old.id);
      await interaction.editReply({
        content: `💾 **Backup #${record.number}** saved — ${snapshotSummary(snapshot)}. The newest ${config.keep} backups are kept. A copy is attached.`,
        files: [
          new AttachmentBuilder(Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8'), {
            name: `backup-${record.number}.json`,
          }),
        ],
      });
      return;
    }

    if (sub === 'list') {
      const all = await ctx.db.records.list<ServerSnapshot>(interaction.guildId, 'backup');
      await interaction.editReply(
        all.length
          ? all
              .map(
                (b) =>
                  `**#${b.number}** ${discordTime(b.createdAt, 'f')} — ${snapshotSummary(b.data)}`,
              )
              .join('\n')
          : 'No backups yet — make one with `/backup create`.',
      );
      return;
    }

    const number = interaction.options.getInteger('number');
    const record = number
      ? await ctx.db.records.findByNumber<ServerSnapshot>(interaction.guildId, 'backup', number)
      : (await ctx.db.records.list<ServerSnapshot>(interaction.guildId, 'backup', { limit: 1 }))[0];
    if (!record)
      throw new UserFacingError(
        number ? `There’s no backup #${number}.` : 'There are no backups yet.',
      );
    const plan = planRestore(record.data, await currentServer(interaction.guild));
    if (!plan.roles.length && !plan.categories.length && !plan.channels.length) {
      await interaction.editReply(
        `✅ Nothing to restore — everything in backup #${record.number} still exists.`,
      );
      return;
    }
    const list = (label: string, names: string[]) =>
      names.length
        ? [
            `**${label}:** ${names.slice(0, 15).join(', ')}${names.length > 15 ? ` and ${names.length - 15} more` : ''}`,
          ]
        : [];
    await interaction.editReply({
      content: [
        `Restoring **backup #${record.number}** (${discordTime(record.createdAt, 'f')}) will re-create:`,
        ...list(
          'Roles',
          plan.roles.map((r) => r.name),
        ),
        ...list(
          'Categories',
          plan.categories.map((c) => c.name),
        ),
        ...list(
          'Channels',
          plan.channels.map((c) => `#${c.name}`),
        ),
        '',
        'Nothing that exists now will be changed or deleted. Messages can’t be restored.',
      ].join('\n'),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(customId('backup', 'restore', String(record.number)))
            .setLabel('Restore')
            .setEmoji('♻️')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  },
};

export const backupComponents: ComponentHandler = {
  area: 'backup',
  async handle(interaction, id, ctx) {
    if (!interaction.isButton() || id.action !== 'restore' || !interaction.inCachedGuild()) return;
    await requireModule<BackupRuntimeConfig>(ctx, interaction.guildId, 'backup');
    requireManager(interaction);
    const record = await ctx.db.records.findByNumber<ServerSnapshot>(
      interaction.guildId,
      'backup',
      Number(id.args[0]),
    );
    if (!record) throw new UserFacingError('That backup no longer exists.');
    await interaction.update({ content: '♻️ Restoring… this can take a minute.', components: [] });
    const plan = planRestore(record.data, await currentServer(interaction.guild));
    const warnings = await applyRestore(interaction.guild, plan);
    await interaction.editReply(
      [
        `✅ Restore finished: ${snapshotSummary(plan)} re-created.`,
        ...(warnings.length
          ? ['', '**Couldn’t restore:**', ...warnings.slice(0, 10).map((w) => `• ${w}`)]
          : []),
      ].join('\n'),
    );
  },
};
