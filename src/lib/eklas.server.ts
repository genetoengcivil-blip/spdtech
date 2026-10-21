import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type RawProduct = Record<string, unknown>;

function pickNumber(obj: RawProduct, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pickString(obj: RawProduct, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function getEklasKey(admin: Admin): Promise<string | null> {
  const { data } = await admin.from("app_secrets").select("value").eq("name", "eklas_api_key").maybeSingle();
  return data?.value || process.env["EKLAS_API_KEY"] || null;
}

async function log(admin: Admin, row: { ok: boolean; error?: string; item_count?: number; changes?: string[] }) {
  await admin.from("supplier_refresh_log").insert({
    ok: row.ok,
    error: row.error ?? null,
    item_count: row.item_count ?? 0,
    changes: (row.changes ?? []) as unknown as Json,
  });
}

/** Fetches the Eklas catalog, saves it, syncs linked product stock and logs the run. */
export async function syncEklas(admin: Admin, opts: { logUnchanged: boolean }) {
  const apiKey = await getEklasKey(admin);
  if (!apiKey) return { ok: false as const, error: "Chave da API não configurada." };

  let products: RawProduct[];
  try {
    const res = await fetch("https://api.eklas.dev/v1/products", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const error =
        res.status === 401 ? "Chave da API inválida ou revogada." : `Fornecedor respondeu com erro ${res.status}.`;
      await log(admin, { ok: false, error });
      return { ok: false as const, error };
    }
    const body: unknown = await res.json();
    const list = Array.isArray(body)
      ? body
      : Array.isArray((body as { products?: unknown[] })?.products)
        ? (body as { products: unknown[] }).products
        : Array.isArray((body as { data?: unknown[] })?.data)
          ? (body as { data: unknown[] }).data
          : [];
    products = list.filter((p): p is RawProduct => typeof p === "object" && p !== null);
  } catch {
    const error = "Não foi possível falar com o fornecedor agora.";
    await log(admin, { ok: false, error });
    return { ok: false as const, error };
  }

  const items = products
    .map((p) => {
      const id = pickString(p, ["id", "product_id", "uuid"]);
      if (!id) return null;
      const unlimited = p["unlimited_stock"] === true;
      return {
        external_id: id,
        name: pickString(p, ["name", "title", "product_name"]) ?? `Produto ${id}`,
        price_text: pickString(p, ["price", "price_text", "cost"]),
        stock: unlimited ? null : pickNumber(p, ["stock", "quantity", "available", "count"]),
        raw: p as unknown as Json,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  const { data: prev } = await admin.from("eklas_stock").select("external_id, stock");
  const prevMap = new Map((prev ?? []).map((r) => [r.external_id, r]));

  const changes: string[] = [];
  const changedStock: typeof items = [];
  for (const item of items) {
    const before = prevMap.get(item.external_id);
    if (!before) {
      changes.push(`Novo no fornecedor: ${item.name}`);
      changedStock.push(item);
    } else if (before.stock !== item.stock) {
      changedStock.push(item);
      if (item.stock === 0) changes.push(`Esgotou no fornecedor: ${item.name}`);
      else if (before.stock === 0 && (item.stock ?? 0) > 0) changes.push(`Voltou ao estoque: ${item.name} (${item.stock} un.)`);
      else changes.push(`Estoque alterado: ${item.name} (${before.stock ?? "∞"} → ${item.stock ?? "∞"})`);
    }
  }

  if (items.length > 0) {
    const now = new Date().toISOString();
    await admin.from("eklas_stock").upsert(items.map((i) => ({ ...i, updated_at: now })));
  }

  // Supplier stock drives the store stock of linked products
  for (const item of changedStock) {
    await admin.from("products").update({ stock_quantity: item.stock }).eq("eklas_external_id", item.external_id);
  }

  const notable = changes.filter((c) => !c.startsWith("Estoque alterado"));
  if (notable.length > 0) {
    const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      await admin.from("notifications").insert(
        admins.flatMap((a) =>
          notable.slice(0, 10).map((c) => ({ user_id: a.user_id, title: "Fornecedor", body: c, link: "/admin/fornecedores" })),
        ),
      );
    }
  }

  if (opts.logUnchanged || changes.length > 0) await log(admin, { ok: true, item_count: items.length, changes });
  return { ok: true as const, count: items.length, changes };
}
