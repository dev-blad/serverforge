import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UserFacingError } from '../../errors.js';
import type { Logger } from '../../logger.js';
import { captureTemplate, validateCaptured, type CaptureSource } from './capture.js';
import { readTemplateFiles } from './loader.js';
import { keySchema, type Tier } from './schema.js';

export interface CaptureOutcome {
  yaml: string;
  fileName: string;
  /** Where the file was written, or null if writing failed (read-only filesystem etc.). */
  writtenTo: string | null;
  warnings: string[];
}

export class CaptureService {
  constructor(
    private readonly templatesDir: string,
    private readonly logger: Logger,
  ) {}

  async capture(
    source: CaptureSource,
    options: { id: string; name?: string | null; tier: Tier },
  ): Promise<CaptureOutcome> {
    const id = options.id.trim().toLowerCase();
    if (!keySchema.safeParse(id).success) {
      throw new UserFacingError(
        'Template ids must be lowercase letters, digits, "-" or "_" (e.g. `crypto-pro`).',
      );
    }
    const result = captureTemplate(source, {
      id,
      name: options.name?.trim() || source.guildName,
      tier: options.tier,
    });
    const existing = await readTemplateFiles(this.templatesDir);
    const problems = validateCaptured(result, existing);
    if (problems.length) {
      throw new UserFacingError('The captured server does not make a valid template yet.', {
        title: 'Capture failed',
        details: problems.slice(0, 10),
      });
    }
    const fileName = `${id}.yaml`;
    const dir = path.join(this.templatesDir, 'captured');
    let writtenTo: string | null = null;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), result.yaml, { flag: 'wx' });
      writtenTo = path.join(dir, fileName);
    } catch (error) {
      this.logger.warn({ err: error, dir }, 'could not write captured template to disk');
    }
    return { yaml: result.yaml, fileName, writtenTo, warnings: result.warnings };
  }
}
