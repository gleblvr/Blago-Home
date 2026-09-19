-- Run once in your Supabase SQL editor. Never expose the service_role key.
create table public.site_admins (user_id uuid primary key references auth.users(id));
alter table public.site_admins enable row level security;
create policy "Admins can see own membership" on public.site_admins for select to authenticated using (user_id=auth.uid());
create table public.properties (
 id text primary key,
 name text not null,
 location text not null default 'Эйлат',
 description text not null default '',
 price text not null default 'Условия по запросу',
 visible boolean not null default false,
 sort_order integer not null default 0,
 photos jsonb not null default '[]'::jsonb
);
alter table public.properties enable row level security;
create policy "Public reads published properties" on public.properties for select to anon, authenticated using (visible=true);
create policy "Only site admins manage properties" on public.properties for all to authenticated
 using (exists(select 1 from public.site_admins where user_id=auth.uid()))
 with check (exists(select 1 from public.site_admins where user_id=auth.uid()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('property-photos','property-photos',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy "Only admins upload photos" on storage.objects for insert to authenticated
 with check (bucket_id='property-photos' and exists(select 1 from public.site_admins where user_id=auth.uid()));
create policy "Only admins manage photos" on storage.objects for delete to authenticated
 using (bucket_id='property-photos' and exists(select 1 from public.site_admins where user_id=auth.uid()));
-- Create your user in Authentication first, then add its UUID here:
-- insert into public.site_admins(user_id) values ('YOUR-USER-UUID');
