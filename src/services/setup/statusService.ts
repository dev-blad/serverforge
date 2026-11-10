import type { BuildRunRecord, Database, LicenseStatus } from '../../db/types.js';
import { maskKey } from '../license/keygen.js';
import { TIER_LABELS, type TemplateRegistry } from '../template/registry.js';
import { TIER_RANK, TIERS, type ModuleId, type Template, type Tier } from '../template/schema.js';
import { enabledModules } from '../template/registry.js';

export interface GuildStatus {
  setUp: boolean;
  tier: Tier | null;
  tierLabel: string | null;
  templateId: string | null;
  templateName: string | null;
  maskedKey: string | null;
  keyStatus: LicenseStatus | null;
  activatedAt: Date | null;
  builtAt: Date | null;
  modules: ModuleId[];
  lastRun: Pick<BuildRunRecord, 'kind' | 'status' | 'startedAt' | 'finishedAt' | 'error'> | null;
}

/** Read-only view of what ServerForge knows about a guild (for /forge status and /help). */
export class StatusService {
  constructor(
    private readonly db: Database,
    private readonly templates: TemplateRegistry,
  ) {}

  async get(guildId: string): Promise<GuildStatus> {
    const guild = await this.db.guilds.get(guildId);
    const lastRun = await this.db.runs.latest(guildId);
    if (!guild?.licenseId) {
      return {
        setUp: false,
        tier: null,
        tierLabel: null,
        templateId: null,
        templateName: null,
        maskedKey: null,
        keyStatus: null,
        activatedAt: null,
        builtAt: null,
        modules: [],
        lastRun: lastRun ?? null,
      };
    }
    const license = await this.db.licenses.findById(guild.licenseId);
    const modules = (await this.db.modules.list(guildId))
      .filter((m) => m.enabled)
      .map((m) => m.moduleId);
    const template = this.templates.has(guild.templateId)
      ? this.templates.get(guild.templateId)
      : null;
    return {
      setUp: true,
      tier: guild.tier,
      tierLabel: TIER_LABELS[guild.tier],
      templateId: guild.templateId,
      templateName: template?.name ?? guild.templateId,
      maskedKey: license ? maskKey(license.last4) : null,
      keyStatus: license?.status ?? null,
      activatedAt: license?.activatedAt ?? null,
      builtAt: guild.builtAt,
      modules,
      lastRun: lastRun ?? null,
    };
  }

  /** What each higher tier adds over `tier` (module ids), for upsell in /help. */
  upgradesFrom(tier: Tier | null): { tier: Tier; adds: ModuleId[]; template: Template }[] {
    const current = tier ? new Set(enabledModules(this.templates.get(tier))) : new Set<ModuleId>();
    return TIERS.filter((t) => !tier || TIER_RANK[t] > TIER_RANK[tier]).map((t) => {
      const template = this.templates.get(t);
      return { tier: t, template, adds: enabledModules(template).filter((m) => !current.has(m)) };
    });
  }
}
