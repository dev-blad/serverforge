import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { TemplateError } from '../../errors.js';
import { inheritanceChain, resolveInheritance, type RawTemplate } from './inheritance.js';
import { TIERS, templateSchema, type Template } from './schema.js';
import { formatZodError, validateSemantics } from './validate.js';

export interface RawTemplateFile {
  file: string;
  raw: RawTemplate;
}

const TEMPLATE_EXTENSIONS = new Set(['.yaml', '.yml', '.json']);

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else if (TEMPLATE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files.sort();
}

/** Parse one template file's text. */
export function parseTemplateText(text: string, file: string): RawTemplate {
  let data: unknown;
  try {
    data = file.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const pos = error.linePos?.[0];
      throw new TemplateError(
        `${file}${pos ? `:${pos.line}:${pos.col}` : ''}: YAML syntax error — ${error.message.split('\n')[0]}`,
      );
    }
    throw new TemplateError(`${file}: could not parse — ${(error as Error).message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TemplateError(`${file}: a template must be an object at the top level`);
  }
  const record = data as Record<string, unknown>;
  if (typeof record['id'] !== 'string' || record['id'].length === 0) {
    throw new TemplateError(`${file}: missing required string field "id"`);
  }
  if (record['extends'] !== undefined && typeof record['extends'] !== 'string') {
    throw new TemplateError(`${file}: "extends" must be a template id string`);
  }
  return record as RawTemplate;
}

export async function readTemplateFiles(dir: string): Promise<RawTemplateFile[]> {
  let files: string[];
  try {
    files = await listFiles(dir);
  } catch (error) {
    throw new TemplateError(
      `Cannot read templates directory "${dir}": ${(error as Error).message}`,
    );
  }
  const out: RawTemplateFile[] = [];
  const problems: string[] = [];
  for (const file of files) {
    try {
      out.push({ file, raw: parseTemplateText(await readFile(file, 'utf8'), file) });
    } catch (error) {
      problems.push((error as Error).message);
    }
  }
  if (problems.length > 0) throw new TemplateError(problems.join('\n'));
  return out;
}

export interface CompileOptions {
  /** Require the base tier templates (starter, pro, elite) to exist. Default true. */
  requireBaseTiers?: boolean;
}

/**
 * Resolve inheritance, validate with zod and semantic checks. Collects *all* problems across
 * all templates and throws a single readable TemplateError if anything is wrong.
 */
export function compileTemplates(
  files: RawTemplateFile[],
  options: CompileOptions = {},
): Map<string, Template> {
  const problems: string[] = [];
  const rawById = new Map<string, RawTemplate>();
  const fileById = new Map<string, string>();

  for (const { file, raw } of files) {
    const existing = fileById.get(raw.id);
    if (existing) {
      problems.push(`${file}: duplicate template id "${raw.id}" (also defined in ${existing})`);
      continue;
    }
    rawById.set(raw.id, raw);
    fileById.set(raw.id, file);
  }

  const templates = new Map<string, Template>();
  const failed = new Set<string>();
  // Parents first, so a broken parent is reported once instead of once per descendant.
  const ordered = [...fileById.keys()].sort(
    (a, b) => inheritanceChain(a, rawById).length - inheritanceChain(b, rawById).length,
  );
  for (const id of ordered) {
    const file = fileById.get(id) ?? id;
    const brokenAncestor = inheritanceChain(id, rawById)
      .slice(0, -1)
      .find((ancestor) => failed.has(ancestor));
    if (brokenAncestor) {
      problems.push(`${file} (${id}): skipped — extends invalid template "${brokenAncestor}"`);
      failed.add(id);
      continue;
    }
    const before = problems.length;
    try {
      const merged = resolveInheritance(id, rawById);
      const result = templateSchema.safeParse(merged);
      if (!result.success) {
        for (const line of formatZodError(result.error, merged))
          problems.push(`${file} (${id}): ${line}`);
        continue;
      }
      const semantic = validateSemantics(result.data);
      if (semantic.length > 0) {
        for (const line of semantic) problems.push(`${file} (${id}): ${line}`);
        continue;
      }
      templates.set(id, result.data);
    } catch (error) {
      problems.push(`${file} (${id}): ${(error as Error).message}`);
    } finally {
      if (problems.length > before) failed.add(id);
    }
  }

  if (options.requireBaseTiers ?? true) {
    for (const tier of TIERS) {
      const t = templates.get(tier);
      if (!t && !problems.some((p) => p.includes(`(${tier})`))) {
        problems.push(`Missing base template "${tier}" (every tier needs a template with that id)`);
      } else if (t && t.tier !== tier) {
        problems.push(`Base template "${tier}" must declare tier: ${tier} (found ${t.tier})`);
      }
    }
  }

  if (problems.length > 0) {
    throw new TemplateError(
      `Template validation failed with ${problems.length} problem(s):\n${problems.map((p) => `  • ${p}`).join('\n')}`,
    );
  }
  return templates;
}

export async function loadTemplates(
  dir: string,
  options?: CompileOptions,
): Promise<Map<string, Template>> {
  return compileTemplates(await readTemplateFiles(dir), options);
}
