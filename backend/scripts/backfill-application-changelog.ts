/**
 * Еднократен backfill на GitHub commit история (main branch) в application_changelog.
 *
 * Usage:
 *   tsx scripts/backfill-application-changelog.ts
 *
 * Requires: SUPABASE_* env, GEMINI_API_KEY
 * Optional: GITHUB_TOKEN, GITHUB_REPO (default Jhoseto/smolyanklima), GITHUB_CHANGELOG_BRANCH (default main)
 */

import { getChangelogBranch } from "../lib/admin/applicationChangelog/githubConfig";
import { bootstrapMainBatch } from "../lib/admin/applicationChangelog/ingestCommit";

async function main() {
  const branch = getChangelogBranch();
  console.log(`Backfill branch: ${branch}`);

  let page = 1;
  let done = false;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  while (!done) {
    const result = await bootstrapMainBatch(page);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
    console.log(
      `page ${page}: imported=${result.imported} skipped=${result.skipped} failed=${result.failed}`,
    );
    done = result.done;
    page = result.page;
  }

  console.log(
    `\nDone. imported=${totalImported} skipped=${totalSkipped} failed=${totalFailed}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
