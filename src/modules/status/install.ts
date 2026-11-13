import { ensurePanel, requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';
import { statusEmbed } from './logic.js';

export interface StatusRuntimeConfig {
  channelId: string;
  messageId: string;
  staffRoleIds: string[];
  renameChannel: boolean;
  /** Channel name from the template (without a status emoji). */
  baseName: string;
  serverName: string;
}

/** Find a channel's name in the rendered template. */
function templateChannelName(ctx: Parameters<ModuleInstaller>[0], key: string): string {
  for (const category of ctx.template.categories) {
    const channel = category.channels.find((c) => c.key === key);
    if (channel) return channel.name;
  }
  return ctx.template.channels.find((c) => c.key === key)?.name ?? key;
}

export const installStatus: ModuleInstaller = async (ctx) => {
  const spec = ctx.template.modules.status;
  if (!spec) throw new Error('status config missing');
  const channelId = requireId(ctx.ids.channels, spec.channel, 'Channel');
  const guild = await ctx.db.guilds.get(ctx.guildId);
  const serverName = guild?.options.serverName ?? 'Status';
  const messageId = await ensurePanel(ctx, 'panel:status', channelId, {
    embeds: [statusEmbed({ state: 'open', at: new Date(), serverName })],
  });
  const config: StatusRuntimeConfig = {
    channelId,
    messageId,
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    renameChannel: spec.renameChannel,
    baseName: templateChannelName(ctx, spec.channel),
    serverName,
  };
  return { ...config };
};
