# Gradient Gen for Windows (desktop app)

This folder holds the original desktop program **Gradient Gen v3.99** and everything needed to turn it into a single `GradientGen.exe`.

## Download

Get the ready-made file from the [Releases page](https://github.com/nihadsquare/gradient-gen/releases). Look for the release whose name starts with **Gradient Gen Desktop** and download `GradientGen-3.99-win64.exe`. There is nothing to install: put the file anywhere (the Desktop, a USB stick) and double-click it. Windows 10 or 11, 64-bit.

Your settings, presets and palettes are saved in `%APPDATA%\GradientGen`, so you can move or replace the `.exe` without losing them.

### The first start: "Windows protected your PC"

The file is not signed with a paid certificate, so Windows SmartScreen shows a blue warning for new programs.
1. Click **More info**.
2. Click **Run anyway**.

Some antivirus programs also warn about any new program made with PyInstaller. To check that your download is the original, compare its fingerprint with the `.sha256` file on the release:

```powershell
Get-FileHash .\GradientGen-3.99-win64.exe -Algorithm SHA256
```

If a program wrongly blocks it, you can report the file as a false positive at <https://www.microsoft.com/en-us/wdsi/filesubmission> (Microsoft Defender) or on your antivirus vendor's website.

## What is in this folder

| File | What it is for |
| --- | --- |
| `gradient_gen.py` | The program (one file; the logo and icon are inside it) |
| `GG.ico` | The icon of the `.exe` |
| `version_info.txt` | The name, version and owner shown in the file's Properties → Details |
| `requirements.txt` | The libraries it needs (Pillow, NumPy) and PyInstaller |
| `build.bat` | Builds the `.exe` on your own PC |

## Run it from the source

Needs Python 3.10 or newer.

```bash
pip install pillow numpy
python gradient_gen.py
```

## Build the .exe

**On GitHub (no install):** Actions tab → *Build Windows app* → *Run workflow*. When it is green, open the run and download **GradientGen-windows** at the bottom. To attach the file to a release, publish a release whose tag starts with `desktop-` (for example `desktop-v3.99`).

**On your own PC:** install Python from <https://www.python.org/downloads/> (tick *Add python.exe to PATH*), then double-click `build.bat`. The result is `dist\GradientGen.exe`.
