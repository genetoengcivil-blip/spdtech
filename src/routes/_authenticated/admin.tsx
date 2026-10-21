import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — SDP tech" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Visão geral", exact: true },
  { to: "/admin/pedidos", label: "Vendas" },
  { to: "/admin/entregas", label: "Entregas" },
  { to: "/admin/suporte", label: "Suporte" },
  { to: "/admin/clientes", label: "Clientes" },
  { to: "/admin/contas", label: "Contas" },
  { to: "/admin/produtos", label: "Produtos" },
  { to: "/admin/estoque", label: "Estoque" },
  { to: "/admin/fornecedores", label: "Fornecedores" },
  { to: "/admin/gestao-fornecedores", label: "Gestão de fornecedores" },
  { to: "/admin/categorias", label: "Categorias" },
  { to: "/admin/cupons", label: "Cupons" },
  { to: "/admin/configuracoes", label: "Pix" },
  { to: "/admin/site", label: "Site" },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="-mx-5 mb-8 flex gap-1 overflow-x-auto px-5">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: "exact" in t }}
            className="shrink-0 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "bg-secondary text-secondary-foreground hover:text-secondary-foreground" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
