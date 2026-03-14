import { Resend } from "resend";

export type RetentionMailInput = {
  userId: string;
  to: string | null;
  subject: string;
  body: string;
  reportKey: string;
  title: string;
  tone: "positive" | "warning";
  ctaUrl?: string;
  ctaLabel?: string;
  metricLabel?: string;
  metricValue?: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function buddySvg(tone: "positive" | "warning") {
  if (tone === "positive") {
    return `
      <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Buddy strong">
        <circle cx="70" cy="70" r="60" fill="rgba(16,185,129,0.16)" stroke="rgba(16,185,129,0.5)" />
        <circle cx="70" cy="48" r="18" fill="#caa38e" />
        <path d="M38 96c0-20 14-34 32-34h0c18 0 32 14 32 34v12H38V96z" fill="rgba(16,185,129,0.25)" stroke="rgba(16,185,129,0.5)" />
        <path d="M56 92h28v26H56z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" />
        <path d="M32 30l10 6M108 30l-10 6M70 14v12" stroke="rgba(16,185,129,0.8)" stroke-width="3" stroke-linecap="round" />
      </svg>
    `;
  }
  return `
    <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Buddy weak">
      <circle cx="70" cy="70" r="60" fill="rgba(220,20,60,0.12)" stroke="rgba(220,20,60,0.35)" />
      <circle cx="70" cy="48" r="18" fill="#caa38e" />
      <path d="M38 96c0-20 14-34 32-34h0c18 0 32 14 32 34v12H38V96z" fill="rgba(220,20,60,0.18)" stroke="rgba(220,20,60,0.35)" />
      <path d="M54 92h32v26H54z" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.12)" />
      <path d="M56 46c4 6 8 6 12 0M72 46c4 6 8 6 12 0M60 64c6 4 14 4 20 0" stroke="rgba(0,0,0,0.45)" stroke-width="3" stroke-linecap="round" />
      <path d="M100 32c4 8 2 16-2 22" stroke="rgba(220,20,60,0.55)" stroke-width="3" stroke-linecap="round" />
    </svg>
  `;
}

function renderRetentionHtml(input: RetentionMailInput) {
  const accent = input.tone === "positive" ? "#10b981" : "#dc143c";
  const panel = input.tone === "positive" ? "rgba(16,185,129,0.12)" : "rgba(220,20,60,0.10)";

  return `
    <div style="background:#09090b;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f4f4f5;">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:28px;">
        <div style="text-align:center">${buddySvg(input.tone)}</div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#a1a1aa;text-align:center;">money-survive</div>
        <h1 style="margin:16px 0 8px;font-size:24px;line-height:1.3;text-align:center;">${input.title}</h1>
        <p style="margin:0 auto 20px;max-width:420px;font-size:14px;line-height:1.8;color:#d4d4d8;text-align:center;">${input.body}</p>
        ${
          input.metricLabel && input.metricValue
            ? `<div style="margin:0 0 20px;border-radius:18px;border:1px solid rgba(255,255,255,0.08);background:${panel};padding:16px;text-align:center;">
                <div style="font-size:12px;font-weight:700;color:#a1a1aa;">${input.metricLabel}</div>
                <div style="margin-top:6px;font-size:28px;font-weight:800;color:${accent};">${input.metricValue}</div>
              </div>`
            : ""
        }
        ${
          input.ctaUrl
            ? `<div style="text-align:center;">
                <a href="${input.ctaUrl}" style="display:inline-block;padding:12px 20px;border-radius:14px;background:${accent};color:#09090b;text-decoration:none;font-weight:800;">
                  ${input.ctaLabel ?? "アプリを開く"}
                </a>
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}

export async function sendRetentionMail(input: RetentionMailInput) {
  const payload = {
    channel: hasResendConfig() && input.to ? "email" : "email_stub",
    userId: input.userId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    reportKey: input.reportKey,
    tone: input.tone,
  };

  if (!input.to || !hasResendConfig()) {
    console.info("[pulse:mail-stub]", JSON.stringify(payload));
    return { ok: true as const, channel: "email_stub" as const };
  }

  const resend = new Resend(getEnv("RESEND_API_KEY"));
  await resend.emails.send({
    from: getEnv("RESEND_FROM_EMAIL"),
    to: input.to,
    subject: input.subject,
    html: renderRetentionHtml(input),
    text: `${input.title}\n\n${input.body}\n\n${input.ctaUrl ?? ""}`.trim(),
  });
  return { ok: true as const, channel: "email" as const };
}
