/**
 * Server structure snapshots. A snapshot records roles, categories, channels and their role
 * permission overwrites (by role NAME, so it survives roles being deleted and recreated).
 * Restoring only re-creates what's missing — it never deletes or changes existing things.
 */

export interface SnapshotOverwrite {
  /** Role name, or "@everyone". */
  role: string;
  allow: string;
  deny: string;
}

export interface SnapshotRole {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
}

export type SnapshotChannelType = 'text' | 'voice' | 'announcement' | 'forum' | 'stage';

export interface SnapshotChannel {
  name: string;
  type: SnapshotChannelType;
  topic: string | null;
  nsfw: boolean;
  slowmode: number;
  userLimit: number;
  /** Category name, or null. */
  parent: string | null;
  position: number;
  overwrites: SnapshotOverwrite[];
}

export interface SnapshotCategory {
  name: string;
  position: number;
  overwrites: SnapshotOverwrite[];
}

export interface ServerSnapshot {
  takenAt: string;
  takenBy: string;
  serverName: string;
  roles: SnapshotRole[];
  categories: SnapshotCategory[];
  channels: SnapshotChannel[];
}

export interface CurrentServer {
  roles: string[];
  categories: string[];
  channels: { name: string; type: SnapshotChannelType; parent: string | null }[];
}

export interface RestorePlan {
  roles: SnapshotRole[];
  categories: SnapshotCategory[];
  channels: SnapshotChannel[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** What a restore would re-create: anything in the snapshot that no longer exists. */
export function planRestore(snapshot: ServerSnapshot, current: CurrentServer): RestorePlan {
  const roles = new Set(current.roles.map(norm));
  const categories = new Set(current.categories.map(norm));
  const channels = new Set(
    current.channels.map((c) => `${norm(c.parent ?? '')}|${c.type}|${norm(c.name)}`),
  );
  return {
    roles: snapshot.roles.filter((r) => !roles.has(norm(r.name))),
    categories: snapshot.categories.filter((c) => !categories.has(norm(c.name))),
    channels: snapshot.channels.filter(
      (c) => !channels.has(`${norm(c.parent ?? '')}|${c.type}|${norm(c.name)}`),
    ),
  };
}

export function snapshotSummary(
  s: Pick<ServerSnapshot, 'roles' | 'categories' | 'channels'>,
): string {
  return `${s.roles.length} roles, ${s.categories.length} categories, ${s.channels.length} channels`;
}
