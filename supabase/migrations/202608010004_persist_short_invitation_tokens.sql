-- Short links are an operational identifier for the invitation.  Keeping the
-- generated value avoids silently invalidating it whenever an administrator
-- reloads the panel or copies it again.
alter table public.invitations
  add column if not exists access_token text;

-- Backfill current invitations once. These are random 42-bit base64url codes,
-- deliberately short enough to be shared by WhatsApp.
update public.invitations
set access_token = substring(translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_') from 1 for 7)
where access_token is null;

alter table public.invitations
  alter column access_token set not null;

alter table public.invitations
  drop constraint if exists invitations_access_token_format,
  add constraint invitations_access_token_format
    check (access_token ~ '^[A-Za-z0-9_-]{7}$');

create unique index if not exists invitations_access_token_unique
  on public.invitations (access_token);

create or replace function public.create_invitation_with_token(
  p_event_id uuid,
  p_display_label text,
  p_category text,
  p_invitation_mode text,
  p_allowed_seats integer,
  p_notes text,
  p_primary_contact_first_name text,
  p_primary_contact_last_name text,
  p_primary_contact_email text,
  p_primary_contact_phone text
)
returns table (invitation jsonb, token text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  generated_token text;
  created_invitation public.invitations;
  violated_constraint text;
begin
  if auth.uid() is null or not public.is_admin(p_event_id) then
    raise exception 'No autorizado para crear invitaciones.' using errcode = '42501';
  end if;

  if p_allowed_seats < 1 then
    raise exception 'El cupo debe ser mayor a cero.' using errcode = '22023';
  end if;

  loop
    generated_token := substring(translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_') from 1 for 7);
    begin
      insert into public.invitations (
        event_id, display_label, category, invitation_mode, token_hash, access_token, allowed_seats,
        notes, primary_contact_first_name, primary_contact_last_name,
        primary_contact_email, primary_contact_phone
      ) values (
        p_event_id, p_display_label, p_category, p_invitation_mode,
        encode(digest(generated_token, 'sha256'), 'hex'), generated_token, p_allowed_seats,
        coalesce(p_notes, ''), coalesce(p_primary_contact_first_name, ''),
        coalesce(p_primary_contact_last_name, ''), coalesce(p_primary_contact_email, ''),
        coalesce(p_primary_contact_phone, '')
      ) returning * into created_invitation;
      exit;
    exception when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint <> 'invitations_access_token_unique' then
        raise;
      end if;
    end;
  end loop;

  return query select to_jsonb(created_invitation), generated_token;
end;
$$;

create or replace function public.regenerate_invitation_token(p_invitation_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  invitation_event_id uuid;
  generated_token text;
begin
  select event_id into invitation_event_id
  from public.invitations
  where id = p_invitation_id;

  if invitation_event_id is null or auth.uid() is null or not public.is_admin(invitation_event_id) then
    raise exception 'No autorizado para regenerar este enlace.' using errcode = '42501';
  end if;

  loop
    generated_token := substring(translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_') from 1 for 7);
    begin
      update public.invitations
      set access_token = generated_token,
          token_hash = encode(digest(generated_token, 'sha256'), 'hex'),
          access_status = 'active'
      where id = p_invitation_id;
      exit;
    exception when unique_violation then
      -- astronomically unlikely, but retry rather than returning a broken link
      null;
    end;
  end loop;

  return generated_token;
end;
$$;
