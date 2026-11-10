import { Events } from 'discord.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { AutoRoleRuntimeConfig } from './install.js';

export const autoRoleRuntime: ModuleRuntime = {
  id: 'autoRole',
  register(client, ctx) {
    client.on(Events.GuildMemberAdd, (member) => {
      void (async () => {
        const config = await ctx.moduleConfig.get<AutoRoleRuntimeConfig>(
          member.guild.id,
          'autoRole',
        );
        const roleId = member.user.bot ? config?.botRoleId : config?.memberRoleId;
        if (!roleId) return;
        await member.roles.add(roleId, 'ServerForge auto role');
      })().catch((error: unknown) =>
        ctx.logger.warn({ err: error, guildId: member.guild.id }, 'auto role failed'),
      );
    });
  },
};
