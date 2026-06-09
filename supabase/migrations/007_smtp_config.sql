/* Supabase migration: create smtp_configs table */
create table smtp_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  host text not null,
  port integer not null,
  username text not null,
  password text not null,
  tls boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- enable row level security
alter table smtp_configs enable row level security;

create policy "Allow user to manage own smtp config" on smtp_configs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
