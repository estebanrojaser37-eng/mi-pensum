# Mi Pensum

App web para gestionar el pensum de estudios: índice de materias, subida de guías (Word/Excel/PDF), evaluaciones con calificación, y récord académico.

## Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (base de datos PostgreSQL + Storage de archivos + Autenticación)

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (elige una región cercana, ej. São Paulo).
3. Ve a **SQL Editor** y pega el contenido completo de `supabase/schema.sql`, luego ejecútalo.
4. Ve a **Storage** > **New bucket**, créalo con el nombre `guias` (privado, no público).
5. Ve a **Project Settings > API** y copia:
   - `Project URL`
   - `anon public` key

## 2. Configurar el proyecto en tu PC

```powershell
# 1. Instala las dependencias
npm install

# 2. Copia el archivo de variables de entorno
copy .env.example .env

# 3. Abre .env y pega tu URL y clave de Supabase
```

## 3. Ejecutar en desarrollo

```powershell
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

## 4. Agregar las materias del pensum

Puedes insertarlas manualmente desde el **Table Editor** de Supabase (tabla `materias`), o crear un script de importación desde el Excel que ya generamos (`Pensum_SEPAD_Barquisimeto.xlsx`) — si quieres, en la próxima sesión armamos ese script de importación masiva.

Recuerda que cada materia necesita un `user_id` — así que primero debes registrar tu usuario en la app (pantalla de login) y copiar tu `id` desde **Authentication > Users** en Supabase.

## 5. Lanzarlo a tu grupo de conocidos

Cuando esté listo, para que tus conocidos accedan sin que tengas que tener la PC encendida:

```powershell
npm run build
```

Esto genera la carpeta `dist/` con la app ya compilada. Puedes subirla gratis a:
- **Vercel** (vercel.com) — conecta tu repositorio de GitHub y despliega automático
- **Netlify** (netlify.com) — arrastra la carpeta `dist/` directamente a su web

En ambos casos, recuerda configurar las mismas variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en el panel de la plataforma elegida.

## Estructura del proyecto

```
mi-pensum/
├── src/
│   ├── pages/          → Pantallas (Índice, Detalle de materia, Récord, Login)
│   ├── components/     → Componentes reutilizables (Layout/navegación)
│   ├── lib/             → Cliente de Supabase
│   └── styles/          → CSS global (Tailwind)
├── supabase/
│   └── schema.sql       → Esquema completo de la base de datos
└── README.md
```

## Próximos pasos sugeridos
- [ ] Script de importación masiva de materias desde Excel
- [ ] Edición de materias (cambiar estado, calificación) desde la propia interfaz, sin usar `prompt()`
- [ ] Vista previa de guías Word/Excel sin descargar (Google Docs Viewer embebido)
- [ ] Exportar récord académico a PDF
- [ ] Modo multiusuario con roles (si luego quieres que varios administradores gestionen materias compartidas)
