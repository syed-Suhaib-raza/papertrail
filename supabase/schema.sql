create table public.audit_log (
  id uuid not null default gen_random_uuid (),
  entity text null,
  entity_id text null,
  action text null,
  performed_by uuid null,
  payload jsonb null,
  created_at timestamp with time zone null default now(),
  constraint audit_log_pkey primary key (id)
) TABLESPACE pg_default;

create table public.categories (
  id serial not null,
  slug text not null,
  name text not null,
  description text null,
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug)
) TABLESPACE pg_default;

create table public.citations (
  id uuid not null default gen_random_uuid (),
  paper_id uuid null,
  cited_text text not null,
  cited_doi text null,
  created_at timestamp with time zone null default now(),
  constraint citations_pkey primary key (id),
  constraint fk_citations_paper foreign KEY (paper_id) references papers (id) on delete CASCADE
) TABLESPACE pg_default;


create table public.coi_declarations (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  paper_id uuid null,
  role text null,
  statement text null,
  declared_at timestamp with time zone null default now(),
  constraint coi_declarations_pkey primary key (id),
  constraint fk_coi_paper foreign KEY (paper_id) references papers (id),
  constraint fk_coi_user foreign KEY (user_id) references profiles (id)
) TABLESPACE pg_default;

create table public.dois (
  id uuid not null default gen_random_uuid (),
  paper_id uuid null,
  doi text null,
  assigned_by uuid null,
  assigned_at timestamp with time zone null default now(),
  metadata jsonb null,
  constraint dois_pkey primary key (id),
  constraint dois_doi_key unique (doi),
  constraint dois_paper_id_key unique (paper_id),
  constraint fk_dois_assigned_by foreign KEY (assigned_by) references profiles (id),
  constraint fk_dois_paper foreign KEY (paper_id) references papers (id)
) TABLESPACE pg_default;






