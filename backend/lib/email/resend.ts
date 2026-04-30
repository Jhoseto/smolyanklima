type SendResult = { ok: true } | { ok: false; skipped?: boolean; error?: string };

/**
 * Sends transactional email via Resend HTTP API when RESEND_API_KEY is set.
 */
export async function sendResendEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 500)}` };
  }
  return { ok: true };
}
