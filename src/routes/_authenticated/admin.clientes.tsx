import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Mail, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  component: Customers,
});

const labels: Record<string, string> = { pending: "Aguardando", paid: "Pago", cancelled: "Cancelado" };

type Order = {
  id: string;
  user_id: string;
  order_number: number;
  product_title: string;
  amount_cents: number;
  status: string;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
};

function Customers() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", "customers"],
    queryFn: async () =>
      ((await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? []) as Order[],
  });

  const customers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; phone: string | null; orders: Order[]; spent: number; last: string }>();
    for (const o of orders) {
      let c = map.get(o.user_id);
      if (!c) {
        c = { id: o.user_id, name: o.buyer_name, email: o.buyer_email, phone: o.buyer_phone, orders: [], spent: 0, last: o.created_at };
        map.set(o.user_id, c);
      }
      if (!c.phone && o.buyer_phone) c.phone = o.buyer_phone;
      c.orders.push(o);
      if (o.status === "paid") c.spent += o.amount_cents;
    }
    const term = q.trim().toLowerCase();
    return [...map.values()].filter(
      (c) => !term || [c.name, c.email, c.phone ?? ""].some((v) => v.toLowerCase().includes(term)),
    );
  }, [orders, q]);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">{customers.length} cliente(s) com pedidos.</p>
      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-6 space-y-3">
        {customers.map((c) => {
          const paid = c.orders.filter((o) => o.status === "paid").length;
          return (
            <div key={c.id} className="rounded-2xl bg-surface p-4">
              <button type="button" className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone ?? "—"}</span>
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{brl(c.spent)}</p>
                  <p className="text-xs text-muted-foreground">{paid} compra(s) paga(s)</p>
                </div>
              </button>
              {open === c.id && (
                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {c.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>#{o.order_number} · {o.product_title}</span>
                      <span className="text-muted-foreground">
                        {dateBR(o.created_at)} · {brl(o.amount_cents)} ·{" "}
                        <span className={cn(o.status === "paid" ? "text-success" : o.status === "pending" ? "text-warning" : "")}>
                          {labels[o.status] ?? o.status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {customers.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhum cliente ainda.</p>}
      </div>
    </div>
  );
}
