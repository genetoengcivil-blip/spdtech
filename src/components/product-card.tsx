import { Link } from "@tanstack/react-router";
import { brl } from "@/lib/format";
import type { ProductWithCat } from "@/lib/queries";

export function ProductCard({ p }: { p: ProductWithCat }) {
  const out = p.stock_quantity !== null && p.stock_quantity <= 0;
  return (
    <Link
      to="/produto/$slug"
      params={{ slug: p.slug }}
      className="group flex items-center gap-4 rounded-2xl bg-surface p-3 transition-colors hover:bg-muted"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-semibold text-muted-foreground/40">{p.title.charAt(0)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {p.categories && <span className="text-xs font-medium text-primary">{p.categories.name}</span>}
        <h3 className="truncate font-semibold">{p.title}</h3>
        {p.subtitle && <p className="truncate text-sm text-muted-foreground">{p.subtitle}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{p.sold_count} vendido{p.sold_count === 1 ? "" : "s"}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-medium">{brl(p.price_cents)}</span>
        {out ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Esgotado</span>
        ) : (
          <span className="text-xs text-primary">Ver detalhes ›</span>
        )}
      </div>
    </Link>
  );
}
