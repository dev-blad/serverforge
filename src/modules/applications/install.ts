import { customId } from '../../bot/customId.js';
import { embedPayload } from '../../services/builder/payload.js';
import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface ApplicationsRuntimeConfig {
  panelChannelId: string;
  reviewChannelId: string;
  staffRoleIds: string[];
  acceptRoleId: string | null;
  title: string;
  questions: {
    key: string;
    label: string;
    placeholder: string | null;
    style: 'short' | 'paragraph';
    required: boolean;
  }[];
}

export const APPLY_BUTTON = customId('apply', 'open');

export const installApplications: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.applications;
  if (!spec) throw new Error('applications config missing');
  const panelChannelId = requireId(ctx.ids.channels, spec.panelChannel, 'Channel');
  await ensurePanel(ctx, 'panel:applications', panelChannelId, {
    embeds: [embedPayload(spec.panelEmbed, ctx.ids)],
    buttons: [{ customId: APPLY_BUTTON, label: spec.buttonLabel, emoji: '📝', style: 'primary' }],
  });
  const config: ApplicationsRuntimeConfig = {
    panelChannelId,
    reviewChannelId: requireId(ctx.ids.channels, spec.reviewChannel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    acceptRoleId: spec.acceptRole ? (ctx.ids.roles[spec.acceptRole] ?? null) : null,
    title: spec.title,
    questions: spec.questions.map((q) => ({
      key: q.key,
      label: q.label,
      placeholder: q.placeholder ?? null,
      style: q.style,
      required: q.required,
    })),
  };
  return { ...config };
};
