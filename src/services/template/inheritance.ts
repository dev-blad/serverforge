import { TemplateError } from '../../errors.js';

/**
 * Template inheritance.
 *
 * A raw template may declare `extends: <parentId>`. The resolved template is the parent
 * (itself fully resolved) deep-merged with the child using these rules:
 *
 *  • Objects merge recursively; child values win.
 *  • Arrays whose items are objects with a string `key` merge *by key*:
 *      – same key → the entries are deep-merged in place (child wins)
 *      – new key  → appended, or inserted relative to a sibling via `before: <key>` / `after: <key>`
 *      – `remove: true` → the inherited entry is deleted
 *  • Any other array (permission lists, keywords, overwrites, …) is replaced wholesale.
 *  • `id`, `name`, `description`, `extends` and `abstract` are never inherited.
 */

export type RawTemplate = Record<string, unknown> & { id: string; extends?: string };

const NON_INHERITED = new Set(['id', 'name', 'description', 'extends', 'abstract']);
const DIRECTIVES = ['before', 'after', 'remove'] as const;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKeyedArray(value: unknown[]): value is (PlainObject & { key: string })[] {
  return value.every((item) => isPlainObject(item) && typeof item['key'] === 'string');
}

function stripDirectives(item: PlainObject): PlainObject {
  const copy: PlainObject = {};
  for (const [k, v] of Object.entries(item)) {
    if (!(DIRECTIVES as readonly string[]).includes(k)) copy[k] = stripDeep(v);
  }
  return copy;
}

/** Remove merge directives from keyed array entries anywhere in a structure. */
function stripDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 0 && isKeyedArray(value)) {
      return value.filter((item) => item['remove'] !== true).map((item) => stripDirectives(item));
    }
    return value.map(stripDeep);
  }
  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripDeep(v);
    return out;
  }
  return value;
}

function mergeKeyedArrays(
  base: (PlainObject & { key: string })[],
  override: (PlainObject & { key: string })[],
  path: string,
): PlainObject[] {
  const result: (PlainObject & { key: string })[] = base.map((item) => ({ ...item }));

  for (const item of override) {
    const index = result.findIndex((existing) => existing.key === item.key);

    if (item['remove'] === true) {
      if (index >= 0) result.splice(index, 1);
      continue;
    }

    let merged: PlainObject & { key: string };
    if (index >= 0) {
      merged = mergeDeep(result[index], item, `${path}[${item.key}]`) as PlainObject & {
        key: string;
      };
      result.splice(index, 1);
    } else {
      merged = item;
    }

    const before = item['before'];
    const after = item['after'];
    let insertAt = index >= 0 ? index : result.length;
    if (typeof before === 'string' || typeof after === 'string') {
      const anchor = (typeof before === 'string' ? before : after) as string;
      const anchorIndex = result.findIndex((existing) => existing.key === anchor);
      if (anchorIndex < 0) {
        throw new TemplateError(
          `${path}: entry "${item.key}" references unknown sibling "${anchor}" in ${
            typeof before === 'string' ? 'before' : 'after'
          }`,
        );
      }
      insertAt = typeof before === 'string' ? anchorIndex : anchorIndex + 1;
    }
    result.splice(insertAt, 0, merged);
  }

  return result.map((item) => stripDirectives(item));
}

/** Deep merge `override` onto `base` following the inheritance rules above. */
export function mergeDeep(base: unknown, override: unknown, path = ''): unknown {
  if (override === undefined) return stripDeep(base);
  if (base === undefined) return stripDeep(override);

  if (Array.isArray(base) && Array.isArray(override)) {
    if (base.length > 0 && override.length > 0 && isKeyedArray(base) && isKeyedArray(override)) {
      return mergeKeyedArrays(base, override, path);
    }
    return stripDeep(override);
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const out: PlainObject = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
    for (const k of keys) {
      out[k] = mergeDeep(base[k], override[k], path ? `${path}.${k}` : k);
    }
    return out;
  }

  return stripDeep(override);
}

/**
 * Resolve a template's inheritance chain. Returns the merged raw object (not yet zod-validated).
 * Throws a TemplateError for unknown parents and cycles.
 */
export function resolveInheritance(
  id: string,
  rawById: ReadonlyMap<string, RawTemplate>,
  seen: string[] = [],
): PlainObject {
  const raw = rawById.get(id);
  if (!raw) {
    const from = seen.at(-1);
    throw new TemplateError(
      from
        ? `Template "${from}" extends unknown template "${id}". Available: ${[...rawById.keys()].join(', ')}`
        : `Unknown template "${id}"`,
    );
  }
  if (seen.includes(id)) {
    throw new TemplateError(`Template inheritance cycle: ${[...seen, id].join(' → ')}`);
  }

  if (!raw.extends) return stripDeep(raw) as PlainObject;

  const parent = resolveInheritance(raw.extends, rawById, [...seen, id]);
  const inheritable: PlainObject = {};
  for (const [k, v] of Object.entries(parent)) {
    if (!NON_INHERITED.has(k)) inheritable[k] = v;
  }
  const merged = mergeDeep(inheritable, raw) as PlainObject;
  if (merged['abstract'] === undefined) delete merged['abstract'];
  return merged;
}

/** The ordered chain of ids from the root ancestor to `id`. */
export function inheritanceChain(id: string, rawById: ReadonlyMap<string, RawTemplate>): string[] {
  const chain: string[] = [];
  let current: string | undefined = id;
  while (current) {
    if (chain.includes(current)) break;
    chain.unshift(current);
    current = rawById.get(current)?.extends;
  }
  return chain;
}
