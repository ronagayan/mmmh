-- Profiles table (auto-populated on sign-up via trigger)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
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

-- Storage bucket for food images
insert into storage.buckets (id, name, public) values ('food-images', 'food-images', true);

create policy "Anyone can view food images"
  on storage.objects for select
  using (bucket_id = 'food-images');

create policy "Authenticated users can upload food images"
  on storage.objects for insert
  with check (bucket_id = 'food-images' and auth.role() = 'authenticated');
