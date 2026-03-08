export type WeeklyMailInput = {
  userId: string;
  to: string | null;
  subject: string;
  body: string;
  weekKey: string;
};

export async function sendWeeklyMailStub(input: WeeklyMailInput) {
  const payload = {
    channel: "email_stub",
    userId: input.userId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    weekKey: input.weekKey,
  };

  console.info("[pulse:mail-stub]", JSON.stringify(payload));
  return { ok: true as const };
}
