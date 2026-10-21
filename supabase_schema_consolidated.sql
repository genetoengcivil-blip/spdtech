-- =========================================================================
-- BANCO DE DADOS CONSOLIDADO - PROJETO SUPABASE SEPARADO
-- Este script consolida todas as migrações (0000 até 0014) em ordem correta.
-- Pode ser executado integralmente no SQL Editor do seu novo Supabase.
-- =========================================================================

-- 1. ENUMS E TIPOS
create type public.app_role as enum ('admin','user');

-- 2. TABELA DE ROLES E PERMISSÕES DE USUÁRIO
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create unique index if not exists one_admin_only on public.user_roles ((role)) where role = 'admin';

create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();


-- 3. PERFIS (PROFILES)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "own or admin read profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own update profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and username ~ '^[A-Za-z0-9_.]{3,30}$');

create or replace function public.username_available(_u text) returns boolean language sql stable security definer set search_path=public as $$
  select not exists (select 1 from public.profiles where lower(username)=lower(trim(_u))) $$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.handle_new_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare u text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''),'[^A-Za-z0-9_.]','','g'),'');
begin
  if u is null or length(u) < 3 then u := 'user' || substr(replace(new.id::text,'-',''),1,8); end if;
  if exists (select 1 from public.profiles where lower(username)=lower(u)) then u := u || substr(replace(new.id::text,'-',''),1,4); end if;
  insert into public.profiles(id, username) values (new.id, left(u,30)) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_profile();


-- 4. CATEGORIAS
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read categories" on public.categories for select using (true);
create policy "admin write categories" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));


-- 5. FORNECEDORES (SUPPLIERS)
create table public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_base_url text NOT NULL DEFAULT 'https://api.eklas.dev/v1',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "admin suppliers" on public.suppliers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.suppliers(name, api_base_url) values ('Eklas','https://api.eklas.dev/v1');


-- 6. PRODUTOS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  subtitle text,
  description text,
  price_cents int not null default 0,
  cover_url text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  sold_count integer not null default 0,
  eklas_external_id text,
  stock_quantity integer,
  delivery_mode text not null default 'manual',
  delivery_delay_minutes integer not null default 0,
  low_stock_threshold integer not null default 5,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_product_id text
);
create unique index if not exists products_eklas_external_id_key on public.products (eklas_external_id) where eklas_external_id is not null;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read active products" on public.products for select using (active or public.has_role(auth.uid(),'admin'));
create policy "admin write products" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));


-- 7. CUPONS
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off int not null check (percent_off between 1 and 100),
  active boolean not null default true,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;
alter table public.coupons enable row level security;
create policy "admin coupons" on public.coupons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));


-- 8. PEDIDOS (ORDERS)
create sequence public.orders_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  product_id uuid references public.products(id) on delete set null,
  product_title text not null default '',
  amount_cents int not null default 0,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  order_number bigint not null default nextval('public.orders_number_seq'),
  quantity integer not null default 1,
  delivery_status text not null default 'pending',
  deliver_after timestamptz,
  coupon_code text,
  discount_cents int not null default 0
);
alter sequence public.orders_number_seq owned by public.orders.order_number;
grant usage on sequence public.orders_number_seq to authenticated;

grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create policy "own or admin read orders" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own pending order" on public.orders for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and paid_at is null);
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));


-- 9. FUNÇÕES E TRIGGERS DE PEDIDOS E ESTOQUE
create or replace function public.reserved_qty(_product uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity),0)::int from public.orders
  where product_id = _product and status = 'pending' and created_at > now() - interval '15 minutes'
$$;

create or replace function public.check_coupon(_code text) returns int language sql stable security definer set search_path=public as $$
  select percent_off from public.coupons where upper(code)=upper(trim(_code)) and active
   and (expires_at is null or expires_at > now()) and (max_uses is null or used_count < max_uses) $$;
grant execute on function public.check_coupon(text) to authenticated;

