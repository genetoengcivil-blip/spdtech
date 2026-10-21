import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { refreshProductStock } from "@/lib/stock-check.functions";

export const Route = createFileRoute("/_authenticated/checkout/$productId")({
  head: () => ({ meta: [{ title: "Finalizar compra — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function Checkout() {
  const { productId } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; pct: number } | null>(null);
  const applyCoupon = async () => {
    const { data } = await supabase.rpc("check_coupon", { _code: coupon });
    if (!data) { setApplied(null); toast.error("Cupom inválido ou expirado."); return; }
    setApplied({ code: coupon.trim().toUpperCase(), pct: data });
    toast.success(`Cupom aplicado: ${data}% de desconto.`);
  };
  const refresh = useServerFn(refreshProductStock);
  const { data: p } = useQuery({
    queryKey: ["checkout", productId],
    queryFn: async () => {
      await refresh({ data: { productId } }).catch(() => null);
      const prod = (await supabase.from("products").select("*").eq("id", productId).single()).data;
      if (!prod) return prod;
      const { data: reserved } = await supabase.rpc("reserved_qty", { _product: productId });
      return { ...prod, stock_quantity: prod.stock_quantity === null ? null : Math.max(0, prod.stock_quantity - (reserved ?? 0)) };
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({ product_id: productId, buyer_name: name, buyer_phone: phone, quantity: qty, coupon_code: applied?.code ?? null, buyer_email: session.user.email ?? "", user_id: session.user.id })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message.includes("Estoque") ? "Estoque insuficiente para essa quantidade." : error?.message.includes("Cupom") ? "Cupom inválido." : "Não foi possível criar o pedido."); return; }
    navigate({ to: "/pedido/$id", params: { id: data.id } });
  };

  const maxQty = Math.min(50, p?.stock_quantity ?? 50);
  if (!p) return <div className="py-32 text-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <h1 className="text-3xl font-semibold">Finalizar compra</h1>
      <div className="mt-8 flex items-center gap-4 rounded-2xl bg-surface p-4">
        {p.cover_url && <img src={p.cover_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
        <div className="flex-1">
          <p className="font-medium">{p.title}</p>
          <p className="text-sm text-muted-foreground">{brl(p.price_cents)}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input required placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        <Input required type="tel" inputMode="tel" placeholder="WhatsApp / telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
        <Input disabled value={session?.user.email ?? ""} className="h-11 rounded-xl" />
        <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-2">
          <span className="text-sm">Quantidade</span>
          <div className="flex items-center gap-3">
            <Button type="button" size="icon" variant="ghost" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</Button>
            <span className="w-6 text-center font-medium">{qty}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Aumentar">+</Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Cupom de desconto" value={coupon} onChange={(e) => { setCoupon(e.target.value); setApplied(null); }} className="h-11 rounded-xl uppercase" />
          <Button type="button" variant="outline" className="h-11" onClick={applyCoupon} disabled={!coupon.trim()}>Aplicar</Button>
        </div>
        {applied && <p className="text-sm text-success">Desconto de {applied.pct}%: −{brl(Math.round(p.price_cents * qty * applied.pct / 100))}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || p.stock_quantity === 0}>{p.stock_quantity === 0 && "Esgotado no momento — "}
          Gerar Pix de {brl(p.price_cents * qty - (applied ? Math.round(p.price_cents * qty * applied.pct / 100) : 0))}
        </Button>
      </form>
    </div>
  );
}
