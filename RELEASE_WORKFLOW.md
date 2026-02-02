# Protocolo de Actualización (Sistema de Instalador)

Para generar una actualización que los usuarios puedan instalar automáticamente:

## 1. Preparación
1.  **Código**: Incrementa `VERSION = "X.X"` en `main.py`.
2.  **Versión**: Pon el número `X.X` en `version.txt`.

## 2. Compilación (Windows)
1.  **Ejecutable**: Corre `build_windows.bat`. Se creará `dist/FiltrosExpress.exe`.
2.  **Instalador**:
    *   Abre `setup_script.iss` con **Inno Setup**.
    *   Dale al botón "Compile" (o Run).
    *   Esto generará un archivo llamado `Setup_FiltrosExpress.exe` en la carpeta `Output` (se creará sola).

## 3. Publicación (GitHub)
1.  **Código**: Commit y Push de los cambios (`main.py` y `version.txt`).
    *   *Esto activa la alerta en el PC del cliente.*
2.  **Release**:
    *   Ve a GitHub > Releases > New Release.
    *   Tag: `vX.X` (IMPORTANTE: Debe coincidir con el número que pusiste en el código).
    *   **Binarios**: Sube el archivo `Setup_FiltrosExpress.exe` (el de la carpeta Output, NO el de dist).
    *   Publish.

## 4. Resultado
El cliente verá el botón "ACTUALIZAR".
Al hacer clic:
1.  Su programa descargará `Setup_FiltrosExpress.exe` desde GitHub.
2.  Se cerrará.
3.  Se abrirá el instalador.
4.  Él solo dará "Siguiente > Instalar" y tendrá la nueva versión.
