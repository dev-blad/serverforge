import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, discordTime, money, padNumber } from '../common.js';

export interface ProductData {
  name: string;
  price: number;
  description: string;
  delivery: string | null;
  image: string | null;
  channelId: string | null;
  messageId: string | null;
}

export type OrderStatus = 'received' | 'in_progress' | 'completed' | 'cancelled';

export interface OrderData {
  item: string;
  price: number | null;
  notes: string | null;
  productNumber: number | null;
  workerId: string | null;
  /** Channel the order was created from (e.g. a ticket) — gets the completion card. */
  channelId: string | null;
  boardMessageId: string | null;
  history: { status: OrderStatus; by: string; at: string }[];
}

export const ORDER_STATUS: Record<OrderStatus, { emoji: string; label: string; color: number }> = {
  received: { emoji: '📥', label: 'Received', color: 0x5865f2 },
  in_progress: { emoji: '🔧', label: 'In progress', color: 0xfee75c },
  completed: { emoji: '✅', label: 'Completed', color: 0x57f287 },
  cancelled: { emoji: '✖️', label: 'Cancelled', color: 0x99aab5 },
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Buttons the order board shows for a status. */
export function nextActions(status: OrderStatus): OrderStatus[] {
  return TRANSITIONS[status];
}

export function productEmbed(options: {
  number: number;
  product: ProductData;
  currency: string;
  color: number;
}): EmbedPayload {
  const { product } = options;
  return {
    title: `🛒 ${product.name}`,
    color: options.color,
    description: [
      product.description,
      '',
      box('Price', `**${money(product.price, options.currency)}**`),
      ...(product.delivery ? [box('Delivery', product.delivery)] : []),
      '',
      'Click **Order** below and we’ll get started.',
    ].join('\n'),
    ...(product.image ? { image: product.image } : {}),
    footer: `Product ${padNumber(options.number)}`,
  };
}

function orderLines(options: {
  number: number;
  order: OrderData;
  customerId: string;
  currency: string;
}): string[] {
  const { order } = options;
  return [
    box('Order ID', `**${padNumber(options.number)}**`),
    box('Customer', `<@${options.customerId}>`),
    box('Item', order.item),
    ...(order.price !== null ? [box('Price', money(order.price, options.currency))] : []),
    ...(order.workerId ? [box('Worker', `<@${order.workerId}>`)] : []),
  ];
}

/** Staff board card. */
export function orderBoardEmbed(options: {
  number: number;
  order: OrderData;
  status: OrderStatus;
  customerId: string;
  currency: string;
  createdAt: Date;
}): EmbedPayload {
  const s = ORDER_STATUS[options.status];
  const last = options.order.history.at(-1);
  return {
    title: `${s.emoji} Order ${padNumber(options.number)} — ${s.label}`,
    color: s.color,
    description: [
      ...orderLines(options),
      box('Status', `${s.emoji} **${s.label}**`),
      box('Placed', discordTime(options.createdAt)),
      ...(last && last.status !== 'received'
        ? [box('Updated', `${discordTime(new Date(last.at))} by <@${last.by}>`)]
        : []),
      ...(options.order.notes ? ['', '**Notes**', options.order.notes] : []),
    ].join('\n'),
  };
}

/** Sent to the customer (DM) when the status changes. */
export function orderUpdateEmbed(options: {
  serverName: string;
  number: number;
  order: OrderData;
  status: OrderStatus;
  customerId: string;
  currency: string;
}): EmbedPayload {
  const s = ORDER_STATUS[options.status];
  const intro: Record<OrderStatus, string> = {
    received: 'Thanks for your order! We’ve received it and will be in touch shortly.',
    in_progress: 'Good news — your order is now being worked on.',
    completed: 'Your order is complete. Thank you for your business!',
    cancelled: 'Your order has been cancelled. If this is unexpected, please open a ticket.',
  };
  return {
    author: options.serverName,
    title: `${s.emoji} Order ${padNumber(options.number)} — ${s.label}`,
    color: s.color,
    description: [
      intro[options.status],
      '',
      ...orderLines(options),
      box('Status', `${s.emoji} **${s.label}**`),
    ].join('\n'),
  };
}

/** Public "Order Completed" card (posted where the order was made, e.g. the ticket). */
export function orderCompletedEmbed(options: {
  number: number;
  order: OrderData;
  customerId: string;
  currency: string;
  askForVouch: boolean;
}): EmbedPayload {
  return {
    title: '✅ Order Completed',
    color: ORDER_STATUS.completed.color,
    description: [
      ...orderLines(options),
      '',
      options.askForVouch
        ? 'Thank you for your business! Please leave a vouch using the button below. ⭐'
        : 'Thank you for your business!',
    ].join('\n'),
    timestamp: true,
  };
}

/** Which loyalty roles a customer should now have. */
export function loyaltyRoles(
  completedOrders: number,
  config: { customerRoleId: string | null; vipRoleId: string | null; vipAfterOrders: number },
): string[] {
  const roles: string[] = [];
  if (completedOrders >= 1 && config.customerRoleId) roles.push(config.customerRoleId);
  if (completedOrders >= config.vipAfterOrders && config.vipRoleId) roles.push(config.vipRoleId);
  return roles;
}
