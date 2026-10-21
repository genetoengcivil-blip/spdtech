import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const safe = (r?: string) => (r && r.startsWith("/") && !r.startsWith("//") ? r : "/conta");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — SDP tech" },
      { name: "description", content: "Entre ou crie sua conta para comprar e acessar seus produtos." },
      { property: "og:title", content: "Entrar — SDP tech" },
      { property: "og:description", content: "Entre ou crie sua conta na SDP tech." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) {
      sessionStorage.removeItem("lume_redirect");
      navigate({ to: safe(redirect ?? sessionStorage.getItem("lume_redirect") ?? undefined) as "/conta" });
    }
  }, [session, redirect, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha inválidos.");
    } else {
      const u = username.trim();
      if (!/^[A-Za-z0-9_.]{3,30}$/.test(u)) { toast.error("Nome de usuário: 3 a 30 letras, números, _ ou ."); setBusy(false); return; }
      const { data: ok } = await supabase.rpc("username_available", { _u: u });
      if (!ok) { toast.error("Esse nome de usuário já está em uso."); setBusy(false); return; }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + safe(redirect), data: { username: u } },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-sm px-5 py-24">
      <h1 className="text-center text-3xl font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {mode === "in" ? "Acesse seus produtos." : "Leva só alguns segundos."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "up" && (
          <Input required placeholder="Nome de usuário" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="h-11 rounded-xl" />
        )}
        <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        <Input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-6 w-full text-center text-sm text-primary">
        {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
