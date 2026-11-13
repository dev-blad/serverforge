import type { EmbedPayload } from '../../services/builder/gateway.js';
import type { TixbotApi, TixbotEmbed } from '../../services/tixbot/api.js';
import { TixbotApiError } from '../../services/tixbot/api.js';

/** TixBot's Discord application id. */
export const TIXBOT_CLIENT_ID = '1470445718400663716';

/** Name of the dropdown panel ServerForge creates in TixBot (used to find it again). */
export const PANEL_NAME = 'ServerForge ticket panel';

export interface TixbotTicketTypeConfig {
  name: string;
  emoji: string;
  description: string | null;
  categoryId: string | null;
  /** Embed TixBot posts inside new tickets of this type (TixBot variables like {user}). */
  welcome?: EmbedPayload | null;
  /** First plain message in new tickets (usually pings the support role). */
  notification?: string | null;
}

/** Per-guild config stored by the installer (Discord ids, not template keys). */
export interface TixbotRuntimeConfig {
  setupChannelId: string;
  setupMessageId: string;
  panelChannelId: string;
  staffRoleId: string;
  escalationRoleId: string | null;
  ticketCategoryId: string;
  escalationCategoryId: string | null;
  closedCategoryId: string | null;
  transcriptChannelId: string | null;
  notificationsChannelId: string | null;
  placeholder: string;
  panelEmbed: EmbedPayload;
  ticketTypes: TixbotTicketTypeConfig[];
  /** Set once TixBot has been configured and the panel posted. */
  completedAt: string | null;
  panelId: number | null;
}

/** TixBot guild settings derived from the server ServerForge built. */
export function tixbotGuildSettings(config: TixbotRuntimeConfig): Record<string, unknown> {
  const settings: Record<string, unknown> = {
    panel_channel_id: config.panelChannelId,
    l1_role_id: config.staffRoleId,
    l1_category_id: config.ticketCategoryId,
  };
  if (config.escalationRoleId) {
    settings['l2_role_id'] = config.escalationRoleId;
    settings['escalation_role_id'] = config.escalationRoleId;
  }
  if (config.escalationCategoryId) {
    settings['l2_category_id'] = config.escalationCategoryId;
    settings['escalation_category_id'] = config.escalationCategoryId;
  }
  if (config.closedCategoryId) {
    settings['closed_category_id'] = config.closedCategoryId;
    settings['archive_category_id'] = config.closedCategoryId;
  }
  if (config.transcriptChannelId) {
    settings['transcript_channel_id'] = config.transcriptChannelId;
    settings['auto_transcript'] = true;
  }
  if (config.notificationsChannelId) {
    settings['notifications_channel_id'] = config.notificationsChannelId;
  }
  return settings;
}

/** Convert a ServerForge embed into TixBot's stored panel embed format. */
export function toTixbotEmbed(embed: EmbedPayload): TixbotEmbed {
  const out: TixbotEmbed = {};
  if (embed.title) out.title = embed.title;
  if (embed.description) out.description = embed.description;
  if (embed.color !== undefined) out.color = embed.color;
  if (embed.url) out.url = embed.url;
  if (embed.author) out.author = { name: embed.author };
  if (embed.footer) out.footer = { text: embed.footer };
  if (embed.thumbnail) out.thumbnail = { url: embed.thumbnail };
  if (embed.image) out.image = { url: embed.image };
  if (embed.fields?.length) {
    out.fields = embed.fields.map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
  }
  return out;
}

