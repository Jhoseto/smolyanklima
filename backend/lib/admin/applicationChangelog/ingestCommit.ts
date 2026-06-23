import { adminDb } from "@/lib/admin/db";
import { fetchCommitDetail, listCommitsForBranch } from "./githubClient";
import { getChangelogBranch, getGithubToken } from "./githubConfig";
import { detailedFallbackSummaryBg, summarizeCommitBg } from "./summarizeCommitBg";
import { isGenericSummary, needsAiResummary } from "./summaryQuality";
import type { ApplicationChangelogRow, IngestCommitInput } from "./types";

const AI_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeBranches(existing: string[] | null | undefined, branch: string): string[] {
  const set = new Set(existing ?? []);
  if (branch.trim()) set.add(branch.trim());
  return [...set];
}

export async function getChangelogRow(sha: string): Promise<ApplicationChangelogRow | null> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("*")
    .eq("commit_sha", sha)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApplicationChangelogRow | null) ?? null;
}

async function runAiSummary(
  row: Pick<
    ApplicationChangelogRow,
    "commit_sha" | "message_original" | "author_name" | "branches" | "insertions" | "deletions"
  >,
  changedFiles: string[],
): Promise<{ title_bg: string; summary_bg: string; sync_status: "ready" | "failed"; sync_error: string | null }> {
  try {
    const summary = await summarizeCommitBg({
      message: row.message_original,
      authorName: row.author_name,
      branches: row.branches,
      changedFiles,
      insertions: row.insertions,
      deletions: row.deletions,
    });
    return { ...summary, sync_status: "ready", sync_error: null };
  } catch (e) {
    const fallback = detailedFallbackSummaryBg(row.message_original);
    return {
      title_bg: fallback.title_bg,
      summary_bg: fallback.summary_bg,
      sync_status: "ready",
      sync_error: "heuristic",
    };
  }
}

export async function ingestCommit(
  input: IngestCommitInput,
  options?: { skipAi?: boolean; fetchDetails?: boolean },
): Promise<{ sha: string; created: boolean; sync_status: string }> {
  const db = await adminDb();
  let changedFiles = input.changedFiles ?? [];
  let filesChanged = input.filesChanged ?? null;
  let insertions = input.insertions ?? null;
  let deletions = input.deletions ?? null;

  const wantDetails =
    options?.fetchDetails === true
      ? true
      : options?.fetchDetails === false
        ? false
        : Boolean(getGithubToken()) && changedFiles.length === 0;

  if (wantDetails) {
    try {
      const detail = await fetchCommitDetail(input.sha);
      changedFiles = detail.changedFiles;
      filesChanged = detail.filesChanged;
      insertions = detail.insertions;
      deletions = detail.deletions;
    } catch {
      /* webhook payload may be enough */
    }
  }

  const existing = await getChangelogRow(input.sha);
  if (existing) {
    const branches = mergeBranches(existing.branches, input.branch);
    if (branches.length !== (existing.branches?.length ?? 0)) {
      await db.from("application_changelog").update({ branches }).eq("commit_sha", input.sha);
    }
    return { sha: input.sha, created: false, sync_status: existing.sync_status };
  }

  const branches = mergeBranches(undefined, input.branch);

  const baseRow = {
    commit_sha: input.sha,
    committed_at: input.committedAt,
    author_name: input.authorName,
    message_original: input.message,
    branches,
    github_url: input.githubUrl,
    files_changed: filesChanged,
    insertions,
    deletions,
    sync_status: "pending" as const,
    sync_error: null,
  };

  const { error } = await db.from("application_changelog").insert(baseRow);
  if (error) throw new Error(error.message);

  if (options?.skipAi) {
    return { sha: input.sha, created: true, sync_status: "pending" };
  }

  await sleep(AI_DELAY_MS);

  const ai = await runAiSummary(
    {
      commit_sha: input.sha,
      message_original: input.message,
      author_name: input.authorName,
      branches,
      insertions,
      deletions,
    },
    changedFiles,
  );

  await db
    .from("application_changelog")
    .update({
      title_bg: ai.title_bg,
      summary_bg: ai.summary_bg,
      sync_status: ai.sync_status,
      sync_error: ai.sync_error,
    })
    .eq("commit_sha", input.sha);

  return { sha: input.sha, created: true, sync_status: ai.sync_status };
}

