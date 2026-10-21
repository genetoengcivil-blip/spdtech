import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Link as LinkIcon, Send, ShoppingCart } from "lucide-react";
import { buyFromSupplier } from "@/lib/supplier-purchase.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/delivery";
import { OrderTracker, StatusBadge } from "@/components/order-tracker";

export const Route = createFileRoute("/_authenticated/admin/pedido/$id")({
  component: OrderDetail,
});

const labels: Record<string, string> = { pending: "Aguardando", paid: "Pago", cancelled: "Cancelado" };

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const now = useNow();

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(title, cover_url, delivery_mode, supplier_id, supplier_product_id), inventory_items(id, content, position, delivered_at)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: purchase } = useQuery({
    queryKey: ["supplier-purchase", id],
    refetchInterval: 20000,
    queryFn: async () => (await supabase.from("supplier_purchases").select("*").eq("order_id", id).maybeSingle()).data,
  });
  const [buying, setBuying] = useState(false);
  const buy = async () => {
    setBuying(true);
    try {
      const res = await buyFromSupplier({ data: { orderId: id } });
      if (res.ok) toast.success(res.message);
      else toast.error(`Fornecedor: ${res.error}`);
    } catch {
      toast.error("Erro ao comprar no fornecedor.");
    }
    setBuying(false);
    qc.invalidateQueries({ queryKey: ["supplier-purchase", id] });
    qc.invalidateQueries({ queryKey: ["admin-order", id] });
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success(status === "paid" ? "Pagamento confirmado. Acesso liberado!" : "Pedido atualizado.");
    qc.invalidateQueries({ queryKey: ["admin-order", id] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    if (status === "paid" && order?.products?.supplier_id && order.products.supplier_product_id) await buy();
  };

  const copyLink = async () => {
    if (!order) return;
    const url = `${window.location.origin}/conta#pedido-${order.order_number}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado. Envie ao cliente."); }
    catch { toast.message(url); }
  };

  const sendItems = async () => {
    if (!order) return;
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error("Escreva ao menos um item para enviar."); return; }
    setSending(true);
    const rows = lines.map((c) => ({ product_id: order.product_id!, order_id: order.id, content: c, delivered_at: new Date().toISOString() }));
    const { error } = await supabase.from("inventory_items").insert(rows);
    if (error) { setSending(false); toast.error("Erro ao enviar."); return; }
    if (order.delivery_status !== "delivered") {
      await supabase.from("orders").update({ delivery_status: "delivered", deliver_after: new Date().toISOString() }).eq("id", id);
    }
    setSending(false);
    setContent("");
    toast.success(`${lines.length} ${lines.length === 1 ? "item enviado" : "itens enviados"} ao cliente.`);
    qc.invalidateQueries({ queryKey: ["admin-order", id] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Carregando…</p>;
  if (!order) return <p className="py-10 text-center text-muted-foreground">Pedido não encontrado.</p>;

  const items = [...(order.inventory_items ?? [])].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/pedidos"><ArrowLeft /> Voltar para Vendas</Link>
      </Button>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Pedido #{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateBR(order.created_at)}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium",
          order.status === "paid" ? "bg-success/10 text-success" : order.status === "pending" ? "bg-warning/10 text-warning" : "bg-surface text-muted-foreground")}>
          {labels[order.status] ?? order.status}
        </span>
      </div>

      <div className="mt-6 rounded-2xl bg-surface p-5">
        <div className="flex items-center gap-4">
          {order.products?.cover_url && <img src={order.products.cover_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
          <div className="flex-1">
            <p className="font-medium">{order.product_title}{order.quantity > 1 && ` × ${order.quantity}`}</p>
            <p className="text-sm text-muted-foreground">{brl(order.amount_cents)}</p>
          </div>
          <StatusBadge order={order} now={now} />
        </div>
        <OrderTracker order={order} now={now} />
        <div className="mt-4 border-t border-border pt-4 text-sm">
          <p className="font-medium">Cliente</p>
          <p className="mt-1 text-muted-foreground">{order.buyer_name} · {order.buyer_email}{order.buyer_phone ? ` · ${order.buyer_phone}` : ""}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === "pending" && (
            <>
              <Button size="sm" onClick={() => setStatus("paid")}>Confirmar Pix</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")}>Cancelar pedido</Button>
            </>
          )}
          {order.status === "paid" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")}>Cancelar e estornar</Button>
          )}
          <Button size="sm" variant="outline" onClick={copyLink}><LinkIcon /> Link de downloads</Button>
        </div>
      </div>

      {order.products?.supplier_id && order.products.supplier_product_id && (
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <h2 className="font-semibold">Compra no fornecedor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {!purchase ? "Ainda não comprado." :
              purchase.status === "delivered" ? `Entregue pelo fornecedor${purchase.external_order_id ? ` (pedido ${purchase.external_order_id})` : ""}.` :
              purchase.status === "pending" ? `Comprado${purchase.external_order_id ? ` (pedido ${purchase.external_order_id})` : ""}, aguardando o fornecedor entregar.` :
              `Falhou: ${purchase.error ?? "erro desconhecido"}`}
          </p>
          {order.status === "paid" && purchase?.status !== "delivered" && (
            <Button size="sm" className="mt-3" onClick={buy} disabled={buying}>
              <ShoppingCart /> {buying ? "Aguarde…" : purchase?.status === "pending" ? "Verificar entrega" : purchase ? "Tentar comprar de novo" : "Comprar no fornecedor"}
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-surface p-5">
        <h2 className="font-semibold">Itens entregues ({items.length}{order.quantity > 1 ? ` de ${order.quantity}` : ""})</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum item enviado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {items.map((i) => <li key={i.id} className="select-all break-all rounded-lg bg-background px-3 py-2">{i.content}</li>)}
          </ul>
        )}

        {order.status === "paid" && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-medium">Enviar produto desta venda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole abaixo o conteúdo que o cliente deve receber (código, login, link…). Um item por linha — se a compra foi de {order.quantity} {order.quantity === 1 ? "unidade" : "unidades"}, envie {order.quantity} {order.quantity === 1 ? "linha" : "linhas"}.
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={Math.min(Math.max(order.quantity, 2), 8)}
              placeholder={"exemplo: usuario@email.com : senha123"}
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" className="mt-2" onClick={sendItems} disabled={sending}>
              <Send /> {sending ? "Enviando…" : "Enviar ao cliente"}
            </Button>
          </div>
        )}
        {order.status === "pending" && (
          <p className="mt-4 text-xs text-muted-foreground">Confirme o pagamento para poder enviar o produto.</p>
        )}
      </div>
    </div>
  );
}
