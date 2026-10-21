import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery } from "@/lib/queries";
import { brl, slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: Products,
});

type Form = {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  category_id: string;
  cover_url: string;
  active: boolean;
  featured: boolean;
  access_url: string;
  file_path: string;
  install: string;
  stock: string;
  delivery_mode: string;
  delay: string;
  supplier_id: string;
  supplier_product_id: string;
};
const empty: Form = { title: "", subtitle: "", description: "", price: "", category_id: "", cover_url: "", active: true, featured: false, access_url: "", file_path: "", install: "", stock: "", delivery_mode: "manual", delay: "0", supplier_id: "", supplier_product_id: "" };

function Products() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () =>
      (await supabase.from("products").select("*, categories(name), product_assets(file_path, access_url, install_instructions)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["supplier-options"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name").order("name")).data ?? [],
  });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (p: (typeof products)[number]) => {
    const a = Array.isArray(p.product_assets) ? p.product_assets[0] : p.product_assets;
    setForm({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle ?? "",
      description: p.description ?? "",
      price: (p.price_cents / 100).toFixed(2).replace(".", ","),
      category_id: p.category_id ?? "",
      cover_url: p.cover_url ?? "",
      active: p.active,
      featured: p.featured,
      access_url: a?.access_url ?? "",
      file_path: a?.file_path ?? "",
      install: a?.install_instructions ?? "",
      stock: p.stock_quantity === null ? "" : String(p.stock_quantity),
      delivery_mode: p.delivery_mode,
      delay: String(p.delivery_delay_minutes),
      supplier_id: p.supplier_id ?? "",
      supplier_product_id: p.supplier_product_id ?? "",
    });
  };

  const upload = async (bucket: "covers" | "files", file: File) => {
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      toast.error("Falha no envio do arquivo.");
      return null;
    }
    return path;
  };

  const onCover = async (file?: File) => {
    if (!file || !form) return;
    setBusy(true);
    const path = await upload("covers", file);
    if (path) {
      const { data } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (data) setForm((f) => f && { ...f, cover_url: data.signedUrl });
    }
    setBusy(false);
  };

  const onFile = async (file?: File) => {
    if (!file || !form) return;
    setBusy(true);
    const path = await upload("files", file);
    if (path) setForm((f) => f && { ...f, file_path: path });
    setBusy(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const row = {
      title: form.title,
      slug: slugify(form.title),
      subtitle: form.subtitle || null,
      description: form.description || null,
      price_cents: Math.round(parseFloat(form.price.replace(/\./g, "").replace(",", ".")) * 100) || 0,
      category_id: form.category_id || null,
      cover_url: form.cover_url || null,
      active: form.active,
      featured: form.featured,
      ...(form.delivery_mode === "manual" ? { stock_quantity: form.stock === "" ? null : Number(form.stock) } : {}),
      delivery_mode: form.delivery_mode,
      delivery_delay_minutes: form.delivery_mode === "delayed" ? Math.max(1, Math.min(10080, Number(form.delay) || 1)) : 0,
      supplier_id: form.delivery_mode === "manual" && form.supplier_id ? form.supplier_id : null,
      supplier_product_id: form.delivery_mode === "manual" && form.supplier_id ? form.supplier_product_id.trim() || null : null,
    };
    const res = form.id
      ? await supabase.from("products").update(row).eq("id", form.id).select("id").single()
      : await supabase.from("products").insert(row).select("id").single();
    if (res.error || !res.data) {
      setBusy(false);
      { toast.error(res.error?.code === "23505" ? "Já existe um produto com esse nome." : "Erro ao salvar."); return; }
    }
    await supabase.from("product_assets").upsert({
      product_id: res.data.id,
      file_path: form.file_path || null,
      access_url: form.access_url || null,
      install_instructions: form.install || null,
    });
    setBusy(false);
    setForm(null);
    toast.success("Produto salvo.");
    qc.invalidateQueries();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    qc.invalidateQueries();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Produtos</h1>
        <Button onClick={() => setForm({ ...empty })}><Plus /> Novo produto</Button>
      </div>
      <div className="mt-6 space-y-3">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-surface p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
              {p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                {p.categories?.name ?? "Sem categoria"} · {brl(p.price_cents)} · {p.sold_count} vendidos · {p.stock_quantity === null ? "estoque ilimitado" : p.stock_quantity <= 0 ? "Esgotado" : `${p.stock_quantity} em estoque`}
                {!p.active && " · Oculto"}
                {p.featured && " · Destaque"}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => edit(p)} aria-label="Editar"><Pencil /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(p.id)} aria-label="Excluir"><Trash2 /></Button>
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Frase curta</Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Preço (R$)</Label>
                  <Input required inputMode="decimal" placeholder="97,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-3 rounded-2xl bg-surface p-4">
                <p className="text-sm font-medium">Tipo de entrega</p>
                <select
                  value={form.delivery_mode}
                  onChange={(e) => setForm({ ...form, delivery_mode: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="manual">Manual (arquivo/link abaixo)</option>
                  <option value="auto">Automática, logo após o pagamento</option>
                  <option value="delayed">Automática, após um prazo em minutos</option>
                </select>
                {form.delivery_mode === "delayed" && (
                  <div className="space-y-1.5">
                    <Label>Prazo (minutos)</Label>
                    <Input inputMode="numeric" value={form.delay} onChange={(e) => setForm({ ...form, delay: e.target.value.replace(/\D/g, "") })} className="bg-background" />
                  </div>
                )}
                {form.delivery_mode !== "manual" && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre os itens (códigos, chaves, logins) na aba Estoque. Cada unidade comprada recebe um item, na ordem em que foram cadastrados. O estoque é a quantidade de itens disponíveis.
                  </p>
                )}
              </div>
              {form.delivery_mode === "manual" && (
                <div className="space-y-3 rounded-2xl bg-surface p-4">
                  <p className="text-sm font-medium">Comprar no fornecedor (opcional)</p>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Nenhum</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {form.supplier_id && (
                    <div className="space-y-1.5">
                      <Label>Código do produto no fornecedor</Label>
                      <Input value={form.supplier_product_id} onChange={(e) => setForm({ ...form, supplier_product_id: e.target.value })} placeholder="Ex.: 42 (veja o # no catálogo)" className="bg-background" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Ao confirmar o Pix, o sistema compra no fornecedor com o saldo da sua carteira lá e envia ao cliente o que chegar.</p>
                </div>
              )}
              {form.delivery_mode === "manual" && <div className="space-y-1.5">
                <Label>Quantidade em estoque</Label>
                <Input inputMode="numeric" placeholder="Vazio = ilimitado" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })} />
              </div>}
              <div className="space-y-1.5">
                <Label>Imagem de capa</Label>
                <div className="flex items-center gap-3">
                  {form.cover_url && <img src={form.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <Input type="file" accept="image/*" onChange={(e) => onCover(e.target.files?.[0])} />
                </div>
              </div>
              <div className="space-y-3 rounded-2xl bg-surface p-4">
                <p className="text-sm font-medium">Entrega após o pagamento</p>
                <div className="space-y-1.5">
                  <Label>Arquivo para download</Label>
                  <Input type="file" onChange={(e) => onFile(e.target.files?.[0])} className="bg-background" />
                  {form.file_path && (
                    <p className="flex items-center justify-between text-xs text-muted-foreground">
                      Arquivo enviado ✓
                      <button type="button" className="text-destructive" onClick={() => setForm({ ...form, file_path: "" })}>remover</button>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Link de acesso (opcional)</Label>
                  <Input type="url" placeholder="https://..." value={form.access_url} onChange={(e) => setForm({ ...form, access_url: e.target.value })} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>Orientações de instalação</Label>
                  <Textarea rows={5} placeholder="Passo a passo que o cliente vê após o pagamento" value={form.install} onChange={(e) => setForm({ ...form, install: e.target.value })} className="bg-background" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Visível na loja
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /> Destaque
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aguarde…" : "Salvar produto"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
