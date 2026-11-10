/**
 * Print the bot invite link to give buyers.
 *   npm run invite-url
 */
import 'dotenv/config';
import { OAuth2Scopes, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { BASE_REQUIRED_PERMISSIONS } from '../src/services/builder/permissions.js';

const clientId = process.env['DISCORD_CLIENT_ID'];
if (!clientId) {
  console.error('✖ DISCORD_CLIENT_ID is not set (see .env.example)');
  process.exit(1);
}
const url = (permissions: bigint) =>
  `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&integration_type=0&scope=${[
    OAuth2Scopes.Bot,
    OAuth2Scopes.ApplicationsCommands,
  ].join('+')}`;

const minimal = new PermissionsBitField(
  BASE_REQUIRED_PERMISSIONS.map((p) => PermissionFlagsBits[p]),
).add(
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.Connect,
);

console.log('Recommended (Administrator — every package works out of the box):');
console.log(`  ${url(PermissionFlagsBits.Administrator)}\n`);
console.log('Without Administrator (Starter only; higher tiers need every permission they grant):');
console.log(`  ${url(minimal.bitfield)}`);
