create extension if not exists "pgcrypto";

create type user_role as enum ('author','reviewer','editor','admin','guest');
create type paper_status as enum ('submitted','under_review','revise','accepted','rejected','published','withdrawn');
create type review_status as enum ('assigned','in_progress','submitted','late','declined');
create type decision_type as enum ('accept','reject','major_revision','minor_revision');
create type assignment_priority as enum ('low','normal','high');

-------------------------
-- TABLES WITHOUT FOREIGN KEYS
-------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  affiliation text,
  orcid text,
  role user_role default 'author',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_email on profiles(email);

create table categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  description text
);

create table keywords (
  id serial primary key,
  word text not null unique
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  abstract text,
  category_id int,
  created_by uuid,
  status paper_status default 'submitted',
  current_version int default 1,
  submission_date timestamptz default now(),
  published_date timestamptz,
  is_withdrawn boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table paper_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null,
  version_number int not null,
  file_path text,
  file_mime text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz default now(),
  notes text
);

create unique index ux_paper_version_unique on paper_versions (paper_id, version_number);

create table paper_keywords (
  paper_id uuid not null,
  keyword_id int not null,
  primary key (paper_id, keyword_id)
);

create table plagiarism_reports (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null,
  provider text,
  report_url text,
  similarity_score numeric(5,2),
  raw_result jsonb,
  created_at timestamptz default now()
);

create table review_assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null,
  reviewer_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz default now(),
  due_date timestamptz,
  status review_status default 'assigned',
  priority assignment_priority default 'normal',
  expertise_match_score numeric(5,2),
  notes text
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  paper_id uuid not null,
  reviewer_id uuid not null,
  review_text text,
  ratings jsonb,
  overall_score numeric(5,2),
  recommendation decision_type,
  submitted_at timestamptz,
  is_anonymous boolean default true,
  created_at timestamptz default now()
);

create table editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null,
  decided_by uuid,
  decision decision_type not null,
  decision_notes text,
  decided_at timestamptz default now()
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  volume text,
  issue_number text,
  type text default 'journal',
  scheduled_release_date date,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table issue_papers (
  issue_id uuid,
  paper_id uuid,
  position int default 0,
  primary key (issue_id, paper_id)
);

create table dois (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid unique,
  doi text unique,
  assigned_by uuid,
  assigned_at timestamptz default now(),
  metadata jsonb
);

create table citations (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid,
  cited_text text not null,
  cited_doi text,
  created_at timestamptz default now()
);

create table coi_declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  paper_id uuid,
  role text,
  statement text,
  declared_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid,
  actor_id uuid,
  type text,
  payload jsonb,
  is_read boolean default false,
  sent_at timestamptz default now()
);

create table reviewer_activity (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid,
  assignment_id uuid,
  action text,
  details jsonb,
  created_at timestamptz default now()
);

create table submission_stats (
  day date not null,
  total_submissions int default 0,
  total_published int default 0,
  total_under_review int default 0,
  acceptance_rate numeric(5,2),
  primary key (day)
);

create table editorial_board (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  role text,
  scope jsonb,
  joined_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity text,
  entity_id text,
  action text,
  performed_by uuid,
  payload jsonb,
  created_at timestamptz default now()
);

-------------------------
-- ADD FOREIGN KEY CONSTRAINTS
-------------------------
alter table profiles
  add constraint fk_profiles_auth_id foreign key (id) references auth.users(id) on delete cascade;

alter table papers
  add constraint fk_papers_category foreign key (category_id) references categories(id),
  add constraint fk_papers_created_by foreign key (created_by) references profiles(id);

alter table paper_versions
  add constraint fk_paper_versions_paper foreign key (paper_id) references papers(id) on delete cascade,
  add constraint fk_paper_versions_created_by foreign key (created_by) references profiles(id);

alter table paper_keywords
  add constraint fk_paper_keywords_paper foreign key (paper_id) references papers(id) on delete cascade,
  add constraint fk_paper_keywords_keyword foreign key (keyword_id) references keywords(id) on delete cascade;

alter table plagiarism_reports
  add constraint fk_plagiarism_paper foreign key (paper_id) references papers(id) on delete cascade;

alter table review_assignments
  add constraint fk_review_assignments_paper foreign key (paper_id) references papers(id) on delete cascade,
  add constraint fk_review_assignments_reviewer foreign key (reviewer_id) references profiles(id),
  add constraint fk_review_assignments_assigned_by foreign key (assigned_by) references profiles(id);

alter table reviews
  add constraint fk_reviews_assignment foreign key (assignment_id) references review_assignments(id) on delete cascade,
  add constraint fk_reviews_paper foreign key (paper_id) references papers(id) on delete cascade,
  add constraint fk_reviews_reviewer foreign key (reviewer_id) references profiles(id);

