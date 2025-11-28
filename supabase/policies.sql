-- policies.sql (PaperTrail)
-- Reference: PaperTrail project proposal. :contentReference[oaicite:1]{index=1}

-- -----------------------------
-- Helper functions
-- -----------------------------

create or replace function current_profile_id()
returns uuid stable language sql as $$
  select id from public.profiles where auth_id = auth.uid() limit 1;
$$;

create or replace function current_user_role()
returns user_role stable language sql as $$
  select role from public.profiles where auth_id = auth.uid() limit 1;
$$;

create or replace function is_admin()
returns boolean stable language sql as $$
  select exists (select 1 from public.profiles where auth_id = auth.uid() and role = 'admin');
$$;

create or replace function is_editor()
returns boolean stable language sql as $$
  select exists (select 1 from public.profiles where auth_id = auth.uid() and role = 'editor');
$$;

create or replace function is_reviewer()
returns boolean stable language sql as $$
  select exists (select 1 from public.profiles where auth_id = auth.uid() and role = 'reviewer');
$$;

create or replace function is_author()
returns boolean stable language sql as $$
  select exists (select 1 from public.profiles where auth_id = auth.uid() and role = 'author');
$$;

-- -----------------------------
-- PROFILES
-- -----------------------------
alter table public.profiles enable row level security;

-- Allow authenticated users to SELECT their own profile; admins can select any.
create policy profiles_select_self_or_admin
on public.profiles
for select
using ( is_admin() OR auth.uid() = auth_id );

-- Allow creation of a profile row for the currently authenticated user (auth_id must match).
create policy profiles_insert_own
on public.profiles
for insert
with check ( auth.uid() = auth_id );

-- Allow update of own profile; admin may update any profile.
create policy profiles_update_self_or_admin
on public.profiles
for update
using ( is_admin() OR auth.uid() = auth_id )
with check ( is_admin() OR auth.uid() = auth_id );

-- Allow admin to delete profiles only.
create policy profiles_delete_admin
on public.profiles
for delete
using ( is_admin() );

-- -----------------------------
-- PAPERS
-- -----------------------------
alter table public.papers enable row level security;

-- Public: allow SELECT only on published papers.
create policy papers_select_published
on public.papers
for select
using ( status = 'published' );

-- Authors: allow SELECT on papers they created.
create policy papers_select_author
on public.papers
for select
using ( exists (select 1 from public.profiles p where p.id = created_by and p.auth_id = auth.uid()) );

-- Assigned reviewers: allow SELECT on papers assigned to the current reviewer.
create policy papers_select_assigned_reviewer
on public.papers
for select
using (
  exists (
    select 1 from public.review_assignments ra
    join public.profiles p on p.id = ra.reviewer_id
    where ra.paper_id = public.papers.id and p.auth_id = auth.uid()
  )
);

-- Editors and admins may SELECT any paper.
create policy papers_select_editor_admin
on public.papers
for select
using ( is_editor() OR is_admin() );

-- Insert: authenticated users may insert papers; created_by must equal their profile id.
create policy papers_insert_author
on public.papers
for insert
with check ( auth.uid() is not null AND created_by = current_profile_id() );

-- Update: authors may update their own paper while status is 'submitted' or 'revise';
-- editors/admins may update any paper.
-- Update: authors may update their own paper while current status is 'submitted' or 'revise';
-- editors/admins may update any paper. (Do NOT use OLD/NEW in policy expressions.)
create policy papers_update_owner_editor_admin
on public.papers
for update
using (
  is_admin() OR is_editor() OR
  (
    -- current row check: the existing row's status must be 'submitted' or 'revise'
    exists (
      select 1 from public.profiles p
      where p.id = created_by and p.auth_id = auth.uid()
    )
    and status in ('submitted','revise')
  )
)
with check (
  -- check the proposed new row: admin/editor may do anything; authors can only set
  -- status to submitted/revise/withdrawn and must remain the created_by
  is_admin() OR is_editor() OR
  (
    created_by = current_profile_id()
    AND status IN ('submitted','revise','withdrawn')
  )
);


-- Delete: only admin may delete (soft-delete by is_withdrawn preferred).
create policy papers_delete_admin
on public.papers
for delete
using ( is_admin() );

-- -----------------------------
-- PAPER_VERSIONS
-- -----------------------------
alter table public.paper_versions enable row level security;

