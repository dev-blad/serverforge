import type { ComponentHandler, SlashCommand } from '../bot/types.js';
import { setupCommand, setupComponents } from './setup.js';

export const commands: SlashCommand[] = [setupCommand];

export const componentHandlers: ComponentHandler[] = [setupComponents];
