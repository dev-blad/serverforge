import { requireId } from '../shared.js';
import type { ModuleInstaller } from '../types.js';

export interface StoreRuntimeConfig {
  catalogueChannelId: string;
  ordersChannelId: string;
  staffRoleIds: string[];
  currency: string;
  customerRoleId: string | null;
  vipRoleId: string | null;
  vipAfterOrders: number;
}

export const installStore: ModuleInstaller = (ctx) => {
  const spec = ctx.template.modules.store;
  if (!spec) throw new Error('store config missing');
  const config: StoreRuntimeConfig = {
    catalogueChannelId: requireId(ctx.ids.channels, spec.catalogueChannel, 'Channel'),
    ordersChannelId: requireId(ctx.ids.channels, spec.ordersChannel, 'Channel'),
    staffRoleIds: spec.staffRoles.map((k) => ctx.ids.roles[k]).filter((id): id is string => !!id),
    currency: spec.currency,
    customerRoleId: spec.customerRole ? (ctx.ids.roles[spec.customerRole] ?? null) : null,
    vipRoleId: spec.vipRole ? (ctx.ids.roles[spec.vipRole] ?? null) : null,
    vipAfterOrders: spec.vipAfterOrders,
  };
  return Promise.resolve({ ...config });
};