-- Authors (owner), assigned reviewers, editors/admin can SELECT versions.
-- Authors (owner), reviewers assigned, editors/admin can SELECT versions.
create policy paper_versions_select_relevant
on public.paper_versions
for select
using (
  exists (
    select 1 from public.papers p
    where p.id = paper_versions.paper_id
      and (
        p.created_by = current_profile_id()
        OR exists (
          select 1 from public.review_assignments ra 
          where ra.paper_id = p.id and ra.reviewer_id = current_profile_id()
        )
        OR is_editor()
        OR is_admin()
      )
  )
);

-- Fix for paper_versions_write_admin_editor
-- This replaces the combined update/delete policy with two separate policies.

DROP POLICY IF EXISTS paper_versions_update_admin_editor ON public.paper_versions;
DROP POLICY IF EXISTS paper_versions_delete_admin_editor ON public.paper_versions;

-- UPDATE policy (editors/admin only)
CREATE POLICY paper_versions_update_admin_editor
ON public.paper_versions
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editors/admin only)
CREATE POLICY paper_versions_delete_admin_editor
ON public.paper_versions
FOR DELETE
USING ( is_admin() OR is_editor() );



-- Insert: owner (author) or editor/admin may insert version entries (app or trigger).
create policy paper_versions_insert_owner_editor_admin
on public.paper_versions
for insert
with check (
  is_admin() OR is_editor() OR (
    exists (select 1 from public.papers p where p.id = paper_versions.paper_id and p.created_by = current_profile_id())
  )
);



-- -----------------------------
-- KEYWORDS, CATEGORIES, PAPER_KEYWORDS
-- -----------------------------
alter table public.keywords enable row level security;
alter table public.categories enable row level security;
alter table public.paper_keywords enable row level security;

-- Public read access to keywords and categories (useful for search/autocomplete).
create policy keywords_select_public
on public.keywords
for select
using ( true );

create policy categories_select_public
on public.categories
for select
using ( true );

-- Write (insert/update/delete) for keywords/categories limited to editors/admin.
-- Split policies for keywords & categories into separate insert/update/delete policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- ---- KEYWORDS ----
DROP POLICY IF EXISTS keywords_write_editor_admin ON public.keywords;
DROP POLICY IF EXISTS keywords_insert_editor_admin ON public.keywords;
DROP POLICY IF EXISTS keywords_update_editor_admin ON public.keywords;
DROP POLICY IF EXISTS keywords_delete_editor_admin ON public.keywords;

-- INSERT: editors/admin only
CREATE POLICY keywords_insert_editor_admin
ON public.keywords
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE: editors/admin only
CREATE POLICY keywords_update_editor_admin
ON public.keywords
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE: editors/admin only
CREATE POLICY keywords_delete_editor_admin
ON public.keywords
FOR DELETE
USING ( is_admin() OR is_editor() );

-- ---- CATEGORIES ----
DROP POLICY IF EXISTS categories_write_editor_admin ON public.categories;
DROP POLICY IF EXISTS categories_insert_editor_admin ON public.categories;
DROP POLICY IF EXISTS categories_update_editor_admin ON public.categories;
DROP POLICY IF EXISTS categories_delete_editor_admin ON public.categories;

-- INSERT: editors/admin only
CREATE POLICY categories_insert_editor_admin
ON public.categories
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE: editors/admin only
CREATE POLICY categories_update_editor_admin
ON public.categories
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE: editors/admin only
CREATE POLICY categories_delete_editor_admin
ON public.categories
FOR DELETE
USING ( is_admin() OR is_editor() );


-- paper_keywords: allow read if paper published or user has access; writes by owner/editor/admin.
create policy paper_keywords_select
on public.paper_keywords
for select
using (
  exists (select 1 from public.papers p where p.id = paper_keywords.paper_id and p.status = 'published')
  OR exists (select 1 from public.papers p where p.id = paper_keywords.paper_id and (
     p.created_by = current_profile_id()
     OR exists (select 1 from public.review_assignments ra where ra.paper_id = p.id and ra.reviewer_id = current_profile_id())
     OR is_editor() OR is_admin()
  ))
);

-- Split paper_keywords_write_owner_editor_admin into 3 policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS paper_keywords_write_owner_editor_admin ON public.paper_keywords;
DROP POLICY IF EXISTS paper_keywords_insert_owner_editor_admin ON public.paper_keywords;
DROP POLICY IF EXISTS paper_keywords_update_owner_editor_admin ON public.paper_keywords;
DROP POLICY IF EXISTS paper_keywords_delete_owner_editor_admin ON public.paper_keywords;

