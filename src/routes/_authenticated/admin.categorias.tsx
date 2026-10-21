import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery } from "@/lib/queries";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: Categories,
});

function Categories() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("categories")
      .insert({ name, slug: slugify(name), description: desc || null, sort_order: cats.length + 1 });
    if (error) { toast.error("Já existe uma categoria com esse nome."); return; }
    setName("");
    setDesc("");
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta categoria? Os produtos ficarão sem categoria.")) return;
    await supabase.from("categories").delete().eq("id", id);
    refresh();
  };

  const rename = async (id: string, value: string) => {
    await supabase.from("categories").update({ name: value, slug: slugify(value) }).eq("id", id);
    refresh();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Categorias</h1>
      <form onSubmit={add} className="mt-6 flex flex-col gap-2 rounded-3xl bg-surface p-4 sm:flex-row">
        <Input required placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
        <Input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="bg-background" />
        <Button type="submit">Adicionar</Button>
      </form>
      <div className="mt-6 divide-y divide-border rounded-3xl bg-surface px-4">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            <input
              defaultValue={c.name}
              onBlur={(e) => e.target.value !== c.name && rename(c.id, e.target.value)}
              className="flex-1 bg-transparent font-medium outline-none"
            />
            <span className="text-xs text-muted-foreground">/{c.slug}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label="Excluir">
              <Trash2 />
            </Button>
          </div>
        ))}
        {cats.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma categoria.</p>}
      </div>
    </div>
  );
}
