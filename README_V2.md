# Filtros Express PRO v2.0

Interfaz React local basada en el diseño de Stitch. Esta primera capa conserva las operaciones principales de la versión 1.3 y prepara la migración a una aplicación nativa con Tauri.

## Ejecutar en local

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173/`. La aplicación no necesita internet para funcionar; Vite solo sirve los archivos locales durante el desarrollo.

Para validar una compilación lista para empaquetar:

```bash
npm run build
npm run preview
```

## Funciones disponibles

- Consulta de precio de lista, precio especial y stock disponible.
- Inventario con los campos de Stitch: código, costo, precio de venta y stock actual.
- Vista previa de stock junto al formulario, búsqueda por código y edición directa desde la fila.
- Clientes con directorio visible, búsqueda y estado activo.
- Precios especiales por cliente y producto.
- Mensajes de confirmación y error accesibles, con validaciones antes de guardar.
- Barra lateral comprimible, navegación independiente y diseño responsive.
- Exportación e importación CSV compatible con las tablas de v1.3.

En modo navegador los datos se guardan en `localStorage`; al ejecutarse como aplicación Tauri se guardan en SQLite, sin cambiar las pantallas ni el formato de importación.

## Aplicación nativa Tauri + SQLite

El proyecto ya incluye el adaptador SQLite y la configuración de Tauri. En el navegador se conserva `localStorage`; dentro del ejecutable Tauri se usa `sqlite:filtros_express_pro.db` en la carpeta de datos de la aplicación.

Requisitos para compilar de forma nativa: Rust mediante `rustup`, Node.js y, en Windows, WebView2 y las herramientas de compilación de Visual Studio.

```bash
npm run tauri:dev
npm run tauri:build
```

El workflow `.github/workflows/build-tauri.yml` ejecuta la compilación del instalador Windows al publicar una etiqueta `v2.*`. El workflow existente conserva la línea Python para etiquetas `v1.*`.

## Migración de v1.3

1. En v1.3 exporta la información a CSV.
2. En v2.0 abre **Copias de seguridad > Importar v1.3**.
3. Selecciona el archivo y verifica el resumen de productos, clientes y precios especiales.
4. Guarda una nueva copia CSV antes de actualizar o reinstalar.

La aplicación Python de v1.3 se mantiene intacta como respaldo. La distribución Windows de v2.0 ya se genera con Tauri + SQLite, por lo que el usuario no necesita instalar Python ni depender de un servidor web.
