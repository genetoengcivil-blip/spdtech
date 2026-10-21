import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: Orders,
});

const labels: Record<string, string> = { pending: "Aguardando", paid: "Pago", cancelled: "Cancelado" };

function deliveryLabel(o: { delivery_status: string; deliver_after: string | null }) {
  if (o.delivery_status === "awaiting_stock") return "Aguardando estoque — cadastre itens na aba Estoque";
  if (o.delivery_status === "manual") return "Manual (arquivo/link)";
  if (o.delivery_status === "delivered")
    return o.deliver_after && new Date(o.deliver_after) > new Date()
      ? `Agendada para ${new Date(o.deliver_after).toLocaleString("pt-BR")}`
      : "Entregue";
  return "Pendente";
}

function Orders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*, inventory_items(content, position)").order("created_at", { ascending: false })).data ?? [],
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success(status === "paid" ? "Pagamento confirmado. Acesso liberado!" : "Pedido atualizado.");
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const copyLink = async (n: number) => {
    const url = `${window.location.origin}/conta#pedido-${n}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado. Envie ao cliente."); }
    catch { toast.message(url); }
  };

  const list = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Vendas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confira o Pix no seu banco e confirme o pedido para liberar o acesso ao cliente.
      </p>
      <div className="mt-6 flex gap-2">
        {["all", "pending", "paid", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full px-4 py-1.5 text-sm", filter === f ? "bg-secondary text-secondary-foreground" : "bg-surface")}
          >
            {f === "all" ? "Todos" : labels[f]}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {list.map((o) => (
          <div key={o.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-medium">#{o.order_number} · {o.product_title}{o.quantity > 1 && ` × ${o.quantity}`}</p>
              <p className="text-sm">{brl(o.amount_cents)} · <span className="text-muted-foreground">{dateBR(o.created_at)}</span></p>
              <p className="text-xs text-muted-foreground">{o.buyer_name} · {o.buyer_email}</p>
              {o.status === "paid" && (
                <p className="mt-1 text-xs">
                  Entrega: <span className={o.delivery_status === "awaiting_stock" ? "text-destructive" : "text-success"}>{deliveryLabel(o)}</span>
                </p>
              )}
              {o.inventory_items?.length > 0 && (
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Itens entregues ({o.inventory_items.length})</summary>
                  <ul className="mt-1 font-mono">{[...o.inventory_items].sort((a, b) => a.position - b.position).map((i) => <li key={i.position}>{i.content}</li>)}</ul>
                </details>
              )}
            </div>
            <span className={cn("text-xs font-medium", o.status === "paid" ? "text-success" : o.status === "pending" ? "text-warning" : "text-muted-foreground")}>
              {labels[o.status] ?? o.status}
            </span>
            <Button size="sm" variant="outline" onClick={() => copyLink(o.order_number)}>
              <LinkIcon /> Link de downloads
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/admin/pedido/$id" params={{ id: o.id }}>Abrir</Link>
            </Button>
            {o.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setStatus(o.id, "paid")}>Confirmar Pix</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "cancelled")}>Cancelar</Button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhum pedido.</p>}
      </div>
    </div>
  );
}