create or replace function public.order_fill_price()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; pct int; gross int;
begin
  select * into p from public.products where id = new.product_id and active;
  if not found then raise exception 'Produto indisponível'; end if;
  if new.quantity is null or new.quantity < 1 or new.quantity > 50 then raise exception 'Quantidade inválida'; end if;
  if p.stock_quantity is not null and p.stock_quantity - public.reserved_qty(p.id) < new.quantity then raise exception 'Estoque insuficiente'; end if;

  gross := p.price_cents * new.quantity;
  new.discount_cents := 0;
  if new.coupon_code is not null and trim(new.coupon_code) <> '' then
    pct := public.check_coupon(new.coupon_code);
    if pct is null then raise exception 'Cupom inválido'; end if;
    new.coupon_code := upper(trim(new.coupon_code));
    new.discount_cents := round(gross * pct / 100.0);
  else new.coupon_code := null; end if;

  new.amount_cents := gross - new.discount_cents;
  new.product_title := p.title;
  new.delivery_status := 'pending';
  new.deliver_after := null;
  return new;
end $$;
create trigger orders_fill_price before insert on public.orders for each row execute function public.order_fill_price();


-- 10. ITENS DE INVENTÁRIO / ENTREGA AUTOMÁTICA
create sequence if not exists public.inventory_position_seq;
create table public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  content text NOT NULL,
  position bigint NOT NULL DEFAULT nextval('public.inventory_position_seq'),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
create index inventory_items_product_pos on public.inventory_items(product_id, position) WHERE order_id IS NULL;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "admin inventory" on public.inventory_items for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "buyer reads delivered items" on public.inventory_items for SELECT TO authenticated
  using (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = inventory_items.order_id AND o.user_id = auth.uid()
    AND o.status = 'paid' AND o.deliver_after IS NOT NULL AND o.deliver_after <= now()));

create or replace function public.recount_inventory(_product uuid)
returns void language sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.products SET stock_quantity =
    (SELECT count(*) FROM public.inventory_items WHERE product_id = _product AND order_id IS NULL)
  WHERE id = _product AND delivery_mode <> 'manual';
$$;

create or replace function public.assign_inventory(_order uuid)
returns boolean language plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o record; p record; avail int;
begin
  select * into o from public.orders where id = _order for update;
  if not found or o.status <> 'paid' or o.delivery_status = 'delivered' then return false; end if;
  select * into p from public.products where id = o.product_id;
  if not found or p.delivery_mode = 'manual' then return false; end if;
  select count(*) into avail from public.inventory_items where product_id = p.id and order_id is null;
  if avail < o.quantity then
    update public.orders set delivery_status = 'awaiting_stock' where id = o.id;
    return false;
  end if;
  update public.inventory_items set order_id = o.id, delivered_at = now()
  where id in (select id from public.inventory_items where product_id = p.id and order_id is null
               order by position limit o.quantity for update skip locked);
  update public.orders set delivery_status = 'delivered',
    deliver_after = now() + make_interval(mins => case when p.delivery_mode = 'delayed' then p.delivery_delay_minutes else 0 end)
  where id = o.id;
  perform public.recount_inventory(p.id);
  return true;
end $$;

create or replace function public.inventory_changed()
returns trigger language plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare pid uuid := coalesce(new.product_id, old.product_id); w record;
begin
  perform public.recount_inventory(pid);
  if tg_op = 'INSERT' then
    for w in select id from public.orders where product_id = pid and status = 'paid' and delivery_status = 'awaiting_stock' order by created_at loop
      exit when not public.assign_inventory(w.id);
    end loop;
  end if;
  return null;
end $$;
create trigger inventory_changed AFTER INSERT OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.inventory_changed();


-- 11. ATIVOS DE PRODUTOS (PRODUCT ASSETS)
create table public.product_assets (
  product_id uuid primary key references public.products(id) on delete cascade,
  file_path text,
  access_url text,
  install_instructions text
);
grant select, insert, update, delete on public.product_assets to authenticated;
grant all on public.product_assets to service_role;
alter table public.product_assets enable row level security;

create or replace function public.has_paid(_user uuid, _product uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where user_id=_user and product_id=_product and status='paid') $$;

create policy "buyers and admin read assets" on public.product_assets for select to authenticated using (public.has_role(auth.uid(),'admin') or public.has_paid(auth.uid(), product_id));
create policy "admin write assets" on public.product_assets for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));


