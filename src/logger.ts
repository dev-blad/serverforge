import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(
  options: { level?: string; pretty?: boolean; name?: string } = {},
): Logger {
  const {
    level = process.env['LOG_LEVEL'] ?? 'info',
    pretty = false,
    name = 'serverforge',
  } = options;
  return pino({
    name,
    level,
    redact: {
      paths: ['key', '*.key', 'token', '*.token', 'rawKey', '*.rawKey'],
      censor: '[redacted]',
    },
    ...(pretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: true } } }
      : {}),
  });
}

/** A silent logger for tests. */
export const silentLogger: Logger = pino({ level: 'silent' });
