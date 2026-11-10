import { UserFacingError } from '../../errors.js';
import type {
  GuildOptions,
  GuildRecord,
  GuildRepository,
  LicenseFilter,
  LicenseRecord,
  LicenseRepository,
} from '../../db/types.js';
import type { KeyAttemptGuard } from '../rateLimit/rateLimiter.js';
import { TIER_RANK, type Tier } from '../template/schema.js';
import type { TemplateRegistry } from '../template/registry.js';
import { TIER_LABELS } from '../template/registry.js';
import { generateKey, hashKey, lastFour, maskKey, normalizeKey } from './keygen.js';

export interface GeneratedKey {
  key: string;
  license: LicenseRecord;
}

/**
 * What activating a key in a guild would do:
 *  • setup   – first activation of an unused key in a guild with no ServerForge build
 *  • upgrade – an unused higher-tier (or different-theme) key in an already-built guild:
 *              only the difference is applied
 *  • resync  – the guild's own, already-bound key is used again: re-apply / repair
 */
export type ActivationKind = 'setup' | 'upgrade' | 'resync';

export interface ActivationCheck {
  license: LicenseRecord;
  kind: ActivationKind;
  /** The guild's tier before this activation, if it already had one. */
  previousTier: Tier | null;
  templateId: string;
}

export class LicenseService {
  constructor(
    private readonly licenses: LicenseRepository,
    private readonly guilds: GuildRepository,
    private readonly pepper: string,
    private readonly templates?: TemplateRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  hash(key: string): string {
    return hashKey(key, this.pepper);
  }

  static mask(license: Pick<LicenseRecord, 'last4'>): string {
    return maskKey(license.last4);
  }

  /** Generate `count` new unused keys. The raw keys are returned once and never stored. */
  async generate(options: {
    tier: Tier;
    count?: number;
    note?: string | null;
    templateId?: string | null;
  }): Promise<GeneratedKey[]> {
    const count = options.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      throw new UserFacingError('Count must be between 1 and 500.');
    }
    const templateId = options.templateId ?? null;
    if (this.templates) {
      const template = this.templates.get(templateId ?? options.tier);
      if (template.tier !== options.tier) {
        throw new UserFacingError(
          `Template "${template.id}" is an ${template.tier} template, not ${options.tier}.`,
        );
      }
      if (template.abstract) throw new UserFacingError(`Template "${template.id}" is abstract.`);
    }

    const out: GeneratedKey[] = [];
    while (out.length < count) {
      const key = generateKey();
      const keyHash = this.hash(key);
      // 60 bits of entropy makes collisions astronomically unlikely, but be safe anyway.
      if (await this.licenses.findByHash(keyHash)) continue;
      const license = await this.licenses.create({
        keyHash,
        last4: lastFour(key),
        tier: options.tier,
        templateId,
        note: options.note ?? null,
      });
      out.push({ key, license });
    }
    return out;
  }

  /** Look up a raw key. Throws a friendly error for malformed, unknown or revoked keys. */
  async resolve(rawKey: string): Promise<LicenseRecord> {
    const key = normalizeKey(rawKey);
    if (!key) {
      throw new UserFacingError(
        "That doesn't look like a ServerForge key. Keys look like `FORGE-XXXX-XXXX-XXXX`.",
        { title: 'Invalid key' },
      );
    }
    const license = await this.licenses.findByHash(this.hash(key));
    if (!license) {
      throw new UserFacingError(
        "We couldn't find that key. Double-check it was copied correctly (it's not case-sensitive).",
        { title: 'Invalid key' },
      );
    }
    if (license.status === 'revoked') {
      throw new UserFacingError('This key has been revoked. Please contact the seller.', {
        title: 'Key revoked',
      });
    }
    return license;
  }

  /**
   * Decide whether (and how) a key can be used in a guild, without changing anything.
   * When a guard is passed, failures count towards the per-user/per-guild rate limits.
   */
  async checkActivation(
    rawKey: string,
    ctx: { guildId: string; userId: string; guard?: KeyAttemptGuard },
  ): Promise<ActivationCheck> {
    ctx.guard?.assertAllowed(ctx.userId, ctx.guildId);
    try {
      const result = await this.evaluate(rawKey, ctx.guildId);
      ctx.guard?.recordSuccess(ctx.userId);
      return result;
    } catch (error) {
      if (error instanceof UserFacingError) ctx.guard?.recordFailure(ctx.userId, ctx.guildId);
      throw error;
    }
  }

