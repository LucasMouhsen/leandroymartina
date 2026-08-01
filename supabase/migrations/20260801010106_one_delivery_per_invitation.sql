-- The panel shows the current delivery activity for each invitation. Keep one
-- row per invitation so later actions replace the prior activity.
with duplicates as (
  select
    id,
    row_number() over (partition by invitation_id order by created_at desc, id desc) as row_number
  from public.invite_deliveries
)
delete from public.invite_deliveries
where id in (select id from duplicates where row_number > 1);

create unique index if not exists invite_deliveries_one_current_activity
on public.invite_deliveries (invitation_id);
