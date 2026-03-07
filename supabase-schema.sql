-- Profiles table (auto-populated on sign-up via trigger)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  -- ECDH P-256 public key (raw, base64-encoded) used for E2E message encryption
  public_key text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Anonymous'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Posts table
create table posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);

alter table posts enable row level security;

create policy "Posts are viewable by everyone"
  on posts for select using (true);

create policy "Users can create posts"
  on posts for insert with check (auth.uid() = user_id);

create policy "Users can delete own posts"
  on posts for delete using (auth.uid() = user_id);

-- Ratings table
create table ratings (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  rating integer not null check (rating >= -5 and rating <= 10),
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

alter table ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on ratings for select using (true);

create policy "Users can insert own ratings"
  on ratings for insert with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on ratings for update using (auth.uid() = user_id);

-- Comments table
create table comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  text text not null check (char_length(text) > 0),
  created_at timestamptz default now()
);

alter table comments enable row level security;

create policy "Comments are viewable by everyone"
  on comments for select using (true);

create policy "Users can create comments"
  on comments for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on comments for delete using (auth.uid() = user_id);

-- Conversations table (between two users)
create table conversations (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references profiles(id) on delete cascade not null,
  user2_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user1_id, user2_id)
);

alter table conversations enable row level security;

create policy "Users can view own conversations"
  on conversations for select using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can create conversations"
  on conversations for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- Messages table
create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  text text not null check (char_length(text) > 0),
  -- true = text is AES-GCM ciphertext (base64), false = plaintext
  encrypted boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create policy "Users can view messages in own conversations"
  on messages for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (auth.uid() = c.user1_id or auth.uid() = c.user2_id)
    )
  );

create policy "Users can send messages in own conversations"
  on messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (auth.uid() = c.user1_id or auth.uid() = c.user2_id)
    )
  );

-- ── Migration (run these on an existing database) ───────────────────────────
-- alter table profiles add column if not exists public_key text;
-- alter table messages add column if not exists encrypted boolean default false;
-- ─────────────────────────────────────────────────────────────────────────────

-- Storage bucket for food images
insert into storage.buckets (id, name, public) values ('food-images', 'food-images', true);

create policy "Anyone can view food images"
  on storage.objects for select
  using (bucket_id = 'food-images');

create policy "Authenticated users can upload food images"
  on storage.objects for insert
  with check (bucket_id = 'food-images' and auth.role() = 'authenticated');
