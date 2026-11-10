import { RetryError } from './queue.js';

interface DiscordErrorLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

const FRIENDLY: Record<number, string> = {
  50013:
    'ServerForge is missing a permission for this step. Give the ServerForge role **Administrator** and drag it to the top of the role list, then retry.',
  50001: "ServerForge can't access a channel it needs. Give it **Administrator** and retry.",
  30005: 'This server has reached the maximum number of roles (250).',
  30013: 'This server has reached the maximum number of channels (500).',
  30032: 'This server has reached the maximum number of AutoMod rules of this type.',
  50024: 'Discord rejected that action for this type of channel.',
  10003: 'A channel ServerForge expected was deleted during the build.',
  10011: 'A role ServerForge expected was deleted during the build.',
  10008: 'A message ServerForge expected was deleted.',
  50074: "Discord won't let ServerForge delete a channel that's required for Community servers.",
  40060: 'This interaction was already handled.',
};

/** Unwrap retry wrappers and return a Discord API error code if there is one. */
export function discordErrorCode(error: unknown): number | null {
  const inner = error instanceof RetryError ? error.cause : error;
  if (inner && typeof inner === 'object') {
    const code = (inner as DiscordErrorLike).code;
    if (typeof code === 'number') return code;
  }
  return null;
}

/** "Unknown X" errors mean the resource is already gone — safe to ignore when deleting. */
export function isUnknownResource(error: unknown): boolean {
  const code = discordErrorCode(error);
  return code !== null && code >= 10000 && code < 11000;
}

/** A short, customer-friendly explanation of a failed build step. */
export function describeError(error: unknown): string {
  const code = discordErrorCode(error);
  if (code !== null && FRIENDLY[code]) return FRIENDLY[code];
  if (error instanceof RetryError)
    return `Discord kept failing (${error.attempts} attempts). It may be having problems — please retry in a few minutes.`;
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}
