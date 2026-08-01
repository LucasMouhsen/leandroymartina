-- Las familias y personas pueden compartir apellido o nombre de grupo.
-- La invitacion se identifica por su UUID y token de acceso, no por su etiqueta.
drop index if exists public.invitations_event_display_label_unique;
