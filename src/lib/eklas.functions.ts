import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type EklasStockItem = {
  external_id: string;
  name: string;
  price_text: string | null;
  stock: number | null;
  updated_at: string;
  raw: Json | null;
  in_store?: boolean;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const refreshEklasStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEklas } = await import("./eklas.server");
    return syncEklas(supabaseAdmin, { logUnchanged: true });
  });

export const getEklasStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EklasStockItem[]> => {
    await assertAdmin(context);
    const [{ data }, { data: linked }] = await Promise.all([
      context.supabase.from("eklas_stock").select("external_id, name, price_text, stock, updated_at, raw").order("name"),
      context.supabase.from("products").select("eklas_external_id").not("eklas_external_id", "is", null),
    ]);
    const set = new Set((linked ?? []).map((r: { eklas_external_id: string | null }) => r.eklas_external_id));
    return (data ?? []).map((d: EklasStockItem) => ({ ...d, in_store: set.has(d.external_id) })) as EklasStockItem[];
  });

export const getEklasKeyInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getEklasKey } = await import("./eklas.server");
    const key = await getEklasKey(supabaseAdmin);
    return { configured: !!key, last4: key ? key.slice(-4) : null };
  });

export const setEklasKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => {
    const key = String(d?.key ?? "").trim();
    if (key.length < 8 || key.length > 500) throw new Error("Chave inválida");
    return { key };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    // Test the key before saving it
    const res = await fetch("https://api.eklas.dev/v1/products", {
      headers: { Authorization: `Bearer ${data.key}`, Accept: "application/json" },
    });
    if (!res.ok) return { ok: false as const, error: res.status === 401 ? "O fornecedor recusou essa chave." : `Fornecedor respondeu com erro ${res.status}.` };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("app_secrets")
      .upsert({ name: "eklas_api_key", value: data.key, updated_at: new Date().toISOString() });
    return { ok: true as const };
  });
