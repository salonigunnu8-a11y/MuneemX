-- Run ONCE in Supabase → SQL Editor after you have created your own login
-- (sign up in the app with your e-mail, or Authentication → Users → Add user).
-- Replace the e-mail below with yours. This makes you the MuneemX platform admin.
insert into public.platform_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
