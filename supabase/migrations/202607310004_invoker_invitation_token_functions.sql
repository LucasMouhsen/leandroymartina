-- The RPCs rely on the existing admin RLS policies; they do not need elevated
-- database privileges.
alter function public.create_invitation_with_token(uuid, text, text, text, integer, text, text, text, text, text)
  security invoker;

alter function public.regenerate_invitation_token(uuid)
  security invoker;
