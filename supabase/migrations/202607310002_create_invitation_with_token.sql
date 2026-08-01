-- Invitation tokens must be generated and hashed on the server. This also
-- avoids relying on Web Crypto support in the administrator's browser.
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

  generated_token := encode(gen_random_bytes(32), 'hex');

  insert into public.invitations (
    event_id,
    display_label,
    category,
    invitation_mode,
    token_hash,
    allowed_seats,
    notes,
    primary_contact_first_name,
    primary_contact_last_name,
    primary_contact_email,
    primary_contact_phone
  ) values (
    p_event_id,
    p_display_label,
    p_category,
    p_invitation_mode,
    encode(digest(generated_token, 'sha256'), 'hex'),
    p_allowed_seats,
    coalesce(p_notes, ''),
    coalesce(p_primary_contact_first_name, ''),
    coalesce(p_primary_contact_last_name, ''),
    coalesce(p_primary_contact_email, ''),
    coalesce(p_primary_contact_phone, '')
  ) returning * into created_invitation;

  return query select to_jsonb(created_invitation), generated_token;
end;
$$;

revoke all on function public.create_invitation_with_token(uuid, text, text, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.create_invitation_with_token(uuid, text, text, text, integer, text, text, text, text, text) to authenticated;