-- 12. ACOMPANHAMENTO DE VENDAS E CUPONS (ORDERS TRACK)
create or replace function public.orders_track_sold()
returns trigger language plpgsql security definer set search_path = public as $$
declare mode text;
begin
  if new.product_id is not null and new.status is distinct from old.status then
    select delivery_mode into mode from public.products where id = new.product_id;
    if new.status = 'paid' then
      update public.products set sold_count = sold_count + new.quantity,
        stock_quantity = case when mode <> 'manual' or stock_quantity is null then stock_quantity else greatest(stock_quantity - new.quantity, 0) end
      where id = new.product_id;
      if mode <> 'manual' then perform public.assign_inventory(new.id);
      else update public.orders set delivery_status = 'manual', deliver_after = now() where id = new.id; end if;
    elsif old.status = 'paid' then
      update public.products set sold_count = greatest(sold_count - new.quantity, 0),
        stock_quantity = case when mode <> 'manual' or stock_quantity is null then stock_quantity else stock_quantity + new.quantity end
      where id = new.product_id;
    end if;
  end if;
  return new;
end $$;
create trigger orders_track_sold after update on public.orders for each row execute function public.orders_track_sold();

create or replace function public.orders_coupon_use() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.coupon_code is not null and new.status is distinct from old.status then
    if new.status='paid' then update public.coupons set used_count=used_count+1 where code=new.coupon_code;
    elsif old.status='paid' then update public.coupons set used_count=greatest(used_count-1,0) where code=new.coupon_code; end if;
  end if;
  return new;
end $$;
create trigger orders_coupon_use after update on public.orders for each row execute function public.orders_coupon_use();


-- 13. AVALIAÇÕES (REVIEWS) E ALERTAS DE ESTOQUE
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "public read reviews" on public.reviews for select to anon, authenticated using (true);
create policy "buyers insert review" on public.reviews for insert to authenticated with check (user_id=auth.uid() and public.has_paid(auth.uid(), product_id));
create policy "own update review" on public.reviews for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own or admin delete review" on public.reviews for delete to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
grant select, insert, delete on public.stock_alerts to authenticated;
grant all on public.stock_alerts to service_role;
alter table public.stock_alerts enable row level security;
create policy "own alerts read" on public.stock_alerts for select to authenticated using (user_id = auth.uid());
create policy "own alerts insert" on public.stock_alerts for insert to authenticated with check (user_id = auth.uid());
create policy "own alerts delete" on public.stock_alerts for delete to authenticated using (user_id = auth.uid());


-- 14. NOTIFICAÇÕES
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.orders_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, title, body, link)
    select r.user_id, 'Novo pedido #' || new.order_number,
           new.buyer_name || ' · ' || new.product_title || ' · aguardando Pix', '/admin/pedidos'
    from public.user_roles r where r.role = 'admin';
  elsif new.status is distinct from old.status then
    if new.status = 'paid' then
      insert into public.notifications (user_id, title, body, link)
      values (new.user_id, 'Pagamento confirmado · Pedido #' || new.order_number,
              new.product_title || ' já está liberado para você.', '/conta');
    elsif new.status = 'cancelled' then
      insert into public.notifications (user_id, title, body, link)
      values (new.user_id, 'Pedido #' || new.order_number || ' cancelado',
              new.product_title, '/conta');
    end if;
  end if;
  return new;
end $$;
create trigger orders_notify_ins after insert on public.orders for each row execute function public.orders_notify();
create trigger orders_notify_upd after update on public.orders for each row execute function public.orders_notify();

create or replace function public.manual_delivery_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare o record;
begin
  if new.order_id is not null then
    select * into o from public.orders where id=new.order_id;
    if found and not exists (select 1 from public.notifications where user_id=o.user_id and link='/conta#pedido-'||o.order_number and created_at > now() - interval '10 seconds') then
      insert into public.notifications(user_id,title,body,link)
      values (o.user_id, 'Produto enviado · Pedido #'||o.order_number, o.product_title||' já está disponível na sua conta.', '/conta#pedido-'||o.order_number);
    end if;
  end if;
  return null;