-- INSERT policy
CREATE POLICY paper_keywords_insert_owner_editor_admin
ON public.paper_keywords
FOR INSERT
WITH CHECK (
  is_admin() OR is_editor() OR
  exists (
    select 1 from public.papers p
    where p.id = paper_keywords.paper_id
      and p.created_by = current_profile_id()
  )
);

-- UPDATE policy
CREATE POLICY paper_keywords_update_owner_editor_admin
ON public.paper_keywords
FOR UPDATE
USING (
  is_admin() OR is_editor() OR
  exists (
    select 1 from public.papers p
    where p.id = paper_keywords.paper_id
      and p.created_by = current_profile_id()
  )
)
WITH CHECK (
  is_admin() OR is_editor() OR
  exists (
    select 1 from public.papers p
    where p.id = paper_keywords.paper_id
      and p.created_by = current_profile_id()
  )
);

-- DELETE policy
CREATE POLICY paper_keywords_delete_owner_editor_admin
ON public.paper_keywords
FOR DELETE
USING (
  is_admin() OR is_editor() OR
  exists (
    select 1 from public.papers p
    where p.id = paper_keywords.paper_id
      and p.created_by = current_profile_id()
  )
);


-- -----------------------------
-- PLAGIARISM REPORTS
-- -----------------------------
alter table public.plagiarism_reports enable row level security;

-- Editors/admins can read all; authors can read reports for their own papers.
create policy plagiarism_select_relevant
on public.plagiarism_reports
for select
using (
  is_admin() OR is_editor() OR
  exists (select 1 from public.papers p where p.id = plagiarism_reports.paper_id and p.created_by = current_profile_id())
);

-- Insert: only editor/admin or system (application) may insert
create policy plagiarism_insert_editor_admin
on public.plagiarism_reports
for insert
with check ( is_admin() OR is_editor() );

-- Update/Delete: editor/admin only
-- Split plagiarism_write_admin_editor into 2 policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy (if present)
DROP POLICY IF EXISTS plagiarism_write_admin_editor ON public.plagiarism_reports;
DROP POLICY IF EXISTS plagiarism_update_admin_editor ON public.plagiarism_reports;
DROP POLICY IF EXISTS plagiarism_delete_admin_editor ON public.plagiarism_reports;

-- UPDATE policy (editors/admin only)
CREATE POLICY plagiarism_update_admin_editor
ON public.plagiarism_reports
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editors/admin only)
CREATE POLICY plagiarism_delete_admin_editor
ON public.plagiarism_reports
FOR DELETE
USING ( is_admin() OR is_editor() );


-- -----------------------------
-- REVIEW_ASSIGNMENTS
-- -----------------------------
alter table public.review_assignments enable row level security;

-- Editors/admins can create assignments.
create policy assignments_insert_editor_admin
on public.review_assignments
for insert
with check ( is_admin() OR is_editor() );

-- Reviewers can SELECT their own assignments.
create policy assignments_select_reviewer
on public.review_assignments
for select
using ( exists (select 1 from public.profiles p where p.id = reviewer_id and p.auth_id = auth.uid()) );

-- Editors/Admin can SELECT any assignment.
create policy assignments_select_editor_admin
on public.review_assignments
for select
using ( is_admin() OR is_editor() );

-- Reviewers may update their own assignment status (e.g., accept/decline/in_progress/submit) but not change reviewer_id.
create policy assignments_update_reviewer_status
on public.review_assignments
for update
using (
  exists (select 1 from public.profiles p where p.id = reviewer_id and p.auth_id = auth.uid())
)
with check (
  is_admin() OR is_editor() OR
  (
    reviewer_id = current_profile_id()
    -- allow reviewer to change only status, priority, notes, assigned_at? enforce application-level checks as needed
  )
);

-- Editors/Admin may update assignments.
create policy assignments_update_editor_admin
on public.review_assignments
for update
using ( is_admin() OR is_editor() )
with check ( is_admin() OR is_editor() );

-- Delete: editor/admin only
create policy assignments_delete_editor_admin
on public.review_assignments
for delete
using ( is_admin() OR is_editor() );

-- -----------------------------
-- REVIEWS
-- -----------------------------
alter table public.reviews enable row level security;

