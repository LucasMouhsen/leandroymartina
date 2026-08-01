-- Guest invitations are delivered exclusively over WhatsApp. Clear every
-- previously stored guest email while keeping administrator authentication intact.
update public.invitations
set primary_contact_email = ''
where primary_contact_email <> '';

update public.invitation_members
set email = ''
where email <> '';

delete from public.invite_deliveries
where channel = 'email';
