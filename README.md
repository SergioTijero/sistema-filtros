# Sistema de Filtros Express PRO 🚀 (v2.2)

Sistema de escritorio ligero para la gestión de inventario y precios de filtros de autos. Diseñado para funcionar en PCs de bajos recursos con Windows 10/11.

## Características

*   **Busqueda Inteligente**: Autocompletado de clientes y búsqueda rápida de filtros.
*   **Gestión de Precios**:
    *   Precios Generales de Venta.
    *   **Precios Especiales** por Cliente (resaltados en verde).
*   **Control de Stock**: Semaforización (Verde/Amarillo/Rojo) y alertas de stock bajo.
*   **Reportes**: Tablas de resumen de inventario y clientes.
*   **Auto-Actualizable**: Detecta nuevas versiones en GitHub.
*   **Portable**: Base de datos SQLite integrada.

## Instalación en Windows

Para instalar este programa en una computadora con Windows:

1.  Descarga este repositorio (Botón verde "Code" > "Download ZIP") o clónalo con Git.
2.  Sigue las instrucciones en el archivo [GUIA DE INSTALACION (INSTALL_GUIDE.md)](INSTALL_GUIDE.md) para generar el ejecutable `.exe`.

## ⚙️ Configuración de Actualizaciones

Para que el botón de "Actualizar" funcione, debes editar las líneas 46-48 de `main.py` antes de compilar:

```python
# main.py
UPDATE_URL_RAW = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/version.txt"
REPO_URL = "https://github.com/TU_USUARIO/TU_REPO"
```

1.  Crea un archivo `version.txt` en tu repo con el número de versión (ej: `2.3`).
2.  Si el programa local es `2.2` y en GitHub dice `2.3`, aparecerá un botón verde "🚀 ACTUALIZAR".

## Requisitos Técnicos
*   Python 3.x (solo para compilar).
*   Librerías: `tkinter`, `sqlite3` (Nativas).

---
*Desarrollado para gestión eficiente de talleres y refaccionarias.*
