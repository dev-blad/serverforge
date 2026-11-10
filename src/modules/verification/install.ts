import { customId } from '../../bot/customId.js';
import { embedPayload } from '../../services/builder/payload.js';
import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface VerificationRuntimeConfig {
  channelId: string;
  roleId: string;
  panelMessageId: string;
  seededAt: string | null;
}

export const VERIFY_BUTTON = customId('verify', 'go');

export const installVerification: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.verification;
  if (!spec) throw new Error('verification config missing');
  const channelId = requireId(ctx.ids.channels, spec.channel, 'Channel');
  const roleId = requireId(ctx.ids.roles, spec.verifiedRole, 'Role');

  const panelMessageId = await ensurePanel(ctx, 'panel:verification', channelId, {
    embeds: [embedPayload(spec.embed, ctx.ids)],
    buttons: [{ customId: VERIFY_BUTTON, label: spec.buttonLabel, style: 'success' }],
  });

  // Existing members keep their access when the gate goes up (only once per guild).
  const previous = await ctx.db.modules.get(ctx.guildId, 'verification');
  let seededAt = (previous?.config['seededAt'] as string | null | undefined) ?? null;
  if (spec.verifyExistingMembers && !seededAt) {
    const count = await ctx.queue.run('verify existing members', () =>
      ctx.gateway.addRoleToAllHumans(roleId),
    );
    ctx.logger.info({ count }, 'verified existing members');
    seededAt = new Date().toISOString();
  }

  const config: VerificationRuntimeConfig = { channelId, roleId, panelMessageId, seededAt };
  return { ...config };
};
