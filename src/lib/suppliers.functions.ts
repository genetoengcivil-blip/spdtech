import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export type SupplierInfo = {
  id: string;
  name: string;
  api_base_url: string;
  notes: string | null;
  active: boolean;
  key_last4: string | null;
};

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupplierInfo[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSupplierKey } = await import("./suppliers.server");
    const { data } = await supabaseAdmin.from("suppliers").select("*").order("created_at");
    return Promise.all(
      (data ?? []).map(async (s) => {
        const k = await getSupplierKey(supabaseAdmin, s);
        return { id: s.id, name: s.name, api_base_url: s.api_base_url, notes: s.notes, active: s.active, key_last4: k ? k.slice(-4) : null };
      }),
    );
  });

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string | undefined; name: string; api_base_url: string; notes: string; active: boolean }) => {
    const name = String(d?.name ?? "").trim().slice(0, 100);
    const url = String(d?.api_base_url ?? "").trim().slice(0, 300);
    if (!name) throw new Error("Informe o nome");
    if (!/^https:\/\/[^\s]+$/.test(url)) throw new Error("Endereço da API deve começar com https://");
    return { id: d?.id, name, api_base_url: url, notes: String(d?.notes ?? "").slice(0, 1000), active: !!d?.active };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = { name: data.name, api_base_url: data.api_base_url, notes: data.notes || null, active: data.active };
    const { error } = data.id
      ? await context.supabase.from("suppliers").update(row).eq("id", data.id)
      : await context.supabase.from("suppliers").insert(row);
    return error ? { ok: false as const, error: "Erro ao salvar." } : { ok: true as const };
  });

export const setSupplierKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; key: string }) => {
    const key = String(d?.key ?? "").trim();
    if (key.length < 8 || key.length > 500) throw new Error("Chave inválida");
    return { id: String(d?.id ?? ""), key };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("suppliers").select("api_base_url").eq("id", data.id).single();
    if (!s) return { ok: false as const, error: "Fornecedor não encontrado." };
    const res = await fetch(`${s.api_base_url.replace(/\/+$/, "")}/products`, {
      headers: { Authorization: `Bearer ${data.key}`, Accept: "application/json" },
    }).catch(() => null);
    if (!res || !res.ok) return { ok: false as const, error: "O fornecedor recusou essa chave." };
    await supabaseAdmin
      .from("app_secrets")
      .upsert({ name: `supplier_key:${data.id}`, value: data.key, updated_at: new Date().toISOString() });
    return { ok: true as const };
  });

export const syncSupplierNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncSupplier } = await import("./suppliers.server");
    return syncSupplier(supabaseAdmin, data.id);
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: String(d?.id ?? "") }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_secrets").delete().eq("name", `supplier_key:${data.id}`);
    await supabaseAdmin.from("suppliers").delete().eq("id", data.id);
    return { ok: true as const };
  });
