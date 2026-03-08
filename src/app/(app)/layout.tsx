import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PushBootstrap } from "@/components/notifications/PushBootstrap";
import { isAdminEmail } from "@/lib/admin/guard";

export default async function AppLayout({ children }: PropsWithChildren) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");
  const isAdmin = isAdminEmail(data.user.email);

  return (
    <>
      <PushBootstrap />
      <AppShell userEmail={data.user.email} isAdmin={isAdmin}>
        {children}
      </AppShell>
    </>
  );
}

