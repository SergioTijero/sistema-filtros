@echo off
echo ===================================================
echo   GENERADOR DE INSTALADOR - FILTROS EXPRESS PRO
echo ===================================================
echo.
echo Este script convertira el codigo Python en un programa (.exe)
echo que funciona sin necesidad de instalar Python en otras maquinas.
echo.
echo Requisitos previos: Tener Python instalado en ESTA maquina.
echo.
pause

echo.
echo [1/3] Instalando herramienta de creacion (PyInstaller)...
pip install pyinstaller

echo.
echo [2/3] Generando el Ejecutable (FiltrosExpress.exe)...
echo Esto puede tomar unos minutos...
:: --noconsole: No mostrar la ventana negra de fondo
:: --onefile: Crear un solo archivo .exe portable
:: --name: Nombre del programa
pyinstaller --noconsole --onefile --name "FiltrosExpress" main.py

echo.
echo [3/3] Limpieza de archivos temporales...
rmdir /s /q build
del /q "FiltrosExpress.spec"

echo.
echo ===================================================
echo   EXITO!
echo ===================================================
echo.
echo Tu programa esta listo en la carpeta "dist".
echo Puedes copiar "FiltrosExpress.exe" al Escritorio.
echo.
pause
