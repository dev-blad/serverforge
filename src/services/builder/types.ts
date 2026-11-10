import type { BuildKind, BuildMode, ResourceKind } from '../../db/types.js';
import type {
  ChannelKind,
  ChannelSpec,
  MessageSpec,
  ModuleId,
  OverwriteSpec,
  PermissionName,
  RoleSpec,
} from '../template/schema.js';

// ─── Guild snapshot (pure data captured from Discord) ───────────────────────

export interface SnapshotRole {
  id: string;
  name: string;
  /** Discord position (higher = higher in the list). @everyone is 0. */
  position: number;
  /** Managed by an integration/bot (cannot be assigned or deleted). */
  managed: boolean;
  /** The bot can edit/delete/assign it (below the bot's highest role and not managed). */
  editable: boolean;
  /** Permission bitfield as a decimal string. */
  permissions: string;
}

export interface SnapshotOverwrite {
  id: string;
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

export type SnapshotChannelType = ChannelKind | 'category' | 'other';

export interface SnapshotChannel {
  id: string;
  name: string;
  type: SnapshotChannelType;
  parentId: string | null;
  position: number;
  overwrites: SnapshotOverwrite[];
  /** The bot is allowed to delete it. */
  deletable: boolean;
}

export interface GuildSnapshot {
  id: string;
  name: string;
  ownerId: string;
  /** @everyone role permissions bitfield (decimal string). */
  everyonePermissions: string;
  features: string[];
  roles: SnapshotRole[];
  channels: SnapshotChannel[];
  bot: {
    userId: string;
    highestRolePosition: number;
    isAdmin: boolean;
    permissions: PermissionName[];
  };
  /** Community rules / public updates channels (can't be deleted while Community is on). */
  rulesChannelId: string | null;
  publicUpdatesChannelId: string | null;
  /** Keys of tracked messages that still exist in Discord. */
  existingMessages: string[];
  /** Ids of AutoMod rules currently in the guild. */
  automodRuleIds: string[];
}

// ─── Plan ───────────────────────────────────────────────────────────────────

export type Phase =
  | 'cleanup'
  | 'roles'
  | 'categories'
  | 'channels'
  | 'community'
  | 'overwrites'
  | 'messages'
  | 'modules';

export const PHASE_LABELS: Record<Phase, string> = {
  cleanup: 'Removing old channels & roles',
  roles: 'Creating roles',
  categories: 'Creating categories',
  channels: 'Creating channels',
  community: 'Enabling Community features',
  overwrites: 'Applying permissions',
  messages: 'Posting embeds',
  modules: 'Setting up modules',
};

export type PlanAction =
  | { phase: 'cleanup'; type: 'deleteChannel'; id: string; name: string }
  | { phase: 'cleanup'; type: 'deleteRole'; id: string; name: string }
  | { phase: 'roles'; type: 'createRole'; key: string; spec: RoleSpec }
  | { phase: 'roles'; type: 'updateEveryone'; permissions: PermissionName[] }
  | { phase: 'roles'; type: 'orderRoles'; keys: string[] }
  | {
      phase: 'categories';
      type: 'createCategory';
      key: string;
      name: string;
      overwrites: OverwriteSpec[];
    }
  | {
      phase: 'channels';
      type: 'createChannel';
      key: string;
      spec: ChannelSpec;
      parentKey: string | null;
      overwrites: OverwriteSpec[];
    }
  | { phase: 'channels'; type: 'orderChannels'; layout: ChannelLayout }
  | { phase: 'channels'; type: 'convertToAnnouncement'; key: string }
  | { phase: 'community'; type: 'enableCommunity'; rulesKey: string; updatesKey: string }
  | { phase: 'overwrites'; type: 'syncOverwrites'; key: string; overwrites: OverwriteSpec[] }
  | { phase: 'messages'; type: 'postMessage'; key: string; spec: MessageSpec }
  | { phase: 'modules'; type: 'applyModule'; moduleId: ModuleId };

export interface ChannelLayout {
  /** Template category keys in display order. */
  categories: string[];
  /** Channel keys per category key ("" = no category) in display order. */
  channels: Record<string, string[]>;
}

export interface Adoption {
  key: string;
  kind: ResourceKind;
  discordId: string;
  name: string;
}

export interface PlanSummary {
  create: { roles: number; categories: number; channels: number; messages: number };
  channelsByType: Record<string, number>;
  remove: { roles: number; channels: number };
  keep: { roles: number; channels: number };
  adopted: number;
  overwriteSyncs: number;
  conversions: number;
  modules: ModuleId[];
  enableCommunity: boolean;
  updateEveryone: boolean;
}

export interface BuildPlan {
  kind: BuildKind;
  mode: BuildMode;
  templateId: string;
  actions: PlanAction[];
  /** Existing resources matched by name that will start being tracked. */
  adoptions: Adoption[];
  /** Ids of template resources that already exist (tracked or adopted). */
  resolved: { roles: Record<string, string>; channels: Record<string, string> };
  summary: PlanSummary;
  warnings: string[];
}

// ─── Progress ───────────────────────────────────────────────────────────────

export interface ProgressUpdate {
  phase: Phase;
  label: string;
  /** Actions completed overall. */
  done: number;
  total: number;
  /** Actions completed / total within the current phase. */
  phaseDone: number;
  phaseTotal: number;
}

export interface ProgressReporter {
  update(progress: ProgressUpdate): void | Promise<void>;
}

export const nullReporter: ProgressReporter = { update: () => undefined };