end $$;
create trigger manual_delivery_notify after insert on public.inventory_items for each row execute function public.manual_delivery_notify();

create or replace function public.product_stock_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_quantity is not distinct from old.stock_quantity then return null; end if;
  if new.stock_quantity is not null and new.stock_quantity > 0 and new.stock_quantity <= new.low_stock_threshold
     and (old.stock_quantity is null or old.stock_quantity > new.low_stock_threshold or old.stock_quantity = 0) then
    insert into public.notifications(user_id,title,body,link)
    select r.user_id, 'Estoque baixo', new.title || ': restam ' || new.stock_quantity || ' un.', '/admin/estoque'
    from public.user_roles r where r.role='admin';
  end if;
  if new.stock_quantity = 0 and old.stock_quantity is distinct from 0 then
    insert into public.notifications(user_id,title,body,link)
    select r.user_id, 'Produto esgotado', new.title || ' foi ocultado da vitrine.', '/admin/estoque'
    from public.user_roles r where r.role='admin';
  end if;
  if old.stock_quantity = 0 and (new.stock_quantity is null or new.stock_quantity > 0) then
    insert into public.notifications(user_id,title,body,link)
    select a.user_id, 'Voltou ao estoque!', new.title || ' está disponível novamente.', '/produto/' || new.slug
    from public.stock_alerts a where a.product_id = new.id;
    delete from public.stock_alerts where product_id = new.id;
  end if;
  return null;
end $$;
create trigger product_stock_changed after update of stock_quantity on public.products
for each row execute function public.product_stock_changed();


-- 15. SUPORTE (TICKETS E MENSAGENS)
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject text not null check (char_length(subject) between 2 and 120),
  status text not null default 'open',
  due_at timestamptz default now() + interval '48 hours',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "own or admin read tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own insert ticket" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open');
create policy "admin update tickets" on public.support_tickets for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  from_admin boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy "read messages" on public.support_messages for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy "send messages" on public.support_messages for insert to authenticated with check (
  sender_id = auth.uid() and (
    (from_admin and public.has_role(auth.uid(),'admin')) or
    (not from_admin and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))));

create or replace function public.support_message_after() returns trigger language plpgsql security definer set search_path=public as $$
declare t record;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if new.from_admin then
    update public.support_tickets set status='answered', due_at=null, last_message_at=now() where id=t.id;
    insert into public.notifications(user_id,title,body,link) values (t.user_id,'Nova resposta do suporte',t.subject,'/suporte');
  else
    update public.support_tickets set status='open', last_message_at=now(),
      due_at = case when t.status='open' and t.due_at is not null then t.due_at else now() + interval '48 hours' end where id=t.id;
    insert into public.notifications(user_id,title,body,link)
      select r.user_id,'Mensagem de suporte',t.subject,'/admin/suporte' from public.user_roles r where r.role='admin';
  end if;
  return null;
end $$;
create trigger support_message_after after insert on public.support_messages for each row execute function public.support_message_after();


-- 16. INTEGRAÇÕES, ESTOQUE EXTERNO E COMPRAS DE FORNECEDOR
create table public.eklas_stock (
  external_id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  price_text text,
  stock integer,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
grant SELECT, INSERT, UPDATE, DELETE ON public.eklas_stock TO authenticated;
grant ALL ON public.eklas_stock TO service_role;
alter table public.eklas_stock ENABLE ROW LEVEL SECURITY;
create POLICY "admin read eklas stock" ON public.eklas_stock FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
create POLICY "admin write eklas stock" ON public.eklas_stock FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

create table public.supplier_products (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  price_text text,
  stock integer,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, external_id)
);
grant SELECT ON public.supplier_products TO authenticated;
grant ALL ON public.supplier_products TO service_role;
alter table public.supplier_products ENABLE ROW LEVEL SECURITY;
create POLICY "admin read supplier products" ON public.supplier_products FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

create table public.supplier_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier text NOT NULL DEFAULT 'eklas',
  ok boolean NOT NULL DEFAULT true,
  item_count integer NOT NULL DEFAULT 0,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE
);
grant SELECT, INSERT ON public.supplier_refresh_log TO authenticated;
grant ALL ON public.supplier_refresh_log TO service_role;
alter table public.supplier_refresh_log ENABLE ROW LEVEL SECURITY;
create POLICY "admin read supplier log" ON public.supplier_refresh_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
create POLICY "admin insert supplier log" ON public.supplier_refresh_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

