import type { AutomodRulePayload } from '../../services/builder/gateway.js';
import type { AutomodRuleSpec } from '../../services/template/schema.js';
import type { IdMap } from '../types.js';

/** Convert a template AutoMod rule to a gateway payload, resolving channel/role keys. */
export function automodPayload(rule: AutomodRuleSpec, ids: IdMap): AutomodRulePayload {
  const alertChannelId = rule.alertChannel ? ids.channels[rule.alertChannel] : undefined;
  return {
    name: rule.name,
    type: rule.type,
    keywords: rule.keywords,
    regex: rule.regex,
    allowList: rule.allowList,
    presets: rule.presets,
    mentionLimit: rule.mentionLimit,
    blockMessage: rule.blockMessage,
    exemptRoleIds: rule.exemptRoles.map((k) => ids.roles[k]).filter((id): id is string => !!id),
    ...(rule.customMessage ? { customMessage: rule.customMessage } : {}),
    ...(alertChannelId ? { alertChannelId } : {}),
    ...(rule.timeoutSeconds ? { timeoutSeconds: rule.timeoutSeconds } : {}),
  };
}
