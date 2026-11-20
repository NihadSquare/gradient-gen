@echo off
rem Builds GradientGen.exe on your own Windows PC (64-bit Python 3.10 or newer must be installed).
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

echo Building GradientGen.exe (this takes a minute or two)...
python -m PyInstaller --noconfirm --clean --onefile --windowed ^
  --name GradientGen --icon GG.ico --version-file version_info.txt ^
  --hidden-import PIL._tkinter_finder gradient_gen.py || goto :fail

echo.
echo Done: %~dp0dist\GradientGen.exe
pause
exit /b 0

:fail
echo.
echo The build failed. Scroll up to see the first error message.
pause
exit /b 1
