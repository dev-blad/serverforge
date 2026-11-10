import { MessageFlags } from 'discord.js';
import { UserFacingError } from '../../errors.js';
import { logEvent } from '../logging/runtime.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import type { VerificationRuntimeConfig } from './install.js';

export const verificationRuntime: ModuleRuntime = {
  id: 'verification',
  components: [
    {
      area: 'verify',
      async handle(interaction, id, ctx) {
        if (!interaction.isButton() || id.action !== 'go' || !interaction.inCachedGuild()) return;
        const config = await requireModule<VerificationRuntimeConfig>(
          ctx,
          interaction.guildId,
          'verification',
        );
        const member = interaction.member;
        if (member.roles.cache.has(config.roleId)) {
          await interaction.reply({
            content: "✅ You're already verified!",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        try {
          await member.roles.add(config.roleId, 'ServerForge verification');
        } catch {
          throw new UserFacingError(
            "I couldn't give you the verified role. Please ask a moderator — ServerForge's role may need to be moved higher.",
          );
        }
        await interaction.reply({
          content: `🎉 Welcome to **${interaction.guild.name}**! You're verified — the rest of the server is now unlocked.`,
          flags: MessageFlags.Ephemeral,
        });
        await logEvent(ctx, interaction.guild, 'joinLeave', {
          title: '✅ Member verified',
          description: `${member.toString()} (${member.user.tag})`,
          color: 0x2ecc71,
          timestamp: true,
        });
      },
    },
  ],
};
