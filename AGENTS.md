<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Store data is read/written from the browser via the Cloud client; RLS + `has_role`/`has_paid` enforce access. Why: simple CRUD app, no secrets needed.
- Order price/title are set by a DB trigger, never trusted from the client. Why: prevents price tampering.
- Pix uses a static BR Code generated client-side (src/lib/pix.ts); admin confirms payment manually. Why: user chose manual Pix.
- First user to sign up becomes admin (DB trigger). Why: bootstrap without manual setup.
- Storage buckets are private (public buckets blocked); covers use long-lived signed URLs. Why: workspace policy.
- In-site notifications are created by DB triggers on orders (new order -> admins, status change -> buyer). Why: works without email and can't be spoofed by clients.
- Sold counts live in products.sold_count, maintained by a trigger on order status. Why: orders are private per user, so the public can't count them.
- Own stock lives in products.stock_quantity (null = unlimited); the order-status trigger decrements on paid and blocks orders at 0. Why: stock must sell out automatically without manual refresh.
- Install instructions live in product_assets (buyer/admin-only RLS). Why: only paying customers should see them.
- Storefront subscribes to realtime changes on products and invalidates product queries. Why: user wants live product updates.
- No AI features in the app. Why: user explicitly declined AI.
- Supplier (Eklas) catalog checks are logged in supplier_refresh_log for the Fornecedores tab. Why: admin wants catalog history.
- Eklas sync logic lives in src/lib/eklas.server.ts, shared by the admin button and a pg_cron-called route (/api/public/hooks/eklas-sync) verified by a DB-stored cron token; supplier stock overwrites stock_quantity of linked products. Why: Eklas has no webhook.
- Runtime-editable secrets (Eklas key, cron token) live in public.app_secrets (service_role only, no client grants). Why: admin changes the key from the panel.
- Account management (create/edit/block) uses auth admin API in server fns after has_role check. Why: needs service role.
- Supplier descriptions are converted to Portuguese with a fixed glossary (src/lib/supplier-text.ts), not AI. Why: user declined AI.
- Automatic delivery: products.delivery_mode (manual/auto/delayed) + inventory_items assigned FIFO by DB function assign_inventory when an order is paid; buyer visibility gated by orders.deliver_after (no cron). Stock of non-manual products = count of unassigned items. Why: atomic, can't be spoofed, no polling.
- Multiple suppliers live in suppliers/supplier_products (Eklas-compatible API), keys in app_secrets as supplier_key:<id>; the original Eklas tab stays on eklas_stock. Why: user wanted both screens.
- Site title/description/meta tags live in store_settings and are read by root and index loaders. Why: editable from the panel.
- Stock: pending orders reserve units for 15 min (reserved_qty in order trigger); checkout re-syncs the supplier first; low-stock/sold-out/back-in-stock notices come from a products trigger (stock_alerts). Why: avoid overselling without polling the client.
