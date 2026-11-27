# Gradient Gen for Windows (desktop app)

This folder holds the original desktop program **Gradient Gen v4.2** and everything needed to compile it into a single `GradientGen.exe` with Nuitka (Python turned into machine code, which is much harder to take apart than a PyInstaller file).

## Download

Get the ready-made file from the [Releases page](https://github.com/nihadsquare/gradient-gen/releases). Open the release **Gradient Gen Desktop 4.2 (Windows)** and download `GradientGen-4.2-win64.exe` (direct link: <https://github.com/nihadsquare/gradient-gen/releases/download/windows-v4.2/GradientGen-4.2-win64.exe>). There is nothing to install: put the file anywhere (the Desktop, a USB stick) and double-click it. Windows 10 or 11, 64-bit.

Your settings, presets and palettes are saved in `%APPDATA%\GradientGen`, so you can move or replace the `.exe` without losing them.

### The first start: "Windows protected your PC"

The file is not signed with a paid certificate, so Windows SmartScreen shows a blue warning for new programs.
1. Click **More info**.
2. Click **Run anyway**.

Some antivirus programs also warn about any new unsigned program. To check that your download is the original, compare its fingerprint with the `.sha256` file on the release:

```powershell
Get-FileHash .\GradientGen-4.2-win64.exe -Algorithm SHA256
```

If a program wrongly blocks it, you can report the file as a false positive at <https://www.microsoft.com/en-us/wdsi/filesubmission> (Microsoft Defender) or on your antivirus vendor's website.

## Licence

Source-available, all rights reserved: see [LICENSE](../LICENSE). You may use the program; you may not copy, redistribute or build another product from this code.

## What is in this folder

| File | What it is for |
| --- | --- |
| `gradient_gen.py` | The program (one file; the logo and icon are inside it) |
| `GG.ico` | The icon of the `.exe` |
| `version_info.txt` | Properties → Details data for the PyInstaller fallback build (the Nuitka build sets them in the workflow) |
| `requirements.txt` | The libraries it needs (Pillow, NumPy) and the tools that compile it (Nuitka) |
| `build.bat` | Builds the `.exe` on your own PC |

## Run it from the source

Needs Python 3.10 or newer.

```bash
pip install pillow numpy
python gradient_gen.py
```

## Build the .exe

**On GitHub (no install):** Actions tab → *Build Windows app* → *Run workflow*, and type a new tag such as `windows-v4.2`. When the run is green, a **draft** release with `GradientGen-4.2-win64.exe` and its checksum appears under *Releases*. Check it, then click *Publish release*. (Published releases are locked by GitHub's immutable releases, so the file has to be in the draft before you publish.) The compile takes about 15 to 30 minutes. If it ever fails, the workflow *Build Windows app (PyInstaller fallback)* builds an easier-to-open version in about 5 minutes.

**On your own PC:** install Python from <https://www.python.org/downloads/> (tick *Add python.exe to PATH*), then double-click `build.bat` (15 to 30 minutes; the first run also downloads a C compiler). The result is `dist\GradientGen.exe`.
