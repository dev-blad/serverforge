/**
 * Minimal client for the TixBot bot API (the same API the TixBot dashboard uses).
 *
 * Every request is scoped to one guild with `x-tixbot-guild`, so TixBot itself checks that
 * every id we send (ticket types, panels) belongs to that guild and never lets us touch billing
 * fields.
 */

export class TixbotApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'TixbotApiError';
  }
}

export interface TixbotTicketType {
  id: number;
  name: string;
}

export interface TixbotDropdownPanel {
  id: number;
  name: string | null;
}

export interface TixbotPanelOption {
  id: number;
  ticket_selection_id: number;
}

/** A panel embed in TixBot's stored format. */
export interface TixbotEmbed {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  author?: { name: string };
  footer?: { text: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: { name: string; value: string; inline: boolean }[];
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class TixbotApi {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly timeoutMs = 15_000,
  ) {}

  private async request<T>(
    guildId: string,
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'x-tixbot-api-key': this.apiKey,
        'x-tixbot-guild': guildId,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const detail =
        data && typeof data === 'object' && 'error' in data
          ? String(data.error)
          : `HTTP ${response.status}`;
      throw new TixbotApiError(response.status, data, `TixBot API ${method} ${path}: ${detail}`);
    }
    return data as T;
  }

  /** TixBot's current settings for the guild and its ticket types. */
  async getConfig(
    guildId: string,
  ): Promise<{ config: Record<string, unknown>; ticketTypes: TixbotTicketType[] }> {
    const data = await this.request<{
      config?: Record<string, unknown> | null;
      ticketTypes?: TixbotTicketType[];
    }>(guildId, 'GET', `/api/config/${guildId}`);
    return { config: data.config ?? {}, ticketTypes: data.ticketTypes ?? [] };
  }

  async getTicketTypes(guildId: string): Promise<TixbotTicketType[]> {
    return (await this.getConfig(guildId)).ticketTypes;
  }

  async saveConfig(guildId: string, config: Record<string, unknown>): Promise<void> {
    await this.request(guildId, 'POST', `/api/config/${guildId}`, config);
  }

  async createTicketType(
    guildId: string,
    type: { name: string; emoji: string; description?: string; display_order: number },
  ): Promise<number> {
    const data = await this.request<{ typeId: number }>(
      guildId,
      'POST',
      `/api/ticket-types/${guildId}`,
      type,
    );
    return data.typeId;
  }

  async updateTicketType(
    guildId: string,
    typeId: number,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.request(guildId, 'PATCH', `/api/ticket-types/${typeId}`, changes);
  }

  async listDropdownPanels(guildId: string): Promise<TixbotDropdownPanel[]> {
    return this.request<TixbotDropdownPanel[]>(guildId, 'GET', `/api/dropdown-panels/${guildId}`);
  }

  async createDropdownPanel(
    guildId: string,
    panel: { name: string; placeholder_text: string },
  ): Promise<number> {
    const data = await this.request<{ panelId: number }>(
      guildId,
      'POST',
      `/api/dropdown-panels/${guildId}`,
      panel,
    );
    return data.panelId;
  }

  async updateDropdownPanel(
    guildId: string,
    panelId: number,
    changes: { placeholder_text?: string; panel_message?: { embeds: TixbotEmbed[] } },
  ): Promise<void> {
    await this.request(guildId, 'PATCH', `/api/dropdown-panels/${panelId}`, changes);
  }

  async getPanelOptions(guildId: string, panelId: number): Promise<TixbotPanelOption[]> {
    return this.request<TixbotPanelOption[]>(
      guildId,
      'GET',
      `/api/dropdown-panels/${panelId}/options`,
    );
  }

  async addPanelOption(
    guildId: string,
    panelId: number,
    ticketTypeId: number,
    displayOrder: number,
  ): Promise<void> {
    await this.request(guildId, 'POST', `/api/dropdown-panels/${panelId}/options`, {
      ticket_selection_id: ticketTypeId,
      display_order: displayOrder,
    });
  }

  async deployDropdownPanel(guildId: string, panelId: number, channelId: string): Promise<void> {
    await this.request(guildId, 'POST', `/api/deploy-dropdown-panel/${guildId}`, {
      panelId,
      channelId,
    });
  }
}
