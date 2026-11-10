import { UserFacingError } from '../../errors.js';
import type {
  BuildKind,
  BuildMode,
  BuildRunRecord,
  Database,
  GuildOptions,
  ResourceRecord,
  SetupSessionRecord,
} from '../../db/types.js';
import type { Logger } from '../../logger.js';
import type { ModuleInstallers } from '../../modules/types.js';
import { BuildExecutor, type ExecuteResult } from '../builder/executor.js';
import type { GuildGateway } from '../builder/gateway.js';
import { plan as buildPlan } from '../builder/planner.js';
import { preflight, type PreflightResult } from '../builder/preflight.js';
import { TaskQueue } from '../builder/queue.js';
import { rollbackRun, type RollbackResult } from '../builder/rollback.js';
import {
  nullReporter,
  type BuildPlan,
  type GuildSnapshot,
  type ProgressReporter,
} from '../builder/types.js';
import type { ActivationCheck, LicenseService } from '../license/licenseService.js';
import type { KeyAttemptGuard } from '../rateLimit/rateLimiter.js';
import { normalizeHex } from '../template/placeholders.js';
import { renderTemplate, type TemplateRegistry } from '../template/registry.js';
import type { Template } from '../template/schema.js';

/** What the setup flow needs to know about a guild — built from a discord.js Guild in production. */
export interface GuildContext {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  gateway: GuildGateway;
  snapshot(tracked: readonly ResourceRecord[]): Promise<GuildSnapshot>;
}

export interface Preview {
  session: SetupSessionRecord;
  check: ActivationCheck;
  template: Template;
  options: GuildOptions;
  plan: BuildPlan;
  preflight: PreflightResult;
  communityEnabled: boolean;
}

export interface BuildOutcome {
  run: BuildRunRecord;
  result: ExecuteResult;
  template: Template;
  check: ActivationCheck | null;
}

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CLEAN_CONFIRMATION = 'CLEAN BUILD';

export interface SetupServiceDeps {
  db: Database;
  licenses: LicenseService;
  templates: TemplateRegistry;
  keyGuard: KeyAttemptGuard;
  installers: ModuleInstallers;
  logger: Logger;
  queueFactory?: () => TaskQueue;
  now?: () => Date;
}

/**
 * Orchestrates /setup, upgrades, re-syncs, rollbacks and crash-resume. Knows nothing about
 * Discord interactions — command/component handlers render its results.
 */
export class SetupService {
  private readonly activeBuilds = new Set<string>();
  private readonly queueFactory: () => TaskQueue;
  private readonly now: () => Date;

  constructor(private readonly deps: SetupServiceDeps) {
    this.queueFactory = deps.queueFactory ?? (() => new TaskQueue({ logger: deps.logger }));
    this.now = deps.now ?? (() => new Date());
  }

  isBuilding(guildId: string): boolean {
    return this.activeBuilds.has(guildId);
  }

  defaultOptions(guild: GuildContext, template: Template): GuildOptions {
    return { serverName: guild.name, brandColor: template.defaults.brandColor, mode: 'alongside' };
  }

  /** Step 1 — validate the key and open a setup session. */
  async start(input: {
    guild: GuildContext;
    userId: string;
    rawKey: string;
    dryRun: boolean;
  }): Promise<{
    session: SetupSessionRecord;
    check: ActivationCheck;
    template: Template;
  }> {
    const { guild, userId } = input;
    if (this.activeBuilds.has(guild.id)) {
      throw new UserFacingError(
        'A build is already running in this server. Please wait for it to finish.',
      );
    }
    await this.deps.db.sessions.purgeExpired(this.now());
    const check = await this.deps.licenses.checkActivation(input.rawKey, {
      guildId: guild.id,
      userId,
      guard: this.deps.keyGuard,
    });
    const template = this.deps.templates.forLicense(check.license.tier, check.templateId);
    const session = await this.deps.db.sessions.create({
      guildId: guild.id,
      userId,
      licenseId: check.license.id,
      dryRun: input.dryRun,
      mode: null,
      options: null,
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    });
    return { session, check, template };
  }

