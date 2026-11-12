import { hexToInt, renderReferencesDeep, type ReferenceIds } from '../template/placeholders.js';
import type { EmbedSpec, MessageSpec, OverwriteSpec, RoleSpec } from '../template/schema.js';
import type { EmbedPayload, MessagePayload, OverwritePayload, RolePayload } from './gateway.js';
import { permissionsToBits } from './permissions.js';

/** Convert a rendered colour string to an int (invalid/placeholder colours are dropped). */
export function colorToInt(color: string | undefined): number | undefined {
  if (!color) return undefined;
  try {
    return hexToInt(color);
  } catch {
    return undefined;
  }
}

export function embedPayload(spec: EmbedSpec, ids: ReferenceIds): EmbedPayload {
  const s = renderReferencesDeep(spec, ids);
  const out: EmbedPayload = {};
  if (s.title) out.title = s.title;
  if (s.description) out.description = s.description;
  const color = colorToInt(s.color);
  if (color !== undefined) out.color = color;
  if (s.url) out.url = s.url;
  if (s.fields.length)
    out.fields = s.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline }));
  if (s.footer) out.footer = s.footer;
  if (s.image) out.image = s.image;
  if (s.thumbnail) out.thumbnail = s.thumbnail;
  if (s.author) out.author = s.author;
  return out;
}

export function messagePayload(spec: MessageSpec, ids: ReferenceIds): MessagePayload {
  const payload: MessagePayload = { embeds: spec.embeds.map((e) => embedPayload(e, ids)) };
  if (spec.content) payload.content = renderReferencesDeep(spec.content, ids);
  if (spec.links.length) payload.links = spec.links.map((l) => ({ ...l }));
  return payload;
}

export function rolePayload(spec: RoleSpec): RolePayload {
  const color = colorToInt(spec.color);
  return {
    name: spec.name,
    hoist: spec.hoist,
    mentionable: spec.mentionable,
    permissions: permissionsToBits(spec.permissions),
    ...(color !== undefined ? { color } : {}),
  };
}

/**
 * Resolve template overwrites to Discord ids. Overwrites for roles that don't exist are
 * skipped (they can't be applied); callers ensure roles are created first.
 */
export function overwritePayloads(
  overwrites: readonly OverwriteSpec[],
  ids: { everyoneId: string; roles: Readonly<Record<string, string>> },
): OverwritePayload[] {
  const out: OverwritePayload[] = [];
  for (const o of overwrites) {
    const id = o.role === 'everyone' ? ids.everyoneId : ids.roles[o.role];
    if (!id) continue;
    out.push({
      id,
      type: 'role',
      allow: permissionsToBits(o.allow),
      deny: permissionsToBits(o.deny),
    });
  }
  return out;
}
