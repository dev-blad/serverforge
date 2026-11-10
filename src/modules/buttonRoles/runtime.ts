import { MessageFlags } from 'discord.js';
import { UserFacingError } from '../../errors.js';
import type { ModuleRuntime } from '../runtimeTypes.js';
import { requireModule } from '../shared.js';
import type { ButtonRolesRuntimeConfig } from './install.js';
import { computeRoleToggle } from './logic.js';

export const buttonRolesRuntime: ModuleRuntime = {
  id: 'buttonRoles',
  components: [
    {
      area: 'br',
      async handle(interaction, id, ctx) {
        if (!interaction.isButton() || id.action !== 't' || !interaction.inCachedGuild()) return;
        const [panelKey = '', buttonKey = ''] = id.args;
        const config = await requireModule<ButtonRolesRuntimeConfig>(
          ctx,
          interaction.guildId,
          'buttonRoles',
        );
        const panel = config.panels[panelKey];
        const member = interaction.member;
        const toggle = panel
          ? computeRoleToggle(new Set(member.roles.cache.keys()), panel, buttonKey)
          : null;
        if (!toggle) {
          throw new UserFacingError(
            'This role button is no longer available. Ask an admin to run `/forge resync`.',
          );
        }
        try {
          if (toggle.remove.length)
            await member.roles.remove(toggle.remove, 'ServerForge button roles');
          if (toggle.add.length) await member.roles.add(toggle.add, 'ServerForge button roles');
        } catch {
          throw new UserFacingError(
            "I couldn't update your roles. ServerForge's role may need to be moved higher.",
          );
        }
        const roleId = toggle.added ? toggle.add[0] : toggle.remove[0];
        await interaction.reply({
          content: toggle.added ? `✅ Added <@&${roleId}>` : `➖ Removed <@&${roleId}>`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
      },
    },
  ],
};
