import type { Client } from 'discord.js';
import type { AppContext, ComponentHandler } from '../bot/types.js';
import type { ModuleId } from '../services/template/schema.js';

/**
 * Runtime half of a feature module: persistent component handlers (buttons survive restarts
 * because they're routed by custom id, not collectors) and gateway event listeners.
 * Every handler must check `ctx.moduleConfig.get(guildId, id)` — a module only acts in
 * guilds whose tier enabled it.
 */
export interface ModuleRuntime {
  id: ModuleId;
  components?: ComponentHandler[];
  register?(client: Client, ctx: AppContext): void;
}
