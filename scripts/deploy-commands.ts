/**
 * Register slash commands manually. (The bot also does this automatically on startup unless
 * AUTO_REGISTER_COMMANDS=false.)
 *
 *   npm run deploy-commands              customer commands globally + seller commands in ADMIN_GUILD_ID
 *                                        (or everything in DEV_GUILD_ID when it is set)
 *   npm run deploy-commands -- --clear   remove global + admin/dev guild commands
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { planCommandRegistration } from '../src/bot/registerCommands.js';
import { commands } from '../src/commands/index.js';

const env = z
  .object({
    DISCORD_TOKEN: z.string().min(10),
    DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
    ADMIN_GUILD_ID: z.string().regex(/^\d{17,20}$/),
    DEV_GUILD_ID: z
      .string()
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
  })
  .safeParse(process.env);
if (!env.success) {
  console.error(
    `✖ Missing/invalid env: ${env.error.issues.map((i) => i.path.join('.')).join(', ')} (see .env.example)`,
  );
  process.exit(1);
}
const { DISCORD_TOKEN, DISCORD_CLIENT_ID, ADMIN_GUILD_ID, DEV_GUILD_ID } = env.data;
const rest = new REST().setToken(DISCORD_TOKEN);

if (process.argv.includes('--clear')) {
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: [] });
  for (const guildId of new Set([ADMIN_GUILD_ID, DEV_GUILD_ID].filter(Boolean) as string[])) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guildId), { body: [] });
  }
  console.log('✔ Cleared all commands');
} else {
  const plan = planCommandRegistration(commands, {
    adminGuildId: ADMIN_GUILD_ID,
    devGuildId: DEV_GUILD_ID,
  });
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: plan.global });
  console.log(`✔ ${plan.global.length} global command(s)`);
  for (const [guildId, body] of Object.entries(plan.guilds)) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guildId), { body });
    console.log(
      `✔ ${body.length} command(s) in guild ${guildId}: ${body.map((c) => `/${c.name}`).join(', ')}`,
    );
  }
  if (plan.global.length) console.log('ℹ Global commands can take up to an hour to show up.');
}
