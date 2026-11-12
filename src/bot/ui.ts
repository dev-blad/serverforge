import { EmbedBuilder } from 'discord.js';
import type { BuildPlan, PlanSummary, ProgressUpdate } from '../services/builder/types.js';
import type { PreflightResult } from '../services/builder/preflight.js';
import type { ActivationCheck } from '../services/license/licenseService.js';
import { TIER_LABELS } from '../services/template/registry.js';
import type { ModuleId, Template, Tier } from '../services/template/schema.js';
import type { GuildOptions } from '../db/types.js';

export const COLORS = {
  brand: 0x5865f2,
  success: 0x2ecc71,
  error: 0xe74c3c,
  warning: 0xf1c40f,
  info: 0x3498db,
} as const;

export const MODULE_LABELS: Record<ModuleId, string> = {
  autoRole: '🤖 Auto roles',
  verification: '✅ Verification gate',
  buttonRoles: '🏷️ Self-assign roles',
  logging: '📜 Mod & join/leave logs',
  automod: '🛡️ AutoMod rules',
  tickets: '🎫 Tickets & transcripts',
  memberStats: '📊 Member count stats',
  tixbot: '🎫 TixBot tickets (auto setup)',
};

export function errorEmbed(
  message: string,
  title = 'Something went wrong',
  details: string[] = [],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`❌ ${title}`)
    .setDescription(message);
  if (details.length)
    embed.addFields({
      name: 'Details',
      value: truncate(details.map((d) => `• ${d}`).join('\n'), 1024),
    });
  return embed;
}

export function successEmbed(message: string, title = 'Done'): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`✅ ${title}`)
    .setDescription(message);
}

export function infoEmbed(message: string, title?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.info).setDescription(message);
  if (title) embed.setTitle(title);
  return embed;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
}

function bar(done: number, total: number, width = 20): string {
  const filled = total === 0 ? width : Math.round((done / total) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

export function progressEmbed(
  progress: ProgressUpdate,
  title = '🔨 Building your server…',
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(title)
    .setDescription(
      `**${progress.label}** ${progress.phaseDone}/${progress.phaseTotal}\n\n\`${bar(progress.done, progress.total)}\` ${Math.round(
        (progress.done / Math.max(progress.total, 1)) * 100,
      )}%`,
    )
    .setFooter({
      text: `Step ${progress.done + 1} of ${progress.total} • Please don't delete channels while building`,
    });
}

export function summaryLines(summary: PlanSummary): string[] {
  const lines: string[] = [];
  const c = summary.create;
  const types = Object.entries(summary.channelsByType)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  if (summary.remove.channels || summary.remove.roles) {
    lines.push(
      `🗑️ Delete **${summary.remove.channels}** channels and **${summary.remove.roles}** roles`,
    );
  }
  lines.push(
    `🎭 Create **${c.roles}** roles${summary.keep.roles ? ` (keep ${summary.keep.roles} existing)` : ''}`,
  );
  lines.push(`📁 Create **${c.categories}** categories`);
  lines.push(
    `💬 Create **${c.channels}** channels${types ? ` (${types})` : ''}${summary.keep.channels ? ` (keep ${summary.keep.channels} existing)` : ''}`,
  );
  if (summary.adopted)
    lines.push(`🔗 Reuse **${summary.adopted}** existing roles/channels with matching names`);
  if (summary.overwriteSyncs)
    lines.push(`🔐 Repair permissions on **${summary.overwriteSyncs}** channels`);
  if (summary.conversions)
    lines.push(`📣 Convert **${summary.conversions}** channel(s) to announcement channels`);
  if (summary.updateEveryone) lines.push('👥 Update @everyone base permissions');
  if (summary.enableCommunity) lines.push('🌐 Enable Discord Community features');
  lines.push(`📝 Post **${c.messages}** embeds`);
  return lines;
}

export interface PreviewView {
  template: Template;
  check: Pick<ActivationCheck, 'kind' | 'previousTier'>;
  options: GuildOptions;
  plan: BuildPlan;
  preflight: PreflightResult;
  dryRun: boolean;
}

export function previewEmbed(view: PreviewView): EmbedBuilder {
  const { template, check, options, plan, preflight, dryRun } = view;
  const heading =
    check.kind === 'upgrade'
      ? `Upgrade ${check.previousTier ? tierLabel(check.previousTier) : ''} → ${tierLabel(template.tier)}`
      : check.kind === 'resync'
        ? `Re-sync ${tierLabel(template.tier)}`
        : `${tierLabel(template.tier)} setup`;
  const embed = new EmbedBuilder()
    .setColor(preflight.ok ? COLORS.brand : COLORS.error)
    .setTitle(`${dryRun ? '🔍 Dry run — ' : '📋 '}${heading}: ${template.name}`)
    .setDescription(
      [
        `**Server name:** ${options.serverName}`,
        `**Brand colour:** \`${options.brandColor}\``,
        `**Mode:** ${options.mode === 'clean' ? '🧹 Clean build' : '➕ Build alongside existing'}`,
        '',
        '**This will:**',
        ...summaryLines(plan.summary),
      ].join('\n'),
    );
  const modules = plan.summary.modules.map((m) => MODULE_LABELS[m]).join('\n');
  if (modules)
    embed.addFields({ name: `Modules (${plan.summary.modules.length})`, value: modules });
  if (preflight.errors.length) {
    embed.addFields({
      name: '⛔ Must fix first',
      value: truncate(preflight.errors.map((e) => `• ${e}`).join('\n'), 1024),
    });
  }
  if (preflight.warnings.length) {
    embed.addFields({
      name: '⚠️ Heads up',
      value: truncate(preflight.warnings.map((w) => `• ${w}`).join('\n'), 1024),
    });
  }
  embed.setFooter({
    text: dryRun
      ? 'Dry run only — nothing was changed. Run /setup without dry-run to build.'
      : preflight.ok
        ? 'Nothing has been changed yet. Press Confirm to start building.'
        : 'Fix the problems above, then run /setup again.',
  });
  return embed;
}

export function statusField(enabled: ModuleId[]): string {
  return enabled.length ? enabled.map((m) => MODULE_LABELS[m]).join('\n') : 'None';
}
