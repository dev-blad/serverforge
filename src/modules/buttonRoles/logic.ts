export interface PanelConfig {
  channelId: string;
  messageId: string;
  exclusive: boolean;
  /** buttonKey → roleId */
  buttons: Record<string, string>;
}

export interface RoleToggle {
  add: string[];
  remove: string[];
  /** true when the clicked role was added (false = removed). */
  added: boolean;
}

/**
 * Decide which roles to add/remove when a member clicks a role button.
 * Clicking a role you have removes it; in exclusive panels picking a role removes the
 * panel's other roles (e.g. only one region).
 */
export function computeRoleToggle(
  memberRoleIds: ReadonlySet<string>,
  panel: PanelConfig,
  buttonKey: string,
): RoleToggle | null {
  const roleId = panel.buttons[buttonKey];
  if (!roleId) return null;
  if (memberRoleIds.has(roleId)) return { add: [], remove: [roleId], added: false };
  const remove = panel.exclusive
    ? Object.values(panel.buttons).filter((id) => id !== roleId && memberRoleIds.has(id))
    : [];
  return { add: [roleId], remove, added: true };
}
