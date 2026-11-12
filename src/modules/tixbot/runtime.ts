import { Events, MessageFlags, OverwriteType, PermissionFlagsBits, type Guild } from 'discord.js';
import type { AppContext } from '../../bot/types.js';
import { UserFacingError } from '../../errors.js';
import { toDiscordEmbed } from '../../services/builder/discordGateway.js';
import { TixbotApi, TixbotApiError } from '../../services/tixbot/api.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import { TIXBOT_CLIENT_ID, runTixbotSetup, type TixbotRuntimeConfig } from './logic.js';

/** Guilds with a setup in progress (one at a time per guild). */
const running = new Set<string>();

/** Let TixBot see and manage the ticket areas even if its roles don't reach them. */
async function grantTixbotAccess(guild: Guild, config: TixbotRuntimeConfig): Promise<void> {
  const allow = {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    AttachFiles: true,
    ManageChannels: true,
    ManageRoles: true,
    ManageMessages: true,
  };
  const ids = [
    config.ticketCategoryId,
    config.escalationCategoryId,
    config.closedCategoryId,
    config.panelChannelId,
    config.transcriptChannelId,
    config.notificationsChannelId,
    ...config.ticketTypes.map((t) => t.categoryId),
  ].filter((id): id is string => !!id);
  for (const id of new Set(ids)) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel || channel.isThread()) continue;
    await channel.permissionOverwrites.edit(TIXBOT_CLIENT_ID, allow, {
      type: OverwriteType.Member,
      reason: 'ServerForge: TixBot ticket setup',
    });
  }
}

async function postToSetupChannel(
  guild: Guild,
  config: TixbotRuntimeConfig,
  embed: { title: string; description: string; color: number },
): Promise<void> {
  const channel = await guild.channels.fetch(config.setupChannelId).catch(() => null);
  if (channel?.isSendable()) {
    await channel.send({ embeds: [toDiscordEmbed(embed)] });
  }
}

function explain(error: unknown): string {
  if (error instanceof TixbotApiError) {
    if (error.status === 401) return 'TixBot rejected the API key (check TIXBOT_API_KEY).';
    if (error.status === 404)
      return "TixBot couldn't find this server yet — try again in a minute.";
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Configure TixBot for a guild. Returns a short status line for whoever triggered it.
 * Results (success or failure) are also posted in the staff setup channel.
 */
export async function setUpTixbot(
  ctx: AppContext,
  guild: Guild,
  config: TixbotRuntimeConfig,
): Promise<string> {
  const { TIXBOT_API_URL, TIXBOT_API_KEY } = ctx.config;
  if (!TIXBOT_API_URL || !TIXBOT_API_KEY) {
    return 'Automatic TixBot setup isn’t switched on for this bot yet. You can set tickets up in the TixBot dashboard instead.';
  }
  if (running.has(guild.id)) return 'Ticket setup is already running — give it a moment.';
  running.add(guild.id);
  const logger = ctx.logger.child({ module: 'tixbot', guildId: guild.id });
  try {
    await grantTixbotAccess(guild, config);
    const api = new TixbotApi(TIXBOT_API_URL, TIXBOT_API_KEY);
    // Once the panel is up, re-runs only refresh TixBot's settings and ticket messages.
    const result = await runTixbotSetup(api, guild.id, config, {
      deployPanel: !config.completedAt,
    });

    const record = await ctx.db.modules.get(guild.id, 'tixbot');
    if (record) {
      await ctx.db.modules.upsert({
        ...record,
        config: {
          ...record.config,
          completedAt: new Date().toISOString(),
          panelId: result.panelId,
        },
      });
      ctx.moduleConfig.invalidate(guild.id);
    }
    logger.info(result, 'TixBot setup complete');

    if (!result.deployed) {
      await postToSetupChannel(guild, config, {
        title: '🔄 TixBot settings refreshed',
        color: 0x2ecc71,
        description: `Ticket types, roles, categories and ticket messages were updated. The existing menu in <#${config.panelChannelId}> was kept.`,
      });
      return '✅ TixBot settings and ticket messages refreshed.';
    }

    await postToSetupChannel(guild, config, {
      title: '✅ Tickets are live',
      color: 0x2ecc71,
      description: [
        `TixBot is set up and the ticket menu is posted in <#${config.panelChannelId}>.`,
        '',
        `• **${config.ticketTypes.length}** ticket types: ${config.ticketTypes.map((t) => `${t.emoji} ${t.name}`).join(', ')}`,
        `• Tickets open in <#${config.ticketCategoryId}> for <@&${config.staffRoleId}>`,
        ...(config.transcriptChannelId
          ? [`• Transcripts go to <#${config.transcriptChannelId}>`]
          : []),
        '',
        'Edit wording, questions and types any time at **tixbot.gg/dashboard**. Sending each ticket type to its own category needs TixBot Pro.',
      ].join('\n'),
    });
    return `✅ Tickets are live in <#${config.panelChannelId}>.`;
  } catch (error) {
    logger.warn({ err: error }, 'TixBot setup failed');
    const reason = explain(error);
    await postToSetupChannel(guild, config, {
      title: '⚠️ TixBot setup didn’t finish',
      color: 0xe67e22,
      description: `${reason}\n\nClick **Set up tickets now** above to try again — it picks up where it left off.`,
    }).catch(() => undefined);
    return `⚠️ Setup didn’t finish: ${reason}`;
  } finally {
    running.delete(guild.id);
  }
}

export const tixbotRuntime: ModuleRuntime = {
  id: 'tixbot',
  components: [
    {
      area: 'tixbot',
      async handle(interaction, id, ctx) {
        if (!interaction.isButton() || id.action !== 'setup' || !interaction.inCachedGuild())
          return;
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          throw new UserFacingError('Only server admins (Manage Server) can set up tickets.');
        }
        const config = await requireModule<TixbotRuntimeConfig>(ctx, interaction.guildId, 'tixbot');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const tixbot = await interaction.guild.members.fetch(TIXBOT_CLIENT_ID).catch(() => null);
        if (!tixbot) {
          await interaction.editReply({
            content:
              'TixBot isn’t in this server yet — click **Add TixBot** first. Setup starts automatically once it joins.',
          });
          return;
        }
        await interaction.editReply({ content: await setUpTixbot(ctx, interaction.guild, config) });
      },
    },
  ],
  register(client, ctx) {
    client.on(Events.GuildMemberAdd, (member) => {
      if (member.id !== TIXBOT_CLIENT_ID) return;
      void (async () => {
        const config = await ctx.moduleConfig.get<TixbotRuntimeConfig>(member.guild.id, 'tixbot');
        if (!config || config.completedAt) return;
        // Give TixBot a moment to load the new server before calling its API.
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await setUpTixbot(ctx, member.guild, config);
      })().catch((error: unknown) =>
        ctx.logger.warn({ err: error, guildId: member.guild.id }, 'TixBot auto setup failed'),
      );
    });
  },
};
