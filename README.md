# Cronulla · Inspection Gallery

Galería de inspección de defectos de fachada del proyecto **CRONULLA JOB**: vistas por filas, mosaico de fotos, matriz Drop × Nivel y tabla, con filtros, edición, drag & drop de fotos e importación/exportación CSV.

Los datos se guardan en **Supabase** (tabla `defects` + bucket `inspection-photos`) y se sincronizan en tiempo real entre dispositivos. Sin Supabase configurado, la app funciona solo con `localStorage`.

## Puesta en marcha

1. **Supabase** — abre el proyecto → *SQL Editor* → ejecuta [`supabase/schema.sql`](supabase/schema.sql) una vez.
2. **Variables de entorno** — copia `.env.example` a `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. **Ejecutar**
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   npm run build    # genera dist/ para desplegar
   ```

La primera vez que la app abre con la base de datos vacía, sube automáticamente los datos iniciales (`src/data/initialData.ts`).

## Copia en Google Sheets

[`google-sheets/sync.gs`](google-sheets/sync.gs) mantiene una hoja de cálculo como espejo de la app (solo en sentido app → hoja):

1. En la hoja: *Extensiones → Apps Script*, pega el contenido de `sync.gs` y guarda.
2. Ejecuta la función `setup` una vez y autoriza los permisos.

Cada minuto comprueba si hubo cambios en Supabase y, si los hay, reescribe las filas de la primera pestaña. Las columnas se identifican por el texto de la fila 1 (`No`, `Orientation`, `PHOTO 1`…), así que su orden no importa. El menú *Cronulla → Actualizar ahora* fuerza una actualización. Las ediciones hechas a mano en las filas de datos se sobrescriben.

## Seguridad

La app aún no tiene inicio de sesión: las políticas RLS permiten leer y escribir con la clave pública, así que cualquiera con la URL de la app puede editar los datos. Añadir Supabase Auth y restringir las políticas antes de compartirla fuera del equipo.
