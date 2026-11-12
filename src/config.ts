import 'dotenv/config';
import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord ID (17-20 digits)');
const optionalSnowflake = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))
  .pipe(snowflake.optional());

const boolish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Settings needed by every process (bot, CLI, scripts). */
export const baseConfigSchema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./data/serverforge.db'),
  LICENSE_PEPPER: z.string().min(16, 'LICENSE_PEPPER must be at least 16 characters'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: boolish,
  TEMPLATES_DIR: z.string().default('./templates'),
  KEY_ATTEMPTS_PER_USER: z.coerce.number().int().positive().default(5),
  KEY_ATTEMPTS_PER_GUILD: z.coerce.number().int().positive().default(15),
  KEY_ATTEMPT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  SUPPORT_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))
    .pipe(z.url().optional()),
});

/** Settings needed by the bot process. */
export const botConfigSchema = baseConfigSchema.extend({
  DISCORD_TOKEN: z.string().min(10, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: snowflake,
  DEV_GUILD_ID: optionalSnowflake,
  OWNER_USER_ID: snowflake,
  ADMIN_GUILD_ID: snowflake,
  /** TixBot bot API (e.g. https://tixbot-production.up.railway.app). Enables automatic ticket setup. */
  TIXBOT_API_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim().replace(/\/+$/, '') : undefined))
    .pipe(z.url().optional()),
  /** The TixBot bot's BOT_API_SECRET. */
  TIXBOT_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  /** Register slash commands automatically on startup (set to "false" to manage them manually). */
  AUTO_REGISTER_COMMANDS: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

function parse<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid configuration (check your .env, see .env.example):\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

export function loadBaseConfig(env: NodeJS.ProcessEnv = process.env): BaseConfig {
  return parse(baseConfigSchema, env);
}

export function loadBotConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  return parse(botConfigSchema, env);
}