  /** Load a session, making sure it belongs to this user + guild and hasn't expired. */
  async getSession(
    sessionId: string,
    guildId: string,
    userId: string,
  ): Promise<SetupSessionRecord> {
    const session = await this.deps.db.sessions.get(sessionId);
    if (!session || session.expiresAt <= this.now()) {
      throw new UserFacingError('This setup session has expired. Please run `/setup` again.', {
        title: 'Session expired',
      });
    }
    if (session.guildId !== guildId)
      throw new UserFacingError('This setup session belongs to another server.');
    if (session.userId !== userId) {
      throw new UserFacingError('Only the person who ran `/setup` can use these buttons.', {
        title: 'Not your setup',
      });
    }
    return session;
  }

  /** Validate customer options typed into the modal. */
  parseOptions(input: {
    serverName: string;
    brandColor: string;
    mode: BuildMode;
    confirmation?: string;
  }): GuildOptions {
    const serverName = input.serverName.trim();
    if (serverName.length < 2 || serverName.length > 100) {
      throw new UserFacingError('The server name must be between 2 and 100 characters.');
    }
    const brandColor = normalizeHex(input.brandColor);
    if (!brandColor) {
      throw new UserFacingError(
        `\`${input.brandColor}\` isn't a valid hex colour. Use a format like \`#5865F2\`.`,
        {
          title: 'Invalid colour',
        },
      );
    }
    if (input.mode === 'clean' && input.confirmation?.trim().toUpperCase() !== CLEAN_CONFIRMATION) {
      throw new UserFacingError(
        `Clean build was **not** started. To confirm deleting existing channels and roles, type \`${CLEAN_CONFIRMATION}\` exactly.`,
        { title: 'Confirmation required' },
      );
    }
    return { serverName, brandColor, mode: input.mode };
  }

  /** Step 2 — store options and compute the preview. */
  async submitOptions(
    sessionId: string,
    guild: GuildContext,
    userId: string,
    options: GuildOptions,
    preserveChannelId?: string | null,
  ): Promise<Preview> {
    const session = await this.getSession(sessionId, guild.id, userId);
    await this.deps.db.sessions.update(session.id, { mode: options.mode, options });
    return this.preview({ ...session, mode: options.mode, options }, guild, preserveChannelId);
  }

  private async licenseCheck(
    session: SetupSessionRecord,
    guild: GuildContext,
  ): Promise<ActivationCheck> {
    const license = await this.deps.db.licenses.findById(session.licenseId);
    if (!license)
      throw new UserFacingError('This key no longer exists. Please contact the seller.');
    if (license.status === 'revoked')
      throw new UserFacingError('This key has been revoked. Please contact the seller.');
    const existing = await this.deps.db.guilds.get(guild.id);
    if (license.status === 'active' && license.guildId !== guild.id) {
      throw new UserFacingError('This key was activated in another server in the meantime.');
    }
    const kind = license.status === 'active' ? 'resync' : existing?.licenseId ? 'upgrade' : 'setup';
    return {
      license,
      kind,
      previousTier: existing?.tier ?? null,
      templateId: license.templateId ?? license.tier,
    };
  }

  private async computePlan(
    guild: GuildContext,
    template: Template,
    mode: BuildMode,
    kind: BuildKind,
    preserveChannelId?: string | null,
  ): Promise<{ plan: BuildPlan; preflight: PreflightResult; snapshot: GuildSnapshot }> {
    const tracked = await this.deps.db.resources.list(guild.id);
    const snapshot = await guild.snapshot(tracked);
    const p = buildPlan({
      template,
      snapshot,
      tracked,
      mode,
      kind,
      preserveChannelId: preserveChannelId ?? null,
    });
    return { plan: p, preflight: preflight(snapshot, template, p), snapshot };
  }

  private render(template: Template, guild: GuildContext, options: GuildOptions): Template {
    return renderTemplate(template, {
      serverName: options.serverName,
      brandColor: options.brandColor,
      ownerId: guild.ownerId,
      ownerName: guild.ownerName,
    });
  }

