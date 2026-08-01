-- Seven base64url characters give 42 bits of cryptographically secure entropy
-- while keeping the invitation link short and easy to share.
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
begin
  if auth.uid() is null or not public.is_admin(p_event_id) then
    raise exception 'No autorizado para crear invitaciones.' using errcode = '42501';
  end if;

  if p_allowed_seats < 1 then
    raise exception 'El cupo debe ser mayor a cero.' using errcode = '22023';
  end if;

  -- 6 random bytes encode to 8 base64 characters without padding. The first
  -- seven are URL-safe after translating the two non-URL-safe characters.
  generated_token := substring(translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_') from 1 for 7);

  insert into public.invitations (
    event_id, display_label, category, invitation_mode, token_hash, allowed_seats,
    notes, primary_contact_first_name, primary_contact_last_name,
    primary_contact_email, primary_contact_phone
  ) values (
    p_event_id, p_display_label, p_category, p_invitation_mode,
    encode(digest(generated_token, 'sha256'), 'hex'), p_allowed_seats,
    coalesce(p_notes, ''), coalesce(p_primary_contact_first_name, ''),
    coalesce(p_primary_contact_last_name, ''), coalesce(p_primary_contact_email, ''),
    coalesce(p_primary_contact_phone, '')
  ) returning * into created_invitation;

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

  generated_token := substring(translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_') from 1 for 7);

  update public.invitations
  set token_hash = encode(digest(generated_token, 'sha256'), 'hex'),
      access_status = 'active'
  where id = p_invitation_id;

  return generated_token;
end;
$$;
