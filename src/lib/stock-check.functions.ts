import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Asks the product's supplier for fresh stock right before checkout. */
export const refreshProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d?.productId ?? "")) throw new Error("Produto inválido");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("products")
      .select("supplier_id, eklas_external_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!p) return { ok: false };
    try {
      if (p.supplier_id) {
        const { syncSupplier } = await import("./suppliers.server");
        await syncSupplier(supabaseAdmin, p.supplier_id);
      } else if (p.eklas_external_id) {
        const { syncEklas } = await import("./eklas.server");
        await syncEklas(supabaseAdmin, { logUnchanged: false });
      }
    } catch {
      return { ok: false };
    }
    return { ok: true };
  });
