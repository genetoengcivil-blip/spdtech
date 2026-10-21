import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationsBell } from "@/components/notifications-bell";

export function SiteHeader() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/", replace: true });
  };

  const link = "text-xs text-foreground/70 transition-colors hover:text-foreground";
  return (
    <header className="glass sticky top-0 z-50 border-b border-border/60">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          SDP <span className="text-primary">tech</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/produtos" className={link} activeProps={{ className: "text-foreground" }}>
            Produtos
          </Link>
          {isAdmin && (
            <Link to="/admin" className={link}>
              Admin
            </Link>
          )}
          {session ? (
            <>
              <NotificationsBell userId={session.user.id} />
              <Link to="/suporte" className={link}>
                Suporte
              </Link>
              <Link to="/conta" className={link}>
                Minha conta
              </Link>
              <button onClick={signOut} className={link}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/auth" className={link}>
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} SDP tech. Produtos digitais com acesso imediato.</span>
        <span>Pagamento seguro via Pix</span>
      </div>
    </footer>
  );
}