alter table editorial_decisions
  add constraint fk_editorial_decisions_paper foreign key (paper_id) references papers(id),
  add constraint fk_editorial_decisions_by foreign key (decided_by) references profiles(id);

alter table issue_papers
  add constraint fk_issue_papers_issue foreign key (issue_id) references issues(id) on delete cascade,
  add constraint fk_issue_papers_paper foreign key (paper_id) references papers(id) on delete cascade;

alter table dois
  add constraint fk_dois_paper foreign key (paper_id) references papers(id),
  add constraint fk_dois_assigned_by foreign key (assigned_by) references profiles(id);

alter table citations
  add constraint fk_citations_paper foreign key (paper_id) references papers(id) on delete cascade;

alter table coi_declarations
  add constraint fk_coi_user foreign key (user_id) references profiles(id),
  add constraint fk_coi_paper foreign key (paper_id) references papers(id);

alter table notifications
  add constraint fk_notifications_recipient foreign key (recipient_id) references profiles(id),
  add constraint fk_notifications_actor foreign key (actor_id) references profiles(id);

alter table reviewer_activity
  add constraint fk_activity_reviewer foreign key (reviewer_id) references profiles(id),
  add constraint fk_activity_assignment foreign key (assignment_id) references review_assignments(id);

alter table editorial_board
  add constraint fk_editorial_board_profile foreign key (profile_id) references profiles(id);


create or replace function audit_insert()
returns trigger language plpgsql as $$
begin
  insert into audit_log(entity, entity_id, action, performed_by, payload, created_at)
  values (TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text), TG_OP, NULL, row_to_json(COALESCE(NEW,OLD)), now());
  return NEW;
end;
$$;

-- Example: attach to a subset of tables
create trigger audit_papers
after insert or update or delete on papers
for each row
execute procedure audit_insert();

create trigger audit_reviews
after insert or update or delete on reviews
for each row
execute procedure audit_insert();


create or replace function generate_simple_doi(paper_uuid uuid)
returns text language plpgsql as $$
begin
  return concat('10.0000/PT-', substring(paper_uuid::text,1,8));
end;
$$;

create or replace function ensure_doi_on_publish()
returns trigger language plpgsql as $$
declare
  existing text;
  newdoi text;
begin
  if new.status = 'published' and old.status is distinct from new.status then
    select doi into existing from dois where paper_id = new.id;
    if existing is null then
      newdoi := generate_simple_doi(new.id);
      insert into dois (paper_id, doi, assigned_by, assigned_at, metadata)
      values (new.id, newdoi, null, now(), jsonb_build_object('title', new.title));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_ensure_doi
after update on papers
for each row
when (old.status is distinct from new.status)
execute procedure ensure_doi_on_publish();


create or replace function save_paper_revision()
returns trigger language plpgsql as $$
declare
  next_version int;
begin
  -- compute next version number based on existing versions
  select coalesce(max(version_number), 0) + 1 into next_version
  from paper_versions
  where paper_id = OLD.id;

  insert into paper_versions (
    paper_id, version_number, file_path, file_mime, metadata, created_by, created_at, notes
  ) values (
    OLD.id,
    next_version,
    NULL, -- you may copy an old file_path if storing files
    NULL,
    jsonb_build_object('title', OLD.title, 'abstract', OLD.abstract, 'status', OLD.status),
    OLD.created_by,
    now(),
    'auto-snapshot-before-update'
  );

  -- advance current_version in papers
  new.current_version = next_version + 0; -- keep caller responsible; alternatively set to next_version
  return new;
end;
$$;

create trigger trg_save_paper_revision
before update on papers
for each row
when (OLD.* IS DISTINCT FROM NEW.*)
execute procedure save_paper_revision();



create or replace function set_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_set_updated_at
before update on papers
for each row
execute procedure set_updated_at_column();







-- 1) Drop the bad constraint if it exists
ALTER TABLE IF EXISTS profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_auth_id;

-- 2) Add an auth_id column to profiles (if you don't already have one)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS auth_id uuid;

-- 3) Add the correct foreign key linking profiles.auth_id -> auth.users(id)
--    NOTE: Supabase creates the "auth" schema; make sure your project has auth.users table.
ALTER TABLE IF EXISTS profiles
  ADD CONSTRAINT fk_profiles_auth_id
  FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
select
  con.conname as constraint_name,
  conrelid::regclass as table_from,
  a.attname as column_from,
  confrelid::regclass as table_to,
  af.attname as column_to
from pg_constraint con
join lateral unnest(con.conkey) with ordinality as cols(attnum, ord) on true
join pg_attribute a on a.attrelid = con.conrelid and a.attnum = cols.attnum
join lateral unnest(con.confkey) with ordinality as cols2(attnum, ord2) on cols.ord = cols2.ord2
join pg_attribute af on af.attrelid = con.confrelid and af.attnum = cols2.attnum
where con.contype = 'f';
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public';
