import { customId } from '../../bot/customId.js';
import { embedPayload } from '../../services/builder/payload.js';
import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';
import type { PanelConfig } from './logic.js';

export interface ButtonRolesRuntimeConfig {
  panels: Record<string, PanelConfig>;
}

export const installButtonRoles: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.buttonRoles;
  const panels: Record<string, PanelConfig> = {};
  for (const panel of spec?.panels ?? []) {
    const channelId = requireId(ctx.ids.channels, panel.channel, 'Channel');
    const buttons: Record<string, string> = {};
    for (const button of panel.buttons)
      buttons[button.key] = requireId(ctx.ids.roles, button.role, 'Role');
    const messageId = await ensurePanel(ctx, `panel:buttonRoles:${panel.key}`, channelId, {
      embeds: [embedPayload(panel.embed, ctx.ids)],
      buttons: panel.buttons.map((b) => ({
        customId: customId('br', 't', panel.key, b.key),
        label: b.label,
        style: b.style,
        ...(b.emoji ? { emoji: b.emoji } : {}),
      })),
    });
    panels[panel.key] = { channelId, messageId, exclusive: panel.exclusive, buttons };
  }
  const config: ButtonRolesRuntimeConfig = { panels };
  return { ...config };
};
