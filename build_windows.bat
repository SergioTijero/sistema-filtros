@echo off
echo ===================================================
echo   GENERADOR DE INSTALADOR - FILTROS EXPRESS PRO
echo ===================================================
echo.
echo Requisitos:
echo 1. Python instalado.
echo 2. Archivo 'app.ico' presente (opcional, pero recomendado).
echo.
pause

echo.
echo [1/3] Verificando entorno...
pip install pyinstaller

echo.
echo [2/3] Generando el Ejecutable...

:: Check for icon
if exist "app.ico" (
    echo Icono detectado. Usando app.ico...
    pyinstaller --noconsole --onefile --icon="app.ico" --name "FiltrosExpress" main.py
) else (
    echo [AVISO] No se encontro app.ico. Usando icono por defecto.
    pyinstaller --noconsole --onefile --name "FiltrosExpress" main.py
)

echo.
echo [3/3] Limpieza...
rmdir /s /q build
del /q "FiltrosExpress.spec"

echo.
echo ===================================================
echo   COMPILACION TERMINADA
echo ===================================================
echo.
echo El archivo ejecutable esta en la carpeta "dist".
echo AHORA: Usa Inno Setup Compiler para crear el Instalador final.
echo.
pause
