import { customId } from '../../bot/customId.js';
import { embedPayload } from '../../services/builder/payload.js';
import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';
import { TIXBOT_CLIENT_ID, tixbotInviteUrl, type TixbotRuntimeConfig } from './logic.js';

export const TIXBOT_SETUP_BUTTON = customId('tixbot', 'setup');

export const installTixbot: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.tixbot;
  if (!spec) throw new Error('tixbot config missing');
  const { channels, roles } = ctx.ids;
  const optional = (key: string | undefined) => (key ? (channels[key] ?? null) : null);

  const setupChannelId = requireId(channels, spec.setupChannel, 'Channel');
  const panelChannelId = requireId(channels, spec.panelChannel, 'Channel');
  const ticketCategoryId = requireId(channels, spec.ticketCategory, 'Category');

  const typeLines = spec.ticketTypes.map((t) => `${t.emoji} **${t.name}**`).join('\n');
  const setupMessageId = await ensurePanel(ctx, 'panel:tixbot-setup', setupChannelId, {
    embeds: [
      {
        title: '🎫 Set up tickets with TixBot',
        color: 0x5865f2,
        description: [
          'This server is ready for tickets. Add **TixBot** and it will be set up automatically:',
          '',
          `• a ticket menu in <#${panelChannelId}>`,
          `• tickets open in <#${ticketCategoryId}>, handled by <@&${requireId(roles, spec.staffRole, 'Role')}>`,
          ...(spec.transcriptChannel && channels[spec.transcriptChannel]
            ? [`• transcripts saved to <#${channels[spec.transcriptChannel]}>`]
            : []),
          '',
          '**Ticket types**',
          typeLines,
          '',
          '**1.** Click **Add TixBot** (this server is already selected).',
          '**2.** That’s it — setup starts as soon as TixBot joins. If TixBot was already here, click **Set up tickets now**.',
        ].join('\n'),
        footer: 'You can change everything later in the TixBot dashboard.',
      },
    ],
    buttons: [
      {
        customId: TIXBOT_SETUP_BUTTON,
        label: 'Set up tickets now',
        emoji: '⚙️',
        style: 'secondary',
      },
    ],
    links: [
      { label: 'Add TixBot', emoji: '🎫', url: tixbotInviteUrl(TIXBOT_CLIENT_ID, ctx.guildId) },
      { label: 'TixBot dashboard', url: 'https://tixbot.gg/dashboard' },
    ],
  });

  // Keep "already set up" across re-syncs and upgrades.
  const previous = await ctx.db.modules.get(ctx.guildId, 'tixbot');
  const config: TixbotRuntimeConfig = {
    setupChannelId,
    setupMessageId,
    panelChannelId,
    staffRoleId: requireId(roles, spec.staffRole, 'Role'),
    escalationRoleId: spec.escalationRole ? (roles[spec.escalationRole] ?? null) : null,
    ticketCategoryId,
    escalationCategoryId: optional(spec.escalationCategory),
    closedCategoryId: optional(spec.closedCategory),
    transcriptChannelId: optional(spec.transcriptChannel),
    notificationsChannelId: optional(spec.notificationsChannel),
    placeholder: spec.placeholder,
    panelEmbed: embedPayload(spec.panelEmbed, ctx.ids),
    ticketTypes: spec.ticketTypes.map((t) => ({
      name: t.name,
      emoji: t.emoji,
      description: t.description ?? null,
      categoryId: optional(t.category),
    })),
    completedAt: (previous?.config['completedAt'] as string | null | undefined) ?? null,
    panelId: (previous?.config['panelId'] as number | null | undefined) ?? null,
  };
  return { ...config };
};
