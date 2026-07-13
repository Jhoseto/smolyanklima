-- Update primary company phone number
update public.settings
set value = '0878 58 16 16',
    updated_at = now()
where key = 'company_phone'
  and value is distinct from '0878 58 16 16';

update public.chat_canned_responses
set content = replace(content, '0888 58 58 16', '0878 58 16 16')
where content like '%0888 58 58 16%';
