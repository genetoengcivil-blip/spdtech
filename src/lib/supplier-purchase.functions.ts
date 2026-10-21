import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type Raw = Record<string, unknown>;

function itemsFrom(body: Raw): string[] {
  const arr = Array.isArray(body["delivered_items"]) ? (body["delivered_items"] as unknown[]) : [];
  const items = arr
    .map((i) => (typeof i === "string" ? i : i && typeof i === "object" ? String((i as Raw)["content"] ?? JSON.stringify(i)) : String(i ?? "")))
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length) return items;
  const c = typeof body["delivered_content"] === "string" ? (body["delivered_content"] as string) : "";
  return c.split("\n").map((s) => s.trim()).filter(Boolean);
}

export const buyFromSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => ({ orderId: String(d?.orderId ?? "").slice(0, 64) }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { getSupplierKey } = await import("./suppliers.server");

    const { data: order } = await db.from("orders").select("*").eq("id", data.orderId).single();
    if (!order || order.status !== "paid") return { ok: false as const, error: "O pedido precisa estar pago." };
    const { data: product } = await db.from("products").select("id, supplier_id, supplier_product_id").eq("id", order.product_id!).single();
    if (!product?.supplier_id || !product.supplier_product_id) return { ok: false as const, error: "Produto sem fornecedor vinculado." };
    const { data: s } = await db.from("suppliers").select("*").eq("id", product.supplier_id).single();
    if (!s) return { ok: false as const, error: "Fornecedor não encontrado." };
    const key = await getSupplierKey(db, s);
    if (!key) return { ok: false as const, error: "Chave do fornecedor não configurada." };

    const { data: prev } = await db.from("supplier_purchases").select("*").eq("order_id", order.id).maybeSingle();
    if (prev?.status === "delivered") return { ok: true as const, status: "delivered", message: "Já entregue." };

    const base = s.api_base_url.replace(/\/+$/, "");
    const headers = { Authorization: `Bearer ${key}`, "X-API-Key": key, Accept: "application/json", "Content-Type": "application/json" };
    let body: Raw;
    let status = 0;
    try {
      const res = prev?.external_order_id
        ? await fetch(`${base}/order/${encodeURIComponent(prev.external_order_id)}`, { headers })
        : await fetch(`${base}/purchase`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              product_id: product.supplier_product_id,
              quantity: order.quantity,
              client_order_id: order.id,
              emails: Array(order.quantity).fill(order.buyer_email),
            }),
          });
      status = res.status;
      body = ((await res.json().catch(() => ({}))) ?? {}) as Raw;
    } catch {
      return { ok: false as const, error: "Não foi possível falar com o fornecedor." };
    }

    const errObj = body["error"];
    const errMsg = typeof errObj === "string" ? errObj : errObj && typeof errObj === "object" ? String((errObj as Raw)["message"] ?? "") : "";
    const failed = status >= 400 || body["success"] === false;
    const extId = body["order_id"] != null ? String(body["order_id"]) : prev?.external_order_id ?? null;
    const items = failed ? [] : itemsFrom(body);
    const newStatus = failed ? (prev?.external_order_id ? "pending" : "failed") : items.length ? "delivered" : "pending";
    const error = failed ? errMsg || `Fornecedor respondeu com erro ${status}.` : null;

    const row = {
      order_id: order.id,
      supplier_id: s.id,
      external_order_id: extId,
      status: newStatus,
      error,
      raw: body as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    if (prev) await db.from("supplier_purchases").update(row).eq("id", prev.id);
    else await db.from("supplier_purchases").insert(row);

    if (items.length) {
      const now = new Date().toISOString();
      await db.from("inventory_items").insert(items.map((c) => ({ product_id: product.id, order_id: order.id, content: c, delivered_at: now })));
      await db.from("orders").update({ delivery_status: "delivered", deliver_after: now }).eq("id", order.id);
    }

    if (failed) return { ok: false as const, error: error! };
    return {
      ok: true as const,
      status: newStatus,
      message: items.length ? `${items.length} item(ns) recebido(s) e enviado(s) ao cliente.` : "Compra feita. O fornecedor ainda vai entregar — toque em Verificar entrega mais tarde.",
    };
  });