/** Apply detailed phrase-based titles to generic rows (instant, no AI). */
export async function applyDetailedFallbackToGeneric(
  limit = 100,
): Promise<{ updated: number; remaining: number }> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("*")
    .order("committed_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  const candidates = ((data ?? []) as ApplicationChangelogRow[])
    .filter(needsAiResummary)
    .slice(0, limit);

  for (const row of candidates) {
    const fb = detailedFallbackSummaryBg(row.message_original);
    await db
      .from("application_changelog")
      .update({
        title_bg: fb.title_bg,
        summary_bg: fb.summary_bg,
        sync_status: "ready",
        sync_error: "heuristic",
      })
      .eq("commit_sha", row.commit_sha);
  }

  const remaining = await countNeedsAiResummary();
  return { updated: candidates.length, remaining };
}

/** Apply keyword-based Bulgarian descriptions to legacy failed rows (no AI cost). */
export async function fixFailedDescriptionsBatch(
  limit = 100,
): Promise<{ fixed: number; stillFailed: number }> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("commit_sha, message_original")
    .eq("sync_status", "failed")
    .order("committed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  for (const row of rows) {
    const summary = detailedFallbackSummaryBg(String(row.message_original ?? ""));
    await db
      .from("application_changelog")
      .update({
        title_bg: summary.title_bg,
        summary_bg: summary.summary_bg,
        sync_status: "ready",
        sync_error: "heuristic",
      })
      .eq("commit_sha", row.commit_sha);
  }

  const stillFailed = await countFailedChangelog();
  return { fixed: rows.length, stillFailed };
}

/** Re-run Gemini for rows with generic/heuristic descriptions (one-time upgrade). */
export async function resummarizeGenericBatch(
  limit = 5,
): Promise<{ processed: number; upgraded: number; remaining: number }> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("*")
    .order("committed_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const candidates = ((data ?? []) as ApplicationChangelogRow[])
    .filter(needsAiResummary)
    .slice(0, limit);

  let upgraded = 0;
  for (const row of candidates) {
    await sleep(AI_DELAY_MS);
    try {
      const summary = await summarizeCommitBg({
        message: row.message_original,
        authorName: row.author_name,
        branches: row.branches,
        changedFiles: [],
        insertions: row.insertions,
        deletions: row.deletions,
      });
      if (isGenericSummary({ title_bg: summary.title_bg, sync_error: null })) {
        const fb = detailedFallbackSummaryBg(row.message_original);
        if (fb.title_bg.length > (summary.title_bg?.length ?? 0)) {
          await db
            .from("application_changelog")
            .update({
              title_bg: fb.title_bg,
              summary_bg: fb.summary_bg,
              sync_status: "ready",
              sync_error: "heuristic",
            })
            .eq("commit_sha", row.commit_sha);
          upgraded += 1;
          continue;
        }
      }
      await db
        .from("application_changelog")
        .update({
          title_bg: summary.title_bg,
          summary_bg: summary.summary_bg,
          sync_status: "ready",
          sync_error: null,
        })
        .eq("commit_sha", row.commit_sha);
      upgraded += 1;
    } catch {
      const fb = detailedFallbackSummaryBg(row.message_original);
      await db
        .from("application_changelog")
        .update({
          title_bg: fb.title_bg,
          summary_bg: fb.summary_bg,
          sync_status: "ready",
          sync_error: "heuristic",
        })
        .eq("commit_sha", row.commit_sha);
      upgraded += 1;
    }
  }

  const remaining = await countNeedsAiResummary();
  return { processed: candidates.length, upgraded, remaining };
}

