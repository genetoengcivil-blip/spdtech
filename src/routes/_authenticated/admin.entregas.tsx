import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dateBR } from "@/lib/format";
import { countdown, deliveryState, useNow } from "@/lib/delivery";
import { StatusBadge } from "@/components/order-tracker";

export const Route = createFileRoute("/_authenticated/admin/entregas")({
  head: () => ({ meta: [{ title: "Entregas — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: Deliveries,
});

const filters = ["Todos", "Pendentes", "Entregues"] as const;

function Deliveries() {
  const now = useNow();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]>("Pendentes");
  const { data = [] } = useQuery({
    queryKey: ["admin-deliveries"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, buyer_name, buyer_email, product_title, quantity, status, delivery_status, deliver_after, created_at, inventory_items(id)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; email: string; orders: typeof data }>();
    for (const o of data) {
      const done = deliveryState(o, now).step === 2;
      if (f === "Pendentes" && done) continue;
      if (f === "Entregues" && !done) continue;
      const t = q.toLowerCase();
      if (t && !`${o.buyer_name} ${o.buyer_email} ${o.order_number}`.toLowerCase().includes(t)) continue;
      const g = m.get(o.buyer_email) ?? { name: o.buyer_name, email: o.buyer_email, orders: [] };
      g.orders.push(o);
      m.set(o.buyer_email, g);
    }
    return [...m.values()];
  }, [data, f, q, now]);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Entregas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Prazo e status de cada pedido, agrupados por cliente.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente ou pedido"
          className="h-9 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        {filters.map((x) => (
          <button key={x} onClick={() => setF(x)}
            className={`rounded-full px-4 text-sm ${f === x ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>{x}</button>
        ))}
      </div>
      {groups.length === 0 && <p className="mt-10 text-center text-muted-foreground">Nenhuma entrega aqui.</p>}
      <div className="mt-6 space-y-4">
        {groups.map((g) => (
          <div key={g.email} className="rounded-2xl bg-surface p-4">
            <p className="font-medium">{g.name}</p>
            <p className="text-xs text-muted-foreground">{g.email} · {g.orders.length} {g.orders.length === 1 ? "pedido" : "pedidos"}</p>
            <ul className="mt-3 divide-y divide-border">
              {g.orders.map((o) => {
                const left = countdown(o.deliver_after, now);
                return (
                  <li key={o.id}>
                    <Link to="/admin/pedido/$id" params={{ id: o.id }} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm"><span className="text-muted-foreground">#{o.order_number}</span> · {o.product_title}{o.quantity > 1 && ` × ${o.quantity}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateBR(o.created_at)} · {o.inventory_items?.length ?? 0}/{o.quantity} itens
                          {o.status === "paid" && o.deliver_after && ` · prazo ${new Date(o.deliver_after).toLocaleString("pt-BR")}${left ? ` (faltam ${left})` : ""}`}
                        </p>
                      </div>
                      <StatusBadge order={o} now={now} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
