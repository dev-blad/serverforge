import type { Database } from '../db/types.js';
import type { ModuleId } from '../services/template/schema.js';

/**
 * Read-through cache for per-guild module config, so hot event handlers (message deletes,
 * member joins) don't hit the database every time. Invalidate after builds.
 */
export class ModuleConfigStore {
  private readonly cache = new Map<string, { at: number; value: Record<string, unknown> | null }>();

  constructor(
    private readonly db: Pick<Database, 'modules'>,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** The module's resolved config if the module is enabled for the guild, else null. */
  async get<T extends object>(guildId: string, moduleId: ModuleId): Promise<T | null> {
    const key = `${guildId}|${moduleId}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value as T | null;
    const record = await this.db.modules.get(guildId, moduleId);
    const value = record?.enabled ? record.config : null;
    this.cache.set(key, { at: this.now(), value });
    return value as T | null;
  }

  invalidate(guildId?: string): void {
    if (!guildId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) if (key.startsWith(`${guildId}|`)) this.cache.delete(key);
  }
}
