/**
 * Register slash commands with Discord.
 *
 *   npm run deploy-commands              global commands + seller commands in ADMIN_GUILD_ID
 *   npm run deploy-commands -- --dev     everything to DEV_GUILD_ID only (updates instantly)
 *   npm run deploy-commands -- --clear   remove global + admin/dev guild commands
 *
 * Global commands can take up to an hour to appear; guild commands are instant.
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { commands } from '../src/commands/index.js';

const env = z
  .object({
    DISCORD_TOKEN: z.string().min(10),
    DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
    ADMIN_GUILD_ID: z.string().regex(/^\d{17,20}$/),
    DEV_GUILD_ID: z.string().optional(),
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
const args = new Set(process.argv.slice(2));

const globalBodies = commands.filter((c) => c.scope === 'global').map((c) => c.data);
const adminBodies = commands.filter((c) => c.scope === 'admin').map((c) => c.data);

if (args.has('--clear')) {
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: [] });
  await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, ADMIN_GUILD_ID), { body: [] });
  if (DEV_GUILD_ID)
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEV_GUILD_ID), { body: [] });
  console.log('✔ Cleared all commands');
} else if (args.has('--dev')) {
  if (!DEV_GUILD_ID) {
    console.error('✖ DEV_GUILD_ID is not set');
    process.exit(1);
  }
  await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEV_GUILD_ID), {
    body: [...globalBodies, ...adminBodies],
  });
  console.log(
    `✔ Registered ${globalBodies.length + adminBodies.length} command(s) to dev guild ${DEV_GUILD_ID}`,
  );
} else {
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: globalBodies });
  console.log(
    `✔ Registered ${globalBodies.length} global command(s): ${globalBodies.map((c) => `/${c.name}`).join(', ')}`,
  );
  await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, ADMIN_GUILD_ID), {
    body: adminBodies,
  });
  console.log(
    `✔ Registered ${adminBodies.length} seller command(s) to admin guild ${ADMIN_GUILD_ID}: ${adminBodies.map((c) => `/${c.name}`).join(', ')}`,
  );
  console.log('ℹ Global commands can take up to an hour to show up in every server.');
}
