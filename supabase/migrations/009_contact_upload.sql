create table contact_uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  uploaded_at timestamp with time zone default now(),
  filename text not null,
  total_rows integer,
  inserted_rows integer,
  updated_rows integer,
  error_rows integer
);

alter table contact_uploads enable row level security;
create policy "user can manage own uploads" on contact_uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
