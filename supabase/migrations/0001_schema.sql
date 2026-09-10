-- ============================================================================
-- AbonoShare — core schema
-- Money is stored as INTEGER CENTAVOS everywhere. Never numeric, never float.
-- Currency is PHP only for the MVP (one currency per group, requirement 11).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
create type member_role      as enum ('owner', 'member');
create type member_status    as enum ('active', 'left', 'removed');
create type split_mode       as enum ('equal', 'exact');
create type expense_category as enum (
  'food_dining', 'groceries', 'transportation', 'rent_utilities',
  'travel', 'entertainment', 'shopping', 'work', 'other'
);
create type settlement_status as enum ('pending', 'confirmed', 'rejected');
create type payment_method    as enum ('gcash', 'maya', 'bank_transfer', 'cash', 'other', 'unspecified');
create type recurrence        as enum ('daily', 'weekly', 'monthly', 'yearly');

-- ------------------------------------------------------------- profiles ----
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Member',
  avatar_url   text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Requirement 31: soft delete + anonymise. Historical rows keep pointing here.
  deleted_at   timestamptz
);

-- --------------------------------------------------------------- groups ----
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  avatar_url  text,
  avatar_seed text not null default encode(gen_random_bytes(6), 'hex'),
  currency    char(3) not null default 'PHP' check (currency = 'PHP'),
  owner_id    uuid not null references profiles(id),
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       member_role   not null default 'member',
  status     member_status not null default 'active',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  removed_by uuid references profiles(id),
  unique (group_id, user_id)
);

create index group_members_user_idx  on group_members (user_id) where status = 'active';
create index group_members_group_idx on group_members (group_id);

-- Requirement 4: shareable link + QR, invitee must accept.
create table group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses   integer,
  uses       integer not null default 0,
  revoked_at timestamptz
);

create index group_invites_group_idx on group_invites (group_id);

-- ------------------------------------------------------------- expenses ----
create table expenses (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references groups(id) on delete cascade,
  description      text not null check (length(trim(description)) between 1 and 120),
  amount_centavos  bigint not null check (amount_centavos > 0),
  payer_id         uuid not null references profiles(id),
  category         expense_category not null default 'other',
  note             text,
  split_mode       split_mode not null default 'equal',
  receipt_path     text,
  created_by       uuid not null references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references profiles(id),
  -- Requirement 14: soft delete only. The row and its history always survive.
  deleted_at       timestamptz,
  deleted_by       uuid references profiles(id)
);

create index expenses_group_idx   on expenses (group_id, created_at desc);
create index expenses_payer_idx   on expenses (payer_id);
create index expenses_active_idx  on expenses (group_id) where deleted_at is null;

create table expense_participants (
  expense_id      uuid not null references expenses(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  share_centavos  bigint not null check (share_centavos >= 0),
  primary key (expense_id, user_id)
);

create index expense_participants_user_idx on expense_participants (user_id);

-- Requirement 13: who -> what changed -> previous value -> new value -> when.
create table expense_revisions (
  id             uuid primary key default gen_random_uuid(),
  expense_id     uuid not null references expenses(id) on delete cascade,
  edited_by      uuid not null references profiles(id),
  edited_at      timestamptz not null default now(),
  changed_fields text[] not null default '{}',
  before_value   jsonb not null,
  after_value    jsonb not null
);

create index expense_revisions_expense_idx on expense_revisions (expense_id, edited_at desc);

create table expense_comments (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id    uuid not null references profiles(id),
  body       text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expense_comments_expense_idx on expense_comments (expense_id, created_at);

-- ---------------------------------------------------------- settlements ----
create table settlements (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  from_user_id    uuid not null references profiles(id),
  to_user_id      uuid not null references profiles(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  status          settlement_status not null default 'pending',
  method          payment_method not null default 'unspecified',
  note            text,
  -- Requirement 23: visible ONLY to from_user and to_user. Enforced in storage RLS.
  proof_path      text,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  deleted_at      timestamptz,
  constraint settlement_not_self check (from_user_id <> to_user_id)
);

create index settlements_group_idx on settlements (group_id, created_at desc);
create index settlements_party_idx on settlements (from_user_id, to_user_id);

-- ------------------------------------------------------- activity + fyi ----
create table activity_log (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  actor_id     uuid references profiles(id),
  action       text not null,
  subject_type text not null,
  subject_id   uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index activity_log_group_idx on activity_log (group_id, created_at desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  group_id   uuid references groups(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

-- ------------------------------------------------- recurring (module 30) ---
-- A template/reminder, NOT an automatic financial record. Each occurrence is
-- confirmed by a human and only then becomes a normal expense.
create table recurring_templates (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references groups(id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 120),
  amount_centavos   bigint check (amount_centavos is null or amount_centavos > 0),
  category          expense_category not null default 'other',
  frequency         recurrence not null,
  next_due_on       date not null,
  default_payer_id  uuid references profiles(id),
  default_participants uuid[] not null default '{}',
  active            boolean not null default true,
  created_by        uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index recurring_templates_group_idx on recurring_templates (group_id) where deleted_at is null;

create table recurring_occurrences (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references recurring_templates(id) on delete cascade,
  due_on      date not null,
  expense_id  uuid references expenses(id) on delete set null,
  skipped_at  timestamptz,
  recorded_by uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (template_id, due_on)
);

-- ---------------------------------------------------- updated_at helper ----
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger groups_touch   before update on groups   for each row execute function touch_updated_at();
create trigger expenses_touch before update on expenses for each row execute function touch_updated_at();
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();

-- ------------------------------------------- profile row for every user ----
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
