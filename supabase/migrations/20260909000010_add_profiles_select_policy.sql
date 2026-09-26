-- Add RLS SELECT policies for the profiles table.
-- RLS is already enabled on the table; this migration only adds policies
-- (no ENABLE ROW LEVEL SECURITY statement).

-- Users can always read their own profile row.
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Landlords can read all profile rows (needed to list tenants).
-- Role is stored in auth.users.raw_user_meta_data via signUp's options.data.
create policy "Landlords can view all profiles"
on public.profiles
for select
to authenticated
using (
  (select raw_user_meta_data ->> 'role'
   from auth.users
   where id = auth.uid()) = 'landlord'
);