  private async evaluate(rawKey: string, guildId: string): Promise<ActivationCheck> {
    const license = await this.resolve(rawKey);
    const guild = await this.guilds.get(guildId);
    const templateId = license.templateId ?? license.tier;

    if (license.status === 'active') {
      if (license.guildId !== guildId) {
        throw new UserFacingError(
          'This key has already been activated in another server. Each key works in one server only.',
          { title: 'Key already used' },
        );
      }
      // Re-using this guild's key → re-sync. If the guild has since been upgraded with a
      // newer key, re-sync with the guild's current license instead of downgrading.
      if (guild?.licenseId && guild.licenseId !== license.id) {
        const current = await this.licenses.findById(guild.licenseId);
        if (current && current.status !== 'revoked') {
          return {
            license: current,
            kind: 'resync',
            previousTier: guild.tier,
            templateId: guild.templateId,
          };
        }
      }
      return { license, kind: 'resync', previousTier: guild?.tier ?? null, templateId };
    }

    // Unused key
    if (!guild || !guild.licenseId) {
      return { license, kind: 'setup', previousTier: null, templateId };
    }

    const currentRank = TIER_RANK[guild.tier];
    const newRank = TIER_RANK[license.tier];
    if (newRank < currentRank) {
      throw new UserFacingError(
        `This server already has **${TIER_LABELS[guild.tier]}**, which includes everything in ${TIER_LABELS[license.tier]}. The key was not used — you can activate it in another server.`,
        { title: 'Downgrade not needed' },
      );
    }
    if (newRank === currentRank && templateId === guild.templateId) {
      throw new UserFacingError(
        `This server already has **${TIER_LABELS[guild.tier]}**. The key was not used — you can activate it in another server, or run \`/forge resync\` to repair this one.`,
        { title: 'Already activated' },
      );
    }
    return { license, kind: 'upgrade', previousTier: guild.tier, templateId };
  }

  /**
   * Bind a license to a guild (idempotent for the same guild). Uses an atomic compare-and-set
   * so the same key can't be bound to two guilds concurrently.
   */
  async activate(license: LicenseRecord, guildId: string, userId: string): Promise<LicenseRecord> {
    if (license.status === 'revoked') throw new UserFacingError('This key has been revoked.');
    if (license.status === 'active') {
      if (license.guildId !== guildId) {
        throw new UserFacingError('This key has already been activated in another server.');
      }
      return license;
    }
    const ok = await this.licenses.activate(license.id, guildId, userId, this.now());
    if (!ok) {
      const fresh = await this.licenses.findById(license.id);
      if (fresh?.status === 'active' && fresh.guildId === guildId) return fresh;
      throw new UserFacingError('This key was just activated somewhere else.', {
        title: 'Key already used',
      });
    }
    const updated = await this.licenses.findById(license.id);
    if (!updated) throw new Error(`License ${license.id} disappeared after activation`);
    return updated;
  }

  /**
   * Commit a checked activation: bind the key (if unused) and record the guild's new
   * tier/template. Upgrades never lower the recorded tier.
   */
  async commitActivation(
    check: ActivationCheck,
    ctx: { guildId: string; userId: string; ownerId: string; options: GuildOptions },
  ): Promise<GuildRecord> {
    const license = await this.activate(check.license, ctx.guildId, ctx.userId);
    const existing = await this.guilds.get(ctx.guildId);
    return this.guilds.upsert({
      id: ctx.guildId,
      tier: license.tier,
      templateId: check.templateId,
      licenseId: license.id,
      ownerId: ctx.ownerId,
      options: ctx.options,
      builtAt: existing?.builtAt ?? null,
    });
  }

  /** Find a license by raw key or by its database id. */
  async find(idOrKey: string): Promise<LicenseRecord | null> {
    const key = normalizeKey(idOrKey);
    if (key) return this.licenses.findByHash(this.hash(key));
    return this.licenses.findById(idOrKey.trim());
  }

  async revoke(idOrKey: string): Promise<LicenseRecord> {
    const license = await this.find(idOrKey);
    if (!license) throw new UserFacingError(`No license found for "${idOrKey}".`);
    if (license.status === 'revoked') return license;
    return this.licenses.revoke(license.id, this.now());
  }

  list(filter?: LicenseFilter): Promise<LicenseRecord[]> {
    return this.licenses.list(filter);
  }
}