-- Insert: reviewers can insert reviews only for assignments assigned to them.
create policy reviews_insert_by_assigned_reviewer
on public.reviews
for insert
with check (
  exists (
    select 1 from public.review_assignments ra
    join public.profiles p on p.id = ra.reviewer_id
    where ra.id = reviews.assignment_id and p.auth_id = auth.uid()
  )
);

-- Reviewers may SELECT their own reviews.
create policy reviews_select_reviewer
on public.reviews
for select
using ( exists (select 1 from public.profiles p where p.id = reviewer_id and p.auth_id = auth.uid()) );

-- Editors/Admin can SELECT all reviews.
create policy reviews_select_editor_admin
on public.reviews
for select
using ( is_admin() OR is_editor() );

-- Update: reviewer can update their own review until submitted_at is set; editors/admin can update any.
create policy reviews_update_reviewer_or_editor
on public.reviews
for update
using (
  is_admin() OR is_editor() OR
  (
    exists (select 1 from public.profiles p where p.id = reviewer_id and p.auth_id = auth.uid())
    AND submitted_at IS NULL
  )
)
with check (
  is_admin() OR is_editor() OR
  (
    reviewer_id = current_profile_id()
    AND submitted_at IS NULL
  )
);

-- Delete: admin/editor only
create policy reviews_delete_admin_editor
on public.reviews
for delete
using ( is_admin() OR is_editor() );

-- -----------------------------
-- EDITORIAL_DECISIONS
-- -----------------------------
alter table public.editorial_decisions enable row level security;

-- Only editors/admins can insert decisions.
create policy decisions_insert_editor_admin
on public.editorial_decisions
for insert
with check ( is_admin() OR is_editor() );

-- Editors/Admin can SELECT decisions; authors can see decisions for their own papers.
create policy decisions_select_authors_editors_admin
on public.editorial_decisions
for select
using (
  is_admin() OR is_editor() OR
  exists (select 1 from public.papers p where p.id = editorial_decisions.paper_id and p.created_by = current_profile_id())
);

-- Update/Delete: editors/admin only.
-- Split decisions_write_editor_admin into separate UPDATE and DELETE policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove any previous conflicting policies (safe to run)
DROP POLICY IF EXISTS decisions_write_editor_admin ON public.editorial_decisions;
DROP POLICY IF EXISTS decisions_update_editor_admin ON public.editorial_decisions;
DROP POLICY IF EXISTS decisions_delete_editor_admin ON public.editorial_decisions;

-- UPDATE policy (editors/admin only)
CREATE POLICY decisions_update_editor_admin
ON public.editorial_decisions
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editors/admin only)
CREATE POLICY decisions_delete_editor_admin
ON public.editorial_decisions
FOR DELETE
USING ( is_admin() OR is_editor() );


-- -----------------------------
-- ISSUES & ISSUE_PAPERS
-- -----------------------------
alter table public.issues enable row level security;
alter table public.issue_papers enable row level security;

-- Issues: public SELECT only if published = true
create policy issues_select_public
on public.issues
for select
using ( published = true );

-- Editors/Admin can manage issues
-- Split issues_manage_editor_admin into INSERT / UPDATE / DELETE
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS issues_manage_editor_admin ON public.issues;
DROP POLICY IF EXISTS issues_insert_editor_admin ON public.issues;
DROP POLICY IF EXISTS issues_update_editor_admin ON public.issues;
DROP POLICY IF EXISTS issues_delete_editor_admin ON public.issues;

-- INSERT policy (editor/admin only)
CREATE POLICY issues_insert_editor_admin
ON public.issues
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE policy (editor/admin only)
CREATE POLICY issues_update_editor_admin
ON public.issues
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editor/admin only)
CREATE POLICY issues_delete_editor_admin
ON public.issues
FOR DELETE
USING ( is_admin() OR is_editor() );


-- issue_papers: public can SELECT if the issue is published
create policy issue_papers_select_public
on public.issue_papers
for select
using (
  exists (select 1 from public.issues i where i.id = issue_papers.issue_id and i.published = true)
);

-- issue_papers manage: editor/admin only
-- Split issue_papers_manage_editor_admin into INSERT / UPDATE / DELETE
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS issue_papers_manage_editor_admin ON public.issue_papers;
DROP POLICY IF EXISTS issue_papers_insert_editor_admin ON public.issue_papers;
DROP POLICY IF EXISTS issue_papers_update_editor_admin ON public.issue_papers;
DROP POLICY IF EXISTS issue_papers_delete_editor_admin ON public.issue_papers;

