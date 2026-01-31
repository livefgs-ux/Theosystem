-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Professors Only)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ACADEMIC TERMS (Years/Semesters/Trimesters)
-- e.g., "2025", "2025 - 1st Trimester"
create table public.academic_terms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  is_archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) not null
);

-- 3. COURSES (Turmas)
-- e.g., "Teologia Média - Noite" linked to a Term
create table public.courses (
  id uuid default uuid_generate_v4() primary key,
  term_id uuid references public.academic_terms(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. STUDENTS (Global list, but linked to courses via enrollment)
create table public.students (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  matricula text,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) not null
);

-- 5. ENROLLMENTS (Which student is in which course)
create table public.enrollments (
  id uuid default uuid_generate_v4() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(course_id, student_id)
);

-- 6. COURSE MODULES (The "Books" or "Subjects")
-- e.g., "Pentateuco", "Históricos"
create table public.course_modules (
  id uuid default uuid_generate_v4() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  name text not null,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. MODULE COLUMNS (The spreadsheet columns)
-- e.g., "Payment", "Delivery", "Class 1", "Class 2", "Exam"
create table public.module_columns (
  id uuid default uuid_generate_v4() primary key,
  module_id uuid references public.course_modules(id) on delete cascade not null,
  name text not null, -- "Aula 01", "Prova", "Pgto"
  type text default 'text', -- 'text', 'date', 'check'
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. ACADEMIC RECORDS (The Cells)
-- Stores the actual value like "OK - 8.4", "F", "***"
create table public.academic_records (
  id uuid default uuid_generate_v4() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  column_id uuid references public.module_columns(id) on delete cascade not null,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(enrollment_id, column_id)
);

-- RLS POLICIES
alter table public.profiles enable row level security;
alter table public.academic_terms enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.course_modules enable row level security;
alter table public.module_columns enable row level security;
alter table public.academic_records enable row level security;

-- Simple Policy: Professors can see everything
create policy "Professors access everything" on public.profiles for all using (auth.role() = 'authenticated');
create policy "Professors access terms" on public.academic_terms for all using (auth.role() = 'authenticated');
create policy "Professors access courses" on public.courses for all using (auth.role() = 'authenticated');
create policy "Professors access students" on public.students for all using (auth.role() = 'authenticated');
create policy "Professors access enrollments" on public.enrollments for all using (auth.role() = 'authenticated');
create policy "Professors access modules" on public.course_modules for all using (auth.role() = 'authenticated');
create policy "Professors access columns" on public.module_columns for all using (auth.role() = 'authenticated');
create policy "Professors access records" on public.academic_records for all using (auth.role() = 'authenticated');

-- FUNCTION: Handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- FUNCTION: Clone a Term (For "Duplicate Structure" feature)
-- This copies Term -> Courses -> Modules -> Columns (but NOT students/records)
create or replace function clone_academic_term(source_term_id uuid, new_name text)
returns uuid as $$
declare
  new_term_id uuid;
  src_course record;
  new_course_id uuid;
  src_module record;
  new_module_id uuid;
  src_col record;
begin
  -- 1. Create new Term
  insert into public.academic_terms (name, user_id)
  select new_name, user_id from public.academic_terms where id = source_term_id
  returning id into new_term_id;

  -- 2. Loop Courses
  for src_course in select * from public.courses where term_id = source_term_id loop
    insert into public.courses (term_id, name)
    values (new_term_id, src_course.name)
    returning id into new_course_id;

    -- 3. Loop Modules
    for src_module in select * from public.course_modules where course_id = src_course.id loop
        insert into public.course_modules (course_id, name, order_index)
        values (new_course_id, src_module.name, src_module.order_index)
        returning id into new_module_id;

        -- 4. Loop Columns
        for src_col in select * from public.module_columns where module_id = src_module.id loop
            insert into public.module_columns (module_id, name, type, order_index)
            values (new_module_id, src_col.name, src_col.type, src_col.order_index);
        end loop;
    end loop;
  end loop;

  return new_term_id;
end;
$$ language plpgsql;
