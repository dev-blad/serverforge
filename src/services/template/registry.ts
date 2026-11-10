import { UserFacingError } from '../../errors.js';
import { customerValues, renderDeep, type CustomerOptions } from './placeholders.js';
import { TIER_RANK, type ModuleId, MODULE_IDS, type Template, type Tier } from './schema.js';
import { indexChannels } from './validate.js';

export const TIER_LABELS: Record<Tier, string> = { starter: 'Starter', pro: 'Pro', elite: 'Elite' };

export class TemplateRegistry {
  constructor(private readonly templates: ReadonlyMap<string, Template>) {}

  get size(): number {
    return this.templates.size;
  }

  list(): Template[] {
    return [...this.templates.values()].sort(
      (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.id.localeCompare(b.id),
    );
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  get(id: string): Template {
    const template = this.templates.get(id);
    if (!template) throw new UserFacingError(`Template "${id}" is not available.`);
    return template;
  }

  /** The template a license should build: its explicit templateId, else the tier's base template. */
  forLicense(tier: Tier, templateId?: string | null): Template {
    const template = this.get(templateId ?? tier);
    if (template.tier !== tier) {
      throw new UserFacingError(
        `This key's template ("${template.id}") does not match its tier. Please contact the seller.`,
      );
    }
    return template;
  }

  /** Templates a seller can issue keys for. */
  sellable(): Template[] {
    return this.list().filter((t) => !t.abstract);
  }
}

/** Render customer placeholders into a template. */
export function renderTemplate(template: Template, options: CustomerOptions): Template {
  const values = customerValues(options, TIER_LABELS[template.tier]);
  return renderDeep(template, values);
}

export interface TemplateSummary {
  roles: number;
  categories: number;
  channels: number;
  channelsByType: Record<string, number>;
  messages: number;
  modules: ModuleId[];
}

export function enabledModules(template: Template): ModuleId[] {
  return MODULE_IDS.filter((id) => template.modules[id]?.enabled === true);
}

export function summarizeTemplate(template: Template): TemplateSummary {
  const channelsByType: Record<string, number> = {};
  let channels = 0;
  for (const [, entry] of indexChannels(template)) {
    if (entry.kind === 'category') continue;
    channels += 1;
    channelsByType[entry.kind] = (channelsByType[entry.kind] ?? 0) + 1;
  }
  return {
    roles: template.roles.length,
    categories: template.categories.length,
    channels,
    channelsByType,
    messages: template.messages.length,
    modules: enabledModules(template),
  };
}