-- INSERT: editors/admin only
CREATE POLICY issue_papers_insert_editor_admin
ON public.issue_papers
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE: editors/admin only
CREATE POLICY issue_papers_update_editor_admin
ON public.issue_papers
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE: editors/admin only
CREATE POLICY issue_papers_delete_editor_admin
ON public.issue_papers
FOR DELETE
USING ( is_admin() OR is_editor() );


-- -----------------------------
-- DOIS
-- -----------------------------
alter table public.dois enable row level security;

-- Only editors/admins may write DOI entries; authors can view DOI for their own papers.
create policy dois_select_owner_editor_admin
on public.dois
for select
using (
  is_admin() OR is_editor() OR
  exists (select 1 from public.papers p where p.id = dois.paper_id and p.created_by = current_profile_id())
);

-- Split dois_write_editor_admin into INSERT / UPDATE / DELETE
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS dois_write_editor_admin ON public.dois;
DROP POLICY IF EXISTS dois_insert_editor_admin ON public.dois;
DROP POLICY IF EXISTS dois_update_editor_admin ON public.dois;
DROP POLICY IF EXISTS dois_delete_editor_admin ON public.dois;

-- INSERT policy (editor/admin only)
CREATE POLICY dois_insert_editor_admin
ON public.dois
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE policy (editor/admin only)
CREATE POLICY dois_update_editor_admin
ON public.dois
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editor/admin only)
CREATE POLICY dois_delete_editor_admin
ON public.dois
FOR DELETE
USING ( is_admin() OR is_editor() );


-- -----------------------------
-- CITATIONS
-- -----------------------------
alter table public.citations enable row level security;

-- Authors can insert citations for their papers; public can view citations for published papers; editors/admin can manage.
create policy citations_insert_author_editor_admin
on public.citations
for insert
with check (
  is_admin() OR is_editor() OR
  exists (select 1 from public.papers p where p.id = citations.paper_id and p.created_by = current_profile_id())
);

create policy citations_select_public_owner
on public.citations
for select
using (
  exists (select 1 from public.papers p where p.id = citations.paper_id and p.status = 'published')
  OR exists (select 1 from public.papers p where p.id = citations.paper_id and p.created_by = current_profile_id())
  OR is_admin() OR is_editor()
);

-- Split citations_write_editor_admin into separate UPDATE and DELETE policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS citations_write_editor_admin ON public.citations;
DROP POLICY IF EXISTS citations_update_editor_admin ON public.citations;
DROP POLICY IF EXISTS citations_delete_editor_admin ON public.citations;

-- UPDATE policy (editors/admin only)
CREATE POLICY citations_update_editor_admin
ON public.citations
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE policy (editors/admin only)
CREATE POLICY citations_delete_editor_admin
ON public.citations
FOR DELETE
USING ( is_admin() OR is_editor() );


-- -----------------------------
-- COI DECLARATIONS
-- -----------------------------
alter table public.coi_declarations enable row level security;

-- Users can insert COI for themselves; editors/admin can view all; authors can view COI tied to their own papers.
create policy coi_insert_self
on public.coi_declarations
for insert
with check ( user_id = current_profile_id() );

create policy coi_select_relevant
on public.coi_declarations
for select
using (
  is_admin() OR is_editor() OR
  user_id = current_profile_id() OR
  exists (select 1 from public.papers p where p.id = coi_declarations.paper_id and p.created_by = current_profile_id())
);

-- Split coi_update_delete_owner_admin_editor into separate UPDATE and DELETE policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS coi_update_delete_owner_admin_editor ON public.coi_declarations;
DROP POLICY IF EXISTS coi_update_owner_admin_editor ON public.coi_declarations;
DROP POLICY IF EXISTS coi_delete_owner_admin_editor ON public.coi_declarations;

-- UPDATE policy
CREATE POLICY coi_update_owner_admin_editor
ON public.coi_declarations
FOR UPDATE
USING (
  is_admin() OR 
  is_editor() OR 
  user_id = current_profile_id()
)
WITH CHECK (
  is_admin() OR
  is_editor() OR
  user_id = current_profile_id()
);

