import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/eklas-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("app_secrets").select("value").eq("name", "cron_token").maybeSingle();
        if (!data?.value || data.value !== token) return new Response("Unauthorized", { status: 401 });
        const { syncEklas } = await import("@/lib/eklas.server");
        const res = await syncEklas(supabaseAdmin, { logUnchanged: false });
        const { syncSupplier } = await import("@/lib/suppliers.server");
        const { data: sups } = await supabaseAdmin.from("suppliers").select("id").eq("active", true);
        for (const sp of sups ?? []) await syncSupplier(supabaseAdmin, sp.id).catch(() => null);
        return Response.json({ ok: res.ok });
      },
    },
  },
});