export async function countNeedsAiResummary(): Promise<number> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("commit_sha, title_bg, sync_status, sync_error")
    .order("committed_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);
  return ((data ?? []) as ApplicationChangelogRow[]).filter(needsAiResummary).length;
}

/** One-time AI pass for rows still marked failed (legacy imports). */
export async function summarizeFailedBatch(
  limit = 6,
): Promise<{ processed: number; succeeded: number; stillFailed: number }> {
  const db = await adminDb();
  const { data, error } = await db
    .from("application_changelog")
    .select("*")
    .eq("sync_status", "failed")
    .order("committed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ApplicationChangelogRow[];

  let succeeded = 0;
  for (const row of rows) {
    await sleep(AI_DELAY_MS);
    const ai = await runAiSummary(row, []);
    await db
      .from("application_changelog")
      .update({
        title_bg: ai.title_bg,
        summary_bg: ai.summary_bg,
        sync_status: ai.sync_status,
        sync_error: ai.sync_error,
      })
      .eq("commit_sha", row.commit_sha);
    if (ai.sync_status === "ready") succeeded += 1;
  }

  const stillFailed = await countFailedChangelog();
  return { processed: rows.length, succeeded, stillFailed };
}

export async function countFailedChangelog(): Promise<number> {
  const db = await adminDb();
  const { count, error } = await db
    .from("application_changelog")
    .select("*", { count: "exact", head: true })
    .eq("sync_status", "failed");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getChangelogCount(): Promise<number> {
  const db = await adminDb();
  const { count, error } = await db
    .from("application_changelog")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function commitExists(sha: string): Promise<boolean> {
  const row = await getChangelogRow(sha);
  return row != null;
}

function mapListCommit(c: Awaited<ReturnType<typeof listCommitsForBranch>>[number], branch: string) {
  return {
    sha: c.sha,
    message: c.commit.message?.trim() || "(no message)",
    authorName: c.commit.author?.name?.trim() || null,
    committedAt: c.commit.author?.date ?? new Date().toISOString(),
    githubUrl: c.html_url,
    branch,
  };
}

export type BootstrapBatchResult = {
  imported: number;
  skipped: number;
  failed: number;
  page: number;
  done: boolean;
  branch: string;
};

/** Paginate main branch history (newest pages first). Used for first-time auto load. */
export async function bootstrapMainBatch(page: number): Promise<BootstrapBatchResult> {
  const branch = getChangelogBranch();
  const PER_PAGE = 100;
  const pg = Math.max(1, page);
  const commits = await listCommitsForBranch(branch, pg, PER_PAGE);

  if (!commits.length) {
    return { imported: 0, skipped: 0, failed: 0, page: pg, done: true, branch };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of commits) {
    try {
      const mapped = mapListCommit(c, branch);
      const result = await ingestCommit(mapped);
      if (result.created) imported += 1;
      else if (result.sync_status === "ready") skipped += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    imported,
    skipped,
    failed,
    page: pg + 1,
    done: commits.length < PER_PAGE,
    branch,
  };
}

export type RefreshResult = {
  added: number;
  skipped: number;
  failed: number;
  branch: string;
};

/** Fetch commits newer than the latest in DB (main branch only). */
export async function refreshNewFromMain(): Promise<RefreshResult> {
  const branch = getChangelogBranch();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let page = 1; page <= 10; page++) {
    const commits = await listCommitsForBranch(branch, page, 50);
    if (!commits.length) break;

    let hitExisting = false;
    for (const c of commits) {
      if (await commitExists(c.sha)) {
        hitExisting = true;
        break;
      }
      try {
        const mapped = mapListCommit(c, branch);
        const result = await ingestCommit(mapped);
        if (result.created) added += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }
    if (hitExisting) break;
  }

  return { added, skipped, failed, branch };
}
