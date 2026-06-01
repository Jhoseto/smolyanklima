-- Update primary company contact email
update public.settings
set value = 'smolyanklima@gmail.com',
    updated_at = now()
where key = 'company_email'
  and value is distinct from 'smolyanklima@gmail.com';
