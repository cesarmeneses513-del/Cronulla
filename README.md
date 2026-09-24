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

## Sincronización con Google Sheets

[`google-sheets/sync.gs`](google-sheets/sync.gs) sincroniza la app con una hoja de cálculo en ambos sentidos:

1. En la hoja: *Extensiones → Apps Script*, pega el contenido de `sync.gs` y guarda.
2. Ejecuta la función `setup` una vez y autoriza los permisos.

- **App → hoja:** cada minuto comprueba si hubo cambios en Supabase y, si los hay, reescribe las filas de la primera pestaña. *Cronulla → Actualizar ahora* lo fuerza.
- **Hoja → app:** al editar celdas se envían al momento solo las columnas editadas de esas filas. Una fila nueva con *Defect* u *Orientation* crea un defecto.
- Las filas se identifican por la columna **ID** (la crea y rellena el script; no editarla). Las columnas se reconocen por el texto de la fila 1, así que su orden no importa.
- **Borrar filas** (clic derecho → *Eliminar fila*) borra esos defectos en la app. Antes se copian a la pestaña oculta `_papelera`; *Cronulla → Restaurar último borrado* los recupera. Vaciar el contenido de una fila no cuenta como borrado.

## Seguridad

La app aún no tiene inicio de sesión: las políticas RLS permiten leer y escribir con la clave pública, así que cualquiera con la URL de la app puede editar los datos. Añadir Supabase Auth y restringir las políticas antes de compartirla fuera del equipo.
