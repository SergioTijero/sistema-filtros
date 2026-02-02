# Guía de Instalación para Windows

Dado que deseas que el programa se comporte como una aplicación nativa (con icono en el escritorio y sin necesitar abrir la consola), sigue estos pasos para **convertir el código fuente en un Ejecutable (.exe)**.

## Paso 1: Generar el Ejecutable

1.  Asegúrate de tener **Python** instalado en tu PC Windows.
2.  Copia toda la carpeta del proyecto a tu PC Windows.
3.  Haz doble clic en el archivo **`build_windows.bat`**.
    *   Este script instalará automáticamente la herramienta necesaria (`pyinstaller`) y construirá el programa.
4.  Espera a que termine y diga "EXITO!".

## Paso 2: Instalación / Acceso Directo

1.  Verás una nueva carpeta llamada **`dist`**.
2.  Dentro encontrarás el archivo **`FiltrosExpress.exe`**.
3.  **Mueve este archivo** a una ubicación segura (ej. `C:\FiltrosExpress` o `Documentos`).
4.  Haz **clic derecho** sobre `FiltrosExpress.exe` > **Enviar a** > **Escritorio (crear acceso directo)**.

¡Listo! Ahora tendrás un icono en tu escritorio que abre el sistema instantáneamente como cualquier otro programa profesional.

---
**Nota Técnica**: El archivo `.exe` generado contiene todo lo necesario para funcionar (incluyendo una mini versión de Python), por lo que puedes copiar ese único archivo a otras computadoras con Windows 10/11 y funcionará sin instalar nada más.
