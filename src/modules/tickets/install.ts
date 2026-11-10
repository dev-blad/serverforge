import { customId } from '../../bot/customId.js';
import { embedPayload } from '../../services/builder/payload.js';
import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface TicketsRuntimeConfig {
  panelChannelId: string;
  panelMessageId: string;
  categoryId: string;
  logChannelId: string;
  staffRoleIds: string[];
  welcomeMessage: string;
  maxOpenPerUser: number;
  transcriptLimit: number;
}

export const TICKET_OPEN = customId('ticket', 'open');
export const TICKET_CLOSE = customId('ticket', 'close');
export const TICKET_CONFIRM_CLOSE = customId('ticket', 'confirm');

export const installTickets: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.tickets;
  if (!spec) throw new Error('tickets config missing');
  const panelChannelId = requireId(ctx.ids.channels, spec.panelChannel, 'Channel');
  const panelMessageId = await ensurePanel(ctx, 'panel:tickets', panelChannelId, {
    embeds: [embedPayload(spec.panelEmbed, ctx.ids)],
    buttons: [{ customId: TICKET_OPEN, label: spec.buttonLabel, style: 'primary' }],
  });
  const config: TicketsRuntimeConfig = {
    panelChannelId,
    panelMessageId,
    categoryId: requireId(ctx.ids.channels, spec.category, 'Category'),
    logChannelId: requireId(ctx.ids.channels, spec.logChannel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    welcomeMessage: spec.welcomeMessage,
    maxOpenPerUser: spec.maxOpenPerUser,
    transcriptLimit: spec.transcriptLimit,
  };
  return { ...config };
};
