import { describe, expect, it } from 'vitest';
import { moduleInstallers } from '../../src/modules/index.js';
import { FakeGuild } from '../fakes/fakeGuild.js';
import { harness } from '../builder/setup.js';

const embedTitles = (guild: FakeGuild, channelName: string) => {
  const channel = guild.channelByName(channelName);
  return [...guild.messages.values()]
    .filter((m) => m.channelId === channel?.id)
    .map((m) => m.payload.embeds?.[0]?.title);
};

describe('Shop templates build cleanly', () => {
  it('Shop Pro: verification gate, ping roles, status board, vouches and TixBot setup', async () => {
    const guild = new FakeGuild();
    const human = guild.addMember();
    const h = harness(guild);
    const { result } = await h.build('shop-pro', { installers: moduleInstallers });
    expect(result.status).toBe('succeeded');
    expect(result.warnings).toEqual([]);

    const modules = (await h.db.modules.list(guild.guildId)).map((m) => m.moduleId).sort();
    expect(modules).toEqual(
      [
        'announcements',
        'autoRole',
        'automod',
        'buttonRoles',
        'logging',
        'memberStats',
        'status',
        'tixbot',
        'verification',
        'vouches',
      ].sort(),
    );

    // Existing members keep access when the gate goes up
    expect(human.roles.has(guild.roleByName('Member')!.id)).toBe(true);
    expect(embedTitles(guild, '﹒ᴠᴇʀɪꜰʏ')).toEqual(['Welcome to Test Server!']);
    expect(embedTitles(guild, '﹒ɢᴇᴛ-ʀᴏʟᴇs')).toEqual(['🔔 Notifications']);
    expect(embedTitles(guild, '﹒sᴛᴀᴛᴜs')).toEqual(['🟢 We’re open']);
    expect(embedTitles(guild, '﹒ᴠᴏᴜᴄʜᴇs')).toEqual(['⭐ Vouches — how it works']);
    // Starter's manual TixBot steps are replaced by the auto-setup embed
    expect(embedTitles(guild, '﹒sᴛᴀꜰꜰ-ᴄʜᴀᴛ')).toEqual(
      expect.arrayContaining(['🧰 Your Pro staff commands', '🎫 Set up tickets with TixBot']),
    );
    expect(embedTitles(guild, '﹒sᴜᴘᴘᴏʀᴛ-ɪɴꜰᴏ')).toEqual([]);
    expect(
      guild.channelByName('👥 Members: 1') ?? guild.channelByName('👥 Members: 0'),
    ).toBeTruthy();
  });

  it('Shop Elite: catalogue, orders board, giveaways, applications, VIP lounge, FAQ and backups', async () => {
    const guild = new FakeGuild();
    const h = harness(guild);
    const { result } = await h.build('shop-elite', { installers: moduleInstallers });
    expect(result.status).toBe('succeeded');
    expect(result.warnings).toEqual([]);

    const modules = (await h.db.modules.list(guild.guildId)).map((m) => m.moduleId);
    for (const id of [
      'store',
      'giveaways',
      'applications',
      'reports',
      'raidAlert',
      'backup',
      'vouches',
      'tixbot',
    ]) {
      expect(modules).toContain(id);
    }
    for (const name of [
      'VIP Lounge',
      '﹒ᴠɪᴘ-ᴏꜰꜰᴇʀs',
      '﹒ᴏʀᴅᴇʀs',
      '﹒ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴs',
      '﹒ʀᴇᴘᴏʀᴛs',
      'ꜰᴀǫ',
      '﹒ɢɪᴠᴇᴀᴡᴀʏs',
    ]) {
      expect(guild.channelByName(name), name).toBeTruthy();
    }
    expect(embedTitles(guild, '﹒ᴀᴘᴘʟʏ')).toEqual(['📝 Join the team']);
    expect(embedTitles(guild, '﹒sʜᴏᴘ')).toEqual(['🛒 Shop — how it works']);

    const store = (await h.db.modules.get(guild.guildId, 'store'))!.config;
    expect(store['ordersChannelId']).toBe(guild.channelByName('﹒ᴏʀᴅᴇʀs')!.id);
    expect(store['customerRoleId']).toBe(guild.roleByName('Customer')!.id);
    expect(store['vipRoleId']).toBe(guild.roleByName('VIP')!.id);
    const apps = (await h.db.modules.get(guild.guildId, 'applications'))!.config as {
      questions: unknown[];
      title: string;
    };
    expect(apps.questions).toHaveLength(4);
    expect(apps.title).toBe('Join the Test Server team');
  });
});
