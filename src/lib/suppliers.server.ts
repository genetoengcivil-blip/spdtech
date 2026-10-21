import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { getEklasKey } from "./eklas.server";

type Admin = SupabaseClient<Database>;
type Raw = Record<string, unknown>;

const pick = (o: Raw, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
};

export async function getSupplierKey(admin: Admin, supplier: { id: string; api_base_url: string }) {
  const { data } = await admin.from("app_secrets").select("value").eq("name", `supplier_key:${supplier.id}`).maybeSingle();
  if (data?.value) return data.value;
  if (supplier.api_base_url.includes("api.eklas.dev")) return getEklasKey(admin);
  return null;
}

export async function syncSupplier(admin: Admin, supplierId: string) {
  const { data: s } = await admin.from("suppliers").select("*").eq("id", supplierId).single();
  if (!s) return { ok: false as const, error: "Fornecedor não encontrado." };
  const logRow = async (row: { ok: boolean; error?: string; item_count?: number; changes?: string[] }) => {
    await admin.from("supplier_refresh_log").insert({
      supplier_id: s.id,
      supplier: s.name,
      ok: row.ok,
      error: row.error ?? null,
      item_count: row.item_count ?? 0,
      changes: (row.changes ?? []) as unknown as Json,
    });
  };
  const key = await getSupplierKey(admin, s);
  if (!key) return { ok: false as const, error: "Chave da API não configurada." };

  let list: Raw[] = [];
  try {
    const res = await fetch(`${s.api_base_url.replace(/\/+$/, "")}/products`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const error = res.status === 401 ? "Chave inválida ou revogada." : `Fornecedor respondeu com erro ${res.status}.`;
      await logRow({ ok: false, error });
      return { ok: false as const, error };
    }
    const body = (await res.json()) as unknown;
    const arr = Array.isArray(body)
      ? body
      : ((body as { products?: unknown[]; data?: unknown[] })?.products ?? (body as { data?: unknown[] })?.data ?? []);
    list = (Array.isArray(arr) ? arr : []).filter((p): p is Raw => typeof p === "object" && p !== null);
  } catch {
    const error = "Não foi possível falar com o fornecedor.";
    await logRow({ ok: false, error });
    return { ok: false as const, error };
  }

  const items = list
    .map((p) => {
      const id = pick(p, ["id", "product_id", "uuid", "sku"]);
      if (!id) return null;
      const st = pick(p, ["stock", "quantity", "available"]);
      return {
        supplier_id: s.id,
        external_id: id,
        name: pick(p, ["name", "title", "product_name"]) ?? `Produto ${id}`,
        price_text: pick(p, ["price", "price_text", "cost"]),
        stock: p["unlimited_stock"] === true ? null : st !== null && !Number.isNaN(Number(st)) ? Number(st) : null,
        raw: p as unknown as Json,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  const { data: prev } = await admin.from("supplier_products").select("external_id, stock").eq("supplier_id", s.id);
  const prevMap = new Map((prev ?? []).map((r) => [r.external_id, r.stock]));
  const changes: string[] = [];
  for (const i of items) {
    if (!prevMap.has(i.external_id)) changes.push(`Novo: ${i.name}`);
    else if (prevMap.get(i.external_id) !== i.stock) changes.push(`Estoque alterado: ${i.name} (${prevMap.get(i.external_id) ?? "∞"} → ${i.stock ?? "∞"})`);
  }
  if (items.length) await admin.from("supplier_products").upsert(items);
  const { data: linked } = await admin.from("products").select("id, supplier_product_id, stock_quantity").eq("supplier_id", s.id);
  const stockMap = new Map(items.map((i) => [i.external_id, i.stock]));
  for (const p of linked ?? []) {
    if (!p.supplier_product_id || !stockMap.has(p.supplier_product_id)) continue;
    const st = stockMap.get(p.supplier_product_id) ?? null;
    if (st !== p.stock_quantity) await admin.from("products").update({ stock_quantity: st }).eq("id", p.id);
  }
  await logRow({ ok: true, item_count: items.length, changes });
  return { ok: true as const, count: items.length, changes };
}
