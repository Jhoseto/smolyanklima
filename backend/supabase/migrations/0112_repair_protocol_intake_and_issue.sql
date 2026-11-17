begin;

alter table public.service_repair_protocols
  add column workflow_stage text,
  add column issue_data jsonb;

-- Existing signatures predate the two-part form. Preserve their original modification dates.
alter table public.service_repair_protocols disable trigger trg_service_repair_protocols_updated_at;
update public.service_repair_protocols
set workflow_stage = case when status = 'signed' then 'legacy_signed' else 'intake' end;
alter table public.service_repair_protocols enable trigger trg_service_repair_protocols_updated_at;

-- Also accept single-part records from older backups which omit workflow_stage.
create function public.repair_protocol_default_stage()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.workflow_stage is null then
    new.workflow_stage := case when new.status = 'signed' then 'legacy_signed' else 'intake' end;
  end if;
  return new;
end;
$$;
create trigger trg_repair_protocol_default_stage before insert on public.service_repair_protocols
for each row execute function public.repair_protocol_default_stage();

alter table public.service_repair_protocols
  alter column workflow_stage set not null,
  add constraint service_repair_protocol_phase_check check ((
    case workflow_stage
      when 'intake' then status in ('prepared', 'in_progress') and issue_data is null
      when 'legacy_signed' then status = 'signed' and issue_data is null
      when 'received' then status = 'signed' and nullif(btrim(signature_team), '') is not null and issue_data is null
      when 'issuing' then status = 'signed' and jsonb_typeof(issue_data) = 'object'
        and issue_data->>'status' in ('prepared', 'in_progress')
      when 'issued' then status = 'signed' and jsonb_typeof(issue_data) = 'object'
        and issue_data->>'status' = 'signed' and nullif(btrim(issue_data->>'signature_team'), '') is not null
      else false
    end
  ) is true);

comment on column public.service_repair_protocols.issue_data is
  'Observations, date and technician signature at issue. The original columns retain the intake record.';
commit;
