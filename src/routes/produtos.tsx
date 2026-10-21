import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos")({
  validateSearch: (s: Record<string, unknown>): { categoria?: string | undefined } => ({
    categoria: typeof s["categoria"] === "string" ? s["categoria"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Produtos — SDP tech" },
      { name: "description", content: "Explore todos os cursos, e-books e templates por categoria." },
      { property: "og:title", content: "Produtos — SDP tech" },
      { property: "og:description", content: "Explore todos os cursos, e-books e templates por categoria." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]),
  component: ProductsPage,
});

function ProductsPage() {
  const { categoria } = Route.useSearch();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [q, setQ] = useState("");

  const filtered = products.filter(
    (p) =>
      (!categoria || p.categories?.slug === categoria) &&
      (!q || p.title.toLowerCase().includes(q.toLowerCase())),
  );
  const pill = "shrink-0 rounded-full px-4 py-2 text-sm transition-colors";

  return (
    <div className="mx-auto max-w-6xl px-5 pt-16">
      <h1 className="text-4xl font-semibold sm:text-5xl">Produtos.</h1>
      <p className="mt-2 text-muted-foreground">Escolha o próximo passo da sua jornada.</p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <Link to="/produtos" search={{}} className={cn(pill, !categoria ? "bg-secondary text-secondary-foreground" : "bg-surface hover:bg-muted")}>
            Todos
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/produtos"
              search={{ categoria: c.slug }}
              className={cn(pill, categoria === c.slug ? "bg-secondary text-secondary-foreground" : "bg-surface hover:bg-muted")}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="mt-10 mx-auto flex max-w-3xl flex-col gap-3">
        {filtered.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-20 text-center text-muted-foreground">Nenhum produto encontrado.</p>
      )}
    </div>
  );
}
