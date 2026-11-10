import type { EmbedPayload } from '../../services/builder/gateway.js';

const DAY = 24 * 60 * 60 * 1000;

export function accountAge(createdAt: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / DAY);
  if (days < 1) return 'less than a day';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export function memberJoinEmbed(
  m: { id: string; tag: string; createdAt: Date; memberCount: number; avatarUrl?: string },
  now: Date = new Date(),
): EmbedPayload {
  const young = now.getTime() - m.createdAt.getTime() < 7 * DAY;
  return {
    title: '📥 Member joined',
    description: `<@${m.id}> (${m.tag})`,
    color: young ? 0xe67e22 : 0x2ecc71,
    fields: [
      {
        name: 'Account age',
        value: `${accountAge(m.createdAt, now)}${young ? ' ⚠️ new account' : ''}`,
        inline: true,
      },
      { name: 'Member #', value: String(m.memberCount), inline: true },
    ],
    footer: `ID: ${m.id}`,
    timestamp: true,
    ...(m.avatarUrl ? { thumbnail: m.avatarUrl } : {}),
  };
}

export function memberLeaveEmbed(
  m: { id: string; tag: string; joinedAt: Date | null; roles: string[] },
  now: Date = new Date(),
): EmbedPayload {
  return {
    title: '📤 Member left',
    description: `<@${m.id}> (${m.tag})`,
    color: 0x95a5a6,
    fields: [
      {
        name: 'Was here for',
        value: m.joinedAt ? accountAge(m.joinedAt, now) : 'unknown',
        inline: true,
      },
      {
        name: 'Roles',
        value: clip(m.roles.length ? m.roles.map((r) => `<@&${r}>`).join(' ') : 'none', 1024),
        inline: false,
      },
    ],
    footer: `ID: ${m.id}`,
    timestamp: true,
  };
}

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function messageDeleteEmbed(m: {
  authorId: string | null;
  authorTag: string | null;
  channelId: string;
  content: string | null;
  attachments: string[];
}): EmbedPayload {
  return {
    title: '🗑️ Message deleted',
    color: 0xe74c3c,
    description: `${m.authorId ? `<@${m.authorId}> (${m.authorTag ?? 'unknown'})` : 'Unknown author'} in <#${m.channelId}>`,
    fields: [
      {
        name: 'Content',
        value: clip(m.content?.trim() ? m.content : '*(not cached or empty)*', 1024),
      },
      ...(m.attachments.length
        ? [{ name: 'Attachments', value: clip(m.attachments.join('\n'), 1024) }]
        : []),
    ],
    timestamp: true,
  };
}

export function messageEditEmbed(m: {
  authorId: string;
  authorTag: string;
  channelId: string;
  url: string;
  before: string | null;
  after: string;
}): EmbedPayload | null {
  if (m.before !== null && m.before === m.after) return null; // embed-only update
  return {
    title: '✏️ Message edited',
    color: 0xf1c40f,
    description: `<@${m.authorId}> (${m.authorTag}) in <#${m.channelId}> — [jump](${m.url})`,
    fields: [
      { name: 'Before', value: clip(m.before?.trim() ? m.before : '*(not cached)*', 1024) },
      { name: 'After', value: clip(m.after.trim() ? m.after : '*(empty)*', 1024) },
    ],
    timestamp: true,
  };
}

export function banEmbed(m: {
  id: string;
  tag: string;
  reason: string | null;
  banned: boolean;
}): EmbedPayload {
  return {
    title: m.banned ? '🔨 Member banned' : '♻️ Member unbanned',
    color: m.banned ? 0xc0392b : 0x27ae60,
    description: `<@${m.id}> (${m.tag})`,
    fields: m.reason ? [{ name: 'Reason', value: clip(m.reason, 1024) }] : [],
    footer: `ID: ${m.id}`,
    timestamp: true,
  };
}

export function timeoutEmbed(m: { id: string; tag: string; until: Date | null }): EmbedPayload {
  return {
    title: m.until ? '⏳ Member timed out' : '✅ Timeout removed',
    color: m.until ? 0xe67e22 : 0x27ae60,
    description: `<@${m.id}> (${m.tag})${m.until ? ` until <t:${Math.floor(m.until.getTime() / 1000)}:f>` : ''}`,
    timestamp: true,
  };
}

export function roleChangeEmbed(m: {
  id: string;
  tag: string;
  added: string[];
  removed: string[];
}): EmbedPayload | null {
  if (!m.added.length && !m.removed.length) return null;
  return {
    title: '🎭 Roles updated',
    color: 0x3498db,
    description: `<@${m.id}> (${m.tag})`,
    fields: [
      ...(m.added.length
        ? [{ name: 'Added', value: clip(m.added.map((r) => `<@&${r}>`).join(' '), 1024) }]
        : []),
      ...(m.removed.length
        ? [{ name: 'Removed', value: clip(m.removed.map((r) => `<@&${r}>`).join(' '), 1024) }]
        : []),
    ],
    timestamp: true,
  };
}
