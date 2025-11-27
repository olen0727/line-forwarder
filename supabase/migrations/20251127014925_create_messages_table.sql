create table messages (
  id bigint generated always as identity primary key,
  user_id text not null,
  user_name text,
  content text not null,
  created_at timestamptz default now()
);
