import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  listSuppliers,
  saveSupplier,
  setSupplierKey,
  syncSupplierNow,
  deleteSupplier,
  type SupplierInfo,
} from "@/lib/suppliers.functions";

export const Route = createFileRoute("/_authenticated/admin/gestao-fornecedores")({
  component: SupplierAdmin,
});

type Form = { id?: string; name: string; api_base_url: string; notes: string; active: boolean };

function SupplierAdmin() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery<SupplierInfo[]>({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const current = suppliers.find((s) => s.id === sel) ?? suppliers[0];

  const { data: catalog = [] } = useQuery({
    queryKey: ["supplier-products", current?.id],
    enabled: !!current,
    queryFn: async () =>
      (await supabase.from("supplier_products").select("external_id, name, price_text, stock").eq("supplier_id", current!.id).order("name")).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["supplier-history", current?.id],
    enabled: !!current,
    queryFn: async () =>
      (await supabase.from("supplier_refresh_log").select("*").eq("supplier_id", current!.id).order("created_at", { ascending: false }).limit(3)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel("suppliers-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplier_products" }, () =>
        qc.invalidateQueries({ queryKey: ["supplier-products"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "supplier_refresh_log" }, () =>
        qc.invalidateQueries({ queryKey: ["supplier-history"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      const res = await saveSupplier({ data: form });
      if (res.ok) {
        toast.success("Fornecedor salvo.");
        setForm(null);
        qc.invalidateQueries({ queryKey: ["suppliers"] });
      } else toast.error(res.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  };

  const saveKey = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await setSupplierKey({ data: { id: current.id, key } });
      if (res.ok) {
        toast.success("Chave trocada e testada.");
        setKey("");
        qc.invalidateQueries({ queryKey: ["suppliers"] });
      } else toast.error(res.error);
    } catch {
      toast.error("Chave inválida.");
    }
    setBusy(false);
  };

  const sync = async () => {
    if (!current) return;
    setBusy(true);
    const res = await syncSupplierNow({ data: { id: current.id } }).catch(() => null);
    if (res?.ok) toast.success(`Catálogo atualizado: ${res.count} produtos.`);
    else toast.error(res?.error ?? "Falha ao consultar.");
    setBusy(false);
  };

  const remove = async (s: SupplierInfo) => {
    if (!confirm(`Excluir o fornecedor ${s.name}, com catálogo e histórico?`)) return;
    await deleteSupplier({ data: { id: s.id } });
    setSel(null);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Gestão de fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cada fornecedor com sua chave, catálogo e histórico.</p>
        </div>
        <Button onClick={() => setForm({ name: "", api_base_url: "https://", notes: "", active: true })}>
          <Plus /> Novo fornecedor
        </Button>
      </div>

      <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5">
        {suppliers.map((s) => (
          <button
            key={s.id}
            onClick={() => setSel(s.id)}
            className={cn("shrink-0 rounded-full px-4 py-2 text-sm", current?.id === s.id ? "bg-primary text-primary-foreground" : "bg-surface")}
          >
            {s.name}
            {!s.active && " (inativo)"}
          </button>
        ))}
      </div>

      {current && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{current.name}</p>
                  <p className="break-all text-xs text-muted-foreground">{current.api_base_url}</p>
                  {current.notes && <p className="mt-2 text-sm text-muted-foreground">{current.notes}</p>}
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ ...current, notes: current.notes ?? "" })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(current)}><Trash2 /></Button>
                </div>
              </div>
              <Button className="mt-4" size="sm" onClick={sync} disabled={busy}>
                <RefreshCw className={busy ? "animate-spin" : ""} /> Consultar catálogo
              </Button>
            </div>
            <div className="rounded-3xl bg-surface p-5">
              <p className="text-xs text-muted-foreground">Chave da API</p>
              <p className="mt-1 font-semibold">{current.key_last4 ? `•••• ${current.key_last4}` : "Não configurada"}</p>
              <div className="mt-3 flex gap-2">
                <Input type="password" placeholder="Nova chave" value={key} onChange={(e) => setKey(e.target.value)} className="bg-background" />
                <Button onClick={saveKey} disabled={busy || key.length < 8}>Trocar</Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-surface p-5">
            <h2 className="font-semibold">Histórico (últimas 3)</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma consulta ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {history.map((h) => {
                  const ch = Array.isArray(h.changes) ? (h.changes as string[]) : [];
                  return (
                    <li key={h.id}>
                      <span className="font-medium">{new Date(h.created_at).toLocaleString("pt-BR")}</span> ·{" "}
                      {h.ok ? `${h.item_count} produtos · ${ch.length} mudança(s)` : <span className="text-destructive">{h.error}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Catálogo ({catalog.length})</h2>
            <div className="mt-3 space-y-2">
              {catalog.map((c) => {
                const out = c.stock !== null && c.stock <= 0;
                return (
                  <div key={c.external_id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">#{c.external_id}{c.price_text && ` · ${c.price_text}`}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", out ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground")}>
                      {c.stock === null ? "Ilimitado" : out ? "Esgotado" : `${c.stock} un.`}
                    </span>
                  </div>
                );
              })}
              {catalog.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Toque em "Consultar catálogo" para carregar.</p>}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader><DialogTitle>{form?.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5"><Label>Nome</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Endereço da API</Label>
                <Input required value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} />
                <p className="text-xs text-muted-foreground">Precisa responder a lista de produtos em /products, no mesmo formato da Eklas.</p>
              </div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Ativo</label>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