create table public.issue_papers (
  issue_id uuid not null,
  paper_id uuid not null,
  position integer null default 0,
  constraint issue_papers_pkey primary key (issue_id, paper_id),
  constraint fk_issue_papers_issue foreign KEY (issue_id) references issues (id) on delete CASCADE,
  constraint fk_issue_papers_paper foreign KEY (paper_id) references papers (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.issues (
  id uuid not null default gen_random_uuid (),
  title text not null,
  slug text null,
  volume text null,
  issue_number text null,
  type text null default 'journal'::text,
  scheduled_release_date date null,
  published boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint issues_pkey primary key (id),
  constraint issues_slug_key unique (slug)
) TABLESPACE pg_default;

create table public.keywords (
  id serial not null,
  word text not null,
  constraint keywords_pkey primary key (id),
  constraint keywords_word_key unique (word)
) TABLESPACE pg_default;

create table public.notifications (
  id uuid not null default gen_random_uuid (),
  recipient_id uuid null,
  actor_id uuid null,
  type text null,
  payload jsonb null,
  is_read boolean null default false,
  sent_at timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id),
  constraint fk_notifications_actor foreign KEY (actor_id) references profiles (id),
  constraint fk_notifications_recipient foreign KEY (recipient_id) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_notifications_recipient_unread on public.notifications using btree (recipient_id, is_read, sent_at desc) TABLESPACE pg_default;

create table public.paper_keywords (
  paper_id uuid not null,
  keyword_id integer not null,
  constraint paper_keywords_pkey primary key (paper_id, keyword_id),
  constraint fk_paper_keywords_keyword foreign KEY (keyword_id) references keywords (id) on delete CASCADE,
  constraint fk_paper_keywords_paper foreign KEY (paper_id) references papers (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.paper_versions (
  id uuid not null default gen_random_uuid (),
  paper_id uuid not null,
  version_number integer not null,
  file_path text null,
  file_mime text null,
  metadata jsonb null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  notes text null,
  constraint paper_versions_pkey primary key (id),
  constraint fk_paper_versions_created_by foreign KEY (created_by) references profiles (id),
  constraint fk_paper_versions_paper foreign KEY (paper_id) references papers (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists ux_paper_version_unique on public.paper_versions using btree (paper_id, version_number) TABLESPACE pg_default;

create table public.papers (
  id uuid not null default gen_random_uuid (),
  title text not null,
  abstract text null,
  category_id integer null,
  created_by uuid null,
  status public.paper_status null default 'submitted'::paper_status,
  current_version integer null default 1,
  submission_date timestamp with time zone null default now(),
  published_date timestamp with time zone null,
  is_withdrawn boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  keywords text null,
  constraint papers_pkey primary key (id),
  constraint fk_papers_category foreign KEY (category_id) references categories (id),
  constraint fk_papers_created_by foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

create trigger audit_papers
after INSERT
or DELETE
or
update on papers for EACH row
execute FUNCTION audit_insert ();

create trigger trg_ensure_doi
after
update on papers for EACH row when (old.status is distinct from new.status)
execute FUNCTION ensure_doi_on_publish ();

create trigger trg_notify_paper_status_change
after
update on papers for EACH row when (old.status is distinct from new.status)
execute FUNCTION notify_paper_status_change ();

create trigger trg_set_created_by BEFORE INSERT on papers for EACH row
execute FUNCTION set_created_by_from_auth ();

create trigger trg_set_updated_at BEFORE
update on papers for EACH row
execute FUNCTION set_updated_at_column ();

create table public.plagiarism_reports (
  id uuid not null default gen_random_uuid (),
  paper_id1 uuid not null,
  created_at timestamp with time zone null default now(),
  paper_id2 uuid not null,
  constraint plagiarism_reports_pkey primary key (id),
  constraint plagiarism_reports_paper_id1_fkey foreign KEY (paper_id1) references papers (id) on delete CASCADE,
  constraint plagiarism_reports_paper_id2_fkey foreign KEY (paper_id2) references papers (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create table public.profiles (
  id uuid not null default gen_random_uuid (),
  full_name text not null,
  email text not null,
  affiliation text null,
  orcid text null,
  role public.user_role null default 'author'::user_role,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  auth_id uuid null,
  spec integer null,
  constraint profiles_pkey primary key (id),
  constraint fk_profiles_auth_id foreign KEY (auth_id) references auth.users (id) on delete CASCADE,
  constraint profiles_spec_fkey foreign KEY (spec) references categories (id) on update CASCADE on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists idx_profiles_email on public.profiles using btree (email) TABLESPACE pg_default;

create table public.review_assignments (
  id uuid not null default gen_random_uuid (),
  paper_id uuid not null,
  reviewer_id uuid not null,
  assigned_by uuid null,
  assigned_at timestamp with time zone null default now(),
  due_date timestamp with time zone null,
  status public.review_status null default 'assigned'::review_status,
  priority public.assignment_priority null default 'normal'::assignment_priority,
  expertise_match_score numeric(5, 2) null,
  notes text null,
  constraint review_assignments_pkey primary key (id),
  constraint fk_review_assignments_assigned_by foreign KEY (assigned_by) references profiles (id),
  constraint fk_review_assignments_paper foreign KEY (paper_id) references papers (id) on delete CASCADE,
  constraint fk_review_assignments_reviewer foreign KEY (reviewer_id) references profiles (id)
) TABLESPACE pg_default;

create trigger trg_log_assignment_status
after
update on review_assignments for EACH row
execute FUNCTION trg_log_assignment_status ();

create trigger trg_notify_editors_assignment_submitted
after
update on review_assignments for EACH row when (old.status is distinct from new.status)
execute FUNCTION notify_editors_on_assignment_submitted ();

create trigger trg_notify_reviewer_assignment
after INSERT on review_assignments for EACH row
execute FUNCTION notify_reviewer_on_assignment ();

create table public.reviewer_activity (
  id uuid not null default gen_random_uuid (),
  reviewer_id uuid null,
  assignment_id uuid null,
  action text null,
  details jsonb null,
  created_at timestamp with time zone null default now(),
  constraint reviewer_activity_pkey primary key (id),
  constraint fk_activity_assignment foreign KEY (assignment_id) references review_assignments (id),
  constraint fk_activity_reviewer foreign KEY (reviewer_id) references profiles (id)
) TABLESPACE pg_default;

create table public.reviews (
  id uuid not null default gen_random_uuid (),
  assignment_id uuid not null,
  paper_id uuid not null,
  reviewer_id uuid not null,
  review_text text null,
  ratings jsonb null,
  overall_score numeric(5, 2) null,
  recommendation public.decision_type null,
  submitted_at timestamp with time zone null,
  is_anonymous boolean null default true,
  created_at timestamp with time zone null default now(),
  constraint reviews_pkey primary key (id),
  constraint fk_reviews_assignment foreign KEY (assignment_id) references review_assignments (id) on delete CASCADE,
  constraint fk_reviews_paper foreign KEY (paper_id) references papers (id) on delete CASCADE,
  constraint fk_reviews_reviewer foreign KEY (reviewer_id) references profiles (id)
) TABLESPACE pg_default;

create trigger audit_reviews
after INSERT
or DELETE
or
update on reviews for EACH row
execute FUNCTION audit_insert ();

create trigger trg_log_review_submitted
after INSERT on reviews for EACH row
execute FUNCTION trg_log_review_submitted ();

create table public.submission_stats (
  day date not null,
  total_submissions integer null default 0,
  total_published integer null default 0,
  total_under_review integer null default 0,
  acceptance_rate numeric(5, 2) null,
  constraint submission_stats_pkey primary key (day)
) TABLESPACE pg_default;