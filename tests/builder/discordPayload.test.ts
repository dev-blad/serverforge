import { describe, expect, it } from 'vitest';
import { ChannelType, type ActionRowBuilder, type ButtonBuilder } from 'discord.js';
import {
  channelTypeToKind,
  toDiscordEmbed,
  toDiscordMessage,
} from '../../src/services/builder/discordGateway.js';
import {
  colorToInt,
  embedPayload,
  messagePayload,
  rolePayload,
} from '../../src/services/builder/payload.js';

describe('discord payload conversion', () => {
  it('builds embeds with every field', () => {
    const json = toDiscordEmbed({
      title: 'T',
      description: 'D',
      color: 0xff0000,
      url: 'https://example.com',
      fields: [{ name: 'a', value: 'b' }],
      footer: 'F',
      image: 'https://example.com/i.png',
      thumbnail: 'https://example.com/t.png',
      author: 'A',
      timestamp: true,
    }).toJSON();
    expect(json).toMatchObject({
      title: 'T',
      description: 'D',
      color: 0xff0000,
      footer: { text: 'F' },
      author: { name: 'A' },
    });
    expect(json.fields).toEqual([{ name: 'a', value: 'b', inline: false }]);
    expect(json.timestamp).toBeDefined();
  });

  it('splits buttons into rows of five and silences mentions', () => {
    const buttons = Array.from({ length: 7 }, (_, i) => ({
      customId: `sf:x:y:${i}`,
      label: `B${i}`,
      style: 'primary' as const,
      emoji: '✅',
    }));
    const message = toDiscordMessage({
      content: 'hi',
      buttons,
      silentMentions: true,
      files: [{ name: 'a.txt', data: Buffer.from('x') }],
    });
    const rows = message.components as ActionRowBuilder<ButtonBuilder>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.components).toHaveLength(5);
    expect(rows[1]!.components).toHaveLength(2);
    expect(message.allowedMentions).toEqual({ parse: [] });
    expect(message.files).toHaveLength(1);
  });

  it('maps channel types', () => {
    expect(channelTypeToKind(ChannelType.GuildText)).toBe('text');
    expect(channelTypeToKind(ChannelType.GuildVoice)).toBe('voice');
    expect(channelTypeToKind(ChannelType.GuildForum)).toBe('forum');
    expect(channelTypeToKind(ChannelType.GuildStageVoice)).toBe('stage');
    expect(channelTypeToKind(ChannelType.GuildAnnouncement)).toBe('announcement');
    expect(channelTypeToKind(ChannelType.GuildCategory)).toBe('category');
    expect(channelTypeToKind(ChannelType.GuildMedia)).toBe('other');
  });

  it('converts template specs to gateway payloads', () => {
    expect(colorToInt('#00FF00')).toBe(0x00ff00);
    expect(colorToInt('{{brandColor}}')).toBeUndefined();
    expect(colorToInt(undefined)).toBeUndefined();
    expect(
      rolePayload({
        key: 'k',
        name: 'N',
        hoist: true,
        mentionable: false,
        permissions: ['ViewChannel'],
      }),
    ).toEqual({
      name: 'N',
      hoist: true,
      mentionable: false,
      permissions: 1024n,
    });
    const ids = { channels: { rules: '1' }, roles: {} };
    expect(
      embedPayload({ title: 'x', fields: [], description: 'see {{channel:rules}}' }, ids),
    ).toEqual({ title: 'x', description: 'see <#1>' });
    expect(
      messagePayload(
        { key: 'm', channel: 'c', content: '{{channel:rules}}', embeds: [], links: [], pin: false },
        ids,
      ),
    ).toEqual({ content: '<#1>', embeds: [] });
    expect(
      messagePayload(
        {
          key: 'm',
          channel: 'c',
          embeds: [{ title: 'x', fields: [] }],
          links: [{ label: 'Add TixBot', url: 'https://example.com', emoji: '🎫' }],
          pin: false,
        },
        ids,
      ).links,
    ).toEqual([{ label: 'Add TixBot', url: 'https://example.com', emoji: '🎫' }]);
  });

  it('adds link buttons in their own row after other buttons', () => {
    const message = toDiscordMessage({
      content: 'hi',
      buttons: [{ customId: 'sf:a:b', label: 'A', style: 'primary' }],
      links: [{ label: 'Add TixBot', url: 'https://example.com/invite', emoji: '🎫' }],
    });
    const rows = message.components as ActionRowBuilder<ButtonBuilder>[];
    expect(rows).toHaveLength(2);
    const link = rows[1]!.components[0]!.toJSON() as {
      style: number;
      url?: string;
      label?: string;
    };
    expect(link.style).toBe(5); // ButtonStyle.Link
    expect(link.url).toBe('https://example.com/invite');
    expect(link.label).toBe('Add TixBot');
  });
});
