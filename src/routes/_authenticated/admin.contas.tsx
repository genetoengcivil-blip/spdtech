import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, KeyRound, Trash2, Pencil, Plus, Search, ShieldCheck, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listAccounts, createAccount, updateAccount, setAccountBlocked, resetAccountPassword, deleteAccount, type Account } from "@/lib/accounts.functions";

export const Route = createFileRoute("/_authenticated/admin/contas")({
  component: Accounts,
});

type Form = { id?: string; email: string; name: string; phone: string; password: string };

function Accounts() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["admin-accounts"],
    queryFn: () => listAccounts(),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const res = form.id
        ? await updateAccount({ data: { id: form.id, email: form.email, name: form.name, phone: form.phone, password: form.password || undefined } })
        : await createAccount({ data: { email: form.email, name: form.name, phone: form.phone, password: form.password } });
      if (res.ok) {
        toast.success(form.id ? "Conta atualizada." : "Conta criada.");
        setForm(null);
        qc.invalidateQueries({ queryKey: ["admin-accounts"] });
      } else toast.error(res.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
    setBusy(false);
  };

  const toggleBlock = async (a: Account) => {
    if (!a.blocked && !confirm(`Bloquear a conta de ${a.email}? A pessoa não conseguirá entrar.`)) return;
    const res = await setAccountBlocked({ data: { id: a.id, blocked: !a.blocked } });
    if (res.ok) {
      toast.success(a.blocked ? "Conta desbloqueada." : "Conta bloqueada.");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    } else toast.error(res.error);
  };

  const resetPwd = async (a: Account) => {
    const pwd = prompt(`Nova senha para ${a.email} (mínimo 6 caracteres):`);
    if (pwd === null) return;
    try {
      const res = await resetAccountPassword({ data: { id: a.id, password: pwd } });
      if (res.ok) toast.success("Senha redefinida. Informe a nova senha ao cliente.");
      else toast.error(res.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir.");
    }
  };

  const remove = async (a: Account) => {
    if (!confirm(`Apagar a conta de ${a.email}? Isso não pode ser desfeito. Os pedidos continuam no histórico de vendas.`)) return;
    const res = await deleteAccount({ data: { id: a.id } });
    if (res.ok) {
      toast.success("Conta apagada.");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    } else toast.error(res.error);
  };

  const term = q.trim().toLowerCase();
  const list = accounts.filter((a) => !term || [a.email, a.name, a.phone].some((v) => v.toLowerCase().includes(term)));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{accounts.length} conta(s) cadastrada(s).</p>
        </div>
        <Button onClick={() => setForm({ email: "", name: "", phone: "", password: "" })}><Plus /> Nova conta</Button>
      </div>
      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-6 space-y-3">
        {isLoading && <p className="py-10 text-center text-muted-foreground">Carregando…</p>}
        {list.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {a.name || a.email}
                {a.is_admin && <ShieldCheck className="h-4 w-4 text-primary" aria-label="Administrador" />}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.email} · {a.phone || "sem telefone"} · desde {dateBR(a.created_at)}
              </p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-medium", a.blocked ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground")}>
              {a.blocked ? "Bloqueada" : "Ativa"}
            </span>
            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ id: a.id, email: a.email, name: a.name, phone: a.phone, password: "" })}>
              <Pencil />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Redefinir senha" title="Redefinir senha" onClick={() => resetPwd(a)}>
              <KeyRound />
            </Button>
            {!a.is_admin && (
              <Button size="icon" variant="ghost" aria-label="Apagar conta" title="Apagar conta" className="text-destructive" onClick={() => remove(a)}>
                <Trash2 />
              </Button>
            )}
            {!a.is_admin && (
              <Button size="sm" variant={a.blocked ? "outline" : "ghost"} onClick={() => toggleBlock(a)}>
                {a.blocked ? <><Unlock /> Desbloquear</> : <><Ban /> Bloquear</>}
              </Button>
            )}
          </div>
        ))}
        {!isLoading && list.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhuma conta encontrada.</p>}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{form.id ? "Nova senha (opcional)" : "Senha"}</Label>
                <Input type="password" required={!form.id} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aguarde…" : "Salvar"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