-- DELETE policy
CREATE POLICY coi_delete_owner_admin_editor
ON public.coi_declarations
FOR DELETE
USING (
  is_admin() OR 
  is_editor() OR 
  user_id = current_profile_id()
);


-- -----------------------------
-- NOTIFICATIONS
-- -----------------------------
alter table public.notifications enable row level security;

-- Users can read their own notifications; admin may read all.
create policy notifications_select_recipient
on public.notifications
for select
using ( recipient_id = current_profile_id() OR is_admin() );

-- Insert: allow system/app to create notifications (recipient must be provided)
create policy notifications_insert_system
on public.notifications
for insert
with check ( recipient_id is not null );

-- Update/Delete: admin only
-- Split notifications_write_admin into separate UPDATE and DELETE policies
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

-- Remove old combined policy if it exists
DROP POLICY IF EXISTS notifications_write_admin ON public.notifications;
DROP POLICY IF EXISTS notifications_update_admin ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_admin ON public.notifications;

-- UPDATE policy (admin only)
CREATE POLICY notifications_update_admin
ON public.notifications
FOR UPDATE
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- DELETE policy (admin only)
CREATE POLICY notifications_delete_admin
ON public.notifications
FOR DELETE
USING ( is_admin() );


-- -----------------------------
-- REVIEWER_ACTIVITY
-- -----------------------------
alter table public.reviewer_activity enable row level security;

-- Reviewers can SELECT their own activity; editors/admin can select all.
create policy reviewer_activity_select
on public.reviewer_activity
for select
using ( reviewer_id = current_profile_id() OR is_admin() OR is_editor() );

-- Insert: allow reviewer or system to insert activity rows.
create policy reviewer_activity_insert
on public.reviewer_activity
for insert
with check ( reviewer_id = current_profile_id() OR is_admin() OR is_editor() );

-- -----------------------------
-- SUBMISSION_STATS & AUDIT_LOG
-- -----------------------------
alter table public.submission_stats enable row level security;
alter table public.audit_log enable row level security;

-- submission_stats: editors/admin only
create policy submission_stats_select
on public.submission_stats
for select
using ( is_admin() OR is_editor() );

-- audit_log: admin only
create policy audit_log_select_admin
on public.audit_log
for select
using ( is_admin() );

-- -----------------------------
-- EDITORIAL_BOARD
-- -----------------------------
alter table public.editorial_board enable row level security;

-- Editors/admin can manage editorial board entries; profile owners can view their own entry.
create policy editorial_board_select
on public.editorial_board
for select
using ( is_admin() OR is_editor() OR profile_id = current_profile_id() );

-- Split editorial_board_manage_editor_admin into INSERT / UPDATE / DELETE
-- Reference: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

DROP POLICY IF EXISTS editorial_board_manage_editor_admin ON public.editorial_board;
DROP POLICY IF EXISTS editorial_board_insert_editor_admin ON public.editorial_board;
DROP POLICY IF EXISTS editorial_board_update_editor_admin ON public.editorial_board;
DROP POLICY IF EXISTS editorial_board_delete_editor_admin ON public.editorial_board;

-- INSERT: editors/admin only
CREATE POLICY editorial_board_insert_editor_admin
ON public.editorial_board
FOR INSERT
WITH CHECK ( is_admin() OR is_editor() );

-- UPDATE: editors/admin only
CREATE POLICY editorial_board_update_editor_admin
ON public.editorial_board
FOR UPDATE
USING ( is_admin() OR is_editor() )
WITH CHECK ( is_admin() OR is_editor() );

-- DELETE: editors/admin only
CREATE POLICY editorial_board_delete_editor_admin
ON public.editorial_board
FOR DELETE
USING ( is_admin() OR is_editor() );


-- 1) Safety: drop the problematic policies on public.profiles
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;

-- 2) Recreate minimal, non-recursive policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- allow authenticated user to select their own profile only
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
USING ( auth.uid() = auth_id );

-- allow a user to create a profile row only for themselves
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
WITH CHECK ( auth.uid() = auth_id );

-- allow a user to update only their own profile
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
USING ( auth.uid() = auth_id )
WITH CHECK ( auth.uid() = auth_id );

-- allow editors/admins to SELECT profiles
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;

CREATE POLICY profiles_select_editor_admin
ON public.profiles
FOR SELECT
USING ( auth.uid() = auth_id OR is_editor() OR is_admin() );



-- End of policies.sql
