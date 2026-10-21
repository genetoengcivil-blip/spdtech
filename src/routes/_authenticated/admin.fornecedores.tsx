import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RefreshCw, PackageX, PackageCheck, Store, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery } from "@/lib/queries";
import { slugify } from "@/lib/format";
import { getEklasStock, refreshEklasStock, getEklasKeyInfo, setEklasKey, type EklasStockItem } from "@/lib/eklas.functions";
import { supplierTextPt, DELIVERY_PT, TYPE_PT } from "@/lib/supplier-text";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({
  component: Fornecedores,
});

// Rótulos em português para os campos conhecidos do fornecedor
const FIELD_LABELS: Record<string, string> = {
  id: "Código",
  product_id: "Código",
  uuid: "Código",
  name: "Nome",
  title: "Nome",
  product_name: "Nome",
  price: "Preço de custo",
  price_text: "Preço de custo",
  cost: "Preço de custo",
  stock: "Quantidade em estoque",
  quantity: "Quantidade em estoque",
  available: "Disponíveis",
  count: "Quantidade",
  in_stock: "Em estoque",
  description: "Descrição",
  category: "Categoria",
  image: "Imagem",
  image_url: "Imagem",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  delivery: "Entrega",
  type: "Tipo",
  max_quantity: "Máximo por pedido",
  unlimited_stock: "Estoque ilimitado",
  currency: "Moeda",
};

function labelFor(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

type AddForm = {
  external_id: string;
  title: string;
  price: string;
  category_id: string;
  description: string;
  install: string;
  stock: string;
  cover_url: string;
};

function Fornecedores() {
  const [sel, setSel] = useState("eklas");
  const { data: sups = [] } = useQuery({
    queryKey: ["supplier-options-full"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name, api_base_url").order("name")).data ?? [],
  });
  return (
    <div>
      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5">
        {[{ id: "eklas", name: "Eklas" }, ...sups.filter((x) => !x.api_base_url.includes("api.eklas.dev"))].map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)}
            className={cn("shrink-0 rounded-full px-4 py-2 text-sm", sel === x.id ? "bg-primary text-primary-foreground" : "bg-surface")}>
            {x.name}
          </button>
        ))}
      </div>
      {sel === "eklas" ? <Stock /> : <SupplierPanel id={sel} name={sups.find((x) => x.id === sel)?.name ?? ""} />}
    </div>
  );
}

type SupItem = { external_id: string; name: string; price_text: string | null; stock: number | null; raw: unknown; updated_at: string };

