import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const paid = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status === "pending");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const month = paid.filter((o) => new Date(o.paid_at ?? o.created_at) >= monthStart);

  // últimos 14 dias
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    const total = paid
      .filter((o) => new Date(o.paid_at ?? o.created_at).toDateString() === d.toDateString())
      .reduce((s, o) => s + o.amount_cents, 0);
    return { d, total };
  });
  const max = Math.max(1, ...days.map((x) => x.total));

  const stats = [
    { l: "Faturamento total", v: brl(paid.reduce((s, o) => s + o.amount_cents, 0)) },
    { l: "Este mês", v: brl(month.reduce((s, o) => s + o.amount_cents, 0)) },
    { l: "Vendas pagas", v: String(paid.length) },
    { l: "Aguardando Pix", v: String(pending.length) },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold">Visão geral</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-3xl bg-surface p-6">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className="mt-2 text-2xl font-semibold">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-6">
        <p className="text-sm font-medium">Vendas — últimos 14 dias</p>
        <div className="mt-6 flex h-40 items-end gap-1.5">
          {days.map(({ d, total }) => (
            <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-md bg-primary/80 transition-all"
                style={{ height: `${Math.max(2, (total / max) * 100)}%` }}
                title={`${d.toLocaleDateString("pt-BR")}: ${brl(total)}`}
              />
              <span className="text-[10px] text-muted-foreground">{d.getDate()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Pedidos aguardando confirmação</p>
          <Link to="/admin/pedidos" className="text-sm text-primary">Ver todos ›</Link>
        </div>
        <div className="mt-4 divide-y divide-border">
          {pending.slice(0, 5).map((o) => (
            <div key={o.id} className="flex justify-between py-3 text-sm">
              <span>#{o.order_number} · {o.buyer_name} · {o.product_title}</span>
              <span className="text-muted-foreground">{brl(o.amount_cents)} · {dateBR(o.created_at)}</span>
            </div>
          ))}
          {pending.length === 0 && <p className="py-3 text-sm text-muted-foreground">Nada pendente.</p>}
        </div>
      </div>
    </div>
  );
}
