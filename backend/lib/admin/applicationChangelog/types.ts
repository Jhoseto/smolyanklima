export type ChangelogSyncStatus = "pending" | "ready" | "failed";

export type ApplicationChangelogRow = {
  commit_sha: string;
  committed_at: string;
  author_name: string | null;
  message_original: string;
  title_bg: string | null;
  summary_bg: string | null;
  branches: string[];
  github_url: string;
  files_changed: number | null;
  insertions: number | null;
  deletions: number | null;
  sync_status: ChangelogSyncStatus;
  sync_error: string | null;
  created_at: string;
};

export type IngestCommitInput = {
  sha: string;
  message: string;
  authorName: string | null;
  committedAt: string;
  githubUrl: string;
  branch: string;
  filesChanged?: number | null;
  insertions?: number | null;
  deletions?: number | null;
  changedFiles?: string[];
};

export type CommitSummaryBg = {
  title_bg: string;
  summary_bg: string;
};