export interface SetupResult {
  panelId: number;
  ticketTypeIds: number[];
  createdTypes: number;
  /** Whether the dropdown panel was (re-)posted. */
  deployed: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isUnset = (value: unknown) => value === null || value === undefined || value === '';

/**
 * How a setup run treats what's already in TixBot:
 *  - `full`  (first setup): apply every setting, ticket message and the panel, then post the menu.
 *  - `fill`  (re-run after a successful setup): only add what's missing — empty settings and
 *    ticket types that don't exist yet. Anything the buyer changed in the TixBot dashboard is
 *    left alone and no second menu is posted.
 */
export type SetupMode = 'full' | 'fill';

/**
 * Configure TixBot for a guild. Ticket types are matched by name and the panel by
 * {@link PANEL_NAME}, so re-running never duplicates them.
 */
export async function runTixbotSetup(
  api: TixbotApi,
  guildId: string,
  config: TixbotRuntimeConfig,
  options: { deployRetries?: number; retryDelayMs?: number; mode?: SetupMode } = {},
): Promise<SetupResult> {
  const fill = options.mode === 'fill';
  const current = await api.getConfig(guildId);

  // Guild settings: everything on first setup, only empty ones on a re-run.
  const wanted = tixbotGuildSettings(config);
  const settings = fill
    ? Object.fromEntries(Object.entries(wanted).filter(([k]) => isUnset(current.config[k])))
    : wanted;
  if (Object.keys(settings).length) await api.saveConfig(guildId, settings);

  // Ticket types (reuse any with the same name)
  const byName = new Map(current.ticketTypes.map((t) => [t.name.trim().toLowerCase(), t.id]));
  const ticketTypeIds: number[] = [];
  const newTypeIds = new Set<number>();
  for (const [index, type] of config.ticketTypes.entries()) {
    let id = byName.get(type.name.trim().toLowerCase());
    const isNew = id === undefined;
    if (id === undefined) {
      id = await api.createTicketType(guildId, {
        name: type.name,
        emoji: type.emoji,
        ...(type.description ? { description: type.description } : {}),
        display_order: index,
      });
      newTypeIds.add(id);
    }
    if (isNew || !fill) {
      await api.updateTicketType(guildId, id, {
        emoji: type.emoji,
        description: type.description,
        display_order: index,
        enabled: true,
        // Per-type categories are a TixBot Pro feature; free servers use l1_category_id.
        target_category_id: type.categoryId ?? config.ticketCategoryId,
        ...(type.welcome ? { ticket_message: { embeds: [toTixbotEmbed(type.welcome)] } } : {}),
        ...(type.notification ? { notification_message: type.notification } : {}),
      });
    }
    ticketTypeIds.push(id);
  }

  // Dropdown panel (reuse ours if it exists)
  const panels = await api.listDropdownPanels(guildId);
  let panelId = panels.find((p) => p.name === PANEL_NAME)?.id;
  const panelIsNew = panelId === undefined;
  if (panelId === undefined) {
    panelId = await api.createDropdownPanel(guildId, {
      name: PANEL_NAME,
      placeholder_text: config.placeholder,
    });
  }
  if (panelIsNew || !fill) {
    await api.updateDropdownPanel(guildId, panelId, {
      placeholder_text: config.placeholder,
      panel_message: { embeds: [toTixbotEmbed(config.panelEmbed)] },
    });
  }
  const panelOptions = await api.getPanelOptions(guildId, panelId);
  const onPanel = new Set(panelOptions.map((o) => Number(o.ticket_selection_id)));
  for (const [index, typeId] of ticketTypeIds.entries()) {
    // On a re-run only brand-new types are added (a buyer may have removed an option on purpose).
    if (onPanel.has(typeId)) continue;
    if (fill && !panelIsNew && !newTypeIds.has(typeId)) continue;
    await api.addPanelOption(guildId, panelId, typeId, index);
  }

  const result = { panelId, ticketTypeIds, createdTypes: newTypeIds.size };
  // A re-run keeps the menu that's already posted.
  if (fill) return { ...result, deployed: false };

  // TixBot may not have this guild/channel cached for a few seconds after joining.
  const retries = options.deployRetries ?? 5;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await api.deployDropdownPanel(guildId, panelId, config.panelChannelId);
      break;
    } catch (error) {
      const retryable = error instanceof TixbotApiError && error.status === 404;
      if (!retryable || attempt >= retries) throw error;
      await sleep(options.retryDelayMs ?? 3000);
    }
  }

  return { ...result, deployed: true };
}

/** TixBot invite that opens with the customer's server pre-selected. */
export function tixbotInviteUrl(clientId: string, guildId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: '268823632',
    integration_type: '0',
    scope: 'bot applications.commands',
    guild_id: guildId,
    disable_guild_select: 'true',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
