import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings", "pix"],
    queryFn: async () => (await supabase.from("store_settings").select("pix_key, pix_name, pix_city").eq("id", 1).single()).data,
  });
  const [f, setF] = useState({ pix_key: "", pix_name: "", pix_city: "" });
  useEffect(() => {
    if (data) setF({ pix_key: data.pix_key, pix_name: data.pix_name, pix_city: data.pix_city });
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("store_settings").update(f).eq("id", 1);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Dados do Pix salvos.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-semibold">Recebimento via Pix</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Esses dados geram o QR Code e o código "copia e cola" que o cliente vê ao comprar.
      </p>
      <form onSubmit={save} className="mt-6 space-y-4 rounded-3xl bg-surface p-6">
        <div className="space-y-1.5">
          <Label>Chave Pix</Label>
          <Input required placeholder="CPF, CNPJ, e-mail, telefone (+55...) ou aleatória" value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label>Nome do recebedor</Label>
          <Input required maxLength={25} value={f.pix_name} onChange={(e) => setF({ ...f, pix_name: e.target.value })} className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Input required maxLength={15} value={f.pix_city} onChange={(e) => setF({ ...f, pix_city: e.target.value })} className="bg-background" />
        </div>
        <Button type="submit">Salvar</Button>
      </form>
    </div>
  );
}
