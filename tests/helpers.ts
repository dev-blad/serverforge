import type { RawTemplateFile } from '../src/services/template/loader.js';

export function rawFile(raw: Record<string, unknown> & { id: string }, file?: string): RawTemplateFile {
  return { file: file ?? `${raw.id}.yaml`, raw: raw };
}

/** A tiny but valid base template. */
export function miniTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> & { id: string } {
  return {
    id: 'mini',
    name: 'Mini',
    tier: 'starter',
    roles: [
      { key: 'admin', name: 'Admin', permissions: ['Administrator'] },
      { key: 'member', name: 'Member', permissions: ['ViewChannel', 'SendMessages'] },
    ],
    categories: [
      {
        key: 'info',
        name: 'Info',
        overwrites: [{ role: 'everyone', deny: ['SendMessages'] }],
        channels: [{ key: 'welcome', name: 'welcome' }],
      },
      { key: 'chat', name: 'Chat', channels: [{ key: 'general', name: 'general' }] },
    ],
    ...overrides,
  };
}
