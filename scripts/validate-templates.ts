/**
 * Validate every template in TEMPLATES_DIR (default ./templates).
 *   npm run validate-templates            validate all
 *   npm run validate-templates -- --dir x validate another directory
 * Exits non-zero with a readable report if anything is wrong.
 */
import 'dotenv/config';
import { loadTemplates } from '../src/services/template/loader.js';
import { summarizeTemplate } from '../src/services/template/registry.js';
import { TemplateError } from '../src/errors.js';

const dirFlag = process.argv.indexOf('--dir');
const dir = (dirFlag >= 0 ? process.argv[dirFlag + 1] : undefined) ?? process.env['TEMPLATES_DIR'] ?? './templates';

try {
  const templates = await loadTemplates(dir);
  console.log(`✔ ${templates.size} template(s) valid in ${dir}\n`);
  for (const t of templates.values()) {
    const s = summarizeTemplate(t);
    const types = Object.entries(s.channelsByType)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');
    console.log(
      `  ${t.id.padEnd(14)} ${t.tier.padEnd(8)} ${String(s.roles).padStart(3)} roles  ${String(s.categories).padStart(2)} categories  ${String(s.channels).padStart(3)} channels (${types})  modules: ${s.modules.join(', ') || '—'}${t.abstract ? '  [abstract]' : ''}${t.extends ? `  extends ${t.extends}` : ''}`,
    );
  }
} catch (error) {
  if (error instanceof TemplateError) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
