import { PermissionFlagsBits } from 'discord.js';
import type { ResourceRecord } from '../../src/db/types.js';
import type {
  AutomodRulePayload,
  ChannelPayload,
  GuildGateway,
  MessagePayload,
  OverwritePayload,
  RolePayload,
} from '../../src/services/builder/gateway.js';
import { bitsToPermissions } from '../../src/services/builder/permissions.js';
import type { GuildSnapshot, SnapshotChannelType } from '../../src/services/builder/types.js';

export interface FakeRole extends Partial<RolePayload> {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  permissions: bigint;
}

export interface FakeChannel {
  id: string;
  name: string;
  type: SnapshotChannelType;
  parentId: string | null;
  position: number;
  overwrites: OverwritePayload[];
  topic?: string;
  deletable: boolean;
}

export interface FakeMember {
  id: string;
  bot: boolean;
  roles: Set<string>;
}

let seq = 1000;
const nextId = () => String(++seq);

/** An in-memory guild implementing GuildGateway, for builder & module tests. */
export class FakeGuild implements GuildGateway {
  readonly guildId: string;
  readonly roles = new Map<string, FakeRole>();
  readonly channels = new Map<string, FakeChannel>();
  readonly messages = new Map<
    string,
    { channelId: string; payload: MessagePayload; pinned: boolean }
  >();
  readonly automod = new Map<string, AutomodRulePayload>();
  readonly members: FakeMember[] = [];
  readonly calls: string[] = [];
  everyonePermissions: bigint = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;
  features = new Set<string>();
  rulesChannelId: string | null = null;
  publicUpdatesChannelId: string | null = null;
  botRoleId: string;
  isAdmin = true;
  botPermissions: bigint = PermissionFlagsBits.Administrator;
  /** Return an error to make a call fail. */
  failOn: ((method: string, arg?: unknown) => Error | undefined) | undefined;

  constructor(guildId = 'g1') {
    this.guildId = guildId;
    this.botRoleId = nextId();
    this.roles.set(this.botRoleId, {
      id: this.botRoleId,
      name: 'ServerForge',
      position: 1,
      managed: true,
      permissions: PermissionFlagsBits.Administrator,
    });
  }

  private record(method: string, arg?: unknown): void {
    this.calls.push(method);
    const error = this.failOn?.(method, arg);
    if (error) throw error;
  }

  // ── helpers for tests ──
  addRole(name: string, opts: Partial<FakeRole> = {}): FakeRole {
    const role: FakeRole = {
      id: nextId(),
      name,
      position: 1,
      managed: false,
      permissions: 0n,
      ...opts,
    };
    if (opts.position === undefined) {
      // insert directly below the bot role
      for (const r of this.roles.values()) if (r.position >= 1) r.position += 1;
      role.position = 1;
    }
    this.roles.set(role.id, role);
    return role;
  }

