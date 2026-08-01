create extension if not exists pgcrypto;

create type public.invitation_access_status as enum ('active', 'paused');
create type public.rsvp_status as enum ('confirmado', 'rechazado');
create type public.moderation_status as enum ('pendiente_aprobacion', 'aprobado', 'rechazado');
create type public.contribution_status as enum ('pendiente_validacion', 'validado', 'rechazado');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple text not null,
  event_date timestamptz not null,
  location text not null,
  rsvp_deadline date not null,
  allow_song_voting boolean not null default true,
  gift_instructions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_label text not null,
  category text not null default 'otros',
  invitation_mode text not null check (invitation_mode in ('individual', 'group')),
  token_hash text not null unique,
  allowed_seats smallint not null check (allowed_seats between 1 and 12),
  notes text not null default '',
  primary_contact_first_name text not null,
  primary_contact_last_name text not null default '',
  primary_contact_email text not null default '',
  primary_contact_phone text not null default '',
  access_status public.invitation_access_status not null default 'active',
  delivery_status text not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invitations_event_display_label_unique on public.invitations(event_id, lower(display_label));

create table public.invitation_members (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index invitation_one_primary_member on public.invitation_members(invitation_id) where is_primary;

create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  status public.rsvp_status not null,
  attending_count smallint not null default 0,
  dietary_restrictions text not null default '',
  comments text not null default '',
  updated_at timestamptz not null default now()
);

create table public.rsvp_attendees (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.rsvp_responses(id) on delete cascade,
  member_id uuid references public.invitation_members(id) on delete set null,
  attendee_type text not null check (attendee_type in ('member', 'companion')),
  name text not null,
  attending boolean not null default false,
  dietary_restrictions text not null default ''
);

create table public.gift_items (
  id text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text not null default '',
  suggested_amount numeric(12,2) not null check (suggested_amount > 0),
  currency char(3) not null default 'ARS',
  image_url text not null default '',
  collection text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gift_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  gift_item_id text references public.gift_items(id) on delete set null,
  guest_name text not null,
  guest_contact text not null,
  amount numeric(12,2) not null check (amount > 0),
  notes text not null default '',
  proof_path text,
  status public.contribution_status not null default 'pendiente_validacion',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  note text not null,
  photo_path text,
  status public.moderation_status not null default 'pendiente_aprobacion',
  created_at timestamptz not null default now()
);

create table public.song_suggestions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  artist text not null default '',
  requested_by text not null,
  votes integer not null default 0,
  status public.moderation_status not null default 'pendiente_aprobacion',
  created_at timestamptz not null default now()
);

create table public.invite_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  channel text not null,
  type text not null,
  status text not null default 'prepared',
  recipient text not null default '',
  message text not null default '',
  invite_link text not null default '',
  operator_id uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_id text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(target_event_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and event_id = target_event_id)
$$;

alter table public.events enable row level security;
alter table public.admins enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_members enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvp_attendees enable row level security;
alter table public.gift_items enable row level security;
alter table public.gift_contributions enable row level security;
alter table public.guest_messages enable row level security;
alter table public.song_suggestions enable row level security;
alter table public.invite_deliveries enable row level security;
alter table public.audit_log enable row level security;

create policy "public reads event details" on public.events for select using (true);
create policy "public reads active gifts" on public.gift_items for select using (active);
create policy "public reads approved messages" on public.guest_messages for select using (status = 'aprobado');
create policy "public reads approved songs" on public.song_suggestions for select using (status = 'aprobado');
create policy "admins manage events" on public.events for all using (public.is_admin(id)) with check (public.is_admin(id));
create policy "admins manage admins" on public.admins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins manage invitations" on public.invitations for all using (public.is_admin(event_id)) with check (public.is_admin(event_id));
create policy "admins manage members" on public.invitation_members for all using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id))) with check (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id)));
create policy "admins manage rsvp" on public.rsvp_responses for all using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id))) with check (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id)));
create policy "admins manage attendees" on public.rsvp_attendees for all using (exists (select 1 from public.rsvp_responses r join public.invitations i on i.id = r.invitation_id where r.id = response_id and public.is_admin(i.event_id))) with check (exists (select 1 from public.rsvp_responses r join public.invitations i on i.id = r.invitation_id where r.id = response_id and public.is_admin(i.event_id)));
create policy "admins manage gifts" on public.gift_items for all using (public.is_admin(event_id)) with check (public.is_admin(event_id));
create policy "admins manage contributions" on public.gift_contributions for all using (public.is_admin(event_id)) with check (public.is_admin(event_id));
create policy "admins manage messages" on public.guest_messages for all using (public.is_admin(event_id)) with check (public.is_admin(event_id));
create policy "admins manage songs" on public.song_suggestions for all using (public.is_admin(event_id)) with check (public.is_admin(event_id));
create policy "admins manage deliveries" on public.invite_deliveries for all using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id))) with check (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_admin(i.event_id)));
create policy "admins read audit" on public.audit_log for select using (public.is_admin(event_id));

insert into storage.buckets (id, name, public) values ('wedding-uploads', 'wedding-uploads', false)
on conflict (id) do nothing;
create policy "admins manage wedding uploads" on storage.objects for all to authenticated using (bucket_id = 'wedding-uploads' and exists (select 1 from public.admins where user_id = auth.uid())) with check (bucket_id = 'wedding-uploads' and exists (select 1 from public.admins where user_id = auth.uid()));
