-- The raw token is returned once to the authorised administrator; only its
-- SHA-256 hash remains stored in the database.
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

  generated_token := encode(gen_random_bytes(32), 'hex');

  update public.invitations
  set token_hash = encode(digest(generated_token, 'sha256'), 'hex'),
      access_status = 'active'
  where id = p_invitation_id;

  return generated_token;
end;
$$;

revoke all on function public.regenerate_invitation_token(uuid) from public, anon;
grant execute on function public.regenerate_invitation_token(uuid) to authenticated;
