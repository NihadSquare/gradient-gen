@echo off
rem Builds GradientGen.exe on your own Windows PC (64-bit Python 3.10 or newer must be installed).
rem It compiles the program with Nuitka (the first run downloads a C compiler, about 3 minutes extra).
rem Double-click this file. The result is dist\GradientGen.exe
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
  pause
  exit /b 1
)

echo Creating a private build environment...
python -m venv .buildenv || goto :fail
call .buildenv\Scripts\activate.bat || goto :fail
python -m pip install --upgrade pip || goto :fail
python -m pip install -r requirements.txt || goto :fail

echo Compiling GradientGen.exe (this takes 15 to 30 minutes)...
python -m nuitka --onefile --windows-console-mode=disable --enable-plugin=tk-inter ^
  --windows-icon-from-ico=GG.ico --output-dir=dist --output-filename=GradientGen.exe ^
  --company-name="Nihad Square" --product-name="Gradient Gen" --file-description="Gradient Gen" ^
  --file-version=4.2.0.0 --product-version=4.2.0.0 ^
  --copyright="Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved." ^
  --assume-yes-for-downloads --remove-output gradient_gen.py || goto :fail

echo.
echo Done: %~dp0dist\GradientGen.exe
pause
exit /b 0

:fail
echo.
echo The build failed. Scroll up to see the first error message.
pause
exit /b 1
