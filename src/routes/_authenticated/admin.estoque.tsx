import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  component: OwnStock,
});

const MODE: Record<string, string> = { manual: "Entrega manual", auto: "Entrega automática", delayed: "Entrega com prazo" };

function OwnStock() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [itemsFor, setItemsFor] = useState<{ id: string; title: string } | null>(null);
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products", "stock"],
    queryFn: async () =>
      (await supabase
        .from("products")
        .select("id, title, stock_quantity, sold_count, active, delivery_mode, delivery_delay_minutes")
        .order("title")).data ?? [],
  });

  const save = async (id: string) => {
    const v = draft[id] ?? "";
    const { error } = await supabase.from("products").update({ stock_quantity: v === "" ? null : Number(v) }).eq("id", id);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Estoque salvo.");
    setDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    qc.invalidateQueries();
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">Estoque</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Produtos de entrega manual: defina a quantidade (vazio = ilimitado). Produtos de entrega automática: cadastre os
        itens; cada unidade vendida recebe um item, na ordem cadastrada.
      </p>
      <div className="mt-6 space-y-3">
        {products.map((p) => {
          const out = p.stock_quantity !== null && p.stock_quantity <= 0;
          const auto = p.delivery_mode !== "manual";
          const value = draft[p.id] ?? (p.stock_quantity === null ? "" : String(p.stock_quantity));
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {MODE[p.delivery_mode]}
                  {p.delivery_mode === "delayed" && ` (${p.delivery_delay_minutes} min)`} · {p.sold_count} vendidos
                  {!p.active && " · Oculto"}
                </p>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-medium", out ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground")}>
                {p.stock_quantity === null ? "Ilimitado" : out ? "Esgotado" : `${p.stock_quantity} un.`}
              </span>
              {auto ? (
                <Button size="sm" variant="outline" onClick={() => setItemsFor({ id: p.id, title: p.title })}>Itens</Button>
              ) : (
                <>
                  <Input className="w-24" inputMode="numeric" placeholder="∞" value={value} onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value.replace(/\D/g, "") })} />
                  <Button size="sm" disabled={!(p.id in draft)} onClick={() => save(p.id)}>Salvar</Button>
                </>
              )}
            </div>
          );
        })}
        {products.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhum produto cadastrado.</p>}
      </div>
      <ItemsDialog product={itemsFor} onClose={() => setItemsFor(null)} />
    </div>
  );
}

function ItemsDialog({ product, onClose }: { product: { id: string; title: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["inventory", product?.id],
    enabled: !!product,
    queryFn: async () =>
      (await supabase
        .from("inventory_items")
        .select("id, content, position, order_id, delivered_at, orders(order_number, buyer_name)")
        .eq("product_id", product!.id)
        .order("position")).data ?? [],
  });

  const add = async () => {
    if (!product) return;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 1000);
    if (!lines.length) return;
    setBusy(true);
    const { error } = await supabase.from("inventory_items").insert(lines.map((content) => ({ product_id: product.id, content })));
    setBusy(false);
    if (error) { toast.error("Erro ao adicionar itens."); return; }
    toast.success(`${lines.length} item(ns) adicionado(s).`);
    setText("");
    qc.invalidateQueries();
  };

  const remove = async (id: string) => {
    await supabase.from("inventory_items").delete().eq("id", id);
    qc.invalidateQueries();
  };

  const available = items.filter((i) => !i.order_id);
  const used = items.filter((i) => i.order_id);

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Itens · {product?.title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Textarea rows={5} placeholder={"Um item por linha (código, chave, login...)\nAAAA-BBBB-CCCC\nDDDD-EEEE-FFFF"} value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="w-full" onClick={add} disabled={busy || !text.trim()}>Adicionar ao estoque</Button>
        </div>
        <div>
          <p className="text-sm font-medium">Disponíveis ({available.length}) — entregues nesta ordem</p>
          <ol className="mt-2 space-y-1 text-sm">
            {available.map((i, idx) => (
              <li key={i.id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="w-6 text-xs text-muted-foreground">{idx + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{i.content}</span>
                <button onClick={() => remove(i.id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
        </div>
        {used.length > 0 && (
          <div>
            <p className="text-sm font-medium">Entregues ({used.length})</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {used.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                  <span className="truncate font-mono">{i.content}</span>
                  <span className="shrink-0">Pedido #{i.orders?.order_number} · {i.orders?.buyer_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
