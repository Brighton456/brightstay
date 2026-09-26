-- Add a SELECT policy so caretakers can view all profiles,
-- mirroring the landlord policy from 00010.

create policy "Caretakers can view all profiles"
on public.profiles
for select
to authenticated
using (
  (select raw_user_meta_data ->> 'role' from auth.users where id = auth.uid()) = 'caretaker'
);