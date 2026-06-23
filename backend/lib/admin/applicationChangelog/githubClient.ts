import { createHmac, timingSafeEqual } from "crypto";
import { getGithubRepo, getGithubToken, getGithubWebhookSecret } from "./githubConfig";

const GITHUB_API = "https://api.github.com";

/** Min gap between unauthenticated GitHub API calls (60 req/h limit). */
const MIN_GAP_MS_NO_TOKEN = 3_000;

let lastGithubRequestAt = 0;

type GithubCommitListItem = {
  sha: string;
  commit: {
    message: string;
    author: { name?: string | null; date?: string | null };
  };
  html_url: string;
};

type GithubCommitDetail = {
  sha: string;
  commit: {
    message: string;
    author: { name?: string | null; date?: string | null };
  };
  html_url: string;
  stats?: { total?: number; additions?: number; deletions?: number };
  files?: { filename: string }[];
};

export class GithubRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, hasToken: boolean) {
    const mins = Math.ceil(retryAfterMs / 60_000);
    super(
      hasToken
        ? `GitHub API лимит — опитайте след ${mins} мин.`
        : `GitHub API лимит (без GITHUB_TOKEN). Изчакайте ~${mins} мин. или добавете GITHUB_TOKEN в .env.`,
    );
    this.name = "GithubRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(): HeadersInit {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SmolyanKlima-Changelog/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function rateLimitWaitMs(res: Response): number {
  const resetHeader = res.headers.get("x-ratelimit-reset");
  if (resetHeader) {
    const resetAt = parseInt(resetHeader, 10) * 1000;
    if (!Number.isNaN(resetAt)) {
      return Math.max(resetAt - Date.now() + 1_500, 5_000);
    }
  }
  return 60_000;
}

function isRateLimitResponse(status: number, body: string): boolean {
  return (
    status === 403 &&
    (body.toLowerCase().includes("rate limit") ||
      body.toLowerCase().includes("api rate limit exceeded"))
  );
}

async function throttleBeforeRequest(): Promise<void> {
  if (getGithubToken()) return;
  const now = Date.now();
  const gap = MIN_GAP_MS_NO_TOKEN - (now - lastGithubRequestAt);
  if (gap > 0) await sleep(gap);
  lastGithubRequestAt = Date.now();
}

async function githubFetch(path: string, attempt = 0): Promise<Response> {
  await throttleBeforeRequest();

  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");

    if (isRateLimitResponse(res.status, body) && attempt < 1) {
      const waitMs = Math.min(rateLimitWaitMs(res), 3_600_000);
      await sleep(waitMs);
      return githubFetch(path, attempt + 1);
    }

    if (isRateLimitResponse(res.status, body)) {
      throw new GithubRateLimitError(rateLimitWaitMs(res), Boolean(getGithubToken()));
    }

    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res;
}

export function verifyGithubWebhookSignature(body: string, signatureHeader: string | null): boolean {
  const secret = getGithubWebhookSecret();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
  } catch {
    return false;
  }
}

export function branchFromRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

export async function listBranches(): Promise<string[]> {
  const repo = getGithubRepo();
  const branches: string[] = [];
  let page = 1;
  while (page <= 20) {
    const res = await githubFetch(`/repos/${repo}/branches?per_page=100&page=${page}`);
    const batch = (await res.json()) as { name: string }[];
    if (!batch.length) break;
    branches.push(...batch.map((b) => b.name));
    if (batch.length < 100) break;
    page += 1;
  }
  return branches;
}

export async function listCommitsForBranch(
  branch: string,
  page: number,
  perPage = 100,
): Promise<GithubCommitListItem[]> {
  const repo = getGithubRepo();
  const res = await githubFetch(
    `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`,
  );
  return (await res.json()) as GithubCommitListItem[];
}

export async function fetchCommitDetail(sha: string): Promise<{
  sha: string;
  message: string;
  authorName: string | null;
  committedAt: string;
  githubUrl: string;
  filesChanged: number | null;
  insertions: number | null;
  deletions: number | null;
  changedFiles: string[];
}> {
  const repo = getGithubRepo();
  const res = await githubFetch(`/repos/${repo}/commits/${sha}`);
  const data = (await res.json()) as GithubCommitDetail;
  const files = (data.files ?? []).map((f) => f.filename).slice(0, 15);
  return {
    sha: data.sha,
    message: data.commit.message?.trim() || "(no message)",
    authorName: data.commit.author?.name?.trim() || null,
    committedAt: data.commit.author?.date ?? new Date().toISOString(),
    githubUrl: data.html_url,
    filesChanged: data.files?.length ?? data.stats?.total ?? null,
    insertions: data.stats?.additions ?? null,
    deletions: data.stats?.deletions ?? null,
    changedFiles: files,
  };
}

export type WebhookPushCommit = {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author?: { name?: string; username?: string };
};

export function mapWebhookCommit(c: WebhookPushCommit, branch: string) {
  return {
    sha: c.id,
    message: c.message?.trim() || "(no message)",
    authorName: c.author?.name?.trim() || c.author?.username?.trim() || null,
    committedAt: c.timestamp,
    githubUrl: c.url,
    branch,
  };
}