  async preview(
    session: SetupSessionRecord,
    guild: GuildContext,
    preserveChannelId?: string | null,
  ): Promise<Preview> {
    const check = await this.licenseCheck(session, guild);
    const base = this.deps.templates.forLicense(check.license.tier, check.templateId);
    const options = session.options ?? this.defaultOptions(guild, base);
    const template = this.render(base, guild, options);
    const {
      plan,
      preflight: pre,
      snapshot,
    } = await this.computePlan(guild, template, options.mode, check.kind, preserveChannelId);
    return {
      session,
      check,
      template,
      options,
      plan,
      preflight: pre,
      communityEnabled: snapshot.features.includes('COMMUNITY'),
    };
  }

  /** Step 3 — the customer pressed Confirm: bind the key and build. */
  async confirm(input: {
    sessionId: string;
    guild: GuildContext;
    userId: string;
    reporter?: ProgressReporter;
    preserveChannelId?: string | null;
  }): Promise<BuildOutcome> {
    const { guild, userId } = input;
    const session = await this.getSession(input.sessionId, guild.id, userId);
    if (session.dryRun)
      throw new UserFacingError('This was a dry run. Run `/setup` without dry-run to build.');
    if (!session.options) throw new UserFacingError('Please fill in the setup options first.');

    return this.exclusive(guild.id, async () => {
      // Re-validate and re-plan with fresh state: the guild may have changed since the preview.
      const preview = await this.preview(session, guild, input.preserveChannelId);
      if (!preview.preflight.ok) {
        throw new UserFacingError('Some problems need fixing before the build can start.', {
          title: 'Pre-flight checks failed',
          details: preview.preflight.errors,
        });
      }
      await this.deps.licenses.commitActivation(preview.check, {
        guildId: guild.id,
        userId,
        ownerId: guild.ownerId,
        options: preview.options,
      });
      await this.deps.db.sessions.delete(session.id);
      const outcome = await this.execute({
        guild,
        template: preview.template,
        plan: preview.plan,
        kind: preview.check.kind,
        options: preview.options,
        userId,
        licenseId: preview.check.license.id,
        communityEnabled: preview.communityEnabled,
        reporter: input.reporter ?? nullReporter,
      });
      return { ...outcome, check: preview.check };
    });
  }

