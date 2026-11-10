export function ticketChannelName(number: number): string {
  return `ticket-${String(number).padStart(4, '0')}`;
}

export interface TranscriptMessage {
  authorTag: string;
  authorId: string;
  bot: boolean;
  createdAt: Date;
  content: string;
  attachments: string[];
  embeds: number;
}

export interface TranscriptMeta {
  guildName: string;
  channelName: string;
  ticketNumber: number;
  openerTag: string;
  openedAt: Date;
  closedByTag: string;
  closedAt: Date;
}

/** Plain-text transcript, oldest message first. */
export function renderTranscript(
  meta: TranscriptMeta,
  messages: readonly TranscriptMessage[],
): string {
  const header = [
    `Transcript — ${meta.guildName} — #${meta.channelName}`,
    `Ticket #${meta.ticketNumber}`,
    `Opened by: ${meta.openerTag} at ${meta.openedAt.toISOString()}`,
    `Closed by: ${meta.closedByTag} at ${meta.closedAt.toISOString()}`,
    `Messages: ${messages.length}`,
    '='.repeat(60),
    '',
  ];
  const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lines = sorted.map((m) => {
    const parts = [
      `[${m.createdAt.toISOString()}] ${m.authorTag}${m.bot ? ' [BOT]' : ''}: ${m.content}`,
    ];
    for (const url of m.attachments) parts.push(`    📎 ${url}`);
    if (m.embeds) parts.push(`    (${m.embeds} embed${m.embeds === 1 ? '' : 's'})`);
    return parts.join('\n');
  });
  return [...header, ...lines, ''].join('\n');
}

/** The opener, any staff role, or anyone with Manage Channels may close a ticket. */
export function canCloseTicket(input: {
  userId: string;
  openerId: string;
  memberRoleIds: ReadonlySet<string>;
  staffRoleIds: readonly string[];
  canManageChannels: boolean;
}): boolean {
  return (
    input.userId === input.openerId ||
    input.canManageChannels ||
    input.staffRoleIds.some((id) => input.memberRoleIds.has(id))
  );
}

export function renderWelcome(template: string, userId: string): string {
  return template.replace(/\{\{\s*user\s*\}\}/g, `<@${userId}>`);
}
