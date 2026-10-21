import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/cupons")({
  head: () => ({ meta: [{ title: "Cupons — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: Coupons,
});

function Coupons() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("10");
  const [max, setMax] = useState("");
  const [exp, setExp] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-coupons"] });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(), percent_off: Number(pct),
      max_uses: max ? Number(max) : null, expires_at: exp ? new Date(exp + "T23:59:59").toISOString() : null,
    });
    if (error) { toast.error(error.message.includes("duplicate") ? "Esse código já existe." : "Erro ao criar cupom."); return; }
    setCode(""); setMax(""); setExp(""); toast.success("Cupom criado."); refresh();
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold">Cupons</h1>
      <form onSubmit={create} className="mt-6 grid gap-2 rounded-2xl bg-surface p-4 sm:grid-cols-5">
        <Input required placeholder="CÓDIGO" value={code} onChange={(e) => setCode(e.target.value)} className="uppercase" />
        <Input required type="number" min={1} max={100} placeholder="% desconto" value={pct} onChange={(e) => setPct(e.target.value)} />
        <Input type="number" min={1} placeholder="Limite de usos" value={max} onChange={(e) => setMax(e.target.value)} />
        <Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} aria-label="Validade" />
        <Button type="submit">Criar cupom</Button>
      </form>
      <div className="mt-6 divide-y divide-border rounded-2xl bg-surface">
        {data.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum cupom ainda.</p>}
        {data.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <p className="font-mono font-medium">{c.code} <span className="font-sans text-primary">−{c.percent_off}%</span></p>
              <p className="text-xs text-muted-foreground">
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} usos
                {c.expires_at && ` · válido até ${new Date(c.expires_at).toLocaleDateString("pt-BR")}`}
              </p>
            </div>
            <Switch checked={c.active} onCheckedChange={async (v) => { await supabase.from("coupons").update({ active: v }).eq("id", c.id); refresh(); }} aria-label="Ativo" />
            <Button size="icon" variant="ghost" aria-label="Excluir" onClick={async () => { await supabase.from("coupons").delete().eq("id", c.id); refresh(); }}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
