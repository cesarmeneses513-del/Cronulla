import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'en' | 'es' | 'fa';

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'fa', label: 'دری (Dari)', short: 'دری' },
];

const LANG_KEY = 'cronulla_lang';

// Keys are the Spanish source strings (the app was written in Spanish); `{name}` placeholders are interpolated.
const DICT: Record<string, { en: string; fa: string }> = {
  // Header / general
  'Control de Defectos & Galería Fotográfica': { en: 'Defect Control & Photo Gallery', fa: 'کنترل نواقص و گالری عکس' },
  'defectos': { en: 'defects', fa: 'نقص' },
  'fotografías': { en: 'photos', fa: 'عکس' },
  'completado': { en: 'completed', fa: 'تکمیل شده' },
  'Cliente': { en: 'Client', fa: 'مشتری' },
  'Editor': { en: 'Editor', fa: 'ویرایشگر' },
  'Deshacer: {label} (Ctrl/Cmd + Z)': { en: 'Undo: {label} (Ctrl/Cmd + Z)', fa: 'برگرداندن: {label} (Ctrl/Cmd + Z)' },
  'Nada que deshacer': { en: 'Nothing to undo', fa: 'چیزی برای برگرداندن نیست' },
  'Deshacer': { en: 'Undo', fa: 'برگرداندن' },
  'Restaurar datos iniciales': { en: 'Restore initial data', fa: 'بازگرداندن داده‌های اولیه' },
  'Importar': { en: 'Import', fa: 'وارد کردن' },
  'Exportar': { en: 'Export', fa: 'صادر کردن' },
  'Nuevo Defecto': { en: 'New defect', fa: 'نقص جدید' },
  'Cambiar de modo': { en: 'Switch mode', fa: 'تغییر حالت' },
  'Salir': { en: 'Exit', fa: 'خروج' },
  'Historial': { en: 'History', fa: 'تاریخچه' },
  'Historial de cambios': { en: 'Change history', fa: 'تاریخچه تغییرات' },
  'Idioma': { en: 'Language', fa: 'زبان' },

  // Status, urgency, photo phase
  'Antes': { en: 'Before', fa: 'قبل' },
  'Durante': { en: 'During', fa: 'در حین کار' },
  'Después': { en: 'After', fa: 'بعد' },
  'En Progreso': { en: 'In progress', fa: 'در جریان' },
  'Completado': { en: 'Completed', fa: 'تکمیل شده' },
  'Alta': { en: 'High', fa: 'بالا' },
  'Media': { en: 'Medium', fa: 'متوسط' },
  'Baja': { en: 'Low', fa: 'پایین' },
  'Tiene foto de {phase}': { en: 'Has a {phase} photo', fa: 'عکس {phase} دارد' },
  'Falta foto de {phase}': { en: 'Missing {phase} photo', fa: 'عکس {phase} ندارد' },

  // Filter bar
  'Buscar por defecto, drop, piso, técnico, nota...': {
    en: 'Search by defect, drop, level, technician, note...',
    fa: 'جستجو بر اساس نقص، دراپ، طبقه، تکنیسین، یادداشت...',
  },
  'Vista de Filas & Inspección': { en: 'Rows & inspection view', fa: 'نمای ردیف‌ها و بازرسی' },
  'Filas': { en: 'Rows', fa: 'ردیف‌ها' },
  'Mosaico de Todas las Fotografías': { en: 'Mosaic of all photos', fa: 'موزاییک همه عکس‌ها' },
  'Mosaico': { en: 'Mosaic', fa: 'موزاییک' },
  'Elevación Fachada (Drop vs Piso)': { en: 'Facade elevation (Drop vs Level)', fa: 'نمای ارتفاعی (دراپ و طبقه)' },
  'Elevación': { en: 'Elevation', fa: 'نمای ارتفاعی' },
  'Vista Tabla': { en: 'Table view', fa: 'نمای جدول' },
  'Tabla': { en: 'Table', fa: 'جدول' },
  'Filtros': { en: 'Filters', fa: 'فیلترها' },
  'Limpiar todo': { en: 'Clear all', fa: 'پاک کردن همه' },
  'Stage:': { en: 'Stage:', fa: 'مرحله:' },
  'Todos': { en: 'All', fa: 'همه' },
  'Estado:': { en: 'Status:', fa: 'وضعیت:' },
  'Urgencia:': { en: 'Urgency:', fa: 'فوریت:' },
  'Solo con fotografías': { en: 'Only with photos', fa: 'فقط با عکس' },
  'Etapa / Orientación': { en: 'Stage / Orientation', fa: 'مرحله / جهت' },
  'Tipo de Defecto': { en: 'Defect type', fa: 'نوع نقص' },
  'Línea (Drop) & Nivel': { en: 'Drop & Level', fa: 'دراپ و طبقه' },
  'Drop:': { en: 'Drop:', fa: 'دراپ:' },
  'Piso:': { en: 'Level:', fa: 'طبقه:' },
  'Técnico Asignado': { en: 'Assigned technician', fa: 'تکنیسین مسئول' },
  'Mostrando {n} de {total} registros de inspección': {
    en: 'Showing {n} of {total} inspection records',
    fa: 'نمایش {n} از {total} مورد بازرسی',
  },
  'Arrastra las fotos entre filas o casillas para reordenar o cambiar de defecto': {
    en: 'Drag photos between rows or slots to reorder them or move them to another defect',
    fa: 'عکس‌ها را بین ردیف‌ها بکشید تا ترتیب را عوض کنید یا به نقص دیگری منتقل کنید',
  },

  // Sort bar
  'Ordenar por:': { en: 'Sort by:', fa: 'مرتب‌سازی:' },
  'Original': { en: 'Original', fa: 'اصلی' },
  'Nº': { en: 'No.', fa: 'شماره' },
  'Stage': { en: 'Stage', fa: 'مرحله' },
  'Defecto (A-Z)': { en: 'Defect (A-Z)', fa: 'نقص (A-Z)' },
  'Ascendente (clic para invertir)': { en: 'Ascending (click to reverse)', fa: 'صعودی (برای برعکس کردن کلیک کنید)' },
  'Descendente (clic para invertir)': { en: 'Descending (click to reverse)', fa: 'نزولی (برای برعکس کردن کلیک کنید)' },
  'Ascendente': { en: 'Ascending', fa: 'صعودی' },
  'Descendente': { en: 'Descending', fa: 'نزولی' },
  'Puedes marcar varios: se ordena en el orden en que los marcas': {
    en: 'You can pick several: they sort in the order you pick them',
    fa: 'می‌توانید چند مورد را انتخاب کنید: به ترتیب انتخاب مرتب می‌شود',
  },

  // Row card
  'Mover fotografía a la fila #{row} ({defect})': { en: 'Move photo to row #{row} ({defect})', fa: 'انتقال عکس به ردیف #{row} ({defect})' },
  'Seleccionar (Shift + clic para seleccionar un rango)': {
    en: 'Select (Shift + click to select a range)',
    fa: 'انتخاب (Shift + کلیک برای انتخاب یک محدوده)',
  },
  'Nivel:': { en: 'Level:', fa: 'طبقه:' },
  'Click para cambiar estado': { en: 'Click to change status', fa: 'برای تغییر وضعیت کلیک کنید' },
  'Click para alternar urgencia': { en: 'Click to change urgency', fa: 'برای تغییر فوریت کلیک کنید' },
  'Editar todos los datos del defecto': { en: 'Edit all defect data', fa: 'ویرایش همه اطلاعات نقص' },
  'Duplicar este registro': { en: 'Duplicate this record', fa: 'کپی این مورد' },
  'Eliminar registro': { en: 'Delete record', fa: 'حذف مورد' },
  'Fotografías ({n})': { en: 'Photos ({n})', fa: 'عکس‌ها ({n})' },
  'Arrastra para ordenar o mover a otra fila': { en: 'Drag to reorder or move to another row', fa: 'برای مرتب کردن یا انتقال به ردیف دیگر بکشید' },
  'Subir archivo': { en: 'Upload file', fa: 'بارگذاری فایل' },
  '+ Pegar URL': { en: '+ Paste URL', fa: '+ چسباندن URL' },
  'No hay fotografías registradas en esta fila.': { en: 'No photos in this row.', fa: 'در این ردیف عکسی ثبت نشده است.' },
  'Arrastra una foto aquí o haz clic en Subir.': { en: 'Drag a photo here or click Upload.', fa: 'یک عکس را اینجا بکشید یا روی بارگذاری کلیک کنید.' },
  'Clic para cambiar la fase de la foto': { en: 'Click to change the photo phase', fa: 'برای تغییر مرحله عکس کلیک کنید' },
  'Ingrese la URL de la fotografía o use el selector de archivos:': {
    en: 'Enter the photo URL or use the file picker:',
    fa: 'آدرس URL عکس را وارد کنید یا از انتخاب فایل استفاده کنید:',
  },
  'Ver en pantalla completa': { en: 'View full screen', fa: 'نمایش تمام صفحه' },
  'Quitar foto': { en: 'Remove photo', fa: 'حذف عکس' },
  '+ NUEVA': { en: '+ NEW', fa: '+ جدید' },
  'Añadir fotografía a esta fila': { en: 'Add a photo to this row', fa: 'افزودن عکس به این ردیف' },
  'Añadir': { en: 'Add', fa: 'افزودن' },
  'Metros lineales:': { en: 'Linear metres:', fa: 'متر طول:' },
  'Dimensión:': { en: 'Size:', fa: 'ابعاد:' },
  'Cantidad:': { en: 'Quantity:', fa: 'تعداد:' },
  'Sin medidas especificadas': { en: 'No measurements', fa: 'بدون اندازه' },
  'Inicio:': { en: 'Start:', fa: 'شروع:' },
  'Listo:': { en: 'Done:', fa: 'تمام:' },

  // Table
  'Fotos': { en: 'Photos', fa: 'عکس‌ها' },
  'Etapa / Proyecto': { en: 'Stage / Project', fa: 'مرحله / پروژه' },
  'Defecto': { en: 'Defect', fa: 'نقص' },
  'Urgencia': { en: 'Urgency', fa: 'فوریت' },
  'Drop': { en: 'Drop', fa: 'دراپ' },
  'Nivel': { en: 'Level', fa: 'طبقه' },
  'Estado': { en: 'Status', fa: 'وضعیت' },
  'Medidas': { en: 'Measurements', fa: 'اندازه‌ها' },
  'Técnico / Fecha': { en: 'Technician / Date', fa: 'تکنیسین / تاریخ' },
  'Notas': { en: 'Notes', fa: 'یادداشت‌ها' },
  'Acciones': { en: 'Actions', fa: 'اقدامات' },
  'Ver foto': { en: 'View photo', fa: 'دیدن عکس' },
  'Sin fotos': { en: 'No photos', fa: 'بدون عکس' },
  'cant:': { en: 'qty:', fa: 'تعداد:' },
  'Editar': { en: 'Edit', fa: 'ویرایش' },
  'Eliminar': { en: 'Delete', fa: 'حذف' },

  // Edit modal
  'Registro #{row}': { en: 'Record #{row}', fa: 'مورد #{row}' },
  'Editar Datos del Defecto': { en: 'Edit defect data', fa: 'ویرایش اطلاعات نقص' },
  'Número de Fila / ID': { en: 'Row number / ID', fa: 'شماره ردیف / شناسه' },
  'Proyecto': { en: 'Project', fa: 'پروژه' },
  'Línea (Drop)': { en: 'Drop', fa: 'دراپ' },
  'Nivel / Piso': { en: 'Level / Floor', fa: 'طبقه' },
  'Metros Lineales (m)': { en: 'Linear metres (m)', fa: 'متر طول (m)' },
  'Base × Altura (m)': { en: 'Width × Height (m)', fa: 'عرض × ارتفاع (m)' },
  'Ej. 1': { en: 'e.g. 1', fa: 'مثلاً 1' },
  'Ej. 4, G, R': { en: 'e.g. 4, G, R', fa: 'مثلاً 4, G, R' },
  'Base': { en: 'Width', fa: 'عرض' },
  'Alto': { en: 'Height', fa: 'ارتفاع' },
  'Comentarios y Notas de Campo': { en: 'Comments & field notes', fa: 'نظرات و یادداشت‌های کار' },
  'Ej. INTRODUCE NEW JOINT, fisuras observadas, requiere andamio...': {
    en: 'e.g. INTRODUCE NEW JOINT, cracks observed, needs scaffold...',
    fa: 'مثلاً INTRODUCE NEW JOINT، ترک دیده شد، داربست لازم است...',
  },
  'Etiquetas Personalizadas': { en: 'Custom tags', fa: 'برچسب‌های سفارشی' },
  '+ Añadir etiqueta...': { en: '+ Add tag...', fa: '+ افزودن برچسب...' },
  'Gestión de Fotografías ({n})': { en: 'Photo management ({n})', fa: 'مدیریت عکس‌ها ({n})' },
  'Pegar enlace URL de la fotografía:': { en: 'Paste the photo URL:', fa: 'آدرس URL عکس را بچسبانید:' },
  'Mover antes': { en: 'Move earlier', fa: 'انتقال به قبل' },
  'Mover después': { en: 'Move later', fa: 'انتقال به بعد' },
  'Eliminar foto': { en: 'Delete photo', fa: 'حذف عکس' },
  'Técnico de Inicio': { en: 'Start technician', fa: 'تکنیسین شروع' },
  'Técnico Finalizado': { en: 'Completion technician', fa: 'تکنیسین تکمیل' },
  'Nombre del técnico': { en: 'Technician name', fa: 'نام تکنیسین' },
  'Fecha (dd/mm/aaaa)': { en: 'Date (dd/mm/yyyy)', fa: 'تاریخ (dd/mm/yyyy)' },
  'Hora': { en: 'Time', fa: 'ساعت' },
  'Cancelar': { en: 'Cancel', fa: 'انصراف' },
  'Guardar Cambios': { en: 'Save changes', fa: 'ذخیره تغییرات' },

  // Lightbox
  'Foto {i}/{n}': { en: 'Photo {i}/{n}', fa: 'عکس {i}/{n}' },
  'Alejar': { en: 'Zoom out', fa: 'کوچک‌نمایی' },
  'Acercar': { en: 'Zoom in', fa: 'بزرگ‌نمایی' },
  'Rotar 90°': { en: 'Rotate 90°', fa: 'چرخش ۹۰°' },
  'Descargar imagen': { en: 'Download image', fa: 'دانلود تصویر' },
  'Fase:': { en: 'Phase:', fa: 'مرحله:' },
  'Foto {i} de {n} · Fila #{row}': { en: 'Photo {i} of {n} · Row #{row}', fa: 'عکس {i} از {n} · ردیف #{row}' },
  'Fila #{row}': { en: 'Row #{row}', fa: 'ردیف #{row}' },
  'Fase de esta fotografía:': { en: 'Phase of this photo:', fa: 'مرحله این عکس:' },
  'Ubicación': { en: 'Location', fa: 'موقعیت' },
  'Estado & Urgencia': { en: 'Status & urgency', fa: 'وضعیت و فوریت' },
  'Dimensiones': { en: 'Dimensions', fa: 'ابعاد' },
  'Base × Altura:': { en: 'Width × Height:', fa: 'عرض × ارتفاع:' },
  'Comentario / Nota': { en: 'Comment / Note', fa: 'نظر / یادداشت' },
  'Finalizado:': { en: 'Completed:', fa: 'تکمیل:' },
  'Fotos de esta fila ({n})': { en: 'Photos in this row ({n})', fa: 'عکس‌های این ردیف ({n})' },
  'Mover foto a otra fila:': { en: 'Move photo to another row:', fa: 'انتقال عکس به ردیف دیگر:' },
  'Seleccionar fila destino...': { en: 'Select target row...', fa: 'انتخاب ردیف مقصد...' },
  'Mover': { en: 'Move', fa: 'انتقال' },
  '¿Seguro que deseas quitar esta fotografía de la fila?': {
    en: 'Remove this photo from the row?',
    fa: 'آیا مطمئن هستید که این عکس از ردیف حذف شود؟',
  },
  'Eliminar esta fotografía': { en: 'Delete this photo', fa: 'حذف این عکس' },

  // Mosaic
  'Filtrar por fase:': { en: 'Filter by phase:', fa: 'فیلتر بر اساس مرحله:' },
  'Todas': { en: 'All', fa: 'همه' },
  'Mostrando {n} fotos': { en: 'Showing {n} photos', fa: 'نمایش {n} عکس' },
  'No se encontraron fotografías con los filtros seleccionados.': {
    en: 'No photos match the selected filters.',
    fa: 'هیچ عکسی با فیلترهای انتخاب‌شده پیدا نشد.',
  },
  'Ampliar fotografía': { en: 'Enlarge photo', fa: 'بزرگ کردن عکس' },
  'Reasignar a otra fila de defecto': { en: 'Reassign to another defect row', fa: 'انتقال به ردیف نقص دیگر' },

  // Elevation
  'Matriz de Elevación Fachada (Drop vs Piso)': { en: 'Facade elevation matrix (Drop vs Level)', fa: 'ماتریس نمای ارتفاعی (دراپ و طبقه)' },
  'Vista espacial de cuerda/drop y niveles. Haz clic en una celda para ver o filtrar los defectos de esa posición.': {
    en: 'Spatial view of rope drops and levels. Click a cell to filter the defects at that position.',
    fa: 'نمای مکانی دراپ‌ها و طبقات. برای فیلتر کردن نواقص آن موقعیت روی یک خانه کلیک کنید.',
  },
  'Piso / Drop': { en: 'Level / Drop', fa: 'طبقه / دراپ' },
  'Drop {d}': { en: 'Drop {d}', fa: 'دراپ {d}' },
  'R (Azotea)': { en: 'R (Roof)', fa: 'R (بام)' },
  'G (PB)': { en: 'G (Ground)', fa: 'G (همکف)' },
  'Nivel {n}': { en: 'Level {n}', fa: 'طبقه {n}' },
  '1 defecto': { en: '1 defect', fa: '1 نقص' },
  '{n} defectos': { en: '{n} defects', fa: '{n} نقص' },

  // Import modal
  'No se detectaron registros válidos en el texto CSV.': { en: 'No valid records found in the CSV text.', fa: 'هیچ مورد معتبری در متن CSV پیدا نشد.' },
  'Error al procesar CSV: {msg}': { en: 'Error processing CSV: {msg}', fa: 'خطا در پردازش CSV: {msg}' },
  'Formato no reconocido': { en: 'Unrecognized format', fa: 'قالب ناشناخته' },
  'Importar Datos desde CSV (Google Sheets / Glide)': {
    en: 'Import data from CSV (Google Sheets / Glide)',
    fa: 'وارد کردن داده از CSV (Google Sheets / Glide)',
  },
  'Pega el texto copiado desde Google Sheets o sube un archivo .csv con las columnas de inspección (ID, No, Defect, Urgency, Drop, Level, PHOTO 1..9, etc.).': {
    en: 'Paste text copied from Google Sheets or upload a .csv file with the inspection columns (ID, No, Defect, Urgency, Drop, Level, PHOTO 1..9, etc.).',
    fa: 'متن کپی‌شده از Google Sheets را بچسبانید یا یک فایل .csv با ستون‌های بازرسی (ID, No, Defect, Urgency, Drop, Level, PHOTO 1..9 و غیره) بارگذاری کنید.',
  },
  'Seleccionar archivo CSV': { en: 'Choose CSV file', fa: 'انتخاب فایل CSV' },
  'o pega el contenido en el área inferior:': { en: 'or paste the content below:', fa: 'یا محتوا را در کادر زیر بچسبانید:' },
  'Pega aquí el contenido CSV con las cabeceras...': {
    en: 'Paste the CSV content with its headers here...',
    fa: 'محتوای CSV را همراه با سرستون‌ها اینجا بچسبانید...',
  },
  'Se detectaron {n} registros de inspección con sus fotos.': {
    en: 'Detected {n} inspection records with their photos.',
    fa: '{n} مورد بازرسی همراه با عکس‌ها شناسایی شد.',
  },
  'Reemplazar los registros actuales con estos datos nuevos (desmarcar para anexar)': {
    en: 'Replace the current records with this new data (untick to append)',
    fa: 'جایگزینی موارد فعلی با این داده‌های جدید (برای افزودن، تیک را بردارید)',
  },

  // Start screen
  'Crear, editar y eliminar defectos, subir y mover fotografías, importar y exportar CSV.': {
    en: 'Create, edit and delete defects, upload and move photos, import and export CSV.',
    fa: 'ایجاد، ویرایش و حذف نواقص، بارگذاری و انتقال عکس‌ها، وارد و صادر کردن CSV.',
  },
  'Entrar con contraseña': { en: 'Sign in with password', fa: 'ورود با رمز عبور' },
  'Ver las fotografías y filtrar los defectos por stage, estado, urgencia, drop y nivel. Solo lectura.': {
    en: 'View the photos and filter defects by stage, status, urgency, drop and level. Read only.',
    fa: 'مشاهده عکس‌ها و فیلتر نواقص بر اساس مرحله، وضعیت، فوریت، دراپ و طبقه. فقط خواندنی.',
  },
  'Ver galería': { en: 'View gallery', fa: 'مشاهده گالری' },
  'Acceso Editor': { en: 'Editor access', fa: 'دسترسی ویرایشگر' },
  'Contraseña': { en: 'Password', fa: 'رمز عبور' },
  'Contraseña incorrecta': { en: 'Wrong password', fa: 'رمز عبور نادرست است' },
  'Volver': { en: 'Back', fa: 'بازگشت' },
  'Entrar': { en: 'Sign in', fa: 'ورود' },
  'Tu nombre': { en: 'Your name', fa: 'نام شما' },
  'Aparece en el historial de cambios': { en: 'Shown in the change history', fa: 'در تاریخچه تغییرات نمایش داده می‌شود' },

  // App: sync, toasts, confirms, selection, footer
  'Cargando desde la nube…': { en: 'Loading from the cloud…', fa: 'در حال بارگیری از ابر…' },
  'Guardando…': { en: 'Saving…', fa: 'در حال ذخیره…' },
  'Sincronizado': { en: 'Synced', fa: 'همگام شد' },
  'Error de sincronización': { en: 'Sync error', fa: 'خطای همگام‌سازی' },
  'Solo en este navegador': { en: 'Only in this browser', fa: 'فقط در این مرورگر' },
  'Revisa la consola del navegador para más detalles': { en: 'Check the browser console for details', fa: 'برای جزئیات، کنسول مرورگر را ببینید' },
  'Deshecho: {label}': { en: 'Undone: {label}', fa: 'برگردانده شد: {label}' },
  'Foto reordenada en la fila #{row}': { en: 'Photo reordered in row #{row}', fa: 'ترتیب عکس در ردیف #{row} تغییر کرد' },
  'Foto trasladada de Fila #{a} ({da}) a Fila #{b} ({db})': {
    en: 'Photo moved from row #{a} ({da}) to row #{b} ({db})',
    fa: 'عکس از ردیف #{a} ({da}) به ردیف #{b} ({db}) منتقل شد',
  },
  'mover foto': { en: 'move photo', fa: 'انتقال عکس' },
  'añadir foto': { en: 'add photo', fa: 'افزودن عکس' },
  'cambiar fase de foto': { en: 'change photo phase', fa: 'تغییر مرحله عکس' },
  'eliminar foto': { en: 'delete photo', fa: 'حذف عکس' },
  'cambiar estado': { en: 'change status', fa: 'تغییر وضعیت' },
  'cambiar urgencia': { en: 'change urgency', fa: 'تغییر فوریت' },
  'guardar registro #{row}': { en: 'save record #{row}', fa: 'ذخیره مورد #{row}' },
  'duplicar registro #{row}': { en: 'duplicate record #{row}', fa: 'کپی مورد #{row}' },
  'eliminar registro #{row}': { en: 'delete record #{row}', fa: 'حذف مورد #{row}' },
  'eliminar {n} registros': { en: 'delete {n} records', fa: 'حذف {n} مورد' },
  'importar CSV': { en: 'import CSV', fa: 'وارد کردن CSV' },
  'restaurar datos originales': { en: 'restore original data', fa: 'بازگرداندن داده‌های اصلی' },
  'Fotografía añadida a {phase}': { en: 'Photo added to {phase}', fa: 'عکس به {phase} اضافه شد' },
  'Foto cambiada a {phase}': { en: 'Photo changed to {phase}', fa: 'عکس به {phase} تغییر کرد' },
  'Fotografía eliminada': { en: 'Photo deleted', fa: 'عکس حذف شد' },
  'Registro #{row} guardado': { en: 'Record #{row} saved', fa: 'مورد #{row} ذخیره شد' },
  'Registro #{row} duplicado': { en: 'Record #{row} duplicated', fa: 'مورد #{row} کپی شد' },
  '¿Estás seguro de eliminar el registro #{row} ({defect})?': {
    en: 'Delete record #{row} ({defect})?',
    fa: 'آیا مطمئن هستید که مورد #{row} ({defect}) حذف شود؟',
  },
  'Registro eliminado': { en: 'Record deleted', fa: 'مورد حذف شد' },
  '¿Eliminar {n} registros seleccionados?\n\nPuedes recuperarlos con el botón "Deshacer".': {
    en: 'Delete {n} selected records?\n\nYou can bring them back with the "Undo" button.',
    fa: '{n} مورد انتخاب‌شده حذف شود؟\n\nمی‌توانید با دکمه «برگرداندن» آن‌ها را بازیابی کنید.',
  },
  '{n} registros eliminados': { en: '{n} records deleted', fa: '{n} مورد حذف شد' },
  'Filtrado por Drop {drop} y Nivel {level}': { en: 'Filtered by Drop {drop} and Level {level}', fa: 'فیلتر بر اساس دراپ {drop} و طبقه {level}' },
  'Archivo CSV exportado exitosamente': { en: 'CSV file exported', fa: 'فایل CSV صادر شد' },
  '{n} registros importados correctamente': { en: '{n} records imported', fa: '{n} مورد وارد شد' },
  '¿Deseas restaurar la lista de defectos original del proyecto? Esto sobrescribirá los cambios de todos los usuarios.': {
    en: "Restore the project's original defect list? This will overwrite everyone's changes.",
    fa: 'فهرست اصلی نواقص پروژه بازگردانده شود؟ این کار تغییرات همه کاربران را بازنویسی می‌کند.',
  },
  '¿Deseas restaurar la lista de defectos original del proyecto? Esto sobrescribirá los cambios locales.': {
    en: "Restore the project's original defect list? This will overwrite your local changes.",
    fa: 'فهرست اصلی نواقص پروژه بازگردانده شود؟ این کار تغییرات محلی را بازنویسی می‌کند.',
  },
  'Datos originales restaurados': { en: 'Original data restored', fa: 'داده‌های اصلی بازگردانده شد' },
  'No se encontraron defectos coincidentes': { en: 'No matching defects', fa: 'هیچ نقص مطابقی پیدا نشد' },
  'Intenta cambiar los filtros seleccionados o el término de búsqueda para ver los registros de inspección.': {
    en: 'Try changing the filters or the search term to see inspection records.',
    fa: 'فیلترها یا عبارت جستجو را تغییر دهید تا موارد بازرسی را ببینید.',
  },
  'Restablecer Filtros': { en: 'Reset filters', fa: 'بازنشانی فیلترها' },
  'Cancelar selección': { en: 'Cancel selection', fa: 'لغو انتخاب' },
  'Seleccionar': { en: 'Select', fa: 'انتخاب' },
  '{n} seleccionados': { en: '{n} selected', fa: '{n} انتخاب شده' },
  'Seleccionar todos ({n})': { en: 'Select all ({n})', fa: 'انتخاب همه ({n})' },
  'Quitar selección': { en: 'Clear selection', fa: 'پاک کردن انتخاب' },
  'Eliminar ({n})': { en: 'Delete ({n})', fa: 'حذف ({n})' },
  'Salir de la selección': { en: 'Exit selection', fa: 'خروج از انتخاب' },
  'Cronulla Job · Sistema de Control de Inspección en Altura & Defectos de Fachada': {
    en: 'Cronulla Job · Rope-access inspection & facade defect control',
    fa: 'Cronulla Job · سیستم کنترل بازرسی در ارتفاع و نواقص نما',
  },
  '{n} filas registradas': { en: '{n} rows recorded', fa: '{n} ردیف ثبت شده' },
  'Solo lectura': { en: 'Read only', fa: 'فقط خواندنی' },
  'Creado por': { en: 'Created by', fa: 'ساخته شده توسط' },
  'Páginas': { en: 'Pages', fa: 'صفحه‌ها' },
  '{from}–{to} de {total}': { en: '{from}–{to} of {total}', fa: '{from}–{to} از {total}' },
  'Anterior': { en: 'Previous', fa: 'قبلی' },
  'Siguiente': { en: 'Next', fa: 'بعدی' },
  'Drag & Drop habilitado': { en: 'Drag & drop enabled', fa: 'کشیدن و رها کردن فعال است' },

  // History panel
  'Actualizar': { en: 'Refresh', fa: 'تازه‌سازی' },
  'Volver a cargar los datos': { en: 'Reload the data', fa: 'بارگیری دوباره داده‌ها' },
  'Datos actualizados: {n} defectos': { en: 'Data refreshed: {n} defects', fa: 'داده‌ها به‌روز شد: {n} نقص' },
  'Cerrar': { en: 'Close', fa: 'بستن' },
  'Cargando…': { en: 'Loading…', fa: 'در حال بارگیری…' },
  'Todavía no hay cambios registrados.': { en: 'No changes recorded yet.', fa: 'هنوز تغییری ثبت نشده است.' },
  'El historial no está activado en la base de datos. Ejecuta supabase/history.sql en el SQL Editor de Supabase.': {
    en: 'History is not enabled in the database. Run supabase/history.sql in the Supabase SQL Editor.',
    fa: 'تاریخچه در پایگاه داده فعال نیست. فایل supabase/history.sql را در SQL Editor سوپابیس اجرا کنید.',
  },
  'Buscar por persona, fila o acción...': { en: 'Search by person, row or action...', fa: 'جستجو بر اساس شخص، ردیف یا عمل...' },
  'Cargar más': { en: 'Load more', fa: 'بارگیری بیشتر' },
  'Borrar': { en: 'Clear', fa: 'پاک کردن' },
  'Borrar historial': { en: 'Clear history', fa: 'پاک کردن تاریخچه' },
  '¿Borrar todo el historial de cambios? Esto no se puede deshacer.': {
    en: 'Clear the whole change history? This cannot be undone.',
    fa: 'تمام تاریخچه تغییرات پاک شود؟ این کار قابل برگشت نیست.',
  },
  'Para poder borrar el historial ejecuta supabase/history-clear.sql en el SQL Editor de Supabase.': {
    en: 'To clear the history, run supabase/history-clear.sql in the Supabase SQL Editor.',
    fa: 'برای پاک کردن تاریخچه، فایل supabase/history-clear.sql را در SQL Editor سوپابیس اجرا کنید.',
  },
  'subió una foto ({phase})': { en: 'uploaded a photo ({phase})', fa: 'یک عکس بارگذاری کرد ({phase})' },
  'quitó una foto ({phase})': { en: 'removed a photo ({phase})', fa: 'یک عکس را حذف کرد ({phase})' },
  'movió una foto de la fila #{from} a la #{to}': { en: 'moved a photo from row #{from} to #{to}', fa: 'یک عکس را از ردیف #{from} به #{to} منتقل کرد' },
  'cambió la fase de una foto: {from} → {to}': { en: 'changed a photo phase: {from} → {to}', fa: 'مرحله یک عکس را تغییر داد: {from} ← {to}' },
  'reordenó las fotos': { en: 'reordered the photos', fa: 'ترتیب عکس‌ها را تغییر داد' },
  'cambió {field}: "{from}" → "{to}"': { en: 'changed {field}: "{from}" → "{to}"', fa: '{field} را تغییر داد: «{from}» ← «{to}»' },
  'creó el defecto ({defect})': { en: 'created the defect ({defect})', fa: 'نقص را ایجاد کرد ({defect})' },
  'eliminó el defecto ({defect})': { en: 'deleted the defect ({defect})', fa: 'نقص را حذف کرد ({defect})' },
  'deshizo: {label}': { en: 'undid: {label}', fa: 'برگرداند: {label}' },
  '{label}: {added} nuevos, {removed} eliminados, {changed} modificados': {
    en: '{label}: {added} new, {removed} deleted, {changed} changed',
    fa: '{label}: {added} جدید، {removed} حذف شده، {changed} تغییر یافته',
  },
  'editó en Google Sheet: {fields}': { en: 'edited in Google Sheet: {fields}', fa: 'در Google Sheet ویرایش کرد: {fields}' },
  'Sin nombre': { en: 'Unnamed', fa: 'بی‌نام' },
  'Hoy': { en: 'Today', fa: 'امروز' },
  'Ayer': { en: 'Yesterday', fa: 'دیروز' },
  'Etiquetas': { en: 'Tags', fa: 'برچسب‌ها' },
  'Comentario': { en: 'Comment', fa: 'نظر' },
  'Técnico inicio': { en: 'Start technician', fa: 'تکنیسین شروع' },
  'Técnico final': { en: 'Completion technician', fa: 'تکنیسین تکمیل' },
  'Fecha inicio': { en: 'Start date', fa: 'تاریخ شروع' },
  'Fecha final': { en: 'Completion date', fa: 'تاریخ تکمیل' },
  'Nº fila': { en: 'Row no.', fa: 'شماره ردیف' },
};

// Plain function for code outside React (and for the provider below).
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let text = lang === 'es' ? key : DICT[key]?.[lang] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === 'en' || stored === 'es' || stored === 'fa') return stored;
    } catch {}
    return 'en';
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
  }, []);

  // Dari is written right to left.
  useEffect(() => {
    document.documentElement.lang = lang === 'fa' ? 'fa-AF' : lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);

// Label helpers shared by several components.
export const STATUS_LABEL: Record<string, string> = {
  BEFORE: 'Antes',
  'IN PROGRESS': 'En Progreso',
  COMPLETED: 'Completado',
};
export const PHASE_LABEL: Record<string, string> = {
  BEFORE: 'Antes',
  'IN PROGRESS': 'Durante',
  COMPLETED: 'Después',
};
export const URGENCY_LABEL: Record<string, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};
