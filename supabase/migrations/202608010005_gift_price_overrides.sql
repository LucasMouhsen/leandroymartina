create table public.gift_price_overrides (
  event_id uuid not null references public.events(id) on delete cascade,
  gift_item_id text not null,
  suggested_amount numeric(12,2) not null check (suggested_amount > 0),
  updated_at timestamptz not null default now(),
  primary key (event_id, gift_item_id)
);

alter table public.gift_price_overrides enable row level security;

grant select on table public.gift_price_overrides to anon;
grant select, insert, update, delete on table public.gift_price_overrides to authenticated;

create policy "public reads gift price overrides"
  on public.gift_price_overrides for select to anon, authenticated
  using (true);

create policy "admins manage gift price overrides"
  on public.gift_price_overrides for all to authenticated
  using (public.is_admin(event_id))
  with check (public.is_admin(event_id));
