import { describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/bot/types.js';
import { createMemoryDatabase } from '../../src/db/memory.js';
import { silentLogger } from '../../src/logger.js';
import { applicationReviewEmbed } from '../../src/modules/applications/logic.js';
import { planRestore, type ServerSnapshot } from '../../src/modules/backup/logic.js';
import { giveawayEmbed, pickWinners, toggleEntry } from '../../src/modules/giveaways/logic.js';
import { RaidDetector, raidAlertEmbed } from '../../src/modules/raidAlert/logic.js';
import { reportDue, weeklyReportEmbed } from '../../src/modules/reports/logic.js';
import {
  canTransition,
  loyaltyRoles,
  nextActions,
  orderBoardEmbed,
  orderCompletedEmbed,
  productEmbed,
  type OrderData,
} from '../../src/modules/store/logic.js';
import { createOrder, setOrderStatus } from '../../src/modules/store/service.js';

describe('store: products and orders', () => {
  it('only allows sensible status changes', () => {
    expect(canTransition('received', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'received')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(nextActions('received')).toEqual(['in_progress', 'completed', 'cancelled']);
    expect(nextActions('cancelled')).toEqual([]);
  });

  it('gives Customer after the first completed order and VIP after the threshold', () => {
    const cfg = { customerRoleId: 'cust', vipRoleId: 'vip', vipAfterOrders: 3 };
    expect(loyaltyRoles(0, cfg)).toEqual([]);
    expect(loyaltyRoles(1, cfg)).toEqual(['cust']);
    expect(loyaltyRoles(3, cfg)).toEqual(['cust', 'vip']);
    expect(loyaltyRoles(5, { ...cfg, vipRoleId: null })).toEqual(['cust']);
  });

  it('renders product, board and completion cards in the boxed style', () => {
    const product = productEmbed({
      number: 3,
      product: {
        name: 'Starter Bundle',
        price: 24.99,
        description: 'All the basics',
        delivery: '24 hours',
        image: null,
        channelId: null,
        messageId: null,
      },
      currency: '£',
      color: 1,
    });
    expect(product.title).toBe('🛒 Starter Bundle');
    expect(product.description).toContain('`Price       :` **£24.99**');
    expect(product.footer).toBe('Product #0003');

    const order: OrderData = {
      item: 'Starter Bundle',
      price: 100,
      notes: 'ASAP',
      productNumber: 3,
      workerId: '9',
      channelId: null,
      boardMessageId: null,
      history: [{ status: 'received', by: '1', at: new Date(0).toISOString() }],
    };
    const board = orderBoardEmbed({
      number: 12,
      order,
      status: 'in_progress',
      customerId: '1',
      currency: '$',
      createdAt: new Date(0),
    });
    expect(board.title).toBe('🔧 Order #0012 — In progress');
    expect(board.description).toContain('`Worker      :` <@9>');
    expect(board.description).toContain('**Notes**\nASAP');
    const done = orderCompletedEmbed({
      number: 12,
      order,
      customerId: '1',
      currency: '$',
      askForVouch: true,
    });
    expect(done.title).toBe('✅ Order Completed');
    expect(done.description).toContain('`Price       :` $100.00');
    expect(done.description).toContain('leave a vouch');
  });

  it('runs an order from received to completed: board card, customer DMs, completion card and loyalty roles', async () => {
    const db = createMemoryDatabase();
    const sent: { where: string; payload: Record<string, unknown> }[] = [];
    const edits: unknown[] = [];
    const rolesAdded: string[][] = [];
    const channel = (where: string) => ({
      isSendable: () => true,
      isTextBased: () => true,
      send: (payload: Record<string, unknown>) => {
        sent.push({ where, payload });
        return Promise.resolve({ id: `msg-${sent.length}` });
      },
      messages: {
        fetch: () => Promise.resolve({ edit: (p: unknown) => (edits.push(p), Promise.resolve()) }),
      },
    });
    const guild = {
      id: 'g1',
      name: 'Shop',
      channels: { fetch: (id: string) => Promise.resolve(channel(id)) },
      members: {
        fetch: () =>
          Promise.resolve({
            roles: { add: (r: string[]) => (rolesAdded.push(r), Promise.resolve()) },
          }),
      },
    } as never;
    const ctx = {
      db,
      logger: silentLogger,
      moduleConfig: {
        get: (_g: string, id: string) => Promise.resolve(id === 'vouches' ? {} : null),
      },
      client: {
        users: {
          fetch: () =>
            Promise.resolve({
              id: 'cust',
              send: (p: Record<string, unknown>) => (
                sent.push({ where: 'dm', payload: p }),
                Promise.resolve()
              ),
            }),
        },
      },
    } as unknown as AppContext;
    const config = {
      catalogueChannelId: 'shop',
      ordersChannelId: 'board',
      staffRoleIds: [],
      currency: '$',
      customerRoleId: 'role-customer',
      vipRoleId: 'role-vip',
      vipAfterOrders: 1,
    };

    const order = await createOrder(ctx, guild, config, {
      customerId: 'cust',
      item: 'Bundle',
      price: 50,
      notes: null,
      productNumber: null,
      channelId: 'ticket-1',
      createdBy: 'staff',
    });
    expect(order.number).toBe(1);
    expect(order.data.boardMessageId).toBe('msg-1');
    expect(sent.map((s) => s.where)).toEqual(['board', 'dm']);

    const started = await setOrderStatus(ctx, guild, config, order, 'in_progress', 'worker');
    expect(started.data.workerId).toBe('worker');
    await expect(setOrderStatus(ctx, guild, config, started, 'received', 'worker')).rejects.toThrow(
      /already in progress/,
    );

    const done = await setOrderStatus(ctx, guild, config, started, 'completed', 'worker');
    expect(done.status).toBe('completed');
    expect(done.data.history.map((h) => h.status)).toEqual([
      'received',
      'in_progress',
      'completed',
    ]);
    expect(edits).toHaveLength(2); // board card updated twice
    const completion = sent.find((s) => s.where === 'ticket-1');
    expect(completion?.payload['content']).toBe('<@cust>');
    expect(JSON.stringify(completion?.payload['components'])).toContain('sf:vouch:open:g1:1');
    expect(rolesAdded).toEqual([['role-customer', 'role-vip']]);
  });
});

describe('giveaways', () => {
  it('draws distinct winners and can exclude previous winners on a reroll', () => {
    const seq = [0, 0, 0];
    const random = () => seq.shift() ?? 0;
    expect(pickWinners(['a', 'b', 'c', 'a'], 2, random)).toEqual(['a', 'b']);
    expect(pickWinners(['a', 'b'], 5, () => 0)).toEqual(['a', 'b']);
    expect(pickWinners(['a', 'b', 'c'], 1, () => 0, ['a'])).toEqual(['b']);
    expect(pickWinners([], 1)).toEqual([]);
  });

  it('toggles entries and shows the result when ended', () => {
    expect(toggleEntry(['a'], 'b')).toEqual({ entrants: ['a', 'b'], entered: true });
    expect(toggleEntry(['a', 'b'], 'a')).toEqual({ entrants: ['b'], entered: false });
    const embed = giveawayEmbed({
      number: 2,
      data: {
        prize: 'Nitro',
        winners: 1,
        endsAt: new Date(0).toISOString(),
        entrants: ['a', 'b'],
        channelId: 'c',
        messageId: null,
        hostId: 'h',
        winnerIds: ['b'],
      },
      ended: true,
      color: 1,
    });
    expect(embed.description).toContain('`Entries     :` 2');
    expect(embed.description).toContain('🏆 **Winner:** <@b>');
  });
});

describe('applications', () => {
  it('shows each answer as a field with the review status', () => {
    const embed = applicationReviewEmbed({
      number: 4,
      applicantId: '1',
      applicantName: 'Blad',
      data: {
        answers: [{ question: 'Why?', answer: 'I love it' }],
        reviewMessageId: null,
        reviewedBy: '9',
        reason: null,
      },
      status: 'accepted',
      createdAt: new Date(0),
    });
    expect(embed.title).toBe('✅ Application #0004');
    expect(embed.fields).toEqual([{ name: 'Why?', value: 'I love it' }]);
    expect(embed.description).toContain('`Reviewed by :` <@9>');
  });
});

describe('weekly report', () => {
  it('is due once a week at the chosen day and hour (UTC)', () => {
    const monday9 = new Date('2026-11-16T09:05:00Z');
    expect(reportDue(monday9, 'mon', 9, null)).toBe(true);
    expect(reportDue(monday9, 'mon', 10, null)).toBe(false);
    expect(reportDue(monday9, 'tue', 9, null)).toBe(false);
    expect(reportDue(monday9, 'mon', 9, new Date('2026-11-16T09:00:00Z'))).toBe(false);
    expect(reportDue(monday9, 'mon', 9, new Date('2026-11-09T09:00:00Z'))).toBe(true);
  });

  it('summarises members, sales and vouches', () => {
    const embed = weeklyReportEmbed({
      serverName: 'Shop',
      numbers: {
        members: 120,
        previousMembers: 100,
        ordersPlaced: 5,
        ordersCompleted: 4,
        revenue: 250,
        openOrders: 1,
        vouches: [5, 4],
        giveaways: 1,
        applications: 0,
      },
      currency: '$',
      color: 1,
      from: new Date('2026-11-09T09:00:00Z'),
      to: new Date('2026-11-16T09:00:00Z'),
    });
    expect(embed.description).toContain('`Members     :` **120** (+20)');
    expect(embed.description).toContain('`Revenue     :` **$250.00**');
    expect(embed.description).toContain('`Avg rating  :` 4.5');
    expect(embed.description).not.toContain('Applications');
  });
});

describe('raid alerts', () => {
  it('alerts once when enough accounts join inside the window, then cools down', () => {
    const detector = new RaidDetector(60_000);
    const join = (i: number, at: number) => ({
      userId: `u${i}`,
      tag: `u${i}`,
      accountCreatedAt: new Date(at - 1000),
      at,
    });
    const t = { joins: 3, seconds: 10 };
    expect(detector.record('g', join(1, 0), t)).toBeNull();
    expect(detector.record('g', join(2, 20_000), t)).toBeNull(); // first join fell out of the window
    expect(detector.record('g', join(3, 21_000), t)).toBeNull();
    const alert = detector.record('g', join(4, 22_000), t);
    expect(alert?.map((j) => j.userId)).toEqual(['u2', 'u3', 'u4']);
    expect(detector.record('g', join(5, 23_000), t)).toBeNull(); // cooldown
    expect(raidAlertEmbed(alert!, 10, 22_000).description).toContain(
      '3 accounts joined in under 10 seconds',
    );
  });
});

describe('backup restore planning', () => {
  it('only re-creates what is missing, matching channels by category and type', () => {
    const snapshot: ServerSnapshot = {
      takenAt: '',
      takenBy: '',
      serverName: 'Shop',
      roles: [
        { name: 'VIP', color: 0, hoist: false, mentionable: false, permissions: '0', position: 1 },
        {
          name: 'Member',
          color: 0,
          hoist: false,
          mentionable: false,
          permissions: '0',
          position: 0,
        },
      ],
      categories: [
        { name: 'Info', position: 0, overwrites: [] },
        { name: 'Staff', position: 1, overwrites: [] },
      ],
      channels: [
        {
          name: 'rules',
          type: 'text',
          topic: null,
          nsfw: false,
          slowmode: 0,
          userLimit: 0,
          parent: 'Info',
          position: 0,
          overwrites: [],
        },
        {
          name: 'chat',
          type: 'text',
          topic: null,
          nsfw: false,
          slowmode: 0,
          userLimit: 0,
          parent: 'Staff',
          position: 0,
          overwrites: [],
        },
        {
          name: 'chat',
          type: 'voice',
          topic: null,
          nsfw: false,
          slowmode: 0,
          userLimit: 0,
          parent: 'Staff',
          position: 1,
          overwrites: [],
        },
      ],
    };
    const plan = planRestore(snapshot, {
      roles: ['member', '@everyone'],
      categories: ['Info'],
      channels: [
        { name: 'rules', type: 'text', parent: 'Info' },
        { name: 'chat', type: 'text', parent: 'Staff' },
      ],
    });
    expect(plan.roles.map((r) => r.name)).toEqual(['VIP']);
    expect(plan.categories.map((c) => c.name)).toEqual(['Staff']);
    expect(plan.channels.map((c) => `${c.parent}/${c.type}/${c.name}`)).toEqual([
      'Staff/voice/chat',
    ]);
  });
});
