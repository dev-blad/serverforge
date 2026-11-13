import { Events } from 'discord.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import type { RaidAlertRuntimeConfig } from './install.js';
import { RaidDetector, raidAlertEmbed } from './logic.js';

const detector = new RaidDetector();

export const raidAlertRuntime: ModuleRuntime = {
  id: 'raidAlert',
  register(client, ctx) {
    client.on(Events.GuildMemberAdd, (member) => {
      void (async () => {
        const config = await ctx.moduleConfig.get<RaidAlertRuntimeConfig>(
          member.guild.id,
          'raidAlert',
        );
        if (!config) return;
        const now = Date.now();
        const joins = detector.record(
          member.guild.id,
          {
            userId: member.id,
            tag: member.user.tag,
            accountCreatedAt: member.user.createdAt,
            at: now,
          },
          config,
        );
        if (!joins) return;
        const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel?.isSendable()) return;
        await channel.send({
          ...(config.pingRoleId ? { content: `<@&${config.pingRoleId}>` } : {}),
          embeds: [toDiscordEmbed(raidAlertEmbed(joins, config.seconds, now))],
          allowedMentions: { roles: config.pingRoleId ? [config.pingRoleId] : [] },
        });
      })().catch((error: unknown) => ctx.logger.warn({ err: error }, 'raid alert failed'));
    });
  },
};