create table public.supplier_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  external_order_id text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
grant SELECT ON public.supplier_purchases TO authenticated;
grant ALL ON public.supplier_purchases TO service_role;
alter table public.supplier_purchases ENABLE ROW LEVEL SECURITY;
create POLICY "admin read supplier purchases" ON public.supplier_purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- 17. CONFIGURAÇÕES DA LOJA (STORE SETTINGS) E SEGREDOS (APP SECRETS)
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  pix_key text not null default '',
  pix_name text not null default 'LUME',
  pix_city text not null default 'FORTALEZA',
  contact_whatsapp text,
  site_title text NOT NULL DEFAULT 'lume — Produtos digitais',
  site_description text NOT NULL DEFAULT 'Cursos, e-books e templates com acesso imediato.',
  meta_keywords text,
  og_image_url text
);
grant select on public.store_settings to authenticated;
grant insert, update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;

drop policy if exists "public read settings" on public.store_settings;
create policy "public read settings" on public.store_settings for select to anon, authenticated using (id = 1);
revoke select on public.store_settings from anon;
grant select (id, site_title, site_description, meta_keywords, og_image_url, contact_whatsapp) on public.store_settings to anon;
grant select on public.store_settings to authenticated;
create policy "admin write settings" on public.store_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.store_settings (id) values (1) on conflict do nothing;

create table public.app_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
grant ALL ON public.app_secrets TO service_role;
alter table public.app_secrets ENABLE ROW LEVEL SECURITY;
insert INTO public.app_secrets(name, value) VALUES ('cron_token', encode(gen_random_bytes(32), 'hex')) ON CONFLICT DO NOTHING;


-- 18. POLÍTICAS DE STORAGE (SUPABASE STORAGE)
-- Certifique-se de criar os buckets 'covers' e 'files' no painel do seu novo Supabase.
create policy "public read covers" on storage.objects for select using (bucket_id='covers');
create policy "admin manage covers" on storage.objects for all to authenticated using (bucket_id='covers' and public.has_role(auth.uid(),'admin')) with check (bucket_id='covers' and public.has_role(auth.uid(),'admin'));
create policy "admin manage files" on storage.objects for all to authenticated using (bucket_id='files' and public.has_role(auth.uid(),'admin')) with check (bucket_id='files' and public.has_role(auth.uid(),'admin'));
create policy "buyers read files" on storage.objects for select to authenticated using (
  bucket_id='files' and exists (select 1 from public.product_assets a where a.file_path = storage.objects.name and public.has_paid(auth.uid(), a.product_id))
);


-- 19. PUBLICATION DE REALTIME
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.eklas_stock;
alter publication supabase_realtime add table public.supplier_refresh_log;
alter publication supabase_realtime add table public.supplier_products;
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_tickets;


-- 20. DADOS INICIAIS (SEED)
insert into public.categories (name, slug, description, sort_order) values
 ('Cursos','cursos','Aprenda no seu ritmo.',1),
 ('E-books','e-books','Leituras que transformam.',2),
 ('Templates','templates','Pronto para usar.',3)
on conflict (slug) do nothing;

insert into public.products (category_id, title, slug, subtitle, description, price_cents, featured) values
 ((select id from public.categories where slug='cursos'),'Design Essencial','design-essencial','Do zero ao portfólio.','Um curso direto ao ponto com fundamentos de design, tipografia e composição.',19700,true),
 ((select id from public.categories where slug='e-books'),'Foco Profundo','foco-profundo','Produtividade sem ruído.','E-book com métodos práticos para trabalhar com concentração total.',4700,true),
 ((select id from public.categories where slug='templates'),'Kit Notion Pro','kit-notion-pro','Organize sua vida.','Templates de Notion para finanças, metas e projetos.',2900,true)
on conflict (slug) do nothing;

update public.products set cover_url = '/images/' || slug || '.jpg' where slug in ('design-essencial','foco-profundo','kit-notion-pro');
