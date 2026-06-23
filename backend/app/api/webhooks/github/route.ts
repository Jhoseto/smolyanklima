import { NextRequest, NextResponse } from "next/server";
import {
  branchFromRef,
  mapWebhookCommit,
  verifyGithubWebhookSignature,
  type WebhookPushCommit,
} from "@/lib/admin/applicationChangelog/githubClient";
import { getChangelogBranch } from "@/lib/admin/applicationChangelog/githubConfig";
import { ingestCommit } from "@/lib/admin/applicationChangelog/ingestCommit";

export const dynamic = "force-dynamic";

type PushPayload = {
  ref?: string;
  commits?: WebhookPushCommit[];
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");

  if (!verifyGithubWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "ping") {
    return NextResponse.json({ ok: true, ping: true });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: event ?? "unknown" });
  }

  let payload: PushPayload;
  try {
    payload = JSON.parse(rawBody) as PushPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ref = payload.ref ?? "";
  const branch = branchFromRef(ref);

  if (branch !== getChangelogBranch()) {
    return NextResponse.json({ ok: true, ignored: "branch", branch });
  }

  const commits = payload.commits ?? [];

  if (!commits.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const c of commits) {
    try {
      const mapped = mapWebhookCommit(c, branch);
      await ingestCommit(
        {
          sha: mapped.sha,
          message: mapped.message,
          authorName: mapped.authorName,
          committedAt: mapped.committedAt,
          githubUrl: mapped.githubUrl,
          branch: mapped.branch,
        },
        { fetchDetails: true },
      );
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed, failed, branch });
}
