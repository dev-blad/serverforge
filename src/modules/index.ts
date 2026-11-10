import type { ModuleRuntime } from './runtimeTypes.js';
import type { ModuleInstallers } from './types.js';

/** Builder-time installers, by module id. */
export const moduleInstallers: ModuleInstallers = {};

/** Runtime handlers, by module id. */
export const moduleRuntimes: ModuleRuntime[] = [];
