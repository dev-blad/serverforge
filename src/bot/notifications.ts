import { EmbedBuilder, type Guild } from 'discord.js';
import type { Logger } from '../logger.js';
import { toDiscordEmbed } from '../services/builder/discordGateway.js';
import type { BuildOutcome } from '../services/setup/setupService.js';
import { hexToInt } from '../services/template/placeholders.js';
import { TIER_LABELS, summarizeTemplate } from '../services/template/registry.js';
import { COLORS, MODULE_LABELS, truncate } from './ui.js';

const KIND_TITLES = {
  setup: 'Your server is ready! 🎉',
  upgrade: 'Upgrade complete! 🚀',
  resync: 'Re-sync complete 🔧',
};

export function buildSummaryEmbed(outcome: BuildOutcome, serverName: string): EmbedBuilder {
  const { template, run, result } = outcome;
  const s = summarizeTemplate(template);
  const embed = new EmbedBuilder()
    .setColor(safeColor(run.options.brandColor))
    .setTitle(`${KIND_TITLES[run.kind]}`)
    .setDescription(
      `**${serverName}** is running the **${TIER_LABELS[template.tier]}** package (${template.name}).\n` +
        `${result.completed} build steps completed.`,
    )
    .addFields(
      { name: 'Roles', value: String(s.roles), inline: true },
      { name: 'Categories', value: String(s.categories), inline: true },
      { name: 'Channels', value: String(s.channels), inline: true },
      { name: 'Modules', value: s.modules.map((m) => MODULE_LABELS[m]).join('\n') || 'None' },
    )
    .setFooter({ text: 'ServerForge' })
    .setTimestamp(new Date());
  if (result.warnings.length) {
    embed.addFields({
      name: '⚠️ Notes',
      value: truncate(result.warnings.map((w) => `• ${w}`).join('\n'), 1024),
    });
  }
  return embed;
}

function safeColor(hex: string): number {
  try {
    return hexToInt(hex);
  } catch {
    return COLORS.brand;
  }
}

export function nextStepsEmbed(
  outcome: BuildOutcome,
  guild: Guild,
  supportUrl?: string,
): EmbedBuilder {
  const modules = outcome.template.modules;
  const steps = [
    '1. Open **Server Settings → Roles** and make sure the **ServerForge** role stays at the top.',
    '2. Give yourself the **Owner** role and your team **Admin** / **Moderator**.',
    '3. Edit the rules and welcome text to match your community (they are normal messages you can delete and re-post).',
  ];
  if (modules.verification?.enabled)
    steps.push(
      '4. Try the **Verify** button in an incognito/alt account to see the new-member experience.',
    );
  if (modules.tickets?.enabled)
    steps.push('5. Open a test ticket from the support panel and close it to see the transcript.');
  steps.push(
    '',
    'Useful commands: `/forge status`, `/forge resync` (repairs anything deleted), `/help`.',
  );
  if (supportUrl) steps.push(`Need help? ${supportUrl}`);
  return toDiscordEmbed({
    title: `${KIND_TITLES[outcome.run.kind]} — ${guild.name}`,
    description: steps.join('\n'),
    color: safeColor(outcome.run.options.brandColor),
  });
}

/** Post the summary embed in the template's summary channel (staff/mod-log), if any. */
export async function postSummary(
  guild: Guild,
  outcome: BuildOutcome,
  logger: Logger,
): Promise<void> {
  const key = outcome.template.summaryChannel;
  const channelId = key ? outcome.result.ids.channels[key] : undefined;
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel?.isSendable()) {
      await channel.send({ embeds: [buildSummaryEmbed(outcome, outcome.run.options.serverName)] });
    }
  } catch (error) {
    logger.warn({ err: error, guildId: guild.id }, 'could not post build summary');
  }
}

/** DM the server owner a "your server is ready" message with next steps. */
export async function dmOwner(
  guild: Guild,
  outcome: BuildOutcome,
  logger: Logger,
  supportUrl?: string,
): Promise<boolean> {
  try {
    const owner = await guild.fetchOwner();
    await owner.send({ embeds: [nextStepsEmbed(outcome, guild, supportUrl)] });
    return true;
  } catch (error) {
    logger.info({ err: error, guildId: guild.id }, 'could not DM owner (DMs probably closed)');
    return false;
  }
}