function SupplierPanel({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [selected, setSelected] = useState<SupItem | null>(null);
  const [addForm, setAddForm] = useState<AddForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: catalog = [] } = useQuery({
    queryKey: ["supplier-products", id],
    queryFn: async () => ((await supabase.from("supplier_products").select("external_id, name, price_text, stock, raw, updated_at").eq("supplier_id", id).order("name")).data ?? []) as SupItem[],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["supplier-history", id],
    queryFn: async () => (await supabase.from("supplier_refresh_log").select("*").eq("supplier_id", id).order("created_at", { ascending: false }).limit(3)).data ?? [],
  });
  const { data: linked = [] } = useQuery({
    queryKey: ["supplier-linked", id],
    queryFn: async () => (await supabase.from("products").select("title, supplier_product_id").eq("supplier_id", id)).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel(`sup-panel-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplier_products" }, () => qc.invalidateQueries({ queryKey: ["supplier-products", id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "supplier_refresh_log" }, () => qc.invalidateQueries({ queryKey: ["supplier-history", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, id]);
  const inStore = new Map(linked.map((l) => [l.supplier_product_id, l.title]));

  const openAdd = (item: SupItem) => {
    if (inStore.has(item.external_id)) return;
    const n = item.price_text ? parseFloat(item.price_text.replace(/[^\d.,-]/g, "").replace(",", ".")) : NaN;
    setAddForm({
      external_id: item.external_id,
      title: item.name,
      price: Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "",
      category_id: "",
      description: supplierTextPt(((item.raw ?? {}) as Record<string, unknown>)["description"]),
      install: "",
      stock: item.stock === null ? "" : String(item.stock),
      cover_url: "",
    });
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) toast.error("Falha no envio da imagem.");
    else {
      const { data } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data) setAddForm((f) => f && { ...f, cover_url: data.signedUrl });
    }
    setSaving(false);
  };

  const saveToStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm) return;
    setSaving(true);
    const { data: created, error } = await supabase.from("products").insert({
      title: addForm.title,
      slug: slugify(addForm.title),
      description: addForm.description || null,
      price_cents: Math.round(parseFloat(addForm.price.replace(/\./g, "").replace(",", ".")) * 100) || 0,
      category_id: addForm.category_id || null,
      active: true,
      featured: false,
      delivery_mode: "manual",
      supplier_id: id,
      supplier_product_id: addForm.external_id,
      stock_quantity: addForm.stock === "" ? null : Number(addForm.stock),
      cover_url: addForm.cover_url || null,
    }).select("id").single();
    if (!error && created && addForm.install) {
      await supabase.from("product_assets").upsert({ product_id: created.id, install_instructions: addForm.install });
    }
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "Já existe um produto com esse nome." : "Erro ao adicionar."); return; }
    toast.success("Produto adicionado à loja. Ao confirmar o Pix, ele é comprado neste fornecedor.");
    setAddForm(null);
    setSelected(null);
    qc.invalidateQueries();
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">{name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualiza sozinho a cada 5 minutos · {catalog.length} produtos · {linked.length} na sua loja. O estoque dos produtos da loja acompanha o do fornecedor.</p>
      <div className="mt-6 rounded-3xl bg-surface p-5">
        <h2 className="font-semibold">Últimas 3 atualizações</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhuma atualização ainda.</p> : (
          <ul className="mt-3 space-y-3 text-sm">
            {history.map((h) => {
              const ch = Array.isArray(h.changes) ? (h.changes as string[]) : [];
              return (
                <li key={h.id}>
                  <p><span className="font-medium">{new Date(h.created_at).toLocaleString("pt-BR")}</span> · {h.ok ? `${h.item_count} produtos · ${ch.length} mudança(s)` : <span className="text-destructive">{h.error}</span>}</p>
                  {ch.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted-foreground">
                      {ch.slice(0, 30).map((c, i) => <li key={i}>• {c}</li>)}
                      {ch.length > 30 && <li>… e mais {ch.length - 30}</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <h2 className="mt-8 text-lg font-semibold">Catálogo ({catalog.length})</h2>
      <div className="mt-3 space-y-2">
        {catalog.map((c) => {
          const out = c.stock !== null && c.stock <= 0;
          const added = inStore.has(c.external_id);
          return (
            <div key={c.external_id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(c)}>
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">#{c.external_id}{c.price_text && ` · ${c.price_text}`} · {c.stock === null ? "Ilimitado" : out ? "Esgotado" : `${c.stock} un.`}</p>
              </button>
              {added ? (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success"><Check className="h-3 w-3" /> Na loja</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => openAdd(c)}><Store /> Adicionar</Button>
              )}
            </div>
          );
        })}
        {catalog.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Catálogo ainda não carregado. Configure a chave em Gestão de fornecedores.</p>}
      </div>

      <Dialog open={!!selected && !addForm} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">Código</dt><dd className="font-medium">#{selected.external_id}</dd></div>
                <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">Estoque</dt><dd className="font-medium">{selected.stock === null ? "Ilimitado" : selected.stock <= 0 ? "Esgotado" : `${selected.stock} unidades`}</dd></div>
                {selected.price_text && <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">Preço de custo</dt><dd className="font-medium">{selected.price_text}</dd></div>}
                <div className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">Atualizado em</dt><dd className="font-medium">{new Date(selected.updated_at).toLocaleString("pt-BR")}</dd></div>
                {Object.entries((selected.raw ?? {}) as Record<string, unknown>)
                  .filter(([k, v]) => v !== null && typeof v !== "object" && !["id", "_id", "product_id", "uuid", "name", "title", "product_name", "price", "price_text", "cost", "stock", "quantity", "available", "description"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">{labelFor(k)}</dt><dd className="max-w-[60%] truncate text-right font-medium">{formatValue(v)}</dd></div>
                  ))}
              </dl>
              {supplierTextPt(((selected.raw ?? {}) as Record<string, unknown>)["description"]) && (
                <div className="rounded-2xl bg-surface p-4 text-sm">
                  <p className="font-medium">Descrição</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{supplierTextPt(((selected.raw ?? {}) as Record<string, unknown>)["description"])}</p>
                </div>
              )}
              <Button className="w-full" onClick={() => openAdd(selected)} disabled={inStore.has(selected.external_id)}>
                {inStore.has(selected.external_id) ? <><Check /> Já está na loja</> : <><Store /> Adicionar à loja</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!addForm} onOpenChange={(o) => !o && setAddForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader><DialogTitle>Adicionar à loja</DialogTitle></DialogHeader>
          {addForm && (
            <form onSubmit={saveToStore} className="space-y-4">
              <div className="space-y-1.5"><Label>Nome</Label><Input required value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Imagem de capa</Label>
                <div className="flex items-center gap-3">
                  {addForm.cover_url && <img src={addForm.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <Input type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files?.[0])} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Preço de venda (R$)</Label><Input required inputMode="decimal" placeholder="97,00" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <select value={addForm.category_id} onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Sem categoria</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={5} value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Orientações de instalação</Label><Textarea rows={5} placeholder="Passo a passo que o cliente vê após o pagamento" value={addForm.install} onChange={(e) => setAddForm({ ...addForm, install: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">O estoque segue o do fornecedor automaticamente.</p>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Aguarde…" : "Adicionar produto"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stock() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<EklasStockItem | null>(null);
  const [addForm, setAddForm] = useState<AddForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: items = [] } = useQuery<EklasStockItem[]>({
    queryKey: ["eklas-stock"],
    queryFn: () => getEklasStock() as Promise<EklasStockItem[]>,
  });
  const { data: keyInfo } = useQuery({ queryKey: ["eklas-key"], queryFn: () => getEklasKeyInfo() });
  const [newKey, setNewKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    try {
      const res = await setEklasKey({ data: { key: newKey } });
      if (res.ok) {
        toast.success("Chave trocada e testada com sucesso.");
        setNewKey("");
        qc.invalidateQueries({ queryKey: ["eklas-key"] });
      } else toast.error(res.error);
    } catch {
      toast.error("Chave inválida.");
    }
    setSavingKey(false);
  };

  // Live updates: catalog and history refresh without reloading
  useEffect(() => {
    const channel = supabase
      .channel("supplier-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "eklas_stock" }, () =>
        qc.invalidateQueries({ queryKey: ["eklas-stock"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "supplier_refresh_log" }, () =>
        qc.invalidateQueries({ queryKey: ["supplier-log"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: history = [] } = useQuery({
    queryKey: ["supplier-log"],
    queryFn: async () =>
      (await supabase.from("supplier_refresh_log").select("*").is("supplier_id", null).order("created_at", { ascending: false }).limit(3)).data ?? [],
  });

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await refreshEklasStock();
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(
          res.changes.length > 0
            ? `Catálogo consultado. ${res.changes.length} novidade(s).`
            : "Catálogo consultado, sem mudanças.",
        );
        qc.invalidateQueries({ queryKey: ["eklas-stock"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    } catch {
      toast.error("Falha ao consultar o fornecedor.");
    }
    qc.invalidateQueries({ queryKey: ["supplier-log"] });
    setBusy(false);
  };

  const openAdd = (item: EklasStockItem) => {
    if (item.in_store) return;
    const priceNumber = item.price_text
      ? parseFloat(item.price_text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."))
      : NaN;
    const raw = (item.raw ?? {}) as Record<string, unknown>;
    const rawDesc = supplierTextPt(raw["description"]);
    setAddForm({
      external_id: item.external_id,
      title: item.name,
      price: Number.isFinite(priceNumber) ? priceNumber.toFixed(2).replace(".", ",") : "",
      category_id: "",
      description: rawDesc,
      install: "",
      stock: "",
      cover_url: "",
    });
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) toast.error("Falha no envio da imagem.");
    else {
      const { data } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data) setAddForm((f) => f && { ...f, cover_url: data.signedUrl });
    }
    setSaving(false);
  };

  const saveToStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm) return;
    setSaving(true);
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        title: addForm.title,
        slug: slugify(addForm.title),
        description: addForm.description || null,
        price_cents: Math.round(parseFloat(addForm.price.replace(/\./g, "").replace(",", ".")) * 100) || 0,
        category_id: addForm.category_id || null,
        active: true,
        featured: false,
        eklas_external_id: addForm.external_id,
        stock_quantity: addForm.stock === "" ? null : Number(addForm.stock),
        cover_url: addForm.cover_url || null,
      })
      .select("id")
      .single();
    if (!error && created && addForm.install) {
      await supabase.from("product_assets").upsert({ product_id: created.id, install_instructions: addForm.install });
    }
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Esse produto (ou nome) já está na loja." : "Erro ao adicionar.");
      return;
    }
    toast.success("Produto adicionado à loja. Complete capa e entrega na aba Produtos.");
    setAddForm(null);
    setSelected(null);
    qc.invalidateQueries();
  };

  const lastUpdate = items.reduce<string | null>(
    (acc, i) => (acc && acc > i.updated_at ? acc : i.updated_at),
    null,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eklas · {items.length} produtos no catálogo
            {lastUpdate && ` · consultado em ${new Date(lastUpdate).toLocaleString("pt-BR")}`}
          </p>
        </div>
        <Button onClick={refresh} disabled={busy}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
          {busy ? "Consultando…" : "Consultar catálogo"}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-surface p-5">
          <p className="text-xs text-muted-foreground">Fornecedor</p>
          <p className="mt-1 font-semibold">Eklas</p>
          <p className="text-xs text-muted-foreground">Sincroniza sozinho a cada 5 minutos</p>
        </div>
        <div className="rounded-3xl bg-surface p-5">
          <p className="text-xs text-muted-foreground">Produtos no catálogo</p>
          <p className="mt-1 font-semibold">{items.length}</p>
          <p className="text-xs text-muted-foreground">{items.filter((i) => i.in_store).length} na sua loja</p>
        </div>
        <div className="rounded-3xl bg-surface p-5">
          <p className="text-xs text-muted-foreground">Chave da API</p>
          <p className="mt-1 font-semibold">{keyInfo?.configured ? `•••• ${keyInfo.last4}` : "Não configurada"}</p>
          <form onSubmit={saveKey} className="mt-2 flex gap-2">
            <Input type="password" placeholder="Nova chave" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-9 bg-background" />
            <Button size="sm" type="submit" disabled={savingKey || newKey.length < 8}>{savingKey ? "…" : "Trocar"}</Button>
          </form>
        </div>
      </div>


      <div className="mt-6 rounded-3xl bg-surface p-5">
        <h2 className="font-semibold">Últimas 3 atualizações</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma consulta registrada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((h) => {
              const ch = Array.isArray(h.changes) ? (h.changes as string[]) : [];
              return (
                <li key={h.id} className="text-sm">
                  <p className="font-medium">
                    {new Date(h.created_at).toLocaleString("pt-BR")} ·{" "}
                    {h.ok ? `${h.item_count} produtos` : <span className="text-destructive">Falhou: {h.error}</span>}
                  </p>
                  {ch.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {ch.slice(0, 8).map((c) => <li key={c}>{c}</li>)}
                      {ch.length > 8 && <li>+{ch.length - 8} outras mudanças</li>}
                    </ul>
                  ) : (
                    h.ok && <p className="text-muted-foreground">Sem mudanças.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Catálogo</h2>

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-surface p-10 text-center">
          <p className="text-muted-foreground">
            Nenhum dado ainda. Toque em "Atualizar estoque" para buscar os produtos do fornecedor.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((i) => {
            const out = i.stock !== null && i.stock <= 0;
            return (
              <div key={i.external_id} className="flex items-center gap-4 rounded-2xl bg-surface p-4">
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${out ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    {out ? <PackageX className="h-5 w-5" /> : <PackageCheck className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{i.external_id}
                      {i.price_text && ` · ${i.price_text}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${out ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>
                    {i.stock === null ? "—" : out ? "Esgotado" : `${i.stock} un.`}
                  </span>
                </button>
                {i.in_store ? (
                  <Button size="sm" variant="ghost" className="shrink-0 text-primary" disabled>
                    <Check /> Na loja
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => openAdd(i)}>
                    <Store /> Adicionar à loja
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detalhes do item */}
      <Dialog open={!!selected && !addForm} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">Código</dt>
                  <dd className="font-medium">#{selected.external_id}</dd>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">Estoque</dt>
                  <dd className="font-medium">
                    {selected.stock === null ? "—" : selected.stock <= 0 ? "Esgotado" : `${selected.stock} unidades`}
                  </dd>
                </div>
                {selected.price_text && (
                  <div className="flex justify-between gap-4 text-sm">
                    <dt className="text-muted-foreground">Preço de custo</dt>
                    <dd className="font-medium">{selected.price_text}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">Atualizado em</dt>
                  <dd className="font-medium">{new Date(selected.updated_at).toLocaleString("pt-BR")}</dd>
                </div>
                {selected.raw &&
                  Object.entries(selected.raw as Record<string, unknown>)
                    .filter(([k]) => !["id", "product_id", "uuid", "name", "title", "product_name", "price", "price_text", "cost", "stock", "quantity", "available", "count", "in_stock", "description", "requires"].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{labelFor(k)}</dt>
                        <dd className="max-w-[60%] truncate text-right font-medium">
                          {k === "delivery" ? DELIVERY_PT[String(v)] ?? formatValue(v) : k === "type" ? TYPE_PT[String(v)] ?? formatValue(v) : formatValue(v)}
                        </dd>
                      </div>
                    ))}
              </dl>
              {supplierTextPt((selected.raw as Record<string, unknown> | null)?.["description"]) && (
                <div className="rounded-2xl bg-surface p-4 text-sm">
                  <p className="font-medium">Descrição</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {supplierTextPt((selected.raw as Record<string, unknown>)["description"])}
                  </p>
                </div>
              )}
              <Button className="w-full" onClick={() => openAdd(selected)} disabled={selected.in_store}>
                {selected.in_store ? <><Check /> Já está na loja</> : <><Store /> Adicionar à loja</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adicionar à loja */}
      <Dialog open={!!addForm} onOpenChange={(o) => !o && setAddForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar à loja</DialogTitle>
          </DialogHeader>
          {addForm && (
            <form onSubmit={saveToStore} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input required value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Imagem do produto</Label>
                <div className="flex items-center gap-3">
                  {addForm.cover_url && <img src={addForm.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <Input type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files?.[0])} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Preço de venda (R$)</Label>
                  <Input required inputMode="decimal" placeholder="97,00" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <select
                    value={addForm.category_id}
                    onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade em estoque</Label>
                <Input inputMode="numeric" placeholder="Vazio = ilimitado" value={addForm.stock} onChange={(e) => setAddForm({ ...addForm, stock: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={5} value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Orientações de instalação</Label>
                <Textarea rows={5} placeholder="Passo a passo que o cliente vê após o pagamento" value={addForm.install} onChange={(e) => setAddForm({ ...addForm, install: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Depois de adicionar, complete a capa e a entrega (arquivo ou link) na aba Produtos.
              </p>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Aguarde…" : "Adicionar produto"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