  addChannel(
    name: string,
    type: SnapshotChannelType = 'text',
    parentId: string | null = null,
    opts: Partial<FakeChannel> = {},
  ): FakeChannel {
    const channel: FakeChannel = {
      id: nextId(),
      name,
      type,
      parentId,
      position: this.channels.size,
      overwrites: [],
      deletable: true,
      ...opts,
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  addMember(bot = false): FakeMember {
    const member = { id: nextId(), bot, roles: new Set<string>() };
    this.members.push(member);
    return member;
  }

  channelByName(name: string): FakeChannel | undefined {
    return [...this.channels.values()].find((c) => c.name === name);
  }

  roleByName(name: string): FakeRole | undefined {
    return [...this.roles.values()].find((r) => r.name === name);
  }

  get botPosition(): number {
    return this.roles.get(this.botRoleId)!.position;
  }

  snapshot(tracked: readonly ResourceRecord[] = []): GuildSnapshot {
    const botPosition = this.botPosition;
    return {
      id: this.guildId,
      name: 'Fake Guild',
      ownerId: 'owner',
      everyonePermissions: this.everyonePermissions.toString(),
      features: [...this.features],
      roles: [
        {
          id: this.guildId,
          name: '@everyone',
          position: 0,
          managed: false,
          editable: false,
          permissions: this.everyonePermissions.toString(),
        },
        ...[...this.roles.values()].map((r) => ({
          id: r.id,
          name: r.name,
          position: r.position,
          managed: r.managed,
          editable: !r.managed && r.position < botPosition,
          permissions: r.permissions.toString(),
        })),
      ],
      channels: [...this.channels.values()].map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.position,
        deletable: c.deletable,
        overwrites: c.overwrites.map((o) => ({
          id: o.id,
          type: o.type,
          allow: o.allow.toString(),
          deny: o.deny.toString(),
        })),
      })),
      bot: {
        userId: 'bot',
        highestRolePosition: botPosition,
        isAdmin: this.isAdmin,
        permissions: bitsToPermissions(this.botPermissions),
      },
      rulesChannelId: this.rulesChannelId,
      publicUpdatesChannelId: this.publicUpdatesChannelId,
      existingMessages: tracked
        .filter((r) => r.kind === 'message' && this.messages.has(r.discordId))
        .map((r) => r.key),
      automodRuleIds: [...this.automod.keys()],
    };
  }

  // ── GuildGateway ──
  async createRole(role: RolePayload): Promise<string> {
    this.record('createRole', role);
    return this.addRole(role.name, { ...role }).id;
  }

  async deleteRole(id: string): Promise<void> {
    this.record('deleteRole', id);
    if (!this.roles.delete(id)) throw Object.assign(new Error('Unknown Role'), { code: 10011 });
  }

  async setEveryonePermissions(bits: bigint): Promise<bigint> {
    this.record('setEveryonePermissions', bits);
    const previous = this.everyonePermissions;
    this.everyonePermissions = bits;
    return previous;
  }

  async orderRoles(orderedIds: string[]): Promise<void> {
    this.record('orderRoles', orderedIds);
    const others = [...this.roles.values()]
      .filter((r) => r.id !== this.botRoleId && !orderedIds.includes(r.id))
      .sort((a, b) => b.position - a.position);
    const sequence = [...orderedIds.map((id) => this.roles.get(id)!).filter(Boolean), ...others];
    let position = sequence.length;
    this.roles.get(this.botRoleId)!.position = position + 1;
    for (const role of sequence) role.position = position--;
  }

  async createChannel(channel: ChannelPayload): Promise<string> {
    this.record('createChannel', channel);
    const name =
      channel.kind === 'text' || channel.kind === 'announcement' || channel.kind === 'forum'
        ? channel.name.toLowerCase().replace(/\s+/g, '-')
        : channel.name;
    return this.addChannel(name, channel.kind, channel.parentId ?? null, {
      overwrites: channel.overwrites,
      ...(channel.topic ? { topic: channel.topic } : {}),
    }).id;
  }

  async deleteChannel(id: string): Promise<void> {
    this.record('deleteChannel', id);
    if (!this.channels.delete(id))
      throw Object.assign(new Error('Unknown Channel'), { code: 10003 });
  }

  async channelExists(id: string): Promise<boolean> {
    return this.channels.has(id);
  }

  async renameChannel(id: string, name: string): Promise<void> {
    this.record('renameChannel', name);
    const channel = this.channels.get(id);
    if (!channel) throw Object.assign(new Error('Unknown Channel'), { code: 10003 });
    channel.name = name;
  }

  async convertToAnnouncement(id: string): Promise<void> {
    this.record('convertToAnnouncement', id);
    const channel = this.channels.get(id);
    if (channel) channel.type = 'announcement';
  }

  async setOverwrites(channelId: string, overwrites: OverwritePayload[]): Promise<void> {
    this.record('setOverwrites', channelId);
    const channel = this.channels.get(channelId);
    if (!channel) throw Object.assign(new Error('Unknown Channel'), { code: 10003 });
    for (const o of overwrites) {
      channel.overwrites = channel.overwrites.filter((x) => x.id !== o.id);
      channel.overwrites.push(o);
    }
  }

  async orderChannels(): Promise<void> {
    this.record('orderChannels');
  }

  async enableCommunity(rules: string, updates: string): Promise<boolean> {
    this.record('enableCommunity');
    this.features.add('COMMUNITY');
    this.rulesChannelId = rules;
    this.publicUpdatesChannelId = updates;
    return true;
  }

  async disableCommunity(): Promise<void> {
    this.record('disableCommunity');
    this.features.delete('COMMUNITY');
  }

  async sendMessage(
    channelId: string,
    payload: MessagePayload,
    options?: { pin?: boolean },
  ): Promise<string> {
    this.record('sendMessage', payload);
    if (!this.channels.has(channelId))
      throw Object.assign(new Error('Unknown Channel'), { code: 10003 });
    const id = nextId();
    this.messages.set(id, { channelId, payload, pinned: options?.pin ?? false });
    return id;
  }

  async deleteMessage(_channelId: string, messageId: string): Promise<void> {
    this.record('deleteMessage');
    this.messages.delete(messageId);
  }

  async messageExists(_channelId: string, messageId: string): Promise<boolean> {
    return this.messages.has(messageId);
  }

  async createAutomodRule(rule: AutomodRulePayload): Promise<string> {
    this.record('createAutomodRule', rule);
    const id = nextId();
    this.automod.set(id, rule);
    return id;
  }

  async deleteAutomodRule(id: string): Promise<void> {
    this.record('deleteAutomodRule');
    this.automod.delete(id);
  }

  async automodRuleExists(id: string): Promise<boolean> {
    return this.automod.has(id);
  }

  async addRoleToAllHumans(roleId: string): Promise<number> {
    this.record('addRoleToAllHumans');
    let n = 0;
    for (const m of this.members) {
      if (!m.bot && !m.roles.has(roleId)) {
        m.roles.add(roleId);
        n += 1;
      }
    }
    return n;
  }

  async memberCount(includeBots: boolean): Promise<number> {
    return this.members.filter((m) => includeBots || !m.bot).length;
  }
}
