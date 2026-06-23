/** GitHub repo for changelog — default: Jhoseto/smolyanklima */
export function getGithubRepo(): string {
  const raw = process.env.GITHUB_REPO?.trim();
  if (raw && raw.includes("/")) return raw;
  return "Jhoseto/smolyanklima";
}

/** Branch whose commits are shown in „За приложението“. */
export function getChangelogBranch(): string {
  return process.env.GITHUB_CHANGELOG_BRANCH?.trim() || "main";
}

export function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

export function getGithubWebhookSecret(): string | null {
  return process.env.GITHUB_WEBHOOK_SECRET?.trim() || null;
}

export function getChangelogGeminiModel(): string {
  const custom = process.env.GEMINI_CHANGELOG_MODEL?.trim();
  if (custom) return custom;
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv || "gemini-2.5-flash";
}
