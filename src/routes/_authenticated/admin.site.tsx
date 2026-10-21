import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { getEklasKeyInfo, setEklasKey } from "@/lib/eklas.functions";

export const Route = createFileRoute("/_authenticated/admin/site")({
  component: SiteSettings,
});

function SiteSettings() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const { data: keyInfo } = useQuery({ queryKey: ["eklas-key"], queryFn: () => getEklasKeyInfo() });
  const [f, setF] = useState({ site_title: "", site_description: "", meta_keywords: "", og_image_url: "" });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data)
      setF({
        site_title: data.site_title,
        site_description: data.site_description,
        meta_keywords: data.meta_keywords ?? "",
        og_image_url: data.og_image_url ?? "",
      });
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.og_image_url && !/^https:\/\//.test(f.og_image_url)) {
      toast.error("O link da imagem deve começar com https://");
      return;
    }
    const { error } = await supabase
      .from("store_settings")
      .update({
        site_title: f.site_title.slice(0, 70),
        site_description: f.site_description.slice(0, 160),
        meta_keywords: f.meta_keywords || null,
        og_image_url: f.og_image_url || null,
      })
      .eq("id", 1);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Dados do site salvos.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await setEklasKey({ data: { key } });
      if (res.ok) {
        toast.success("Chave da Eklas trocada e testada.");
        setKey("");
        qc.invalidateQueries({ queryKey: ["eklas-key"] });
      } else toast.error(res.error);
    } catch {
      toast.error("Chave inválida.");
    }
    setBusy(false);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Site</h1>
        <p className="mt-1 text-sm text-muted-foreground">Como o site aparece no Google e quando o link é compartilhado.</p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-3xl bg-surface p-6">
        <div className="space-y-1.5">
          <Label>Título do site <span className="text-muted-foreground">({f.site_title.length}/70)</span></Label>
          <Input required maxLength={70} value={f.site_title} onChange={(e) => setF({ ...f, site_title: e.target.value })} className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição <span className="text-muted-foreground">({f.site_description.length}/160)</span></Label>
          <Textarea required maxLength={160} rows={3} value={f.site_description} onChange={(e) => setF({ ...f, site_description: e.target.value })} className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label>Palavras-chave (separadas por vírgula)</Label>
          <Input value={f.meta_keywords} onChange={(e) => setF({ ...f, meta_keywords: e.target.value })} className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label>Imagem de compartilhamento (link https)</Label>
          <Input type="url" placeholder="https://..." value={f.og_image_url} onChange={(e) => setF({ ...f, og_image_url: e.target.value })} className="bg-background" />
        </div>
        <div className="rounded-2xl bg-background p-4">
          <p className="text-xs text-muted-foreground">Prévia no Google</p>
          <p className="mt-1 text-primary">{f.site_title || "Título"}</p>
          <p className="text-sm text-muted-foreground">{f.site_description || "Descrição"}</p>
        </div>
        <Button type="submit">Salvar</Button>
      </form>

      <form onSubmit={saveKey} className="space-y-3 rounded-3xl bg-surface p-6">
        <h2 className="font-semibold">Chave da Eklas</h2>
        <p className="text-sm text-muted-foreground">Atual: {keyInfo?.configured ? `•••• ${keyInfo.last4}` : "não configurada"}</p>
        <div className="flex gap-2">
          <Input type="password" placeholder="Nova chave" value={key} onChange={(e) => setKey(e.target.value)} className="bg-background" />
          <Button type="submit" disabled={busy || key.length < 8}>{busy ? "Testando…" : "Trocar"}</Button>
        </div>
      </form>
    </div>
  );
}
