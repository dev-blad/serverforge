import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { parse } from 'yaml';
import { PermissionFlagsBits } from 'discord.js';
import {
  captureTemplate,
  slugify,
  validateCaptured,
  type CaptureSource,
} from '../../src/services/template/capture.js';
import { CaptureService } from '../../src/services/template/captureService.js';
import { compileTemplates, readTemplateFiles } from '../../src/services/template/loader.js';
import { silentLogger } from '../../src/logger.js';
import type { TemplateInput } from '../../src/services/template/schema.js';

const bits = (...flags: bigint[]) => flags.reduce((a, b) => a | b, 0n).toString();

function source(): CaptureSource {
  return {
    guildId: 'G',
    guildName: 'Design Lab',
    everyonePermissions: bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages),
    features: ['COMMUNITY'],
    rulesChannelId: 'c-rules',
    publicUpdatesChannelId: 'c-staff',
    roles: [
      {
        id: 'G',
        name: '@everyone',
        color: 0,
        hoist: false,
        mentionable: false,
        permissions: '0',
        position: 0,
        managed: false,
      },
      {
        id: 'r-admin',
        name: 'Admin',
        color: 0xff0000,
        hoist: true,
        mentionable: false,
        permissions: bits(PermissionFlagsBits.Administrator),
        position: 3,
        managed: false,
      },
      {
        id: 'r-mod',
        name: 'Mod Squad!',
        color: 0,
        hoist: false,
        mentionable: true,
        permissions: bits(PermissionFlagsBits.KickMembers),
        position: 2,
        managed: false,
      },
      {
        id: 'r-bot',
        name: 'SomeBot',
        color: 0,
        hoist: false,
        mentionable: false,
        permissions: '0',
        position: 4,
        managed: true,
      },
    ],
    channels: [
      {
        id: 'cat-info',
        name: 'Info',
        type: 'category',
        parentId: null,
        position: 0,
        topic: null,
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [
          { id: 'G', type: 'role', allow: '0', deny: bits(PermissionFlagsBits.SendMessages) },
        ],
      },
      {
        id: 'c-rules',
        name: 'rules',
        type: 'text',
        parentId: 'cat-info',
        position: 0,
        topic: 'Read me',
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [
          { id: 'G', type: 'role', allow: '0', deny: bits(PermissionFlagsBits.SendMessages) },
        ],
      },
      {
        id: 'c-news',
        name: 'news',
        type: 'announcement',
        parentId: 'cat-info',
        position: 1,
        topic: null,
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [
          { id: 'r-mod', type: 'role', allow: bits(PermissionFlagsBits.SendMessages), deny: '0' },
          { id: 'u1', type: 'member', allow: '1024', deny: '0' },
        ],
      },
      {
        id: 'cat-staff',
        name: 'Staff',
        type: 'category',
        parentId: null,
        position: 1,
        topic: null,
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [],
      },
      {
        id: 'c-staff',
        name: 'staff',
        type: 'text',
        parentId: 'cat-staff',
        position: 0,
        topic: null,
        slowmode: 30,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [],
      },
      {
        id: 'c-vc',
        name: 'Hangout',
        type: 'voice',
        parentId: 'cat-staff',
        position: 1,
        topic: null,
        slowmode: 0,
        nsfw: false,
        userLimit: 5,
        bitrate: 64000,
        tags: [],
        overwrites: [],
      },
      {
        id: 'c-forum',
        name: 'help',
        type: 'forum',
        parentId: null,
        position: 0,
        topic: 'Ask',
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [{ name: 'Solved', emoji: '✅', moderated: true }],
        overwrites: [],
      },
      {
        id: 'c-dir',
        name: 'directory',
        type: 'other',
        parentId: null,
        position: 1,
        topic: null,
        slowmode: 0,
        nsfw: false,
        userLimit: null,
        bitrate: null,
        tags: [],
        overwrites: [],
      },
    ],
  };
}

describe('capture', () => {
  it('slugifies names into keys', () => {
    expect(slugify('Mod Squad!')).toBe('mod-squad');
    expect(slugify('📌 Information')).toBe('information');
    expect(slugify('🔥')).toBe('item');
  });

  it('turns a guild into a valid template', () => {
    const result = captureTemplate(source(), { id: 'design-lab', name: 'Design Lab', tier: 'pro' });
    const t = result.template as unknown as TemplateInput;
    expect(t.roles!.map((r) => r.key)).toEqual(['admin', 'mod-squad']);
    expect(t.roles![0]).toMatchObject({
      color: '#FF0000',
      hoist: true,
      permissions: ['Administrator'],
    });
    expect(t.categories![0]!.channels![0]).toEqual({
      key: 'rules',
      name: 'rules',
      topic: 'Read me',
    }); // synced
    expect(t.categories![0]!.channels![1]!.overwrites).toEqual([
      { role: 'mod-squad', allow: ['SendMessages'] },
    ]);
    expect(t.categories![1]!.channels![1]).toMatchObject({ type: 'voice', userLimit: 5 });
    expect(t.channels![0]).toMatchObject({
      type: 'forum',
      tags: [{ name: 'Solved', emoji: '✅', moderated: true }],
    });
    expect(t.community).toEqual({
      enabled: true,
      rulesChannel: 'rules',
      updatesChannel: 'staff-2',
    }); // category "Staff" took "staff"
    expect(result.warnings.join('\n')).toMatch(/managed role/);
    expect(result.warnings.join('\n')).toMatch(/per-user permission overwrite/);
    expect(result.warnings.join('\n')).toMatch(/unsupported types/);

    // YAML round-trips and passes the real validator
    const parsed = parse(result.yaml) as Record<string, unknown> & { id: string };
    expect(() =>
      compileTemplates([{ file: 'x.yaml', raw: parsed }], { requireBaseTiers: false }),
    ).not.toThrow();
    expect(validateCaptured(result, [])).toEqual([]);
  });

  it('reports id clashes with existing templates', async () => {
    const existing = await readTemplateFiles(path.resolve('templates'));
    const result = captureTemplate(source(), { id: 'pro', name: 'X', tier: 'pro' });
    expect(validateCaptured(result, existing).join()).toMatch(/duplicate template id "pro"/);
  });

  it('CaptureService writes the file and replaces an earlier capture of the same id', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sf-capture-'));
    try {
      const service = new CaptureService(dir, silentLogger);
      const outcome = await service.capture(source(), { id: 'lab', tier: 'starter' });
      expect(outcome.writtenTo).toBe(path.join(dir, 'captured', 'lab.yaml'));
      expect(await readFile(outcome.writtenTo!, 'utf8')).toContain('id: lab');
      const again = await service.capture(source(), { id: 'lab', name: 'Lab v2', tier: 'starter' });
      expect(again.writtenTo).toBe(outcome.writtenTo);
      expect(await readFile(again.writtenTo!, 'utf8')).toContain('Lab v2');
      await expect(service.capture(source(), { id: 'Bad Id', tier: 'starter' })).rejects.toThrow(
        /lowercase/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
