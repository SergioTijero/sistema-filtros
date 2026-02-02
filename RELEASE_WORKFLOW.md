# ☁️ Protocolo de Lanzamiento Automático (GitHub Actions)

¡Bienvenido al nivel profesional! Ahora **no necesitas usar Windows** para crear el actualizador. GitHub lo hará por ti en la nube.

## Prerrequisitos
1.  **Icono**: Asegúrate de que `app.ico` está en el repositorio de GitHub (en la raíz).
2.  **Configuración**: Asegúrate de que los permisos de GitHub Actions están activos en tu repositorio (Settings > Actions > General > Workflow permissions > Read and write permissions).

---

## 🚀 Cómo Lanzar una Nueva Versión (Desde Mac)

Supongamos que quieres lanzar la **Versión 1.3**.

### 1. Actualiza el Código
*   En `main.py`: `VERSION = "1.3"`
*   En `setup_script.iss`: `#define MyAppVersion "1.3"`
*   En `version.txt`: `1.3`

### 2. Sube los Cambios
Desde tu terminal en Mac:
```bash
git add .
git commit -m "Preparando versión 1.3"
git push
```

### 3. Activa el "Robot" (Tag)
Para que GitHub sepa que esto es una versión oficial y empiece a construir el `.exe`, debes ponerle una etiqueta ("Tag"):

```bash
git tag v1.3
git push origin v1.3
```

### 4. Espera y Disfruta
1.  Ve a tu repositorio en GitHub > pestaña **Actions**.
2.  Verás un proceso girando llamado "Build Windows Installer".
3.  Espera unos 2-3 minutos.
4.  Cuando termine (Tick verde ✅), ve a la pestaña **Releases**.
5.  ¡MAGIA! GitHub habrá creado el "Release v1.3" y habrá subido el archivo `Setup_FiltrosExpress.exe` automáticamente.

---

## ✅ Experiencia del Usuario (Tu Papá)
1.  Su programa le avisa "ACTUALIZAR" (porque vio el `version.txt` nuevo).
2.  Le da clic.
3.  El programa baja el instalador `Setup...exe` que GitHub creó.
4.  Se abre el asistente de instalación.
5.  Actualiza y **MANTIENE TODOS SUS DATOS** (porque ahora viven en `%APPDATA%`).
