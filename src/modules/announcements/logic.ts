import type { EmbedPayload } from '../../services/builder/gateway.js';

export function announcementEmbed(options: {
  serverName: string;
  title: string;
  message: string;
  image?: string | null;
  authorName: string;
  color: number;
}): EmbedPayload {
  return {
    author: `📢 ${options.serverName}`,
    title: options.title,
    description: options.message,
    color: options.color,
    ...(options.image ? { image: options.image } : {}),
    footer: `Posted by ${options.authorName}`,
    timestamp: true,
  };
}

/** Accept only http(s) image links. */
export function cleanImageUrl(input: string | null | undefined): string | null {
  const value = input?.trim();
  return value && /^https?:\/\/\S+$/i.test(value) ? value : null;
}
