-- =========================================
-- MI PENSUM · Esquema de base de datos
-- =========================================

-- Perfiles de usuario (extiende auth.users de Supabase)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  created_at timestamp with time zone default now()
);

-- Materias del pensum
create table materias (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  nombre text not null,
  area text not null,               -- Bíblicas, Teológicas, Ministerio Práctico, etc.
  nivel text default 'Básico',      -- Básico, Ministerial, Superior
  orden int default 0,              -- para ordenar el índice
  estado text default 'pendiente' check (estado in ('pendiente', 'en_curso', 'aprobada', 'reprobada')),
  calificacion_final numeric(5,2),
  created_at timestamp with time zone default now()
);

-- Guías subidas por materia (Word, Excel, PDF)
create table guias (
  id uuid default gen_random_uuid() primary key,
  materia_id uuid references materias(id) on delete cascade not null,
  nombre_archivo text not null,
  tipo text not null,               -- word, excel, pdf, otro
  ruta_storage text not null,       -- path dentro del bucket de Supabase Storage
  tamano_kb int,
  fecha_subida timestamp with time zone default now()
);

-- Evaluaciones por materia
create table evaluaciones (
  id uuid default gen_random_uuid() primary key,
  materia_id uuid references materias(id) on delete cascade not null,
  nombre text not null,             -- ej. "Parcial 1", "Monografía final"
  tipo text default 'examen' check (tipo in ('examen', 'tarea', 'proyecto', 'monografia', 'participacion')),
  fecha date,
  peso_porcentual numeric(5,2),     -- ej. 25.00 para 25%
  calificacion numeric(5,2),        -- null hasta que se califique
  created_at timestamp with time zone default now()
);

-- =========================================
-- Índices para consultas frecuentes
-- =========================================
create index idx_materias_user on materias(user_id);
create index idx_guias_materia on guias(materia_id);
create index idx_evaluaciones_materia on evaluaciones(materia_id);

-- =========================================
-- Row Level Security (cada usuario ve solo lo suyo)
-- =========================================
alter table profiles enable row level security;
alter table materias enable row level security;
alter table guias enable row level security;
alter table evaluaciones enable row level security;

create policy "usuarios ven su propio perfil"
  on profiles for select using (auth.uid() = id);

create policy "usuarios editan su propio perfil"
  on profiles for update using (auth.uid() = id);

create policy "usuarios gestionan sus propias materias"
  on materias for all using (auth.uid() = user_id);

create policy "usuarios gestionan guias de sus materias"
  on guias for all using (
    exists (select 1 from materias where materias.id = guias.materia_id and materias.user_id = auth.uid())
  );

create policy "usuarios gestionan evaluaciones de sus materias"
  on evaluaciones for all using (
    exists (select 1 from materias where materias.id = evaluaciones.materia_id and materias.user_id = auth.uid())
  );

-- =========================================
-- Trigger: crear perfil automáticamente al registrarse
-- =========================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- Storage bucket para las guías (ejecutar desde el dashboard de Supabase
-- o descomentar si tu plan lo permite vía SQL)
-- =========================================
-- insert into storage.buckets (id, name, public) values ('guias', 'guias', false);
