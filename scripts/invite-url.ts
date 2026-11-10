/**
 * Print the bot invite link to give buyers.
 *   npm run invite-url
 *
 * ServerForge asks for Administrator: Discord only lets a bot grant permissions it has itself,
 * and the shipped templates create Owner/Admin roles with Administrator. Preflight explains
 * exactly what's missing if a customer removes it.
 */
import 'dotenv/config';
import { OAuth2Scopes, PermissionFlagsBits } from 'discord.js';

const clientId = process.env['DISCORD_CLIENT_ID'];
if (!clientId) {
  console.error('✖ DISCORD_CLIENT_ID is not set (see .env.example)');
  process.exit(1);
}
const scopes = [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join('+');
console.log(
  `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${PermissionFlagsBits.Administrator}&integration_type=0&scope=${scopes}`,
);
