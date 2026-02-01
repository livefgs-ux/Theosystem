export const DB_SCHEMA = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Professors Only)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. ACADEMIC TERMS
create table if not exists public.academic_terms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  is_archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) not null
);

-- 3. COURSES
create table if not exists public.courses (
  id uuid default uuid_generate_v4() primary key,
  term_id uuid references public.academic_terms(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. STUDENTS
create table if not exists public.students (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  matricula text,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) not null
);

-- 5. ENROLLMENTS
create table if not exists public.enrollments (
  id uuid default uuid_generate_v4() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(course_id, student_id)
);

-- 6. COURSE MODULES
create table if not exists public.course_modules (
  id uuid default uuid_generate_v4() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  name text not null,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. MODULE COLUMNS
create table if not exists public.module_columns (
  id uuid default uuid_generate_v4() primary key,
  module_id uuid references public.course_modules(id) on delete cascade not null,
  name text not null,
  type text default 'text', -- 'text', 'date', 'check'
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SAFE MIGRATION: Ensure 'type' column exists if table was created previously
do $$ 
begin 
  alter table public.module_columns add column if not exists type text default 'text'; 
exception 
  when others then null; 
end $$;

-- 8. ACADEMIC RECORDS
create table if not exists public.academic_records (
  id uuid default uuid_generate_v4() primary key,
  enrollment_id uuid references public.enrollments(id) on delete cascade not null,
  column_id uuid references public.module_columns(id) on delete cascade not null,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(enrollment_id, column_id)
);

-- 9. LIBRARY BOOKS
create table if not exists public.library_books (
  id uuid default uuid_generate_v4() primary key,
  code text,
  title text not null,
  author text,
  category text,
  stock integer default 0,
  user_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. BOOK TRANSACTIONS
create table if not exists public.book_transactions (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  book_id uuid references public.library_books(id) on delete cascade, 
  type text not null, 
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. ATTENDANCE
create table if not exists public.attendance (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  date text not null,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, course_id, date)
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
alter table public.library_books enable row level security;
alter table public.book_transactions enable row level security;
alter table public.attendance enable row level security;

create policy "Professors access everything" on public.profiles for all using (auth.role() = 'authenticated');
create policy "Professors access terms" on public.academic_terms for all using (auth.role() = 'authenticated');
create policy "Professors access courses" on public.courses for all using (auth.role() = 'authenticated');
create policy "Professors access students" on public.students for all using (auth.role() = 'authenticated');
create policy "Professors access enrollments" on public.enrollments for all using (auth.role() = 'authenticated');
create policy "Professors access modules" on public.course_modules for all using (auth.role() = 'authenticated');
create policy "Professors access columns" on public.module_columns for all using (auth.role() = 'authenticated');
create policy "Professors access records" on public.academic_records for all using (auth.role() = 'authenticated');
create policy "Professors access library_books" on public.library_books for all using (auth.role() = 'authenticated');
create policy "Professors access transactions" on public.book_transactions for all using (auth.role() = 'authenticated');
create policy "Professors access attendance" on public.attendance for all using (auth.role() = 'authenticated');

-- FUNCTIONS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
  insert into public.academic_terms (name, user_id)
  select new_name, user_id from public.academic_terms where id = source_term_id
  returning id into new_term_id;

  for src_course in select * from public.courses where term_id = source_term_id loop
    insert into public.courses (term_id, name)
    values (new_term_id, src_course.name)
    returning id into new_course_id;

    for src_module in select * from public.course_modules where course_id = src_course.id loop
        insert into public.course_modules (course_id, name, order_index)
        values (new_course_id, src_module.name, src_module.order_index)
        returning id into new_module_id;

        for src_col in select * from public.module_columns where module_id = src_module.id loop
            insert into public.module_columns (module_id, name, type, order_index)
            values (new_module_id, src_col.name, src_col.type, src_col.order_index);
        end loop;
    end loop;
  end loop;

  return new_term_id;
end;
$$ language plpgsql;

insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data->>'full_name'
from auth.users
on conflict (id) do nothing;
`;