  async cancel(sessionId: string, guildId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId, guildId, userId);
    await this.deps.db.sessions.delete(session.id);
  }

  /** /forge resync — re-apply the guild's current template (create-only, never deletes). */
  async previewResync(guild: GuildContext): Promise<{
    template: Template;
    plan: BuildPlan;
    preflight: PreflightResult;
    options: GuildOptions;
    communityEnabled: boolean;
  }> {
    const record = await this.deps.db.guilds.get(guild.id);
    if (!record?.licenseId) {
      throw new UserFacingError(
        "This server hasn't been set up with ServerForge yet. Run `/setup` with your key first.",
        {
          title: 'Not set up',
        },
      );
    }
    const template = this.render(this.deps.templates.get(record.templateId), guild, record.options);
    const {
      plan,
      preflight: pre,
      snapshot,
    } = await this.computePlan(guild, template, 'alongside', 'resync');
    return {
      template,
      plan,
      preflight: pre,
      options: { ...record.options, mode: 'alongside' },
      communityEnabled: snapshot.features.includes('COMMUNITY'),
    };
  }

  async resync(
    guild: GuildContext,
    userId: string,
    reporter: ProgressReporter = nullReporter,
  ): Promise<BuildOutcome> {
    return this.exclusive(guild.id, async () => {
      const {
        template,
        plan,
        preflight: pre,
        options,
        communityEnabled,
      } = await this.previewResync(guild);
      if (!pre.ok) {
        throw new UserFacingError('Some problems need fixing before re-sync can run.', {
          title: 'Pre-flight checks failed',
          details: pre.errors,
        });
      }
      const record = await this.deps.db.guilds.get(guild.id);
      const outcome = await this.execute({
        guild,
        template,
        plan,
        kind: 'resync',
        options,
        userId,
        licenseId: record?.licenseId ?? null,
        communityEnabled,
        reporter,
      });
      return { ...outcome, check: null };
    });
  }

  async rollback(runId: string, guild: GuildContext, userId: string): Promise<RollbackResult> {
    const run = await this.deps.db.runs.get(runId);
    if (!run || run.guildId !== guild.id)
      throw new UserFacingError('That build was not found in this server.');
    if (run.userId !== userId && guild.ownerId !== userId) {
      throw new UserFacingError(
        'Only the person who started the build or the server owner can roll it back.',
      );
    }
    return this.exclusive(guild.id, () =>
      rollbackRun(runId, {
        db: this.deps.db,
        gateway: guild.gateway,
        queue: this.queueFactory(),
        logger: this.deps.logger,
      }),
    );
  }

  /**
   * After a crash/restart, any run still marked "running" was interrupted. Mark it and resume
   * by re-planning from the same template/options — the planner skips what already exists.
   */
  async resumeInterrupted(
    resolveGuild: (guildId: string) => Promise<GuildContext | null>,
    onDone?: (outcome: BuildOutcome, guild: GuildContext) => Promise<void>,
  ): Promise<number> {
    const runs = await this.deps.db.runs.listByStatus('running');
    let resumed = 0;
    for (const run of runs) {
      await this.deps.db.runs.update(run.id, { status: 'interrupted', finishedAt: this.now() });
      const guild = await resolveGuild(run.guildId);
      if (!guild) continue;
      try {
        const template = this.render(this.deps.templates.get(run.templateId), guild, run.options);
        const outcome = await this.exclusive(guild.id, async () => {
          const { plan, snapshot } = await this.computePlan(guild, template, 'alongside', run.kind);
          return this.execute({
            communityEnabled: snapshot.features.includes('COMMUNITY'),
            guild,
            template,
            plan,
            kind: run.kind,
            options: run.options,
            userId: run.userId,
            licenseId: run.licenseId,
            reporter: nullReporter,
          });
        });
        resumed += 1;
        await onDone?.({ ...outcome, check: null }, guild);
      } catch (error) {
        this.deps.logger.error(
          { err: error, runId: run.id, guildId: run.guildId },
          'failed to resume build',
        );
      }
    }
    return resumed;
  }

  private async exclusive<T>(guildId: string, fn: () => Promise<T>): Promise<T> {
    if (this.activeBuilds.has(guildId)) {
      throw new UserFacingError(
        'A build is already running in this server. Please wait for it to finish.',
      );
    }
    this.activeBuilds.add(guildId);
    try {
      return await fn();
    } finally {
      this.activeBuilds.delete(guildId);
    }
  }

  private async execute(input: {
    guild: GuildContext;
    template: Template;
    plan: BuildPlan;
    kind: BuildKind;
    options: GuildOptions;
    userId: string;
    licenseId: string | null;
    communityEnabled: boolean;
    reporter: ProgressReporter;
  }): Promise<Omit<BuildOutcome, 'check'>> {
    const { db, logger, installers } = this.deps;
    const run = await db.runs.create({
      guildId: input.guild.id,
      licenseId: input.licenseId,
      templateId: input.plan.templateId,
      tier: input.template.tier,
      kind: input.kind,
      mode: input.plan.mode,
      status: 'running',
      options: input.options,
      userId: input.userId,
    });
    const executor = new BuildExecutor({
      gateway: input.guild.gateway,
      db,
      queue: this.queueFactory(),
      logger: logger.child({ guildId: input.guild.id, runId: run.id }),
      installers,
    });
    logger.info(
      {
        guildId: input.guild.id,
        runId: run.id,
        kind: input.kind,
        actions: input.plan.actions.length,
      },
      'build started',
    );
    const result = await executor.execute({
      run,
      plan: input.plan,
      template: input.template,
      communityEnabled: input.communityEnabled,
      reporter: input.reporter,
    });
    if (result.status === 'succeeded') await db.guilds.markBuilt(input.guild.id, this.now());
    logger.info(
      { guildId: input.guild.id, runId: run.id, status: result.status },
      'build finished',
    );
    const fresh = (await db.runs.get(run.id)) ?? run;
    return { run: fresh, result, template: input.template };
  }
}
