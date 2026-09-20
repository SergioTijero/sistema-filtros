# Filtros Express PRO

Aplicación local para consultar precios, administrar inventario, gestionar clientes y asignar tarifas especiales. La versión actual es **v2.1.0**: React + Vite para la interfaz, Tauri para el ejecutable de escritorio y un archivo JSON local para los datos.

La versión Python 1.3 se conserva como línea anterior y como fuente de migración CSV.

## Descargar v2.0

La versión publicada para Windows x64 está disponible en [GitHub Releases](https://github.com/SergioTijero/sistema-filtros/releases/tag/v2.1.0):

- [Instalador Windows `.exe`](https://github.com/SergioTijero/sistema-filtros/releases/download/v2.1.0/Filtros.Express.PRO_2.1.0_x64-setup.exe)
- [Paquete Windows `.msi`](https://github.com/SergioTijero/sistema-filtros/releases/download/v2.1.0/Filtros.Express.PRO_2.1.0_x64_en-US.msi)

El instalador no requiere Python ni conexión a internet para trabajar con inventario, clientes o precios. La aplicación guarda la información en `filtros_express_pro.json`, dentro de la carpeta de datos de la aplicación.

En v2.1.0 cada cambio mantiene además una copia local de recuperación y las escrituras JSON se serializan. Esto permite recuperar el último estado si Windows cierra la aplicación mientras se está guardando. Las bases SQLite creadas por v2.0.0/v2.0.1 se leen una sola vez para migrarlas al nuevo archivo JSON.

## Funciones de v2.0

- Consulta de precio de lista, tarifa especial y stock disponible.
- Inventario con código, costo de compra en soles, precio de venta en soles y stock actual.
- Vista previa de stock junto al formulario de registro.
- Edición de productos desde la fila de inventario.
- Indicador de stock bajo y mensajes de validación, éxito y error.
- Directorio de clientes con búsqueda y estado activo.
- Tarifas especiales por cliente y producto.
- Barra lateral independiente, comprimible y responsive.
- Exportación e importación CSV compatible con v1.3.
- Datos persistentes en JSON cuando corre como aplicación Tauri.

## Modos de ejecución

| Modo | Uso | Almacenamiento |
| --- | --- | --- |
| Navegador/Vite | Desarrollo y revisión visual | `localStorage` del navegador |
| Tauri | Aplicación nativa Windows | JSON local: `filtros_express_pro.json` |

## Desarrollo web local

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Esta modalidad sirve archivos locales y no necesita internet durante el uso.

Para validar la compilación web:

```bash
npm run build
npm run preview
```

## Ejecutar y compilar Tauri

Requisitos adicionales:

- Rust instalado mediante `rustup`.
- En Windows, WebView2 y las herramientas de compilación de Visual Studio.
- Node.js y las dependencias instaladas con `npm install`.

```bash
npm run tauri:dev
npm run tauri:build
```

El adaptador de datos está en [`src/storage.js`](src/storage.js). Detecta el entorno Tauri y utiliza el plugin Store para persistir JSON; en el navegador mantiene `localStorage` para poder probar la UI sin Rust. El lector SQLite solo se conserva para migrar instalaciones anteriores.

## Migrar desde v1.3

1. Abre la versión Python 1.3.
2. Exporta una copia en formato CSV.
3. Abre **Copias de seguridad > Importar v1.3** en v2.0.
4. Selecciona el archivo `.csv` y espera el mensaje de importación completada.
5. Verifica los totales de productos, clientes y precios especiales.
6. Exporta una nueva copia desde v2.0 como respaldo.

El importador reconoce las tablas que exporta v1.3:

```text
# TABLE: products
code,cost,price,stock

# TABLE: clients
name

# TABLE: special_prices
client_name,product_code,price
```

Los importes se guardan como números y se muestran en soles (`S/`). El símbolo monetario no se escribe en el CSV.

## Releases automáticos

GitHub Actions mantiene dos líneas de publicación:

- Etiquetas `v1.*`: workflow Python e instalador Inno Setup de la versión anterior.
- Etiquetas `v2.*`: workflow Tauri, Rust + JSON local, instaladores `.exe` y `.msi`.

Para publicar una nueva v2:

```bash
git tag v2.1.0
git push origin v2.1.0
```

El workflow [`build-tauri.yml`](.github/workflows/build-tauri.yml) compila en `windows-latest` y adjunta los instaladores a la release. Para consultar el estado, revisa la pestaña [Actions](https://github.com/SergioTijero/sistema-filtros/actions).

## Estructura principal

```text
src/main.jsx                 Pantallas y lógica de la interfaz React
src/styles.css               Tokens y estilos alineados con Stitch
src/storage.js               Adaptador JSON local/localStorage
src-tauri/                   Configuración, permisos y backend Tauri
.github/workflows/           Builds automáticos v1 y v2
main.py                      Aplicación Python v1.3 conservada
```

## Estado de la versión

- Release: [v2.1.0](https://github.com/SergioTijero/sistema-filtros/releases/tag/v2.1.0)
- Build Windows: [workflow Tauri](https://github.com/SergioTijero/sistema-filtros/actions/runs/30410971693)
- Rama de integración: [`agent/release-v2-tauri`](https://github.com/SergioTijero/sistema-filtros/tree/agent/release-v2-tauri)

Desarrollado por Sergio Tijero.
