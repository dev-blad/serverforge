import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../bot/types.js';
import { COLORS, MODULE_LABELS } from '../bot/ui.js';
import { TIER_LABELS } from '../services/template/registry.js';

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('How to use ServerForge in this server');

export const helpCommand: SlashCommand = {
  data: data.toJSON(),
  scope: 'global',
  async execute(interaction, ctx) {
    const status = interaction.guildId ? await ctx.status.get(interaction.guildId) : null;
    const embed = new EmbedBuilder().setColor(COLORS.brand).setTitle('🔨 ServerForge help');

    if (!status?.setUp) {
      embed.setDescription(
        [
          'ServerForge builds a complete, professional community server from the package you bought.',
          '',
          '**Getting started**',
          '1. Make sure the **ServerForge** role is at the top of *Server Settings → Roles*.',
          '2. Run `/setup key:FORGE-XXXX-XXXX-XXXX` (server owner or Administrator).',
          '3. Pick **Build alongside existing** or **Clean build**, enter your server name & brand colour.',
          '4. Check the preview and press **Confirm**. Done in a minute or two!',
          '',
          'Tip: `/setup key:<key> dry-run:true` shows exactly what would be created without changing anything.',
        ].join('\n'),
      );
    } else {
      embed.setDescription(
        `This server runs **${status.tierLabel}** (${status.templateName}).\n\n**Commands**\n` +
          [
            '`/forge status` — package, key and enabled modules',
            '`/forge resync` — re-create anything from the package that was deleted',
            '`/setup key:<key>` — re-run setup, or activate a higher-tier key to **upgrade**',
          ].join('\n'),
      );
      const features: string[] = [];
      if (status.modules.includes('verification'))
        features.push(
          '✅ New members click **Verify** in the verify channel to unlock the server.',
        );
      if (status.modules.includes('buttonRoles'))
        features.push(
          '🏷️ Members pick pronouns/regions/pings with the buttons in the roles channel.',
        );
      if (status.modules.includes('logging'))
        features.push(
          '📜 Edits, deletes, bans, timeouts and joins/leaves are logged automatically.',
        );
      if (status.modules.includes('automod'))
        features.push(
          '🛡️ Discord AutoMod rules are active — tweak them in Server Settings → AutoMod.',
        );
      if (status.modules.includes('tickets'))
        features.push(
          '🎫 Members open private tickets from the support panel; closing saves a transcript.',
        );
      if (status.modules.includes('tixbot'))
        features.push(
          '🎫 Tickets run on TixBot — add it with the button in your staff channel and it sets itself up.',
        );
      if (status.modules.includes('memberStats'))
        features.push('📊 The member-count channel updates automatically (max every ~5 minutes).');
      if (features.length) embed.addFields({ name: 'Your features', value: features.join('\n') });
    }

    const upgrades = ctx.status.upgradesFrom(status?.tier ?? null).filter((u) => u.adds.length);
    if (upgrades.length && status?.setUp) {
      embed.addFields({
        name: 'Want more?',
        value: upgrades
          .map(
            (u) =>
              `**${TIER_LABELS[u.tier]}** adds: ${u.adds.map((m) => MODULE_LABELS[m]).join(', ')}`,
          )
          .join('\n'),
      });
    }
    if (ctx.config.SUPPORT_URL) embed.addFields({ name: 'Support', value: ctx.config.SUPPORT_URL });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
