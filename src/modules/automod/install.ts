import { describeError } from '../../services/builder/discordErrors.js';
import type { ModuleInstaller } from '../types.js';
import { automodPayload } from './logic.js';

export interface AutomodRuntimeConfig {
  /** rule key → Discord AutoMod rule id */
  rules: Record<string, string>;
}

/**
 * Creates the template's rules with Discord's native AutoMod API. Existing tracked rules are
 * kept. A rule Discord refuses (e.g. the guild already has its own spam rule — Discord allows
 * one per type) is skipped with a warning instead of failing the whole build.
 */
export const installAutomod: ModuleInstaller = async (ctx) => {
  const rules: Record<string, string> = {};
  for (const rule of ctx.template.modules.automod?.rules ?? []) {
    const key = `automod:${rule.key}`;
    const tracked = await ctx.tracked(key);
    if (tracked) {
      const exists = await ctx.queue.run(`check ${key}`, () =>
        ctx.gateway.automodRuleExists(tracked.discordId),
      );
      if (exists) {
        rules[rule.key] = tracked.discordId;
        continue;
      }
    }
    try {
      const id = await ctx.queue.run(`create AutoMod rule ${rule.name}`, () =>
        ctx.gateway.createAutomodRule(automodPayload(rule, ctx.ids)),
      );
      await ctx.track({ key, kind: 'automod', discordId: id });
      rules[rule.key] = id;
    } catch (error) {
      ctx.logger.warn({ err: error, rule: rule.key }, 'AutoMod rule not created');
      ctx.warn(`AutoMod rule "${rule.name}" was skipped: ${describeError(error)}`);
    }
  }
  const config: AutomodRuntimeConfig = { rules };
  return { ...config };
};
