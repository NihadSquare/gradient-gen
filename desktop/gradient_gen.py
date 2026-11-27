#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Gradient Gen - Copyright (c) 2026 AK Nihad (Nihad Square). All rights reserved.
# Source-available, not open source: see LICENSE. Copying or reuse is not permitted without written permission.
# Official site: https://nihadsquare.github.io/gradient-gen/
"""
Gradient Gen v4.2 - standalone edition (single file)

Developed by Nihad Square.
The program icon (GG.ico) and the logos (GG.png, NS.png) are embedded at the bottom of
this file, so nothing else has to sit next to it.

Requires : Python 3.9+, Pillow, numpy (offered for install on first run if missing)
Settings : %APPDATA%/GradientGen  (or ~/.config/GradientGen on Linux/macOS)
"""
import tkinter as tk
from tkinter import ttk, colorchooser, messagebox, filedialog
import tkinter.font as tkfont
import sys
import importlib.util
import random
import math
import os
import re
import json
import time
import subprocess
import webbrowser
import base64
import zlib
import io
import tempfile
from colorsys import rgb_to_hls, hls_to_rgb

_BUILD_SIG = "gg.4c5662a6a2ef.f80d"
_ENGINE_SIG = "gg.32ca1c8ad370.10cf"
os.environ.setdefault("GG_SIG", _BUILD_SIG + "|" + _ENGINE_SIG)

APP_NAME = "Gradient Gen"
APP_VERSION = "4.2"
APP_BUILD = "GG07112026P"
APP_ID = "AKNCreatives.GradientGen.3"      # Windows taskbar grouping / icon identity
MAX_DIM = 8192                              # max export width or height (px)
LARGE_PIXELS = 33_000_000                   # ask for confirmation above this size
PREVIEW_W, PREVIEW_H = 448, 248             # preview box (the canvas is this size)
JULIA_C = (-0.8 + 0.156j, -0.4 + 0.6j, 0.285 + 0.01j, -0.70176 - 0.3842j,
           -0.835 - 0.2321j, -0.1 + 0.651j, 0.355 + 0.355j, -0.74543 + 0.11301j)
PERLIN_GAIN = 1.4                           # stretches Perlin noise to use the full color range
UI_FONT = "Roboto"                          # replaced at start-up by an installed font


# ── Dependency check (runs BEFORE Pillow / numpy are imported) ─────────────
def _ensure_dependencies():
    wanted = (("PIL", "pillow"), ("numpy", "numpy"))
    missing = [pip_name for mod, pip_name in wanted if importlib.util.find_spec(mod) is None]
    if not missing:
        return
    root = tk.Tk()
    root.withdraw()
    try:
        if getattr(sys, "frozen", False):
            messagebox.showerror("Missing library",
                                 "These libraries are missing from this build: " + ", ".join(missing))
            sys.exit(1)
        if not messagebox.askyesno("Install Required Libraries",
                                   "Gradient Gen needs: " + ", ".join(missing) +
                                   ".\n\nInstall them now with pip?"):
            sys.exit(1)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
            importlib.invalidate_caches()
        except Exception as e:
            messagebox.showerror("Error",
                                 f"Failed to install {', '.join(missing)}: {e}\n\n"
                                 f"Install manually with:\n  pip install {' '.join(missing)}")
            sys.exit(1)
    finally:
        root.destroy()


_ensure_dependencies()
from PIL import Image, ImageDraw, ImageTk, ImageFilter, ImageFont, ImageEnhance
import numpy as np


# ── Paths, embedded assets, icon ─────────────────────────────────────────
def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def data_dir():
    """Per-user folder for settings and presets (falls back to the app folder)."""
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA")
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    for path in ([os.path.join(base, "GradientGen")] if base else []) + [app_dir()]:
        try:
            os.makedirs(path, exist_ok=True)
            if os.access(path, os.W_OK):
                return path
        except OSError:
            continue
    return os.getcwd()


SETTINGS_PATH = os.path.join(data_dir(), "GG_Settings.json")
PRESETS_PATH = os.path.join(data_dir(), "GG_Presets.json")
PALETTES_PATH = os.path.join(data_dir(), "GG_Palettes.json")

# (label, width, height) - the first entry means "type my own size"
SIZE_PRESETS = [
    ("Custom Size", None, None),
    ("Full HD  1920 x 1080", 1920, 1080), ("2K  2560 x 1440", 2560, 1440),
    ("4K UHD  3840 x 2160", 3840, 2160), ("5K  5120 x 2880", 5120, 2880),
    ("Ultrawide  3440 x 1440", 3440, 1440),
    ("Phone Wallpaper  1080 x 1920", 1080, 1920), ("Phone Tall  1170 x 2532", 1170, 2532),
    ("Tablet  2048 x 2732", 2048, 2732),
    ("Instagram Post  1080 x 1080", 1080, 1080), ("Instagram Story  1080 x 1920", 1080, 1920),
    ("YouTube Banner  2560 x 1440", 2560, 1440), ("Facebook Cover  820 x 312", 820, 312),
    ("X / Twitter Header  1500 x 500", 1500, 500), ("LinkedIn Banner  1584 x 396", 1584, 396),
]

BUILTIN_PALETTES = [
    {"name": "Sunset Sky",      "colors": ["#2B1055", "#7597DE", "#F9748F", "#FEB47B"]},
    {"name": "Ocean Depths",    "colors": ["#001F3F", "#0074D9", "#39CCCC", "#B8F2E6"]},
    {"name": "Forest Canopy",   "colors": ["#0B3D2E", "#2E7D32", "#8BC34A", "#E6EE9C"]},
    {"name": "Candy Pop",       "colors": ["#FF6EC7", "#FFB3E6", "#B28DFF", "#6EC6FF"]},
    {"name": "Midnight Velvet", "colors": ["#0F0C29", "#302B63", "#24243E"]},
    {"name": "Peach Blush",     "colors": ["#FF9A9E", "#FAD0C4", "#FFECD2"]},
    {"name": "Neon Pulse",      "colors": ["#120078", "#9D0191", "#FD3A69", "#FECD1A"]},
    {"name": "Mono Scale",      "colors": ["#0D0D0D", "#555555", "#BBBBBB", "#F5F5F5"]},
    {"name": "Aurora Borealis", "colors": ["#0B1026", "#1B4965", "#2EC4B6", "#9EF01A"]},
    {"name": "Lavender Dream",  "colors": ["#E6E6FA", "#C9B6F2", "#A78BFA", "#6D5BD0"]},
    {"name": "Retro Sunset",    "colors": ["#2D1E5F", "#B83B5E", "#F08A5D", "#F9ED69"]},
    {"name": "Cyber City",      "colors": ["#0D0221", "#261447", "#F706CF", "#00F0FF"]},
    {"name": "Autumn Leaves",   "colors": ["#3E2723", "#8D4B1F", "#D9822B", "#F2C14E"]},
    {"name": "Mint Fresh",      "colors": ["#E0FBFC", "#B8F2E6", "#7ED6C1", "#3AAFA9"]},
    {"name": "Berry Punch",     "colors": ["#2B0A3D", "#7B1E7A", "#D6336C", "#FF8FA3"]},
    {"name": "Desert Dune",     "colors": ["#5E3023", "#C08552", "#DEB887", "#F3E9DC"]},
    {"name": "Arctic Ice",      "colors": ["#03045E", "#0077B6", "#90E0EF", "#CAF0F8"]},
    {"name": "Cotton Candy",    "colors": ["#FFC8DD", "#FFAFCC", "#BDE0FE", "#A2D2FF"]},
    {"name": "Volcano Glow",    "colors": ["#1A0000", "#7A0C0C", "#E4572E", "#FFC857"]},
    {"name": "Emerald Tide",    "colors": ["#022B3A", "#1F7A8C", "#52B788", "#D8F3DC"]},
    {"name": "Golden Hour",     "colors": ["#3D2C8D", "#916BBF", "#F7A072", "#FFD166"]},
    {"name": "Rose Gold",       "colors": ["#6D3B47", "#B76E79", "#E8B4B8", "#FCE4E4"]},
    {"name": "Slate Stone",     "colors": ["#1F2933", "#3E4C59", "#7B8794", "#CBD2D9"]},
    {"name": "Tropical Breeze", "colors": ["#00A896", "#02C39A", "#F0F3BD", "#FF6F59"]},
    {"name": "Twilight Dusk",   "colors": ["#10002B", "#3C096C", "#7B2CBF", "#C77DFF"]},
    {"name": "Citrus Splash",   "colors": ["#FF9F1C", "#FFBF69", "#FFFFFF", "#2EC4B6"]},
    {"name": "Lagoon Waters",   "colors": ["#012A4A", "#2A6F97", "#61A5C2", "#A9D6E5"]},
    {"name": "Blush Garden",    "colors": ["#F8EDEB", "#F9DCC4", "#FEC89A", "#D8E2DC"]}
]


def asset_bytes(name):
    return zlib.decompress(base64.b64decode("".join(ASSETS[name].split())))


def asset_image(name):
    return Image.open(io.BytesIO(asset_bytes(name))).convert("RGBA")


def fit_width(img, width):
    """Resize keeping the original aspect ratio (no stretching)."""
    height = max(1, int(round(img.height * width / img.width)))
    return img.resize((width, height), Image.Resampling.LANCZOS)


_ICON_PATH = None


def icon_path():
    """Write the embedded GG.ico to a temp file once and return its path."""
    global _ICON_PATH
    if _ICON_PATH and os.path.exists(_ICON_PATH):
        return _ICON_PATH
    data = asset_bytes("GG.ico")
    for folder in (tempfile.gettempdir(), data_dir()):
        path = os.path.join(folder, "GradientGen_GG.ico")
        try:
            if not (os.path.exists(path) and os.path.getsize(path) == len(data)):
                with open(path, "wb") as f:
                    f.write(data)
            _ICON_PATH = path
            return path
        except OSError:
            continue
    return None


def set_app_user_model_id():
    """Makes Windows show GG.ico on the taskbar instead of the Python icon."""
    if sys.platform.startswith("win"):
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
        except Exception:
            pass


def apply_app_icon(root):
    """Window + taskbar icon for the main window and every dialog opened later."""
    try:
        if sys.platform.startswith("win"):
            path = icon_path()
            if path:
                root.iconbitmap(default=path)
        else:
            img = Image.open(io.BytesIO(asset_bytes("GG.ico"))).convert("RGBA").resize((128, 128))
            root._icon_ref = ImageTk.PhotoImage(img)
            root.iconphoto(True, root._icon_ref)
    except Exception as e:
        print(f"Warning: could not set the program icon: {e}")


def pick_ui_font(root):
    try:
        families = set(tkfont.families(root))
    except Exception:
        families = set()
    for name in ("Segoe UI Variable Text", "Segoe UI", "SF Pro Text", "Helvetica Neue", "Inter", "Roboto", "DejaVu Sans", "Arial"):
        if name in families:
            return name
    return "Helvetica"


def get_pil_font(size):
    for name in ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf", "Helvetica.ttc"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def save_image_file(image, path, quality=95, flatten=None):
    """Save as PNG, JPEG or WebP and return the final path.
    flatten = "White" / "Black" replaces transparency with that color; JPEG cannot store
    transparency, so it is flattened onto white when flatten is None."""
    ext = os.path.splitext(path)[1].lower()
    quality = int(min(100, max(1, quality)))
    if ext in (".jpg", ".jpeg") or flatten in ("White", "Black"):
        rgba = image.convert("RGBA")
        flat = Image.new("RGB", rgba.size, (0, 0, 0) if flatten == "Black" else (255, 255, 255))
        flat.paste(rgba, mask=rgba.getchannel("A"))
        image = flat
    if ext in (".jpg", ".jpeg"):
        image.save(path, "JPEG", quality=quality, subsampling=0)
    elif ext == ".webp":
        image.save(path, "WEBP", quality=quality, lossless=(quality >= 100), method=4)
    else:
        if ext != ".png":
            path += ".png"
        image.save(path, "PNG")
    return path


def copy_image_to_clipboard(image, flatten=None):
    """Put a picture on the system clipboard. Returns (ok, message).
    Windows: DIB + PNG formats.  macOS: osascript.  Linux: wl-copy or xclip (must be installed)."""
    rgba = image.convert("RGBA")
    flat = Image.new("RGB", rgba.size, (0, 0, 0) if flatten == "Black" else (255, 255, 255))
    flat.paste(rgba, mask=rgba.getchannel("A"))
    png_buf = io.BytesIO()
    (rgba if flatten is None else flat).save(png_buf, "PNG")
    png = png_buf.getvalue()
    try:
        if sys.platform.startswith("win"):
            import ctypes
            from ctypes import wintypes
            bmp = io.BytesIO()
            flat.save(bmp, "BMP")
            dib = bmp.getvalue()[14:]                         # drop the 14-byte file header
            user32 = ctypes.WinDLL("user32", use_last_error=True)
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            user32.OpenClipboard.argtypes = [wintypes.HWND]
            user32.OpenClipboard.restype = wintypes.BOOL
            user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
            user32.SetClipboardData.restype = wintypes.HANDLE
            user32.RegisterClipboardFormatW.argtypes = [wintypes.LPCWSTR]
            user32.RegisterClipboardFormatW.restype = wintypes.UINT
            kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
            kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
            kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
            kernel32.GlobalLock.restype = wintypes.LPVOID
            kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
            kernel32.GlobalFree.argtypes = [wintypes.HGLOBAL]

            def put(fmt, data):
                h = kernel32.GlobalAlloc(0x0002, len(data))         # GMEM_MOVEABLE
                if not h:
                    raise OSError("out of memory")
                p = kernel32.GlobalLock(h)
                ctypes.memmove(p, data, len(data))
                kernel32.GlobalUnlock(h)
                if not user32.SetClipboardData(fmt, h):
                    kernel32.GlobalFree(h)
                    raise OSError("the clipboard refused the picture")

            for _ in range(15):                                   # another program may hold it for a moment
                if user32.OpenClipboard(None):
                    break
                time.sleep(0.05)
            else:
                return False, "The clipboard is busy. Try again."
            try:
                user32.EmptyClipboard()
                put(8, dib)                                       # CF_DIB
                put(user32.RegisterClipboardFormatW("PNG"), png)  # keeps transparency for apps that read it
            finally:
                user32.CloseClipboard()
            return True, "Copied"
        if sys.platform == "darwin":
            path = os.path.join(tempfile.gettempdir(), "gradientgen_clip.png")
            with open(path, "wb") as f:
                f.write(png)
            script = f'set the clipboard to (read (POSIX file "{path}") as \u00abclass PNGf\u00bb)'
            subprocess.run(["osascript", "-e", script], check=True, timeout=30,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True, "Copied"
        import shutil
        for cmd in (["wl-copy", "--type", "image/png"], ["xclip", "-selection", "clipboard", "-t", "image/png"]):
            if shutil.which(cmd[0]):
                subprocess.run(cmd, input=png, check=True, timeout=30,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True, "Copied"
        return False, "Install wl-clipboard or xclip to copy pictures on Linux."
    except Exception as e:
        return False, f"Could not copy: {e}"


# ══════════════════════════════════════════════════════════════════════════
#  Modern UI toolkit (v3.3): themes, drawn icons and custom widgets
# ══════════════════════════════════════════════════════════════════════════
def _theme(name, label, dark, bg, surface, surface2, border, text, dim, accent, accent_hover,
           on_accent, track, preview, ok, warn, bad):
    return {"name": name, "label": label, "dark": dark, "bg": bg, "surface": surface,
            "surface2": surface2, "border": border, "text": text, "dim": dim, "accent": accent,
            "accent_hover": accent_hover, "on_accent": on_accent, "track": track,
            "preview": preview, "knob": "#FFFFFF", "ok": ok, "warn": warn, "bad": bad}


_OK, _WARN, _BAD = "#34D399", "#FBBF24", "#F87171"
THEMES = {
    "midnight": _theme("midnight", "Midnight", True, "#0D0A1F", "#16122E", "#211B45", "#2F2862",
                       "#ECE9FF", "#9893C9", "#5240FF", "#846BFF", "#FFFFFF", "#2B2559", "#090715",
                       _OK, _WARN, _BAD),
    "graphite": _theme("graphite", "Graphite", True, "#111214", "#1A1B1E", "#25272B", "#34373D",
                       "#ECEDEF", "#8D9199", "#C9CDD4", "#E4E7EC", "#15161A", "#33363C", "#0B0B0D",
                       _OK, _WARN, _BAD),
    "aurora": _theme("aurora", "Aurora", True, "#06161A", "#0C2227", "#133339", "#1E4A52",
                     "#E2F7F5", "#7FB6B3", "#2DD4BF", "#5EEAD4", "#042F2E", "#18424A", "#041013",
                     _OK, _WARN, _BAD),
    "sunset": _theme("sunset", "Sunset", True, "#1A0E12", "#27151B", "#381F28", "#53303C",
                     "#FFEDE5", "#CFA3A0", "#FF7A45", "#FF9566", "#2A0F05", "#4A2A35", "#12070A",
                     _OK, _WARN, _BAD),
    "rose": _theme("rose", "Rose", True, "#1A0D15", "#26121E", "#361A2A", "#512740",
                   "#FFE8F1", "#CFA0B8", "#FF5C9A", "#FF82B2", "#2B0716", "#4A2339", "#11060D",
                   _OK, _WARN, _BAD),
    "ocean": _theme("ocean", "Ocean", True, "#071327", "#0D1E3B", "#142A50", "#213B69",
                    "#E6F0FF", "#8BA6D4", "#3B9CFF", "#66B2FF", "#04152E", "#1B3563", "#040C1A",
                    _OK, _WARN, _BAD),
    "forest": _theme("forest", "Forest", True, "#09150F", "#0F2218", "#163124", "#244937",
                     "#E6F6EC", "#8DB8A0", "#4ADE80", "#74E8A0", "#052313", "#1D4030", "#050E09",
                     _OK, _WARN, _BAD),
    "paper": _theme("paper", "Paper", False, "#ECECE6", "#FFFFFF", "#F3F3EE", "#D9D8D0",
                    "#1E1E24", "#6B6B78", "#5B3DF5", "#7357FF", "#FFFFFF", "#D8D7E6", "#E2E2DB",
                    "#12805C", "#B7791F", "#C53030"),
}
THEME_ORDER = ["midnight", "graphite", "aurora", "sunset", "rose", "ocean", "forest", "paper"]
THEME_ALIASES = {"default": "midnight", "purple": "midnight", "dark": "graphite", "black": "graphite",
                 "blue": "ocean", "green": "forest", "light": "paper", "orange": "sunset",
                 "cyan": "aurora", "teal": "aurora"}
SIDEBAR_W = 400
PROGRESS_PIXELS = 4_000_000     # exports with at least this many pixels show a progress bar with Cancel
DEFAULT_PREFS = {"theme": "midnight", "accent": "", "default_folder": "", "default_format": "PNG",
                 "confirm_close": True, "tooltips": True, "default_background": "Transparent",
                 "remember_window": False, "window_geometry": "", "window_zoomed": False}
MAX_COLORS = 12            # the most color stops a gradient can have
DEFAULT_COLORS = ["#5240FF", "#130935"] + ["#CCCCCC"] * (MAX_COLORS - 2)
DEFAULT_POSITIONS = [0.0, 1.0, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7, 0.9, 0.15]
PREVIEW_PAD = 14
PREVIEW_MAX_PIXELS = 640_000


def F(size=10, bold=False):
    return (UI_FONT, size, "bold" if bold else "normal")


def _rgba(color, alpha=255):
    c = color.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), alpha


def _blend(c1, c2, f):
    """f of color 1 mixed with (1-f) of color 2."""
    a, b = _rgba(c1), _rgba(c2)
    return "#%02x%02x%02x" % tuple(int(round(a[i] * f + b[i] * (1 - f))) for i in range(3))


def _contrast_text(color):
    r, g, b, _ = _rgba(color)
    return "#14141A" if (r * 0.299 + g * 0.587 + b * 0.114) > 150 else "#FFFFFF"


_SPR = {}


def _photo(key, build):
    """Cached ImageTk sprite (built once per unique key)."""
    p = _SPR.get(key)
    if p is None:
        p = ImageTk.PhotoImage(build())
        _SPR[key] = p
    return p


def _chip(color, edge):
    """16 px smooth rounded color square with a thin edge (color previews in dropdown options)."""
    return _photo(("chip", color, edge), lambda: _rr(16, 16, 4, color, edge))


def _ring(size, r_out, ow, ring, fill=None, S=6, label=None, label_color="#FFFFFF", label_px=9):
    """Anti-aliased circle: outer radius r_out, ring thickness ow, optional fill inside (smooth, no jagged edges)."""
    big = size * S
    c = big / 2.0
    def disc(r):
        m = Image.new("L", (big, big), 0)
        ImageDraw.Draw(m).ellipse((c - r * S, c - r * S, c + r * S - 1, c + r * S - 1), fill=255)
        return m
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if fill is not None:
        f = Image.new("RGBA", (big, big), _rgba(fill)[:3] + (255,))
        f.putalpha(disc(r_out - ow))
        img = Image.alpha_composite(img, f)
    outer, inner = disc(r_out), disc(r_out - ow)
    ringmask = Image.fromarray(np.clip(np.asarray(outer, dtype=np.int16) - np.asarray(inner, dtype=np.int16),
                                       0, 255).astype(np.uint8), "L")
    rl = Image.new("RGBA", (big, big), _rgba(ring)[:3] + (255,))
    rl.putalpha(ringmask)
    img = Image.alpha_composite(img, rl)
    if label:                                         # number centred by its real glyph box (exact in both directions)
        font = None
        for name in ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf", "arial.ttf", "DejaVuSans.ttf"):
            try:
                font = ImageFont.truetype(name, label_px * S)
                break
            except Exception:
                continue
        if font is None:
            font = get_pil_font(label_px * S)
        d = ImageDraw.Draw(img)
        l, t, r, b = d.textbbox((0, 0), str(label), font=font)
        d.text((big / 2 - (l + r) / 2, big / 2 - (t + b) / 2), str(label), font=font, fill=_rgba(label_color))
    return img.resize((size, size), Image.Resampling.LANCZOS)


def _rr(w, h, r, fill=None, outline=None, ow=1, S=4):
    """Anti-aliased rounded rectangle with transparent corners."""
    w, h = max(1, int(w)), max(1, int(h))
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle(
        (0, 0, w * S - 1, h * S - 1), radius=min(r, w / 2, h / 2) * S,
        fill=_rgba(fill) if fill else None, outline=_rgba(outline) if outline else None, width=ow * S)
    return img.resize((w, h), Image.Resampling.LANCZOS)


def round_corners(img, r):
    """Round the corners of a PIL image (used for the preview)."""
    img = img.convert("RGBA")
    S = 4
    mask = Image.new("L", (img.width * S, img.height * S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width * S - 1, img.height * S - 1),
                                           radius=r * S, fill=255)
    mask = mask.resize(img.size, Image.Resampling.LANCZOS)
    alpha = Image.composite(img.getchannel("A"), Image.new("L", img.size, 0), mask)
    out = img.copy()
    out.putalpha(alpha)
    return out


def icon_img(name, size, color, S=8):
    """Crisp UI icons drawn at runtime on a 24-unit grid (anti-aliased)."""
    k = size * S
    u = k / 24.0
    img = Image.new("RGBA", (k, k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col = _rgba(color)
    sw = max(1, int(round(1.9 * u)))

    def line(pts, w=sw):
        xy = [(x * u, y * u) for x, y in pts]
        d.line(xy, fill=col, width=w, joint="curve")
        for x, y in (xy[0], xy[-1]):
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=col)

    def circle(cx, cy, r, fill=False, w=sw):
        box = ((cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u)
        if fill:
            d.ellipse(box, fill=col)
        else:
            d.ellipse(box, outline=col, width=w)

    if name in ("lock", "unlock"):
        if name == "lock":
            d.arc((7.5 * u, 2.2 * u, 16.5 * u, 12.2 * u), 180, 360, fill=col, width=sw)
            line([(7.5, 7.2), (7.5, 11.5)])
            line([(16.5, 7.2), (16.5, 11.5)])
        else:
            d.arc((7.5 * u, 0.6 * u, 16.5 * u, 10.6 * u), 180, 360, fill=col, width=sw)
            line([(7.5, 5.6), (7.5, 11.5)])
            line([(16.5, 5.6), (16.5, 7.4)])
        d.rounded_rectangle((5 * u, 11 * u, 19 * u, 21.5 * u), radius=2.6 * u, fill=col)
        d.ellipse((10.4 * u, 14.2 * u, 13.6 * u, 17.4 * u), fill=(0, 0, 0, 0))
        d.rectangle((11.2 * u, 16 * u, 12.8 * u, 18.6 * u), fill=(0, 0, 0, 0))
    elif name == "sparkle":
        d.polygon([(x * u, y * u) for x, y in
                   [(10, 3), (12.2, 9.8), (19, 12), (12.2, 14.2), (10, 21), (7.8, 14.2), (1, 12), (7.8, 9.8)]],
                  fill=col)
        d.polygon([(x * u, y * u) for x, y in
                   [(19, 2), (20.1, 5), (23, 6), (20.1, 7), (19, 10), (17.9, 7), (15, 6), (17.9, 5)]], fill=col)
    elif name == "download":
        line([(12, 3.5), (12, 14.5)])
        line([(7, 10), (12, 15), (17, 10)])
        line([(4.5, 15.5), (4.5, 19.5), (19.5, 19.5), (19.5, 15.5)])
    elif name == "back":
        line([(14.5, 5), (7.5, 12), (14.5, 19)])
        line([(8, 12), (19, 12)])
    elif name == "palette":
        circle(12, 12, 9)
        for cx, cy in ((8, 10.5), (12, 7.5), (16, 10.5)):
            circle(cx, cy, 1.5, fill=True)
        circle(12, 16, 1.5, fill=True)
    elif name == "gradient":
        d.rounded_rectangle((3 * u, 4.5 * u, 21 * u, 19.5 * u), radius=3 * u, outline=col, width=sw)
        for x in (8, 12, 16):
            line([(x, 8), (x, 16)], w=max(1, int(round(1.3 * u))))
    elif name == "layers":
        line([(12, 3.5), (21, 8), (12, 12.5), (3, 8), (12, 3.5)])
        line([(3, 12), (12, 16.5), (21, 12)])
        line([(3, 16), (12, 20.5), (21, 16)])
    elif name == "reset":
        d.arc((4.5 * u, 4.5 * u, 19.5 * u, 19.5 * u), 40, 330, fill=col, width=sw)
        d.polygon([(x * u, y * u) for x, y in [(20.5, 3.5), (20.5, 10.5), (13.5, 9)]], fill=col)
    elif name == "info":
        circle(12, 12, 9)
        circle(12, 7.6, 1.25, fill=True)
        line([(12, 11), (12, 17)])
    elif name == "help":
        circle(12, 12, 9)
        font = get_pil_font(int(13 * u))
        d.text((12 * u, 12.4 * u), "?", fill=col, font=font, anchor="mm")
    elif name == "theme":
        circle(12, 12, 9)
        d.pieslice((3 * u, 3 * u, 21 * u, 21 * u), 270, 90, fill=col)
    elif name == "bookmark":
        pts = [(7, 3.5), (17, 3.5), (17, 20.5), (12, 16), (7, 20.5), (7, 3.5)]
        line(pts)
    elif name == "copy":
        line([(14.5, 4.5), (4.5, 4.5), (4.5, 14.5)])
        d.rounded_rectangle((8.5 * u, 8.5 * u, 20 * u, 20 * u), radius=2.4 * u, outline=col, width=sw)
    elif name == "image":
        d.rounded_rectangle((3.5 * u, 4.5 * u, 20.5 * u, 19.5 * u), radius=2.6 * u, outline=col, width=sw)
        circle(9, 9.6, 1.5, fill=True)
        line([(3.8, 17), (9.2, 12.2), (13, 15.4), (16, 12.8), (20.2, 16.6)])
    elif name == "gear":
        circle(12, 12, 6.4)
        circle(12, 12, 2.6)
        for k in range(8):
            a = math.radians(k * 45)
            line([(12 + 6.4 * math.cos(a), 12 + 6.4 * math.sin(a)), (12 + 9.4 * math.cos(a), 12 + 9.4 * math.sin(a))])
    elif name == "expand":
        for pts in (((4, 9), (4, 4), (9, 4)), ((15, 4), (20, 4), (20, 9)),
                    ((4, 15), (4, 20), (9, 20)), ((15, 20), (20, 20), (20, 15))):
            line(list(pts))
    elif name == "chevron":
        line([(7, 9.5), (12, 14.5), (17, 9.5)])
    elif name == "dice":
        d.rounded_rectangle((3.5 * u, 3.5 * u, 20.5 * u, 20.5 * u), radius=4.2 * u, outline=col, width=sw)
        for cx, cy in ((8.6, 8.6), (15.4, 8.6), (12, 12), (8.6, 15.4), (15.4, 15.4)):
            circle(cx, cy, 1.45, fill=True)
    elif name in ("star", "star_fill"):
        pts = []
        for k in range(10):
            ang = -math.pi / 2 + k * math.pi / 5
            rad = 9.4 if k % 2 == 0 else 4.1
            pts.append((12 + rad * math.cos(ang), 12.8 + rad * math.sin(ang)))
        if name == "star_fill":
            d.polygon([(x * u, y * u) for x, y in pts], fill=col)
        else:
            line(pts + [pts[0]], w=max(1, int(round(1.6 * u))))
    elif name in ("undo", "redo"):
        line([(14, 7.5), (8, 7.5)])
        line([(14, 20.5), (8, 20.5)])
        d.arc((7.5 * u, 7.5 * u, 20.5 * u, 20.5 * u), 270, 90, fill=col, width=sw)
        d.polygon([(x * u, y * u) for x, y in [(2.6, 7.5), (8.6, 3.0), (8.6, 12.0)]], fill=col)
    out = img.resize((size, size), Image.Resampling.LANCZOS)
    return out.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if name == "redo" else out


def _corner_sprites(r, fill, border):
    key = ("corners", r, fill, border)
    if key not in _SPR:
        base = _rr(2 * r, 2 * r, r, fill, border)
        boxes = [(0, 0, r, r), (r, 0, 2 * r, r), (0, r, r, 2 * r), (r, r, 2 * r, 2 * r)]
        _SPR[key] = [ImageTk.PhotoImage(base.crop(b)) for b in boxes]
    return _SPR[key]


# ── Color blending (v3.89) ──────────────────────────────────────────────────
BLEND_MODES = ["RGB", "HSL", "OKLab"]
TRANSITIONS = ["Smooth", "Ease", "Step", "Hold"]
LUT_SIZE = 4096


def _srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return 255.0 * np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def _rgb_to_oklab(rgb):
    r, g, b = np.moveaxis(_srgb_to_lin(rgb), -1, 0)
    l_ = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m_ = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s_ = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
                     1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
                     0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_], axis=-1)


def _oklab_to_rgb(lab):
    L, a, b = np.moveaxis(np.asarray(lab, dtype=np.float64), -1, 0)
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return _lin_to_srgb(np.stack([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                                  -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                                  -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s], axis=-1))


def _hls_to_rgb_np(h, l, s):
    q = np.where(l < 0.5, l * (1 + s), l + s - l * s)
    p = 2 * l - q

    def chan(t):
        t = t % 1.0
        return np.where(t < 1 / 6, p + (q - p) * 6 * t,
                        np.where(t < 0.5, q, np.where(t < 2 / 3, p + (q - p) * (2 / 3 - t) * 6, p)))
    return np.stack([chan(h + 1 / 3), chan(h), chan(h - 1 / 3)], axis=-1) * 255.0


def _mix_colors(c0, c1, u, mode):
    """Colors c0 -> c1 (0-255 RGB triples) at the steps u (array 0-1), mixed in `mode`. Returns (N, 3)."""
    c0 = np.asarray(c0, dtype=np.float64)
    c1 = np.asarray(c1, dtype=np.float64)
    u = np.asarray(u, dtype=np.float64)[:, None]
    if mode == "OKLab":
        a, b = _rgb_to_oklab(c0), _rgb_to_oklab(c1)
        return _oklab_to_rgb(a + (b - a) * u)
    if mode == "HSL":
        h0, l0, s0 = rgb_to_hls(*(c0 / 255.0))
        h1, l1, s1 = rgb_to_hls(*(c1 / 255.0))
        if s0 < 0.02:
            h0 = h1                              # a grey has no hue: take the other color's
        if s1 < 0.02:
            h1 = h0
        dh = ((h1 - h0 + 0.5) % 1.0) - 0.5      # the short way round the color wheel
        return _hls_to_rgb_np((h0 + dh * u[:, 0]) % 1.0, l0 + (l1 - l0) * u[:, 0], s0 + (s1 - s0) * u[:, 0])
    return c0 + (c1 - c0) * u


def _shape_step(u, trans):
    """How far (0-1) a segment has moved from its first color to the next, for the transition style."""
    if trans == "Ease":
        return u * u * (3 - 2 * u)
    if trans == "Step":
        return np.zeros_like(u)                  # first color stays until the next stop, then it jumps
    if trans == "Hold":
        k = np.clip((u - 0.5) * 2.0, 0.0, 1.0)  # first color stays for half the way, then blends smoothly
        return k * k * (3 - 2 * k)
    return u


def build_stop_lut(positions, rgba, mode="RGB", trans=None, size=LUT_SIZE):
    """Color ramp as a (size, 4) uint8 table. `positions` must be sorted (0-1); `rgba` holds R, G, B (0-255)
    and alpha (0-255) per stop; `trans[i]` is the transition from stop i to stop i+1."""
    pos = np.asarray(positions, dtype=np.float64)
    col = np.asarray(rgba, dtype=np.float64)
    n = len(pos)
    trans = list(trans) if trans else ["Smooth"] * n
    xs = np.linspace(0.0, 1.0, size)
    lut = np.empty((size, 4), dtype=np.float64)
    lut[:] = col[0]
    for i in range(n - 1):
        p0, p1 = pos[i], pos[i + 1]
        if p1 - p0 < 1e-9:
            continue                             # two stops at the same place = a hard edge
        m = (xs >= p0) & (xs < p1)
        if not m.any():
            continue
        u = _shape_step((xs[m] - p0) / (p1 - p0), trans[i] if i < len(trans) else "Smooth")
        lut[m, :3] = _mix_colors(col[i, :3], col[i + 1, :3], u, mode)
        lut[m, 3] = col[i, 3] + (col[i + 1, 3] - col[i, 3]) * u
    lut[xs >= pos[-1]] = col[-1]
    return np.clip(np.rint(lut), 0, 255).astype(np.uint8)


def apply_lut(t, lut):
    """Look every value of t (0-1, 2-D) up in the color table -> (h, w, 4) uint8. Works in row blocks."""
    top = len(lut) - 1
    t = np.asarray(t)
    out = np.empty(t.shape + (4,), dtype=np.uint8)
    rows = max(1, 2_000_000 // max(1, t.shape[-1]))
    for r in range(0, t.shape[0], rows):
        seg = np.nan_to_num(t[r:r + rows], nan=0.0)
        out[r:r + rows] = lut[np.rint(np.clip(seg, 0.0, 1.0) * top).astype(np.int16)]
    return out


class RenderCancelled(Exception):
    """Raised inside a render when the person pressed Cancel."""


TIP_KEY = "#010203"                            # the see-through color of a tooltip window (Windows)


def _tip_image(w, h, fill, border, r=8, S=4):
    """Rounded tooltip box on the see-through key color: smooth border/fill, clean corner edge."""
    def mask(inset):
        m = Image.new("L", (w * S, h * S), 0)
        ImageDraw.Draw(m).rounded_rectangle((inset * S, inset * S, (w - inset) * S - 1, (h - inset) * S - 1),
                                            radius=max(1, r - inset) * S, fill=255)
        return m.resize((w, h), Image.Resampling.LANCZOS)
    outer = mask(0).point(lambda v: 255 if v >= 128 else 0)      # hard edge, so no key-colored fringe shows
    inner = mask(1)
    box = Image.composite(Image.new("RGB", (w, h), fill), Image.new("RGB", (w, h), border), inner)
    out = Image.new("RGB", (w, h), TIP_KEY)
    out.paste(box, (0, 0), outer)
    return out


class Tooltip:
    def __init__(self, widget, app, text):
        self.widget, self.app, self.text, self.tip, self._id = widget, app, text, None, None
        widget.bind("<Enter>", self._enter, add="+")
        widget.bind("<Leave>", self._hide, add="+")
        widget.bind("<ButtonPress>", self._hide, add="+")

    def _enter(self, _e=None):
        self._hide()
        self._id = self.widget.after(450, self._show)

    def _show(self):
        if self.tip is not None or not getattr(self.app, "prefs", {}).get("tooltips", True):
            return
        t = self.app.theme
        try:
            x = self.widget.winfo_rootx()
            y = self.widget.winfo_rooty() + self.widget.winfo_height() + 6
            fnt = tkfont.Font(family=UI_FONT, size=9)
            lines = self.text.split("\n")
            w = max(fnt.measure(ln) for ln in lines) + 24
            h = fnt.metrics("linespace") * len(lines) + 16
            self.tip = tw = tk.Toplevel(self.widget)
            tw.wm_overrideredirect(True)
            tw.geometry(f"{w}x{h}+{x}+{y}")
            try:
                tw.wm_attributes("-transparentcolor", TIP_KEY)       # Windows: the corners become see-through
                rounded = True
            except tk.TclError:
                rounded = False                                      # other systems: a plain box
            cv = tk.Canvas(tw, width=w, height=h, bd=0, highlightthickness=0, bg=TIP_KEY if rounded else t["border"])
            cv.pack()
            if rounded:
                tw._img = ImageTk.PhotoImage(_tip_image(w, h, t["surface2"], t["border"]))
                cv.create_image(0, 0, anchor="nw", image=tw._img)
            else:
                cv.create_rectangle(1, 1, w - 2, h - 2, fill=t["surface2"], outline=t["surface2"])
            cv.create_text(w / 2, h / 2, text=self.text, fill=t["text"], font=F(9), justify="left")
        except tk.TclError:
            self.tip = None

    def _hide(self, _e=None):
        if self._id:
            try:
                self.widget.after_cancel(self._id)
            except (tk.TclError, ValueError):
                pass
            self._id = None
        if self.tip is not None:
            try:
                self.tip.destroy()
            except tk.TclError:
                pass
            self.tip = None


class _Canvas(tk.Canvas):
    """Canvas whose own 'state' option is replaced by a simple enabled/disabled flag."""
    def __init__(self, parent, app, bgkey="surface", **kw):
        super().__init__(parent, highlightthickness=0, bd=0, **kw)
        self.app, self.bgkey, self._state = app, bgkey, "normal"

    def configure(self, cnf=None, **kw):
        if "state" in kw:
            self._state = kw.pop("state")
            self._draw()
        if cnf is None and not kw:
            return None
        return super().configure(cnf, **kw)

    config = configure

    def _draw(self):
        pass

    def retheme(self, t):
        self._draw()


class RoundButton(_Canvas):
    def __init__(self, parent, app, text="", command=None, style="secondary", icon=None,
                 width=None, height=34, radius=10, size=10, bgkey="surface", compact=False, fill=False,
                 accent_text=False):
        super().__init__(parent, app, bgkey, height=height, cursor="hand2")
        self.text, self.command, self.style, self.icon = text, command, style, icon
        self.accent_text = accent_text
        self.h, self.r, self.fillw = height, radius, fill
        self.font = tkfont.Font(family=UI_FONT, size=size, weight="bold")
        pad = 12 if compact else 18
        iw = 26 if icon else 0
        self.w = width or (self.font.measure(text) + iw + 2 * pad if text else height)
        super().configure(width=self.w)
        self._hover = self._down = False
        self.bind("<Enter>", lambda e: self._set(hover=True))
        self.bind("<Leave>", lambda e: self._set(hover=False, down=False))
        self.bind("<ButtonPress-1>", lambda e: self._set(down=True))
        self.bind("<ButtonRelease-1>", self._release)
        if fill:
            self.bind("<Configure>", self._resize)
        app.skin(self)

    def configure(self, cnf=None, **kw):
        changed = False
        for k in ("text", "icon", "style", "command"):
            if k in kw:
                setattr(self, k, kw.pop(k))
                changed = True
        if changed:
            self._draw()
        return super().configure(cnf, **kw)

    config = configure

    def _resize(self, e):
        if e.width > 4 and e.width != self.w:
            self.w = e.width
            self._draw()

    def _set(self, hover=None, down=None):
        if hover is not None:
            self._hover = hover
        if down is not None:
            self._down = down
        self._draw()

    def _release(self, e):
        was_down = self._down
        self._set(down=False)
        if was_down and self._state != "disabled" and 0 <= e.x <= self.w and 0 <= e.y <= self.h and self.command:
            self.command()

    def _colors(self):
        t, s = self.app.theme, self.style
        if self._state == "disabled":
            return (None if s == "ghost" else t["surface2"], None, _blend(t["dim"], t["surface2"], 0.55))
        if s == "primary":
            fill = t["accent_hover"] if self._hover else t["accent"]
            if self._down:
                fill = _blend(t["accent"], "#000000", 0.8)
            return fill, None, t["on_accent"]
        if s == "ghost":
            fill = (t["surface2"] if self._hover else None)
            return fill, None, (t["text"] if self._hover else t["dim"])
        fill = t["track"] if self._down else t["surface2"]
        return fill, (t["accent"] if self._hover else t["border"]), (t["accent"] if self.accent_text else t["text"])

    def _draw(self):
        if not hasattr(self, "w"):
            return
        t = self.app.theme
        self.delete("all")
        super().configure(bg=t[self.bgkey])
        fill, outline, fg = self._colors()
        if fill or outline:
            self.create_image(0, 0, anchor="nw", image=_photo(
                ("btn", self.w, self.h, self.r, fill, outline),
                lambda: _rr(self.w, self.h, self.r, fill, outline)))
        icon_w = 18 if self.icon else 0
        gap = 8 if (self.icon and self.text) else 0
        tw = self.font.measure(self.text) if self.text else 0
        x = (self.w - (icon_w + gap + tw)) / 2
        if self.icon:
            self.create_image(x, self.h / 2, anchor="w", image=_photo(
                ("ico", self.icon, 18, fg), lambda: icon_img(self.icon, 18, fg)))
        if self.text:
            self.create_text(x + icon_w + gap, self.h / 2, anchor="w", text=self.text, fill=fg, font=self.font)
        super().configure(cursor="arrow" if self._state == "disabled" else "hand2")


class Toggle(_Canvas):
    W, H = 40, 22

    def __init__(self, parent, app, variable, command=None, bgkey="surface", tip=None):
        super().__init__(parent, app, bgkey, width=self.W, height=self.H, cursor="hand2")
        if tip:
            Tooltip(self, app, tip)
        self.var, self.command = variable, command
        self.var.trace_add("write", lambda *a: self._draw())
        self.bind("<ButtonRelease-1>", self._click)
        app.skin(self)

    def _click(self, e):
        if self._state == "disabled" or not (0 <= e.x <= self.W and 0 <= e.y <= self.H):
            return
        self.var.set(not self.var.get())
        if self.command:
            self.command()

    def _draw(self):
        if not hasattr(self, "var"):
            return
        t = self.app.theme
        on = bool(self.var.get())
        dis = self._state == "disabled"
        track = t["accent"] if on else t["track"]
        if dis:
            track = _blend(track, t["surface"], 0.45)

        def build():
            S, W, H = 4, self.W, self.H
            img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((0, 0, W * S - 1, H * S - 1), radius=H * S / 2, fill=_rgba(track))
            kx = (W - H + 3) if on else 3
            d.ellipse((kx * S, 3 * S, (kx + H - 6) * S, (H - 3) * S), fill=_rgba(t["knob"] if not dis else "#C8C8D0"))
            return img.resize((W, H), Image.Resampling.LANCZOS)

        self.delete("all")
        super().configure(bg=t[self.bgkey], cursor="arrow" if dis else "hand2")
        self.create_image(0, 0, anchor="nw", image=_photo(("tog", on, dis, track, t["knob"]), build))


class LockToggle(_Canvas):
    """Small lock icon (optionally with a label) bound to a BooleanVar."""
    S = 26

    def __init__(self, parent, app, variable, text=None, tip="Lock: keep this unchanged when randomizing",
                 bgkey="surface"):
        self.text = text
        if text and tip == "Lock: keep this unchanged when randomizing":
            tip = f"Lock {text}: Auto Generate leaves it unchanged"
        self.font = tkfont.Font(family=UI_FONT, size=9)
        width = self.S + ((self.font.measure(text) + 6) if text else 0)
        super().__init__(parent, app, bgkey, width=width, height=self.S, cursor="hand2")
        self.w, self.var = width, variable
        self.var.trace_add("write", lambda *a: self._draw())
        self.bind("<ButtonRelease-1>", self._click)
        Tooltip(self, app, tip)
        app.skin(self)

    def _click(self, e):
        if 0 <= e.x <= self.w and 0 <= e.y <= self.S:
            self.var.set(not self.var.get())

    def _draw(self):
        if not hasattr(self, "var"):
            return
        t = self.app.theme
        on = bool(self.var.get())
        fill = t["accent"] if on else t["surface2"]
        fg = t["on_accent"] if on else t["dim"]

        def build():
            base = _rr(self.S, self.S, 8, fill)
            ic = icon_img("lock" if on else "unlock", 16, fg)
            base.alpha_composite(ic, (5, 5))
            return base

        self.delete("all")
        super().configure(bg=t[self.bgkey])
        self.create_image(0, 0, anchor="nw", image=_photo(("lock", on, fill, fg, self.S), build))
        if self.text:
            self.create_text(self.S + 6, self.S / 2, anchor="w", text=self.text, font=self.font,
                             fill=t["text"] if on else t["dim"])


class PillSlider(_Canvas):
    KNOB = 18

    def __init__(self, parent, app, variable=None, from_=0.0, to=100.0, command=None, width=120,
                 height=24, bgkey="surface", wheel_step=None, tip=None):
        super().__init__(parent, app, bgkey, width=width, height=height, takefocus=1)
        if tip:
            Tooltip(self, app, tip)
        self.var = variable if variable is not None else tk.DoubleVar(value=from_)
        self.lo, self.hi, self.command = float(from_), float(to), command
        self.wheel_step = wheel_step          # None = about 2% of the range, rounded to a nice number
        self._focus = False
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<B1-Motion>", self._press)
        self.bind("<FocusIn>", lambda e: self._set_focus(True))
        self.bind("<FocusOut>", lambda e: self._set_focus(False))
        self.var.trace_add("write", lambda *a: self._draw())
        app.skin(self)

    def get(self):
        try:
            return float(self.var.get())
        except (tk.TclError, ValueError):
            return self.lo

    def set(self, value):
        self.var.set(min(self.hi, max(self.lo, float(value))))

    def _set_focus(self, v):
        self._focus = v
        self._draw()

    def step_size(self):
        """Mouse-wheel step: about 2% of the range, rounded to a nice number (360 -> 5, 0.5 -> 0.01, 100 -> 2)."""
        if self.wheel_step:
            return float(self.wheel_step)
        raw = (self.hi - self.lo) * 0.02
        nice = (0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10)
        return float(min(nice, key=lambda n: abs(n - raw)))

    def wheel(self, direction):
        """direction +1 = increase, -1 = decrease. Returns True when the slider handled the wheel."""
        if self._state == "disabled":
            return False
        step = self.step_size()
        new = round(round((self.get() + direction * step) / step) * step, 6)
        self.set(new)
        if self.command:
            self.command(self.get())
        return True

    def _press(self, e):
        if self._state == "disabled":
            return
        if e.type == tk.EventType.ButtonPress:
            self.focus_set()
        pad = self.KNOB / 2 + 1
        usable = max(1.0, self.winfo_width() - 2 * pad)
        frac = min(1.0, max(0.0, (e.x - pad) / usable))
        self.set(self.lo + frac * (self.hi - self.lo))
        if self.command:
            self.command(self.get())

    def _draw(self):
        if not hasattr(self, "var"):
            return
        t = self.app.theme
        w, h = max(self.winfo_width(), 40), max(self.winfo_height(), 20)
        dis = self._state == "disabled"
        pad = self.KNOB / 2 + 1
        frac = 0.0 if self.hi == self.lo else (self.get() - self.lo) / (self.hi - self.lo)
        x = pad + frac * (w - 2 * pad)
        cy = h / 2
        accent = _blend(t["accent"], t["track"], 0.35) if dis else t["accent"]
        self.delete("all")
        super().configure(bg=t[self.bgkey])
        self.create_line(pad, cy, w - pad, cy, width=5, capstyle="round", fill=t["track"])
        if x > pad + 0.5:
            self.create_line(pad, cy, x, cy, width=5, capstyle="round", fill=accent)

        def build():
            S, K = 4, self.KNOB
            img = Image.new("RGBA", (K * S, K * S), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.ellipse((0, 0, K * S - 1, K * S - 1), fill=_rgba(accent))
            m = 3 * S
            d.ellipse((m, m, K * S - 1 - m, K * S - 1 - m), fill=_rgba(t["knob"] if not dis else "#B8B8C4"))
            return img.resize((K, K), Image.Resampling.LANCZOS)

        if self._focus and not dis:                       # focused: a ring around the knob (the wheel now works here)
            self.create_image(x, cy, image=_photo(("focusring2", accent), lambda: _ring(26, 12, 2, accent)))
        self.create_image(x, cy, image=_photo(("knob", dis, accent, t["knob"]), build))
        super().configure(cursor="arrow" if dis else "hand2")


class StopBar(_Canvas):
    """Gradient strip with color stops: click the bar to add a stop, drag a dot to move it,
    double-click a dot to change its color, right-click a dot to delete it."""
    BAR_Y, BAR_H, PAD, H = 6, 18, 12, 46

    def __init__(self, parent, app, bgkey="surface"):
        super().__init__(parent, app, bgkey, height=self.H, cursor="hand2")
        self._drag = None
        self._sel = None
        self._photo_ref = None
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<B1-Motion>", self._motion)
        self.bind("<ButtonRelease-1>", lambda e: setattr(self, "_drag", None))
        self.bind("<Double-Button-1>", self._double)
        self.bind("<Button-3>", self._delete)
        self.bind("<Button-2>", self._delete)
        app.skin(self)

    def _count(self):
        try:
            return min(max(int(self.app.num_colors.get()), 2), MAX_COLORS)
        except (ValueError, tk.TclError):
            return 2

    def _x(self, p):
        return self.PAD + p * max(1, self.winfo_width() - 2 * self.PAD)

    def _p(self, x):
        return min(1.0, max(0.0, (x - self.PAD) / max(1, self.winfo_width() - 2 * self.PAD)))

    def _hit(self, x, y):
        hy = self.BAR_Y + self.BAR_H + 11
        best, dist = None, 11.0
        for i in range(self._count()):
            dd = math.hypot(x - self._x(self.app.color_positions[i]), y - hy)
            if dd <= dist:
                best, dist = i, dd
        if best is None and self.BAR_Y <= y <= self.BAR_Y + self.BAR_H:      # near a stop on the bar itself
            for i in range(self._count()):
                if abs(x - self._x(self.app.color_positions[i])) <= 6:
                    best = i
        return best

    def _press(self, e):
        i = self._hit(e.x, e.y)
        if i is not None:
            self._drag = i
            self.app.select_stop(i)
        elif self.BAR_Y <= e.y <= self.BAR_Y + self.BAR_H + 2:
            self.app.add_stop(self._p(e.x))
        self._draw()

    def _motion(self, e):
        if self._drag is not None:
            self.app.move_stop(self._drag, round(self._p(e.x), 3))

    def _double(self, e):
        i = self._hit(e.x, e.y)
        if i is not None:
            self._drag = None
            self.app.pick_color(i)

    def _delete(self, e):
        i = self._hit(e.x, e.y)
        if i is not None:
            self._sel = None
            self.app.remove_stop(i)

    def _draw(self):
        try:
            if not hasattr(self, "_sel"):
                return
            w = self.winfo_width()
            if w < 60:
                return
            app, t = self.app, self.app.theme
            n = self._count()
            bw = w - 2 * self.PAD
            lut = app.stop_lut(n)                                    # blend mode + transitions included
            cols = lut[np.rint(np.linspace(0.0, 1.0, bw) * (len(lut) - 1)).astype(np.int32)]
            row = cols[:, :3].astype(np.float32)
            a = (cols[:, 3].astype(np.float32) / 255.0)[:, None]
            yy, xx = np.mgrid[0:self.BAR_H, 0:bw]
            checker = np.where((((xx // 6) + (yy // 6)) % 2).astype(bool), 255.0, 204.0)[..., None]
            comp = row[None, :, :] * a[None, :, :] + checker * (1 - a[None, :, :])
            img = round_corners(Image.fromarray(np.rint(comp).astype(np.uint8)), 6)
            self._photo_ref = ImageTk.PhotoImage(img)
            self.delete("all")
            super().configure(bg=t[self.bgkey])
            self.create_image(self.PAD, self.BAR_Y, anchor="nw", image=self._photo_ref)
            hy = self.BAR_Y + self.BAR_H + 11
            cur = getattr(app, "_sel_stop", 0)
            for i in sorted(range(n), key=lambda k: k == cur):            # the selected dot is drawn last (on top)
                x = self._x(app.color_positions[i])
                col = app.colors[i].upper()
                sel = (i == cur)
                self.create_line(x, self.BAR_Y + self.BAR_H, x, hy - 6, fill=t["dim"])
                rc = t["accent"] if sel else t["text"]
                self.create_image(x, hy, image=_photo(("stopdot", col, rc, sel, i + 1),
                                                      lambda: _ring(22, 10 if sel else 9, 3 if sel else 2, rc, fill=col,
                                                                    label=i + 1, label_color=_contrast_text(col))))
        except tk.TclError:
            pass


class Segmented(_Canvas):
    def __init__(self, parent, app, options, variable, command=None, seg_width=92, height=34, bgkey="surface"):
        self.options, self.var, self.command = list(options), variable, command
        self.sw, self.h = seg_width, height
        super().__init__(parent, app, bgkey, width=seg_width * len(self.options) + 8, height=height,
                         cursor="hand2")
        self.font = tkfont.Font(family=UI_FONT, size=10, weight="bold")
        self.var.trace_add("write", lambda *a: self._draw())
        self.bind("<ButtonRelease-1>", self._click)
        app.skin(self)

    def _click(self, e):
        i = int((e.x - 4) // self.sw)
        if 0 <= i < len(self.options) and self.var.get() != self.options[i]:
            self.var.set(self.options[i])
            if self.command:
                self.command()

    def _draw(self):
        if not hasattr(self, "font"):
            return
        t = self.app.theme
        W = self.sw * len(self.options) + 8
        self.delete("all")
        super().configure(bg=t[self.bgkey])
        self.create_image(0, 0, anchor="nw", image=_photo(
            ("seg", W, self.h, t["surface2"], t["border"]), lambda: _rr(W, self.h, 12, t["surface2"], t["border"])))
        for i, opt in enumerate(self.options):
            active = self.var.get() == opt
            x0 = 4 + i * self.sw
            if active:
                self.create_image(x0, 4, anchor="nw", image=_photo(
                    ("segpill", self.sw, self.h - 8, t["accent"]),
                    lambda: _rr(self.sw, self.h - 8, 9, t["accent"])))
            self.create_text(x0 + self.sw / 2, self.h / 2, text=opt, font=self.font,
                             fill=t["on_accent"] if active else t["dim"])


class ColorSwatch(_Canvas):
    def __init__(self, parent, app, text="#000000", command=None, width=108, height=30, bgkey="surface"):
        super().__init__(parent, app, bgkey, width=width, height=height, cursor="hand2")
        self.color, self.w, self.h, self.command = text, width, height, command
        self.label = text
        self.font = tkfont.Font(family=UI_FONT, size=9, weight="bold")
        self.bind("<ButtonRelease-1>", self._click)
        app.skin(self)

    def set(self, color, label=None):
        self.color = color
        self.label = label if label is not None else color
        self._draw()

    def _click(self, e):
        if self._state != "disabled" and self.command and 0 <= e.x <= self.w and 0 <= e.y <= self.h:
            self.command()

    def _draw(self):
        if not hasattr(self, "font"):
            return
        t = self.app.theme
        dis = self._state == "disabled"
        color = self.color if re.match(r"^#[0-9A-Fa-f]{6}$", str(self.color)) else t["surface2"]
        fill = _blend(color, t["surface"], 0.3) if dis else color
        fg = t["dim"] if dis else _contrast_text(color)
        self.delete("all")
        super().configure(bg=t[self.bgkey], cursor="arrow" if dis else "hand2")
        self.create_image(0, 0, anchor="nw", image=_photo(
            ("sw", self.w, self.h, fill, t["border"]), lambda: _rr(self.w, self.h, 9, fill, t["border"])))
        self.create_text(self.w / 2, self.h / 2, text=self.label, fill=fg, font=self.font)


class Card(tk.Canvas):
    """Rounded 'card' container. Put widgets in `.body` (a themed Frame)."""
    def __init__(self, parent, app, radius=14, pad=14, expand=False, rpad=0):
        super().__init__(parent, highlightthickness=0, bd=0, height=2 * pad + 4)
        self.app, self.r, self.pad, self.expand, self.rpad = app, radius, pad, expand, rpad     # rpad = extra room on the right
        self._cw = self._ch = 0
        self._req = 0
        self.body = tk.Frame(self, bd=0, highlightthickness=0)
        self._win = self.create_window(pad, pad, anchor="nw", window=self.body)
        self.bind("<Configure>", self._on_resize)
        self.body.bind("<Configure>", self._on_body)
        app.skin(self)

    def retheme(self, t):
        self.configure(bg=t["bg"])
        self.body.configure(bg=t["surface"])
        self._draw()

    def _on_body(self, e=None):
        need = self.body.winfo_reqheight() + 2 * self.pad
        if need != self._req:
            self._req = need
            self.configure(height=need)

    def _on_resize(self, e):
        self._cw, self._ch = e.width, e.height
        opts = {"width": max(1, e.width - 2 * self.pad - self.rpad)}
        if self.expand:
            opts["height"] = max(1, e.height - 2 * self.pad)
        self.itemconfigure(self._win, **opts)
        self._draw()

    def _draw(self):
        self.delete("cardbg")
        w, h, r = self._cw, self._ch, self.r
        if w < 2 * r + 2 or h < 2 * r + 2:
            return
        t = self.app.theme
        fill, bd = t["surface"], t["border"]
        tl, tr, bl, br = _corner_sprites(r, fill, bd)
        c = dict(outline="", tags="cardbg")
        self.create_rectangle(r, 0, w - r, h, fill=fill, **c)
        self.create_rectangle(0, r, w, h - r, fill=fill, **c)
        self.create_rectangle(r, 0, w - r, 1, fill=bd, **c)
        self.create_rectangle(r, h - 1, w - r, h, fill=bd, **c)
        self.create_rectangle(0, r, 1, h - r, fill=bd, **c)
        self.create_rectangle(w - 1, r, w, h - r, fill=bd, **c)
        self.create_image(0, 0, anchor="nw", image=tl, tags="cardbg")
        self.create_image(w - r, 0, anchor="nw", image=tr, tags="cardbg")
        self.create_image(0, h - r, anchor="nw", image=bl, tags="cardbg")
        self.create_image(w - r, h - r, anchor="nw", image=br, tags="cardbg")
        self.tag_lower("cardbg")


_DROP_KEY = "#010203"


class _DropPopup:
    """Rounded drop-down list shown under a RoundCombo."""
    ROW, PAD, MAXROWS = 28, 6, 9

    def __init__(self, combo):
        self.c = combo
        app = combo.app
        t = app.theme
        self.values = list(combo._values)
        self.n = len(self.values)
        self.rows = max(1, min(self.n, self.MAXROWS))
        try:
            self.cur = self.values.index(str(combo.var.get()))
        except ValueError:
            self.cur = -1
        self.hover = self.cur
        self.dragging = False
        self.off = 0
        if self.cur >= self.rows:
            self.off = max(0, min(self.cur - self.rows // 2, self.n - self.rows))
        self.w = max(combo.winfo_width(), 90)
        self.h = self.rows * self.ROW + 2 * self.PAD
        self.font = tkfont.Font(family=UI_FONT, size=10)
        top = self.top = tk.Toplevel(combo)
        top.withdraw()
        top.overrideredirect(True)
        try:
            top.attributes("-topmost", True)
        except tk.TclError:
            pass
        self.keyed = False
        if sys.platform == "win32":
            try:
                top.wm_attributes("-transparentcolor", _DROP_KEY)
                self.keyed = True
            except tk.TclError:
                pass
        self.cv = tk.Canvas(top, width=self.w, height=self.h, highlightthickness=0, bd=0, bg=t["bg"])
        self.cv.pack()
        x, y = combo.winfo_rootx(), combo.winfo_rooty() + combo.winfo_height() + 3
        if y + self.h > top.winfo_screenheight() - 8:
            y = combo.winfo_rooty() - self.h - 3
        top.geometry(f"{self.w}x{self.h}+{x}+{max(0, y)}")
        self._draw()
        top.deiconify()
        top.lift()
        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            self.cv.bind(seq, self._wheel)
        self.cv.bind("<Motion>", self._motion)
        self.cv.bind("<ButtonPress-1>", self._click)
        self.cv.bind("<B1-Motion>", self._drag)
        self.cv.bind("<ButtonRelease-1>", lambda e: setattr(self, "dragging", False))
        top.bind("<Escape>", lambda e: self.close())
        top.bind("<Up>", lambda e: self._move(-1))
        top.bind("<Down>", lambda e: self._move(1))
        top.bind("<Return>", lambda e: self._choose(self.hover))
        top.bind("<FocusOut>", lambda e: self.close())
        try:
            top.focus_force()
        except tk.TclError:
            pass

    def _background(self):
        t = self.c.app.theme
        key = ("dropbg", self.w, self.h, t["surface2"], t["accent"], t["bg"], self.keyed)

        def build():
            sp = _rr(self.w, self.h, 12, t["surface2"], t["accent"])
            base = Image.new("RGBA", sp.size, _rgba(t["bg"]))
            base.alpha_composite(sp)
            if self.keyed:
                outside = sp.getchannel("A").point(lambda v: 255 if v == 0 else 0)
                base.paste(Image.new("RGBA", sp.size, _rgba(_DROP_KEY)), mask=outside)
            return base
        return _photo(key, build)

    def _draw(self):
        t = self.c.app.theme
        cv = self.cv
        cv.delete("all")
        cv.create_image(0, 0, anchor="nw", image=self._background())
        iw = self.w - 2 * self.PAD
        for i in range(self.rows):
            idx = self.off + i
            if idx >= self.n:
                break
            y0 = self.PAD + i * self.ROW
            hov = idx == self.hover
            fg = t["on_accent"] if hov else (t["accent"] if idx == self.cur else t["text"])
            if hov:
                cv.create_image(self.PAD, y0 + 1, anchor="nw", image=_photo(
                    ("drophi", iw, self.ROW - 2, t["accent"]), lambda: _rr(iw, self.ROW - 2, 8, t["accent"])))
            val = self.values[idx]
            chip = (_chip(val, _blend(t["text"], t["surface2"], 0.35))
                    if getattr(self.c, "swatches", False) and re.fullmatch(r"#[0-9A-Fa-f]{6}", val) else None)
            if chip is not None:                    # color preview on the left, then the hex code
                tw = self.font.measure(val)
                x0 = (self.w - (16 + 8 + tw)) / 2 if self.c.justify == "center" else self.PAD + 10
                cv.create_image(x0, y0 + self.ROW / 2, anchor="w", image=chip)
                cv.create_text(x0 + 24, y0 + self.ROW / 2, anchor="w", text=val, fill=fg, font=self.font)
            elif self.c.justify == "center":
                cv.create_text(self.w / 2, y0 + self.ROW / 2, text=val, fill=fg, font=self.font)
            else:
                cv.create_text(self.PAD + 10, y0 + self.ROW / 2, anchor="w", text=val, fill=fg,
                               font=self.font)
        if self.n > self.rows:
            span = self.rows * self.ROW
            y1 = self.PAD + span * self.off / self.n
            y2 = self.PAD + span * (self.off + self.rows) / self.n
            cv.create_line(self.w - 7, self.PAD + 2, self.w - 7, self.PAD + span - 2, width=4, capstyle="round",
                           fill=_blend(t["border"], t["surface2"], 0.5))
            cv.create_line(self.w - 7, y1 + 2, self.w - 7, max(y1 + 8, y2 - 2), width=4, capstyle="round",
                           fill=t["accent"] if self.dragging else t["dim"])

    def _index_at(self, y):
        i = int((y - self.PAD) // self.ROW)
        idx = self.off + i
        return idx if 0 <= i < self.rows and 0 <= idx < self.n else None

    def _drag_to(self, y):
        span = self.rows * self.ROW
        off = int(round((y - self.PAD) / span * self.n - self.rows / 2))
        self.off = max(0, min(self.n - self.rows, off))
        self._draw()

    def _drag(self, e):
        if self.dragging:
            self._drag_to(e.y)

    def _motion(self, e):
        if self.dragging:
            return
        idx = self._index_at(e.y)
        if idx is not None and idx != self.hover:
            self.hover = idx
            self._draw()

    def _wheel(self, e):
        if self.n <= self.rows:
            return "break"
        up = getattr(e, "num", 0) == 4 or getattr(e, "delta", 0) > 0
        step = 3 if self.n > 2 * self.rows else 1
        self.off = max(0, min(self.n - self.rows, self.off + (-step if up else step)))
        idx = self._index_at(e.y)
        if idx is not None:
            self.hover = idx                        # the highlight follows the pointer after scrolling
        self._draw()
        return "break"

    def _move(self, d):
        base = self.hover if self.hover >= 0 else (0 if d > 0 else self.n - 1)
        self.hover = max(0, min(self.n - 1, base + (d if self.hover >= 0 else 0)))
        if self.hover < self.off:
            self.off = self.hover
        elif self.hover >= self.off + self.rows:
            self.off = self.hover - self.rows + 1
        self._draw()

    def _click(self, e):
        if self.n > self.rows and e.x >= self.w - 16:      # on the scrollbar: drag it, do not pick
            self.dragging = True
            self._drag_to(e.y)
            return
        idx = self._index_at(e.y)
        if idx is not None:
            self._choose(idx)

    def _choose(self, idx):
        if 0 <= idx < self.n:
            self.c.var.set(self.values[idx])
        self.close()
        try:
            self.c.focus_set()            # the dropdown stays focused, so the mouse wheel keeps working on it
        except tk.TclError:
            self.c.app.release_focus()

    def close(self):
        c, app = self.c, self.c.app
        if getattr(app, "_open_drop", None) is self:
            app._open_drop = None
        c._pop = None
        try:
            self.top.destroy()
        except tk.TclError:
            pass
        c._draw()


class RoundCombo(_Canvas):
    """Drop-down with rounded corners (field and list). Replaces ttk.Combobox."""
    def __init__(self, parent, app, textvariable=None, values=(), width=12, justify="left",
                 state="readonly", height=30, bgkey="surface"):
        self.var = textvariable if textvariable is not None else tk.StringVar()
        self._values = [str(v) for v in values]
        self.justify = justify
        self.font = tkfont.Font(family=UI_FONT, size=10)
        px = self.font.measure("0") * width + 40
        super().__init__(parent, app, bgkey, width=px, height=height, cursor="hand2", takefocus=1)
        self.h = height
        self._hover = self._focus = False
        self._pop = None
        self.swatches = False                  # True = show a color preview before hex-code options
        self._state = "disabled" if state == "disabled" else "normal"
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<Enter>", lambda e: self._set_hover(True))
        self.bind("<Leave>", lambda e: self._set_hover(False))
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<FocusIn>", lambda e: self._set_focus(True))
        self.bind("<FocusOut>", lambda e: self._set_focus(False))
        self.bind("<Up>", lambda e: self._step(-1))
        self.bind("<Down>", lambda e: self._step(1))
        self.bind("<Return>", lambda e: self.open())
        self.bind("<space>", lambda e: (self.open(), "break")[1])
        self.var.trace_add("write", lambda *a: self._draw())
        app.skin(self)

    # tk-style API used by the rest of the program
    def get(self):
        return self.var.get()

    def set(self, value):
        self.var.set(str(value))

    def configure(self, cnf=None, **kw):
        if "values" in kw:
            self._values = [str(v) for v in kw.pop("values")]
        return super().configure(cnf, **kw)

    config = configure

    def cget(self, key):
        if key == "textvariable":
            return str(self.var)
        if key == "values":
            return tuple(self._values)
        if key == "state":
            return "disabled" if self._state == "disabled" else "readonly"
        return super().cget(key)

    def _set_hover(self, v):
        self._hover = v
        self._draw()

    def _set_focus(self, v):
        self._focus = v
        self._draw()

    def _press(self, e):
        self.focus_set()
        if self._pop is not None:
            self._pop.close()
        else:
            self.open()

    def _step(self, d):
        if self._state == "disabled" or not self._values:
            return
        try:
            i = self._values.index(str(self.var.get()))
        except ValueError:
            i = -1 if d > 0 else len(self._values)
        self.var.set(self._values[max(0, min(len(self._values) - 1, i + d))])

    def wheel(self, d):
        """d = +1 next item, -1 previous item; stops at the ends."""
        if self._state == "disabled" or not self._values:
            return False
        self._step(d)
        return True

    def open(self):
        if self._state == "disabled" or not self._values or self._pop is not None:
            return
        old = getattr(self.app, "_open_drop", None)
        if old is not None:
            old.close()
        self._pop = self.app._open_drop = _DropPopup(self)
        self._draw()

    def _draw(self):
        try:
            if not hasattr(self, "h"):
                return
            w = self.winfo_width()
            if w < 24:
                return
            t = self.app.theme
            dis = self._state == "disabled"
            lit = (not dis) and (self._hover or self._focus or self._pop is not None)
            border = t["accent"] if lit else t["border"]
            fill = t["bg"] if dis else t["surface2"]
            fg = _blend(t["dim"], t["bg"], 0.55) if dis else t["text"]
            arrow = t["dim"] if dis else (t["accent"] if lit else t["dim"])
            h = self.h
            self.delete("all")
            super().configure(bg=t[self.bgkey])
            self.create_image(0, 0, anchor="nw", image=_photo(("combo", w, h, fill, border),
                                                              lambda: _rr(w, h, 9, fill, border)))
            text = str(self.var.get())
            if self.swatches and re.fullmatch(r"#[0-9A-Fa-f]{6}", text):       # color preview, then the hex code
                x0 = (w - 20 - (16 + 8 + self.font.measure(text))) / 2 if self.justify == "center" else 12
                self.create_image(x0, h / 2, anchor="w", image=_chip(text, _blend(t["text"], fill, 0.35)))
                self.create_text(x0 + 24, h / 2, anchor="w", text=text, fill=fg, font=self.font)
            elif self.justify == "center":
                self.create_text((w - 20) / 2, h / 2, text=text, fill=fg, font=self.font)
            else:
                self.create_text(12, h / 2, anchor="w", text=text, fill=fg, font=self.font)
            self.create_image(w - 17, h / 2, image=_photo(("chev", 14, arrow), lambda: icon_img("chevron", 14, arrow)))
            super().configure(cursor="arrow" if dis else "hand2")
        except tk.TclError:
            pass


class RoundEntry(_Canvas):
    """Text field with rounded corners. Replaces ttk.Entry (the real field is `.entry`)."""
    def __init__(self, parent, app, textvariable=None, width=6, justify="center", validate=None,
                 validatecommand=None, state="normal", height=30, bgkey="surface"):
        font = tkfont.Font(family=UI_FONT, size=10)
        px = font.measure("0") * width + 30
        super().__init__(parent, app, bgkey, width=px, height=height)
        self.h = height
        opts = {}
        if validate:
            opts["validate"] = validate
        if validatecommand:
            opts["validatecommand"] = validatecommand
        self.entry = tk.Entry(self, textvariable=textvariable, justify=justify, bd=0, highlightthickness=0,
                              relief="flat", font=F(10), **opts)
        self._win = self.create_window(0, 0, window=self.entry, anchor="center")
        self._focus = False
        self._state = "disabled" if state == "disabled" else "normal"
        self.entry.bind("<FocusIn>", lambda e: self._set_focus(True))
        self.entry.bind("<FocusOut>", lambda e: self._set_focus(False))
        for seq in ("<Return>", "<KP_Enter>", "<Escape>"):
            self.entry.bind(seq, lambda e: app.release_focus(), add="+")
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<ButtonPress-1>", lambda e: self.entry.focus_set())
        app.skin(self)

    def _set_focus(self, v):
        self._focus = v
        self._draw()

    def get(self):
        return self.entry.get()

    def delete(self, *a):
        if a:                                   # entry-style delete(first, last)
            return self.entry.delete(*a)
        return super().delete("all")

    def insert(self, index, text):
        return self.entry.insert(index, text)

    def focus_set(self):
        self.entry.focus_set()

    def configure(self, cnf=None, **kw):
        """Also accepts foreground= / fg= (text color, None = theme color), like a normal entry."""
        if "foreground" in kw or "fg" in kw:
            self._fg = kw.pop("foreground", None) or kw.pop("fg", None)
            kw.pop("fg", None)
            self._draw()
        return super().configure(cnf, **kw) if (cnf is not None or kw) else None

    config = configure

    def _draw(self):
        try:
            if not hasattr(self, "entry"):
                return
            w = self.winfo_width()
            if w < 24:
                return
            t = self.app.theme
            dis = self._state == "disabled"
            fill = t["bg"] if dis else t["surface2"]
            border = t["accent"] if (self._focus and not dis) else t["border"]
            fg = _blend(t["dim"], t["bg"], 0.55) if dis else (getattr(self, "_fg", None) or t["text"])
            h = self.h
            super().delete("bg")
            self.create_image(0, 0, anchor="nw", tags="bg", image=_photo(("entry", w, h, fill, border),
                                                                         lambda: _rr(w, h, 9, fill, border)))
            self.tag_lower("bg")
            self.coords(self._win, w / 2, h / 2)
            self.itemconfigure(self._win, width=max(10, w - 18), height=max(10, h - 10))
            super().configure(bg=t[self.bgkey])
            self.entry.configure(bg=fill, fg=fg, insertbackground=t["text"], selectbackground=t["accent"],
                                 selectforeground=t["on_accent"], disabledbackground=fill,
                                 disabledforeground=fg, readonlybackground=fill,
                                 state="disabled" if dis else "normal")
        except tk.TclError:
            pass



class ScrollFrame(tk.Frame):
    """Vertically scrolling container with a slim custom scrollbar and mouse-wheel support."""
    FADE_H = 16          # height of the fade band over the bottom of the cards (px)
    FADE_MAX = 0.9      # overlay opacity at the bottom edge of the band (0.95 = 95%)

    def __init__(self, parent, app, bgkey="bg", width=SIDEBAR_W, bar=5):
        super().__init__(parent, bd=0, highlightthickness=0)
        self.app, self.bgkey, self.barw = app, bgkey, bar
        self._lo, self._hi = 0.0, 1.0
        self._bar_hover = self._bar_drag_on = False
        self.canvas = tk.Canvas(self, width=width, height=200, highlightthickness=0, bd=0,
                                yscrollincrement=26)
        self.inner = tk.Frame(self.canvas, bd=0, highlightthickness=0)
        self._win = self.canvas.create_window(0, 0, anchor="nw", window=self.inner)
        self.bar = tk.Frame(self, width=bar, bd=0, highlightthickness=0, cursor="hand2")
        self.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        # fade band over the bottom of the cards: 0% at its top edge, 100% at the bottom edge,
        # shown only while there is more to scroll to
        self.fade = tk.Canvas(self, height=self.FADE_H, highlightthickness=0, bd=0)
        self._fade_shown, self._fade_key = False, None
        self.canvas.configure(yscrollcommand=self._on_scroll)
        self.inner.bind("<Configure>", self._fit)
        self.canvas.bind("<Configure>", self._on_canvas)
        self.bar.bind("<ButtonPress-1>", self._bar_drag)
        self.bar.bind("<B1-Motion>", self._bar_drag)
        self.bar.bind("<Enter>", lambda e: self._bar_state(hover=True))
        self.bar.bind("<Leave>", lambda e: self._bar_state(hover=False))
        self.bar.bind("<ButtonPress-1>", lambda e: self._bar_state(drag=True), add="+")
        self.bar.bind("<ButtonRelease-1>", lambda e: self._bar_state(drag=False))
        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            app.root.bind_all(seq, self._wheel, add="+")
        app.skin(self)

    def retheme(self, t):
        self.configure(bg=t[self.bgkey])
        self.canvas.configure(bg=t[self.bgkey])
        self.inner.configure(bg=t[self.bgkey])
        self.bar.configure(bg=t[self.bgkey])
        self.fade.configure(bg=t[self.bgkey])
        self._draw_bar()
        self._draw_fade()

    def _fit(self, e=None):
        self.canvas.configure(scrollregion=(0, 0, self.canvas.winfo_width(), self.inner.winfo_reqheight()))
        if self._fade_shown:
            self.after_idle(self._draw_fade)

    def _on_canvas(self, e):
        self.canvas.itemconfigure(self._win, width=e.width)
        self._fit()
        self.after_idle(self._update_fade)

    def _on_scroll(self, lo, hi):
        self._lo, self._hi = float(lo), float(hi)
        self._draw_bar()
        self._update_fade()

    # ── fade band: the cards' own shapes, hidden under a 0% -> 100% background overlay ──
    def _update_fade(self):
        scrolls = self._hi - self._lo < 0.999 and self._hi < 0.995
        if scrolls and not self._fade_shown:
            self.fade.place(x=0, rely=1.0, y=-self.FADE_H, relwidth=1.0, height=self.FADE_H)
            self._fade_shown = True
            self.bar.lift()
        elif not scrolls and self._fade_shown:
            self.fade.place_forget()
            self._fade_shown = False
        self._draw_fade()

    def _draw_fade(self):
        w, vh = self.canvas.winfo_width(), self.canvas.winfo_height()
        if w < 4 or vh < self.FADE_H or not self._fade_shown:
            return
        t = self.app.theme
        H = self.FADE_H
        y0 = int(round(self.canvas.canvasy(0))) + vh - H            # top of the band in content coordinates
        cards = []
        for c in self.inner.winfo_children():
            if hasattr(c, "r") and c.winfo_ismapped():
                top = c.winfo_y()
                if top < y0 + H and top + c.winfo_height() > y0:
                    cards.append((c.winfo_x(), top - y0, c.winfo_width(), c.winfo_height(), c.r))
        key = (w, y0, tuple(cards), t["bg"], t["surface"], t["border"])
        if key == self._fade_key:
            return
        self._fade_key = key
        S = 4
        # 1) what is underneath: page background plus the cards (fill, 1 px border, rounded corners)
        shape = Image.new("RGB", (w * S, H * S), _rgba(t[self.bgkey])[:3])
        dr = ImageDraw.Draw(shape)
        for x, y, cw, ch, r in cards:
            dr.rounded_rectangle((x * S, y * S, (x + cw) * S - 1, (y + ch) * S - 1), radius=r * S,
                                 fill=_rgba(t["surface"])[:3], outline=_rgba(t["border"])[:3], width=S)
        base = np.asarray(shape.resize((w, H), Image.Resampling.LANCZOS), dtype=np.float32)
        # 2) background-colored overlay: 0% opacity at the top row -> 100% at the bottom row
        a = np.linspace(0.0, self.FADE_MAX, H, dtype=np.float32)[:, None, None]
        bgc = np.array(_rgba(t[self.bgkey])[:3], dtype=np.float32)[None, None, :]
        out = np.rint(base * (1.0 - a) + bgc * a).astype(np.uint8)
        self.fade.delete("all")
        self.fade._img = ImageTk.PhotoImage(Image.fromarray(out, "RGB"))
        self.fade.create_image(0, 0, anchor="nw", image=self.fade._img)

    def _bar_state(self, hover=None, drag=None):
        """The scrollbar thumb turns accent while the pointer is on it or it is being dragged."""
        if hover is not None:
            self._bar_hover = hover
        if drag is not None:
            self._bar_drag_on = drag
        try:
            t = self.app.theme
            self.bar.configure(bg=t["accent"] if (self._bar_hover or self._bar_drag_on) else t["track"])
        except tk.TclError:
            pass

    def _draw_bar(self):
        if self._hi - self._lo >= 0.999:
            self.bar.place_forget()
            return
        t = self.app.theme
        h = max(self.canvas.winfo_height(), 20)
        y1 = int(self._lo * h + 3)
        y2 = int(max(self._lo * h + 28, self._hi * h - 3))
        self.bar.configure(bg=t["accent"] if (self._bar_hover or self._bar_drag_on) else t["track"])
        self.bar.place(relx=1.0, x=-(self.barw + 4), y=y1, width=self.barw, height=max(10, y2 - y1))
        self.bar.lift()

    def _bar_drag(self, e):
        h = max(self.canvas.winfo_height(), 1)
        y = e.y_root - self.canvas.winfo_rooty()
        span = self._hi - self._lo
        self.canvas.yview_moveto(min(1 - span, max(0.0, y / h - span / 2)))

    def _wheel(self, e):
        if self.app.wheel_adjust(e):                 # a focused dropdown / slider under the pointer takes the wheel
            return "break"
        try:
            w = self.winfo_containing(e.x_root, e.y_root)
        except (KeyError, tk.TclError):
            return
        while w is not None and w is not self:
            w = getattr(w, "master", None)
        if w is None or self._hi - self._lo >= 0.999:
            return
        if getattr(e, "num", 0) == 4:
            step = -2
        elif getattr(e, "num", 0) == 5:
            step = 2
        else:
            step = -2 if e.delta > 0 else 2
            if abs(e.delta) >= 120:
                step = -int(e.delta / 120) * 2
        self.canvas.yview_scroll(step, "units")


class _StopPos:
    """Stands in for the old per-stop position slider: reads and writes the app's lists,
    so every other part of the program keeps working unchanged."""
    def __init__(self, app, i):
        self.app, self.i = app, i

    def get(self):
        return self.app.color_positions[self.i] * 100

    def set(self, v):
        try:
            v = min(100.0, max(0.0, float(v)))
        except (TypeError, ValueError):
            return
        self.app.color_positions[self.i] = v / 100
        self.app.on_stop_changed(self.i)

    def configure(self, *a, **k):
        pass

    config = configure


class _StopOpacity:
    """Same idea for the per-stop opacity box (values are percent, as text)."""
    def __init__(self, app, i):
        self.app, self.i = app, i

    def get(self):
        return str(int(round(self.app.color_opacities[self.i] * 100)))

    def set(self, v):
        try:
            v = min(100.0, max(0.0, float(v)))
        except (TypeError, ValueError):
            return
        self.app.color_opacities[self.i] = v / 100
        self.app.on_stop_changed(self.i)

    def configure(self, *a, **k):
        pass

    config = configure


class ThemeTile(tk.Canvas):
    """Clickable theme preview used by the theme picker."""
    def __init__(self, parent, key, selected, command, bg):
        super().__init__(parent, width=150, height=84, highlightthickness=0, bd=0, bg=bg, cursor="hand2")
        t = THEMES[key]
        self.create_image(0, 0, anchor="nw", image=_photo(
            ("tile", key, selected),
            lambda: _rr(150, 84, 14, t["bg"], t["accent"] if selected else t["border"], 2 if selected else 1)))
        self.create_image(12, 12, anchor="nw", image=_photo(
            ("tilecard", key), lambda: _rr(126, 30, 8, t["surface"], t["border"])))
        for i, c in enumerate((t["accent"], t["text"], t["dim"])):
            x = 24 + i * 22
            self.create_oval(x - 6, 27 - 6, x + 6, 27 + 6, fill=c, outline="")
        self.create_text(14, 62, anchor="w", text=t["label"], fill=t["text"], font=F(10, True))
        self.bind("<ButtonRelease-1>", lambda e: command(key))

from colorsys import rgb_to_hsv, hsv_to_rgb


def style_titlebar(win, t):
    """Windows 10/11: dark/light title bar that matches the theme (silently ignored elsewhere)."""
    if not sys.platform.startswith("win"):
        return
    try:
        import ctypes
        win.update_idletasks()
        hwnd = ctypes.windll.user32.GetParent(win.winfo_id()) or win.winfo_id()
        dwm = ctypes.windll.dwmapi

        def put(attr, value):
            v = ctypes.c_int(value)
            return dwm.DwmSetWindowAttribute(hwnd, attr, ctypes.byref(v), ctypes.sizeof(v))

        dark = 1 if t["dark"] else 0
        if put(20, dark) != 0:
            put(19, dark)
        bgr = lambda c: (int(c[5:7], 16) << 16) | (int(c[3:5], 16) << 8) | int(c[1:3], 16)
        put(35, bgr(t["bg"]))        # caption color (Windows 11)
        put(36, bgr(t["text"]))      # caption text color (Windows 11)
        ctypes.windll.user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x27)   # repaint the frame
    except Exception:
        pass


class ColorPlane(tk.Canvas):
    """Saturation/value square with a hue bar underneath (the in-app color picker)."""
    GAP, BAR = 12, 16

    def __init__(self, parent, app, color, command=None, width=336, height=168, bgkey="surface"):
        super().__init__(parent, width=width, height=height + self.GAP + self.BAR, highlightthickness=0, bd=0)
        self.app, self.bgkey, self.command, self.W, self.H = app, bgkey, command, width, height
        self._drag, self._sv_cache = None, {}
        self.h, self.s, self.v = 0.0, 0.0, 1.0
        self.set_hex(color, redraw=False)
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<B1-Motion>", self._move)
        app.skin(self)

    def retheme(self, t):
        self.configure(bg=t[self.bgkey])
        self._sv_cache.clear()
        self._draw()

    def hex(self):
        r, g, b = (int(round(c * 255)) for c in hsv_to_rgb(self.h, self.s, self.v))
        return "#%02X%02X%02X" % (r, g, b)

    def set_hex(self, hx, redraw=True):
        c = hx.lstrip("#")
        r, g, b = (int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
        h, s, v = rgb_to_hsv(r, g, b)
        if s > 0.001 and v > 0.001:
            self.h = h                    # keep the old hue for greys/black so the bar does not jump
        self.s, self.v = s, v
        if redraw:
            self._draw()

    def _press(self, e):
        self._drag = "sv" if e.y <= self.H else "hue"
        self._move(e)

    def _move(self, e):
        clamp = lambda x: min(1.0, max(0.0, x))
        if self._drag == "sv":
            self.s, self.v = clamp(e.x / self.W), 1 - clamp(e.y / self.H)
        else:
            self.h = min(0.9999, clamp(e.x / self.W))
        self._draw()
        if self.command:
            self.command(self.hex())

    def _sv_image(self):
        key = round(self.h * 360)
        if key not in self._sv_cache:
            if len(self._sv_cache) > 40:
                self._sv_cache.clear()
            W, H = self.W, self.H
            s = np.linspace(0, 1, W)[None, :]
            v = np.linspace(1, 0, H)[:, None]
            c = v * s
            hp = (key % 360) / 60.0
            x = c * (1 - abs(hp % 2 - 1))
            m = v - c
            z = np.zeros_like(c)
            r1, g1, b1 = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)][int(hp) % 6]
            rgb = np.stack([r1 + m, g1 + m, b1 + m], axis=2)
            img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
            self._sv_cache[key] = ImageTk.PhotoImage(round_corners(img, 10))
        return self._sv_cache[key]

    def _hue_image(self):
        k = ("hue", self.W, self.BAR)

        def build():
            row = np.array([hsv_to_rgb(i / self.W, 1, 1) for i in range(self.W)])
            arr = np.repeat((row * 255).astype(np.uint8)[None, :, :], self.BAR, axis=0)
            return round_corners(Image.fromarray(arr).convert("RGBA"), self.BAR // 2)
        return _photo(k, build)

    @staticmethod
    def _ring(inner):
        def build():
            S, n = 4, 22
            img = Image.new("RGBA", (n * S, n * S), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.ellipse((0, 0, n * S - 1, n * S - 1), fill=(0, 0, 0, 90))
            d.ellipse((2 * S, 2 * S, n * S - 1 - 2 * S, n * S - 1 - 2 * S), fill=(255, 255, 255, 255))
            m = 4 * S
            d.ellipse((m, m, n * S - 1 - m, n * S - 1 - m), fill=_rgba(inner))
            return img.resize((n, n), Image.Resampling.LANCZOS)
        return _photo(("ring", inner), build)

    def _draw(self):
        if not hasattr(self, "_sv_cache"):
            return
        self.delete("all")
        self.create_image(0, 0, anchor="nw", image=self._sv_image())
        self.create_image(self.s * self.W, (1 - self.v) * self.H, image=self._ring(self.hex()))
        y = self.H + self.GAP
        self.create_image(0, y, anchor="nw", image=self._hue_image())
        hue_hex = "#%02X%02X%02X" % tuple(int(c * 255) for c in hsv_to_rgb(self.h, 1, 1))
        self.create_image(max(8, min(self.W - 8, self.h * self.W)), y + self.BAR / 2, image=self._ring(hue_hex))


_native_messagebox = messagebox


class _ThemedMessageBox:
    """Drop-in replacement for tkinter.messagebox that follows the active theme."""
    app = None

    def _show(self, kind, title, message, buttons, default, cancel):
        app = self.app
        try:
            alive = app is not None and bool(app.root.winfo_exists())
        except tk.TclError:
            alive = False
        if not alive:
            return None
        t = app.theme
        win = tk.Toplevel(app.root)
        win.withdraw()
        win.title(title)
        win.resizable(False, False)
        win.transient(app.root)
        win.configure(bg=t["surface"])
        res = {"v": cancel}
        body = tk.Frame(win, bg=t["surface"], bd=0)
        body.pack(fill="both", expand=True, padx=24, pady=(22, 18))
        col = {"info": t["accent"], "question": t["accent"], "warning": t["warn"], "error": t["bad"]}[kind]
        glyph = {"info": "i", "question": "?", "warning": "!", "error": "×"}[kind]

        def build():
            S, n = 4, 40
            img = Image.new("RGBA", (n * S, n * S), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.ellipse((0, 0, n * S - 1, n * S - 1), fill=_rgba(col))
            d.text((n * S / 2, n * S / 2 + S), glyph, fill=_rgba(_contrast_text(col)),
                   font=get_pil_font(int(24 * S)), anchor="mm")
            return img.resize((n, n), Image.Resampling.LANCZOS)

        photo = _photo(("dlgicon", kind, col), build)
        ic = tk.Label(body, image=photo, bg=t["surface"], bd=0)
        ic.image = photo
        ic.grid(row=0, column=0, sticky="n", padx=(0, 16))
        txt = tk.Frame(body, bg=t["surface"], bd=0)
        txt.grid(row=0, column=1, sticky="w")
        tk.Label(txt, text=title, font=F(12, True), bg=t["surface"], fg=t["text"], anchor="w", bd=0).pack(anchor="w")
        tk.Label(txt, text=message, font=F(10), bg=t["surface"], fg=t["dim"], justify="left", anchor="w",
                 wraplength=340, bd=0).pack(anchor="w", pady=(6, 0))
        row = tk.Frame(body, bg=t["surface"], bd=0)
        row.grid(row=1, column=0, columnspan=2, sticky="e", pady=(20, 0))

        def finish(v):
            res["v"] = v
            win.destroy()

        for label, value, style in buttons:
            RoundButton(row, app, text=label, style=style, height=34,
                        command=lambda v=value: finish(v)).pack(side="left", padx=(8, 0))
        win.bind("<Return>", lambda e: finish(default))
        win.bind("<Escape>", lambda e: finish(cancel))
        win.protocol("WM_DELETE_WINDOW", lambda: finish(cancel))
        win.update_idletasks()
        app.center_toplevel(win, max(win.winfo_reqwidth(), 380), win.winfo_reqheight())
        style_titlebar(win, t)
        win.deiconify()
        try:
            win.grab_set()
            win.focus_force()
        except tk.TclError:
            pass
        app.root.wait_window(win)
        return res["v"]

    def showinfo(self, title="", message="", **kw):
        r = self._show("info", title, message, [("OK", True, "primary")], True, True)
        return _native_messagebox.showinfo(title, message, **kw) if r is None else "ok"

    def showwarning(self, title="", message="", **kw):
        r = self._show("warning", title, message, [("OK", True, "primary")], True, True)
        return _native_messagebox.showwarning(title, message, **kw) if r is None else "ok"

    def showerror(self, title="", message="", **kw):
        r = self._show("error", title, message, [("OK", True, "primary")], True, True)
        return _native_messagebox.showerror(title, message, **kw) if r is None else "ok"

    def askyesno(self, title="", message="", **kw):
        r = self._show("question", title, message, [("No", False, "secondary"), ("Yes", True, "primary")],
                       True, False)
        return _native_messagebox.askyesno(title, message, **kw) if r is None else bool(r)


messagebox = _ThemedMessageBox()


class _Const:
    """Tiny stand-in for a tk variable that always returns one value."""
    def __init__(self, v):
        self.v = v

    def get(self):
        return self.v


class GradientGeneratorApp:
    @property
    def noise_seed(self):
        return self._noise_seed

    @noise_seed.setter
    def noise_seed(self, value):
        self._noise_seed = int(value)
        sv = getattr(self, "seed_var", None)
        if sv is not None and sv.get() != str(self._noise_seed):
            sv.set(str(self._noise_seed))

    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} v{APP_VERSION}")
        self.root.minsize(1080, 680)
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        gw, gh = min(1240, sw - 40), min(820, sh - 90)
        self.root.geometry(f"{gw}x{gh}+{max(0, (sw - gw) // 2)}+{max(0, (sh - gh) // 2 - 20)}")
        self.root.resizable(True, True)

        apply_app_icon(self.root)

        self.style = ttk.Style()
        self.style.theme_use('clam')
        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):      # wheel must scroll the page, not change a dropdown
            self.root.unbind_class("TCombobox", seq)
        self.themes = THEMES
        self._skins = []          # (widget, callback) pairs re-colored on every theme change
        self._combos = []

        self.prefs = self._read_prefs()
        self._restore_window()
        self._dirty, self._track_dirty = False, False        # "picture changed since the last save" (for the close question)
        saved_theme = self.load_settings()
        theme_name = saved_theme if saved_theme in self.themes else "midnight"
        self.current_theme = tk.StringVar(value=theme_name)
        self.theme = self._theme_for(theme_name)
        messagebox.app = self

        # ── All tk variables ──────────────────────────────────────────────────
        self.colors = list(DEFAULT_COLORS)
        self.color_positions = list(DEFAULT_POSITIONS)
        self.color_opacities = [1.0] * MAX_COLORS
        self.stop_trans = ["Smooth"] * MAX_COLORS          # how each stop moves on to the next one
        self.blend_mode = tk.StringVar(value="RGB")        # color space the stops are blended in
        self._sel_stop, self._ed_busy, self._ed_src = 0, False, False       # selected color stop (compact editor)
        self.num_colors = tk.StringVar(value="2")
        self.reverse_colors = tk.BooleanVar(value=False)
        self.gradient_type = tk.StringVar(value="Linear")
        self.direction = tk.StringVar(value="0°")
        self.direction_deg = tk.DoubleVar(value=0.0)       # drives the angle slider
        self._dir_sync = False
        self._hist = []                                    # last auto-generated images (settings snapshots)
        self._hist_idx = -1
        self.other_direction = tk.StringVar(value="Center")
        self.custom_x = tk.DoubleVar(value=50)
        self.custom_y = tk.DoubleVar(value=50)
        self.effect = tk.StringVar(value="None")
        self.secondary_effect = tk.StringVar(value="None")
        self.intensity = tk.DoubleVar(value=0.1)
        self.secondary_intensity = tk.DoubleVar(value=0.1)
        self.lock_colors = tk.BooleanVar(value=True)
        self.lock_num_colors = tk.BooleanVar(value=True)
        self.lock_opacities = tk.BooleanVar(value=False)
        self.lock_gradient_type = tk.BooleanVar(value=False)
        self.lock_direction = tk.BooleanVar(value=False)
        self.lock_other_direction = tk.BooleanVar(value=False)
        self.lock_effect = tk.BooleanVar(value=False)
        self.lock_secondary_effect = tk.BooleanVar(value=False)
        self.lock_intensity = tk.BooleanVar(value=False)
        self.lock_secondary_intensity = tk.BooleanVar(value=False)
        self.image = None
        self.canvas = None
        self.color_widgets = []
        self.position_vars = [_StopPos(self, i) for i in range(MAX_COLORS)]
        self.opacity_vars = [_StopOpacity(self, i) for i in range(MAX_COLORS)]
        self.voronoi_points = []
        self.voronoi_ref_size = (450, 250)
        self.hex_centers = {}
        self.update_delay = 0.3
        self.preview_pending = False
        self.zoom_level = tk.DoubleVar(value=1.0)
        self.show_palette = tk.BooleanVar(value=False)
        self.presets = []
        self.load_presets()
        self.last_update_time = 0
        self.canvas_offset_x = tk.DoubleVar(value=0)
        self.canvas_offset_y = tk.DoubleVar(value=0)
        self.drag_start_x = 0
        self.drag_start_y = 0
        self.width = tk.IntVar(value=1920)
        self.height = tk.IntVar(value=1080)
        self.aspect_ratio = tk.StringVar(value="16:9")
        self.temp_var = tk.StringVar(value="Neutral")
        self.scheme_var = tk.StringVar(value="Complementary")
        self.contrast_color1 = tk.StringVar(value=self.colors[0].upper())
        self.contrast_color2 = tk.StringVar(
            value=self.colors[1].upper() if len(self.colors) > 1 else self.colors[0].upper()
        )
        self.contrast_combo1 = None
        self._harmony_refresh = None            # set by Palette Tools: refills the Harmony Base Color list
        self._contrast_refresh = None           # set by Color Contrast: refills its color lists
        self.contrast_combo2 = None
        self.mode = tk.StringVar(value="Single")
        self.batch_size = tk.StringVar(value="10")
        self.file_format = tk.StringVar(value=self.prefs["default_format"])
        self.last_folder = self.prefs["default_folder"]
        self.batch_progress = None  # for progress bar during batch
        self.batch_running = False
        self._noise_seed = random.randint(0, 2 ** 31 - 1)
        self.seed_var = tk.StringVar(value=str(self._noise_seed))
        self.lock_seed = tk.BooleanVar(value=False)
        self.size_preset = tk.StringVar(value="Custom Size")
        self.export_quality = tk.DoubleVar(value=95)
        self.export_quality_text = tk.StringVar(value="95")
        self.ov_text_on = tk.BooleanVar(value=False)
        self.ov_text = tk.StringVar(value="Your text")
        self.ov_text_pos = tk.StringVar(value="Bottom-right")
        self.ov_text_size = tk.DoubleVar(value=5.0)
        self.ov_text_color = tk.StringVar(value="Auto")
        self.ov_logo_name = tk.StringVar(value="No logo chosen")
        self.ov_logo_pos = tk.StringVar(value="Top-left")
        self.ov_logo_size = tk.DoubleVar(value=18.0)
        self.ov_opacity = tk.DoubleVar(value=90.0)
        self.ov_background = tk.StringVar(value=self.prefs["default_background"])
        self.guides = tk.StringVar(value="Off")
        self._ov_logo = None
        self._ov_logo_stamp = 0
        self.vcmd_seed = (self.root.register(lambda p: p == "" or (p.isdigit() and len(p) <= 10)), "%P")
        self._open_drop = None
        self._thumb_cache = {}
        self._render_cache = None
        self._res_updating = False
        self.vcmd_int = (self.root.register(self._validate_int), "%P")

        self.create_gui()
        self.apply_theme(self.current_theme.get())
        self._bind_shortcuts()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.after(2500, self.start_tracking_changes)         # edits after start-up count as "unsaved"

    # ── GUI Creation ──────────────────────────────────────────────────────────
    def skin(self, widget, fn=None):
        """Register a widget so it is re-colored whenever the theme changes."""
        self._skins.append((widget, fn))
        try:
            fn(widget, self.theme) if fn else widget.retheme(self.theme)
        except tk.TclError:
            pass
        return widget

    def _frame(self, parent, bgkey="surface"):
        f = tk.Frame(parent, bd=0, highlightthickness=0)
        return self.skin(f, lambda w, t: w.configure(bg=t[bgkey]))

    def _label(self, parent, text="", color="text", size=10, bold=False, bgkey="surface", **kw):
        lab = tk.Label(parent, text=text, bd=0, font=F(size, bold), anchor=kw.pop("anchor", "w"), **kw)
        return self.skin(lab, lambda w, t: w.configure(bg=t[bgkey], fg=t[color]))

    def _combo(self, parent, var, values, width=12, **kw):
        return RoundCombo(parent, self, textvariable=var, values=values, width=width,
                          justify=kw.pop("justify", "left"), state=kw.pop("state", "readonly"))

    def _entry(self, parent, var, width=6, **kw):
        return RoundEntry(parent, self, textvariable=var, width=width, justify=kw.pop("justify", "center"), **kw)

    def _card(self, parent, title, icon=None, **kw):
        card = Card(parent, self, **kw)
        hdr = self._frame(card.body)
        hdr.grid(row=0, column=0, columnspan=8, sticky="w", pady=(0, 8))
        if icon:                                   # a small icon in the dim title color, before the name
            ico = tk.Label(hdr, bd=0)

            def paint(w, t, icon=icon):
                ph = _photo(("cardico", icon, 14, t["dim"]), lambda: icon_img(icon, 14, t["dim"]))
                w.configure(bg=t["surface"], image=ph)
                w.image = ph
            self.skin(ico, paint)
            ico.pack(side="left", padx=(0, 7))
        self._label(hdr, title.upper(), color="dim", size=8, bold=True).pack(side="left")
        return card, card.body

    def _sep(self, parent):
        s = tk.Frame(parent, height=1, bd=0)
        return self.skin(s, lambda w, t: w.configure(bg=t["border"]))

    def make_dialog(self, title, w, h):
        win = tk.Toplevel(self.root)
        win.withdraw()
        win.title(title)
        win.resizable(False, False)
        win.transient(self.root)
        win._min_w = w
        self.skin(win, lambda x, t: x.configure(bg=t["surface"]))
        win.after_idle(lambda: self._fit_dialog(win))
        return win

    def _fit_dialog(self, win):
        """Size the dialog to its content once it has been built, centre it, then show it."""
        try:
            win.update_idletasks()
            self.center_toplevel(win, max(win._min_w, win.winfo_reqwidth()), win.winfo_reqheight())
            style_titlebar(win, self.theme)
            win.deiconify()
            win.grab_set()
            win.focus_set()
        except tk.TclError:
            pass
    def create_gui(self):
        self.status_var = tk.StringVar(value="Ready")
        shell = self._frame(self.root, "bg")
        shell.pack(fill="both", expand=True)
        shell.columnconfigure(1, weight=1)
        shell.rowconfigure(1, weight=1)

        # ── header ──
        header = self._frame(shell, "bg")
        header.grid(row=0, column=0, columnspan=2, sticky="ew", padx=20, pady=(14, 6))
        header.columnconfigure(1, weight=1)
        try:
            self.title_image = ImageTk.PhotoImage(fit_width(asset_image("GG.png"), 280))
            logo = tk.Label(header, image=self.title_image, bd=0)
        except Exception:
            logo = tk.Label(header, text="Gradient Gen", font=F(18, True), bd=0)
        self.skin(logo, lambda w, t: w.configure(bg=t["bg"], fg=t["text"]))
        logo.grid(row=0, column=0, sticky="w")
        actions = self._frame(header, "bg")
        actions.grid(row=0, column=2, sticky="e")
        for i, (label, icon, cmd) in enumerate([
                ("View", "expand", self.open_fullscreen_preview),
                ("Settings", "gear", self.open_settings),
                ("Presets", "bookmark", self.open_preset_window),
                ("Reset", "reset", self.reset_settings),
                ("About", "info", self.show_about)]):
            RoundButton(actions, self, text=label, icon=icon, command=cmd, style="ghost",
                        height=34, compact=True, bgkey="bg").grid(row=0, column=i, padx=2)

        # ── sidebar: scrolling cards + fixed action bar ──
        side = self._frame(shell, "bg")
        side.grid(row=1, column=0, sticky="ns", padx=(20, 6), pady=(4, 0))
        side.rowconfigure(0, weight=1)
        self.sidebar = ScrollFrame(side, self, bgkey="bg", width=SIDEBAR_W)
        self.sidebar.grid(row=0, column=0, sticky="ns")
        inner = self.sidebar.inner
        inner.columnconfigure(0, weight=1)
        for r, builder in enumerate((self._build_colors_card, self._build_output_card, self._build_overlay_card)):
            builder(inner).grid(row=r, column=0, sticky="ew", pady=(0, 10))

        bar = self._frame(side, "bg")
        bar.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        bar.columnconfigure((0, 1), weight=1, uniform="act")
        self.auto_button = RoundButton(bar, self, text="Auto Generate", icon="sparkle", style="secondary",
                                       height=42, bgkey="bg", fill=True, command=self.generate_random)
        self.auto_button.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        self.save_button = RoundButton(bar, self, text="Save Image", icon="download", style="primary",
                                       height=42, bgkey="bg", fill=True, command=self.save_image)
        self.save_button.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        Tooltip(self.auto_button, self, "Generate image  (Space)")
        Tooltip(self.save_button, self, "Save the image  (Ctrl+S)")

        # ── preview ──
        self._build_preview(shell)

        # ── footer ──
        footer = self._frame(shell, "bg")
        footer.grid(row=2, column=0, columnspan=2, sticky="ew", padx=22, pady=(8, 10))
        footer.columnconfigure(0, weight=1)
        self._label(footer, textvariable=self.status_var, color="dim", size=9, bgkey="bg").grid(
            row=0, column=0, sticky="w")
        self._label(footer, f"Developed by Nihad Square  |  {APP_NAME} v{APP_VERSION}", color="dim",
                    size=8, bgkey="bg").grid(row=0, column=1, sticky="e")

        # ── variable traces that refresh the preview ──
        self.num_colors.trace_add("write", self.on_num_colors_change)
        for v in (self.gradient_type, self.effect, self.secondary_effect, self.direction,
                  self.other_direction, self.custom_x, self.custom_y):
            v.trace_add("write", self.schedule_preview)
        self.direction.trace_add("write", self._direction_from_text)
        self.direction_deg.trace_add("write", self._direction_from_slider)
        self.other_direction.trace_add("write", self._update_custom_xy_state)
        self.seed_var.trace_add("write", self._seed_from_text)
        self.mode.trace_add("write", lambda *a: self.toggle_batch_entry())
        self.guides.trace_add("write", lambda *a: self._draw_guides())
        self.aspect_ratio.trace_add("write", self.update_resolution)
        self.width.trace_add("write", self.update_resolution)
        self.height.trace_add("write", self.on_height_edited)
        self.size_preset.trace_add("write", self._on_size_preset)
        self.export_quality.trace_add("write", lambda *a: self.export_quality_text.set(
            str(int(round(self._safe_get(self.export_quality, 95))))))
        for v in (self.ov_text_on, self.ov_text, self.ov_text_pos, self.ov_text_size, self.ov_text_color,
                  self.ov_logo_pos, self.ov_logo_size, self.ov_opacity, self.ov_background):
            v.trace_add("write", self.schedule_preview)

        self.update_color_pickers()

    def _lock(self, parent, var, **kw):
        return LockToggle(parent, self, var, **kw)

    def _build_colors_card(self, parent):
        card, b = self._card(parent, "Colors", icon="palette", rpad=3)        # +3 px right: this column has a scrollbar
        b.columnconfigure(0, weight=1)
        head = self._frame(b)
        head.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        head.columnconfigure(2, weight=1)
        self._label(head, "Colors").grid(row=0, column=0, sticky="w", padx=(0, 8))
        self._combo(head, self.num_colors, [str(i) for i in range(2, MAX_COLORS + 1)], width=3,
                    justify="center").grid(row=0, column=1, sticky="w")
        chips = self._frame(head)
        chips.grid(row=0, column=2, sticky="e")
        for i, (text, var) in enumerate((("Number", self.lock_num_colors), ("Colors", self.lock_colors),
                                         ("Opacity", self.lock_opacities))):
            self._lock(chips, var, text=text).grid(row=0, column=i, padx=(6, 0))

        self._build_stop_editor(b)                       # color bar, chips and the editor of the selected stop (rows 2-5)
        div = tk.Frame(b, height=1, bd=0)                 # thin divider: stop editor above, palette tools below
        self.skin(div, lambda w, t: w.configure(bg=t["border"]))
        div.grid(row=6, column=0, sticky="ew", pady=(14, 0))
        r1 = self._frame(b)
        r1.grid(row=7, column=0, sticky="ew", pady=(14, 0))
        r1.columnconfigure((1, 2), weight=1, uniform="pal")
        self._label(r1, "Palette", color="dim").grid(row=0, column=0, sticky="w", padx=(0, 8))
        self._combo(r1, self.scheme_var,
                    ["Complementary", "Analogous", "Monochromatic", "Triadic", "Tetradic", "Square", "Shades",
                     "Compound", "Pentadic", "Hexadic", "Split-Complementary"], width=8).grid(
            row=0, column=1, sticky="ew")
        self._combo(r1, self.temp_var, ["Neutral", "Warm", "Cool", "New Scheme"], width=8).grid(
            row=0, column=2, sticky="ew", padx=(6, 0))
        pb = self._frame(b)
        pb.grid(row=8, column=0, sticky="e", pady=(8, 0))
        pb.columnconfigure(0, uniform="palbtn")
        pb.columnconfigure(1, uniform="palbtn")
        RoundButton(pb, self, text="Palette Tools", icon="bookmark", style="secondary", height=32, width=135,
                    command=self.open_palette_tools).grid(row=0, column=0, sticky="e")
        RoundButton(pb, self, text="Generate Palette", icon="sparkle", style="secondary", height=32, width=160,
                    accent_text=True, command=lambda: self.generate_color_palette(
                        self.colors[0], self.scheme_var.get(), int(self.num_colors.get()))
                    ).grid(row=0, column=1, sticky="e", padx=(6, 0))

        r2 = self._frame(b)
        r2.grid(row=9, column=0, sticky="ew", pady=(8, 0))
        r2.columnconfigure(4, weight=1)
        self._label(r2, "Contrast", color="dim").grid(row=0, column=0, sticky="w", padx=(0, 8))
        num = int(self.num_colors.get())
        opts = [c.upper() for c in self.colors[:num]]
        self.contrast_combo1 = self._combo(r2, self.contrast_color1, opts, width=7, justify="center")
        self.contrast_combo1.grid(row=0, column=1)
        self._label(r2, "↔", color="dim").grid(row=0, column=2, padx=6)
        self.contrast_combo2 = self._combo(r2, self.contrast_color2, opts, width=7, justify="center")
        self.contrast_combo2.grid(row=0, column=3)
        RoundButton(r2, self, text="Test", style="secondary", height=30, width=80, accent_text=True,
                    command=self.show_contrast_comparison).grid(row=0, column=4, sticky="e")
        return card

    def _form_row(self, b, row, label):
        self._label(b, label, color="dim").grid(row=row, column=0, sticky="w", pady=4, padx=(0, 10))

    def _build_gradient_card(self, parent):
        card, b = self._card(parent, "Gradient", icon="gradient")
        b.columnconfigure(1, weight=1)
        types = ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Swirl", "Plasma", "Voronoi", "Cylindrical",
                 "Pixelated", "Abstract", "Parametric", "Perlin", "Wave", "Starburst", "Kaleidoscope", "Tiled",
                 "Hexagonal", "Bilinear", "Fractal", "Mesh", "Aurora", "Marble", "Contour", "Halftone", "Dither",
                 "Silk", "Stained glass"]
        self._form_row(b, 1, "Type")
        self._combo(b, self.gradient_type, types, width=16).grid(row=1, column=1, sticky="ew", pady=4)
        self._lock(b, self.lock_gradient_type, tip="Lock the gradient type: Auto Generate leaves it unchanged").grid(row=1, column=2, padx=(8, 0))
        self._form_row(b, 2, "Direction")
        dr = self._frame(b)
        dr.grid(row=2, column=1, sticky="ew", pady=4)
        dr.columnconfigure(0, weight=1)
        PillSlider(dr, self, variable=self.direction_deg, from_=0, to=360,
                   tip="Direction of the gradient in degrees (mouse wheel adjusts)").grid(row=0, column=0, sticky="ew")
        self._label(dr, textvariable=self.direction, anchor="e", width=5).grid(row=0, column=1, padx=(8, 0))
        self._lock(b, self.lock_direction, tip="Lock the direction: Auto Generate leaves it unchanged").grid(row=2, column=2, padx=(8, 0))
        self._form_row(b, 3, "Position")
        self._combo(b, self.other_direction,
                    ["Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right", "Top-center",
                     "Bottom-center", "Left-center", "Right-center", "Custom"], width=16).grid(
            row=3, column=1, sticky="ew", pady=4)
        self._lock(b, self.lock_other_direction, tip="Lock the position: Auto Generate leaves it unchanged").grid(row=3, column=2, padx=(8, 0))
        self._form_row(b, 4, "Custom X / Y")
        xy = self._frame(b)
        xy.grid(row=4, column=1, sticky="w", pady=4)
        self.custom_x_entry = self._entry(xy, self.custom_x, width=5)
        self.custom_x_entry.grid(row=0, column=0)
        self._label(xy, "%", color="dim").grid(row=0, column=1, padx=(3, 10))
        self.custom_y_entry = self._entry(xy, self.custom_y, width=5)
        self.custom_y_entry.grid(row=0, column=2)
        self._label(xy, "%", color="dim").grid(row=0, column=3, padx=(3, 0))
        self._update_custom_xy_state()
        return card

    def _build_effects_card(self, parent):
        card, b = self._card(parent, "Effects", icon="sparkle")
        b.columnconfigure(1, weight=1)
        effects = ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples", "Liquidify", "Posterize",
                   "Vignette", "Edge_detect", "Color_invers", "Sepia", "Solarize", "Distort", "Bloom", "Mosaic",
                   "Emboss", "Sharpen", "Chromatic", "Pixel_sort", "Frosted", "Glitch", "Gradient_map", "Light_leak",
                   "Anti_band"]
        spec = ((1, "Effect 1", self.effect, self.lock_effect), (3, "Effect 2", self.secondary_effect,
                                                                   self.lock_secondary_effect))
        for row, label, var, lock in spec:
            self._form_row(b, row, label)
            self._combo(b, var, effects, width=16).grid(row=row, column=1, sticky="ew", pady=4)
            self._lock(b, lock, tip=f"Lock {label}: Auto Generate leaves it unchanged").grid(row=row, column=2, padx=(8, 0))
        for row, label, var, lock in ((2, "Strength 1", self.intensity, self.lock_intensity),
                                      (4, "Strength 2", self.secondary_intensity, self.lock_secondary_intensity)):
            self._form_row(b, row, label)
            PillSlider(b, self, variable=var, from_=0.0, to=0.5, command=self.schedule_preview,
                       tip=f"{label}: how strong the effect is").grid(row=row, column=1, sticky="ew", pady=4)
            self._lock(b, lock, tip=f"Lock {label}: Auto Generate leaves it unchanged").grid(row=row, column=2, padx=(8, 0))
        return card

    def _build_output_card(self, parent):
        card, b = self._card(parent, "Output", icon="download", rpad=3)        # +3 px right: this column has a scrollbar
        b.columnconfigure(1, weight=1)
        self._form_row(b, 1, "Size (px)")
        sz = self._frame(b)
        sz.grid(row=1, column=1, sticky="w", pady=4)
        self._entry(sz, self.width, width=5, validate="key", validatecommand=self.vcmd_int).grid(row=0, column=0)
        self._label(sz, "×", color="dim").grid(row=0, column=1, padx=6)
        self._entry(sz, self.height, width=5, validate="key", validatecommand=self.vcmd_int).grid(row=0, column=2)
        self._combo(sz, self.aspect_ratio, ["16:9", "4:3", "5:4", "1:1", "Custom"], width=7).grid(
            row=0, column=3, padx=(10, 0))
        self._form_row(b, 2, "Preset")
        self._combo(b, self.size_preset, [p[0] for p in SIZE_PRESETS], width=16).grid(
            row=2, column=1, sticky="ew", pady=4)
        self._form_row(b, 3, "Mode")
        Segmented(b, self, ["Single", "Batch"], self.mode, command=self.toggle_batch_entry).grid(
            row=3, column=1, sticky="w", pady=4)
        self._form_row(b, 4, "Batch")
        bt = self._frame(b)
        bt.grid(row=4, column=1, sticky="w", pady=4)
        self.batch_entry = self._entry(bt, self.batch_size, width=5, state="disabled")
        self.batch_entry.grid(row=0, column=0)
        self._label(bt, "images as", color="dim").grid(row=0, column=1, padx=8)
        self.format_dropdown = self._combo(bt, self.file_format, ["PNG", "JPEG", "WebP"], width=6, state="disabled")
        self.format_dropdown.grid(row=0, column=2)
        self._form_row(b, 5, "Quality")
        qf = self._frame(b)
        qf.grid(row=5, column=1, sticky="ew", pady=4)
        qf.columnconfigure(0, weight=1)
        PillSlider(qf, self, variable=self.export_quality, from_=50, to=100).grid(row=0, column=0, sticky="ew")
        self._label(qf, textvariable=self.export_quality_text, anchor="e", width=4).grid(row=0, column=1, padx=(8, 0))
        Tooltip(qf, self, "JPEG and WebP quality (100 = lossless WebP)")
        self._form_row(b, 6, "Background")
        bg_row = self._frame(b)
        bg_row.grid(row=6, column=1, sticky="ew", pady=4)
        bg_row.columnconfigure(0, weight=6)
        bg_row.columnconfigure(2, weight=4)
        self._combo(bg_row, self.ov_background, ["White", "Black", "Transparent"], width=8).grid(
            row=0, column=0, sticky="ew")
        self._label(bg_row, "Guides", color="dim").grid(row=0, column=1, padx=(8, 6))
        self._combo(bg_row, self.guides, self.GUIDE_OPTS, width=8).grid(row=0, column=2, sticky="ew")
        self._form_row(b, 7, "Copy as")
        cc = self._frame(b)
        cc.grid(row=7, column=1, sticky="ew", pady=4)
        cc.columnconfigure((0, 1, 2), weight=1, uniform="cc")
        css_btn = RoundButton(cc, self, text="CSS", icon="copy", style="secondary", height=30, fill=True,
                              command=lambda: self.copy_gradient_code("css"))
        css_btn.grid(row=0, column=0, sticky="ew", padx=(0, 3))
        svg_btn = RoundButton(cc, self, text="SVG", icon="copy", style="secondary", height=30, fill=True,
                              command=lambda: self.copy_gradient_code("svg"))
        svg_btn.grid(row=0, column=1, sticky="ew", padx=3)
        img_btn = RoundButton(cc, self, text="Image", icon="copy", style="secondary", height=30, fill=True,
                              command=self.copy_image_to_clipboard)
        img_btn.grid(row=0, column=2, sticky="ew", padx=(3, 0))
        Tooltip(css_btn, self, "Copy this gradient as CSS  (Ctrl+K)")
        Tooltip(svg_btn, self, "Copy this gradient as an SVG image")
        Tooltip(img_btn, self, "Copy the picture to the clipboard  (Ctrl+C)")
        self.batch_progress_var = tk.DoubleVar(value=0.0)
        self.batch_progress_bar = ttk.Progressbar(b, variable=self.batch_progress_var, maximum=100,
                                                  mode="determinate")
        self.batch_progress_bar.grid(row=8, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        self.batch_progress_bar.grid_remove()
        return card

    def _build_preview(self, shell):
        right = self._frame(shell, "bg")
        right.grid(row=1, column=1, sticky="nsew", padx=(6, 20), pady=(4, 0))
        right.rowconfigure(0, weight=1)
        right.columnconfigure(0, weight=1)
        pcard = Card(right, self, radius=16, pad=12, expand=True)
        pcard.grid(row=0, column=0, sticky="nsew")
        pb = pcard.body
        pb.rowconfigure(0, weight=1)
        pb.columnconfigure(0, weight=1)
        self.canvas = tk.Canvas(pb, width=320, height=220, highlightthickness=0, bd=0)
        self.skin(self.canvas, lambda w, t: w.configure(bg=t["surface"]))
        self.canvas.grid(row=0, column=0, sticky="nsew")
        self.canvas.bind("<MouseWheel>", self.zoom_canvas)
        self.canvas.bind("<Button-4>", self.zoom_canvas)
        self.canvas.bind("<Button-5>", self.zoom_canvas)
        self.canvas.bind("<ButtonPress-1>", self.start_pan)
        self.canvas.bind("<B1-Motion>", self.pan_canvas)
        self.canvas.bind("<Configure>", lambda e: self.schedule_preview())

        tb = self._frame(pb)
        tb.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        tb.columnconfigure(3, weight=1)
        self._label(tb, "Zoom", color="dim").grid(row=0, column=0, padx=(0, 8))
        PillSlider(tb, self, variable=self.zoom_level, from_=1.0, to=4.0, width=100, tip="Zoom into the pattern",
                   wheel_step=0.1, command=self.schedule_preview).grid(row=0, column=1)
        self.zoom_text = tk.StringVar(value="1.0x")
        self.zoom_level.trace_add("write", lambda *a: self.zoom_text.set(f"{self._safe_get(self.zoom_level, 1.0):.1f}x"))
        self._label(tb, textvariable=self.zoom_text, color="dim", size=9).grid(row=0, column=2, padx=(8, 0))
        self.undo_btn = RoundButton(tb, self, icon="undo", style="secondary", height=30, radius=9,
                                    command=self.history_undo)
        self.undo_btn.grid(row=0, column=4, padx=(0, 4))
        self.redo_btn = RoundButton(tb, self, icon="redo", style="secondary", height=30, radius=9,
                                    command=self.history_redo)
        self.redo_btn.grid(row=0, column=5, padx=(0, 14))
        Tooltip(self.undo_btn, self, "Undo: last 5 images  (Ctrl+Z)")
        Tooltip(self.redo_btn, self, "Redo  (Ctrl+Y)")
        self.undo_btn.configure(state="disabled")
        self.redo_btn.configure(state="disabled")
        self._label(tb, "Show Palette", color="dim").grid(row=0, column=6, padx=(0, 5))
        Toggle(tb, self, self.show_palette, command=self.update_preview,
               tip="Show the color palette instead of the gradient").grid(row=0, column=7)
        self._label(tb, "Reverse", color="dim").grid(row=0, column=8, padx=(18, 5))
        Toggle(tb, self, self.reverse_colors, command=self.schedule_preview,
               tip="Reverse the order of the colors").grid(row=0, column=9)

        sd = self._frame(tb)
        sd.grid(row=0, column=10, padx=(18, 0))
        self._label(sd, "Seed:", color="dim").grid(row=0, column=0, padx=(0, 6))
        self.seed_entry = self._entry(sd, self.seed_var, width=10, validate="key", validatecommand=self.vcmd_seed)
        self.seed_entry.grid(row=0, column=1)
        Tooltip(self.seed_entry, self, "Seed: Reproduce a pattern")
        dice = RoundButton(sd, self, icon="dice", style="secondary", height=30, radius=9, command=self.new_seed)
        dice.grid(row=0, column=2, padx=(6, 0))
        Tooltip(dice, self, "New random seed")
        self._lock(sd, self.lock_seed, tip="Lock seed").grid(
            row=0, column=3, padx=(6, 0))

        ctl = self._frame(right, "bg")
        ctl.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        ctl.columnconfigure((0, 1), weight=1, uniform="ctl")
        self._build_gradient_card(ctl).grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        self._build_effects_card(ctl).grid(row=0, column=1, sticky="nsew", padx=(5, 0))

    # ── Theme picker ────────────────────────────────────────────────────────
    def open_theme_picker(self):
        win = self.make_dialog("Choose a theme", 690, 300)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        self._label(body, "Choose a theme", size=13, bold=True).grid(row=0, column=0, columnspan=4, sticky="w")
        self._label(body, "Saved automatically and used the next time you open Gradient Gen.",
                    color="dim", size=9).grid(row=1, column=0, columnspan=4, sticky="w", pady=(2, 14))

        def choose(key):
            self.apply_theme(key)
            self.save_settings(key)
            win.destroy()

        for i, key in enumerate(THEME_ORDER):
            ThemeTile(body, key, key == self.current_theme.get(), choose, self.theme["surface"]).grid(
                row=2 + i // 4, column=i % 4, padx=(0, 12), pady=(0, 12))

    # ── Settings window ─────────────────────────────────────────────────────
    def open_settings(self):
        win = self.make_dialog("Settings", 520, 560)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(1, weight=1)
        self._label(body, "Settings", size=13, bold=True).grid(row=0, column=0, columnspan=3, sticky="w")
        self._label(body, "Saved automatically and used the next time you open Gradient Gen.", color="dim",
                    size=9).grid(row=1, column=0, columnspan=3, sticky="w", pady=(2, 12))

        def lab(r, text):
            self._label(body, text).grid(row=r, column=0, sticky="w", pady=8, padx=(0, 16))

        # theme (it used to be a header button)
        lab(2, "Theme")
        RoundButton(body, self, text="Choose Theme", icon="theme", style="secondary", height=32, size=9,
                    command=self.open_theme_picker).grid(row=2, column=1, sticky="w")

        # accent color
        lab(3, "Accent Color")
        acc = ColorSwatch(body, self, text=self.theme["accent"], width=104, height=30)
        acc.grid(row=3, column=1, sticky="w")
        acc.command = lambda: self._pick_accent(win, acc)

        def default_accent():
            self.prefs["accent"] = ""
            self._save_prefs()
            self.apply_theme(self.current_theme.get())
            acc.set(self.theme["accent"])
        RoundButton(body, self, text="Theme Default", style="secondary", height=30, size=9, command=default_accent
                    ).grid(row=3, column=2, sticky="e")
        Tooltip(acc, self, "Use your own accent color with any theme")

        # default export format
        lab(4, "Default Format")
        fmt = tk.StringVar(value=self.prefs["default_format"])
        win._fmt = fmt

        def on_fmt(*a):
            if fmt.get() in ("PNG", "JPEG", "WebP"):
                self.prefs["default_format"] = fmt.get()
                self.file_format.set(fmt.get())
                self._save_prefs()
        fmt.trace_add("write", on_fmt)
        self._combo(body, fmt, ["PNG", "JPEG", "WebP"], width=8, justify="center").grid(row=4, column=1, sticky="w")

        # default background (Output card)
        lab(5, "Default Background")
        bgv = tk.StringVar(value=self.prefs["default_background"])
        win._bg = bgv

        def on_bg(*a):
            if bgv.get() in ("Transparent", "White", "Black"):
                self.prefs["default_background"] = bgv.get()
                self.ov_background.set(bgv.get())
                self._save_prefs()
        bgv.trace_add("write", on_bg)
        self._combo(body, bgv, ["Transparent", "White", "Black"], width=11, justify="center").grid(
            row=5, column=1, sticky="w")

        # default folder
        lab(6, "Default Folder")
        folder_lbl = self._label(body, "", color="dim", size=9, wraplength=190, justify="left")
        folder_lbl.grid(row=6, column=1, sticky="w")

        def show_folder():
            f = self.prefs["default_folder"]
            folder_lbl.configure(text=f if f else "Not set (last used)")
        show_folder()
        fb = self._frame(body)
        fb.grid(row=6, column=2, sticky="e")

        def browse():
            f = filedialog.askdirectory(parent=win, initialdir=self.prefs["default_folder"] or os.getcwd())
            if f:
                self.prefs["default_folder"] = f
                self.last_folder = f
                self._save_prefs()
                show_folder()

        def clear_folder():
            self.prefs["default_folder"] = ""
            self._save_prefs()
            show_folder()
        RoundButton(fb, self, text="Browse", style="secondary", height=30, size=9, command=browse).grid(row=0, column=0)
        RoundButton(fb, self, text="Clear", style="secondary", height=30, size=9, command=clear_folder).grid(
            row=0, column=1, padx=(6, 0))

        # tooltips
        lab(7, "Tooltips")
        tips = tk.BooleanVar(value=bool(self.prefs["tooltips"]))
        win._tips = tips

        def on_tips():
            self.prefs["tooltips"] = bool(tips.get())
            self._save_prefs()
        Toggle(body, self, tips, command=on_tips, tip="Show or hide the small hints").grid(row=7, column=1, sticky="w")
        self._label(body, "Hints when you point at a control", color="dim", size=9).grid(
            row=7, column=1, sticky="w", padx=(52, 0))

        # remember window size and position
        lab(8, "Remember Window")
        rem = tk.BooleanVar(value=bool(self.prefs["remember_window"]))
        win._rem = rem

        def on_rem():
            self.prefs["remember_window"] = bool(rem.get())
            self._save_prefs()
            self._remember_window()
        Toggle(body, self, rem, command=on_rem, tip="Open at the size and place you closed it").grid(
            row=8, column=1, sticky="w")
        self._label(body, "Size and position", color="dim", size=9).grid(
            row=8, column=1, sticky="w", padx=(52, 0))

        # ask before closing
        lab(9, "Ask Before Closing")
        ask = tk.BooleanVar(value=bool(self.prefs["confirm_close"]))
        win._ask = ask

        def on_ask():
            self.prefs["confirm_close"] = bool(ask.get())
            self._save_prefs()
        Toggle(body, self, ask, command=on_ask, tip="Ask first when the latest picture has not been saved").grid(
            row=9, column=1, sticky="w")
        self._label(body, "When the latest picture is not saved", color="dim", size=9).grid(
            row=9, column=1, sticky="w", padx=(52, 0))

        # reset
        sep = tk.Frame(body, height=1, bd=0)
        self.skin(sep, lambda w, t: w.configure(bg=t["border"]))
        sep.grid(row=10, column=0, columnspan=3, sticky="ew", pady=(14, 12))

        def reset_prefs():
            if not messagebox.askyesno("Reset Preferences",
                                       "Reset the theme, accent color, default format, default background, default "
                                       "folder, tooltips, window memory and the closing question to their original values?\n\nYour presets and palettes "
                                       "are not touched."):
                return
            self.prefs = dict(DEFAULT_PREFS)
            self._save_prefs()
            self.file_format.set("PNG")
            self.ov_background.set("Transparent")
            self.last_folder = ""
            self.apply_theme("midnight")
            self.status_var.set("Preferences reset")
            win.destroy()
        bottom = self._frame(body)                        # Open tutorial + Reset preferences on the left, Done on the right
        bottom.grid(row=11, column=0, columnspan=3, sticky="ew")
        bottom.columnconfigure(2, weight=1)
        RoundButton(bottom, self, text="Tutorial", icon="help", style="secondary", height=32,
                    command=self.show_tutorial).grid(row=0, column=0)
        RoundButton(bottom, self, text="Reset Preferences", style="secondary", height=32, command=reset_prefs).grid(
            row=0, column=1, padx=(8, 0))
        RoundButton(bottom, self, text="Done", style="primary", height=32, width=110, command=win.destroy).grid(
            row=0, column=2, sticky="e")

    def _pick_accent(self, parent, swatch):
        win = self.make_dialog("Accent color", 380, 430)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(0, weight=1)
        cur = self.theme["accent"].upper()
        var = tk.StringVar(value=cur)
        self._label(body, "Accent color", size=13, bold=True).grid(row=0, column=0, sticky="w")
        ColorPlane(body, self, cur, command=lambda hx: var.set(hx)).grid(row=1, column=0, pady=(12, 12))
        row = self._frame(body)
        row.grid(row=2, column=0, sticky="ew")
        row.columnconfigure(0, weight=1)
        self._entry(row, var, width=10).grid(row=0, column=0, sticky="ew", padx=(0, 10))

        def apply():
            hx = var.get().strip().upper()
            if not hx.startswith("#"):
                hx = "#" + hx
            if not re.match(r"^#[0-9A-F]{6}$", hx):
                messagebox.showerror("Accent color", "Please enter a color like #5240FF.")
                return
            self.prefs["accent"] = hx
            self._save_prefs()
            self.apply_theme(self.current_theme.get())
            win.destroy()
            try:
                swatch.set(self.theme["accent"])
            except tk.TclError:
                pass
        RoundButton(row, self, text="Use this color", style="primary", height=34, command=apply).grid(row=0, column=1)

    def _restore_window(self):
        """Reopen at the last size and position (only when Settings says so; kept on screen)."""
        if not self.prefs.get("remember_window"):
            return
        m = re.match(r"^(\d+)x(\d+)([+-]\d+)([+-]\d+)$", self.prefs.get("window_geometry", ""))
        if not m:
            return
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        w, h = min(max(1080, int(m.group(1))), sw), min(max(680, int(m.group(2))), sh)
        x, y = min(max(0, int(m.group(3))), max(0, sw - w)), min(max(0, int(m.group(4))), max(0, sh - h - 40))
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        if self.prefs.get("window_zoomed"):
            try:
                self.root.state("zoomed")
            except tk.TclError:
                try:
                    self.root.attributes("-zoomed", True)
                except tk.TclError:
                    pass

    def _remember_window(self):
        if not self.prefs.get("remember_window"):
            return
        try:
            try:
                zoomed = self.root.state() == "zoomed"
            except tk.TclError:
                zoomed = False
            if not zoomed:
                self.prefs["window_geometry"] = self.root.winfo_geometry()
            self.prefs["window_zoomed"] = zoomed
            self._save_prefs()
        except tk.TclError:
            pass

    def start_tracking_changes(self):
        self._track_dirty = True

    def on_close(self):
        """Window close button: ask first when the latest picture was changed and not saved."""
        if self.batch_running and not messagebox.askyesno("Gradient Gen",
                                                          "A batch is still being generated.\n\nClose anyway?"):
            return
        if (self.prefs.get("confirm_close", True) and self._dirty and not self.batch_running
                and not messagebox.askyesno("Close Gradient Gen",
                                            "Your latest picture has not been saved.\n\nClose anyway?")):
            return
        self._remember_window()
        self.root.destroy()

    # ── Helper methods ───────────────────────────────────────────────────────
    # ── Shared helpers (v3.2) ────────────────────────────────────────────────
    @staticmethod
    def _safe_get(var, default=None):
        try:
            return var.get()
        except (tk.TclError, ValueError):
            return default

    @staticmethod
    def _validate_int(proposed):
        return proposed == "" or (proposed.isdigit() and len(proposed) <= 5)

    def distribute_positions(self, num=None):
        """Spread the first `num` color stops evenly from 0 to 100 %."""
        try:
            num = int(self.num_colors.get()) if num is None else int(num)
        except (ValueError, tk.TclError):
            num = 2
        num = min(max(num, 2), MAX_COLORS)
        for i in range(num):
            self.color_positions[i] = i / (num - 1)

    def spread_stops(self):
        """Spread the stops evenly but keep their left-to-right order."""
        n = self._num()
        order = sorted(range(n), key=lambda k: self.color_positions[k])
        for rank, k in enumerate(order):
            self.color_positions[k] = rank / (n - 1)
        self.sync_color_widgets()
        self.schedule_preview()

    def _num(self):
        try:
            return min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        except (ValueError, tk.TclError):
            return 2

    def sync_color_widgets(self):
        """Show the current positions / opacities in the color bar, chips and the editor."""
        self.refresh_editor()
        self._refresh_stop_bar()
        self._draw_chips()

    def on_num_colors_change(self, *args):
        n = self._num()
        old_n = getattr(self, "_last_num", 2)
        self._last_num = n
        if n > old_n and not getattr(self, "_keep_positions", False):
            self._fill_new_stops(old_n, n)
        if not getattr(self, "_keep_positions", False):
            self.distribute_positions()
        self.update_color_pickers()

    def _fill_new_stops(self, old_n, new_n):
        """New stops that still hold the grey placeholder get the color the gradient already has
        at their (evenly spread) position, so raising Number never drops grey into the picture."""
        try:
            order = sorted(range(old_n), key=lambda k: self.color_positions[k])
            xs = [self.color_positions[k] for k in order]
            rgb = [self.hex_to_rgb(self.colors[k]) for k in order]
            for k in range(old_n, new_n):
                if str(self.colors[k]).upper() != "#CCCCCC":
                    continue
                x = k / (new_n - 1)
                self.colors[k] = "#%02X%02X%02X" % tuple(
                    int(round(float(np.interp(x, xs, [c[ch] for c in rgb])))) for ch in range(3))
        except Exception:
            pass

    def select_stop(self, i):
        """Make stop `i` the one the editor shows (called by the bar, the chips and add / delete)."""
        self._sel_stop = max(0, min(self._num() - 1, int(i)))
        self._refresh_stop_bar()
        self._draw_chips()
        self.refresh_editor()

    def on_stop_changed(self, i=None):
        self._refresh_stop_bar()
        if not self._ed_src and i is not None and i == self._sel_stop:
            self.refresh_editor()
        self.schedule_preview()

    def get_export_size(self):
        """Validated (width, height) for saving, or None after telling the user why."""
        try:
            w = int(self.width.get())
            h = int(self.height.get())
        except (ValueError, tk.TclError):
            messagebox.showerror("Error", "Please enter a valid width and height.")
            return None
        if w < 1 or h < 1:
            messagebox.showerror("Error", "Width and height must be at least 1 px.")
            return None
        if w > MAX_DIM or h > MAX_DIM:
            messagebox.showwarning("Size too large",
                                   f"The maximum size is {MAX_DIM} x {MAX_DIM} px.\n"
                                   f"You entered {w} x {h}.")
            return None
        if w * h > LARGE_PIXELS:
            if not messagebox.askyesno("Large image",
                                       f"{w} x {h} px ({w * h / 1e6:.0f} MP) can take a while and "
                                       f"use several GB of RAM.\n\nContinue?"):
                return None
        return w, h

    # ── Keyboard shortcuts / drop-down housekeeping ─────────────────────────────
    def _bind_shortcuts(self):
        r = self.root
        r.bind_all("<ButtonPress>", self._drop_outside, add="+")
        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):         # wheel on a focused dropdown / slider
            r.bind_all(seq, self._on_wheel_any, add="+")
        r.bind("<Configure>", self._drop_on_move, add="+")
        for seq in ("<Control-s>", "<Control-S>"):
            r.bind_all(seq, self._sc_save)
        r.bind_all("<Control-z>", self._sc_undo)
        for seq in ("<Control-y>", "<Control-Y>", "<Control-Z>"):
            r.bind_all(seq, self._sc_redo)
        r.bind_all("<space>", self._sc_auto)
        for seq in ("<Control-c>", "<Control-C>"):
            r.bind_all(seq, self._sc_copy)
        for seq in ("<g>", "<G>"):
            r.bind_all(seq, self._sc_guides)
        for seq in ("<Control-k>", "<Control-K>"):
            r.bind_all(seq, self._sc_copy_css)
        for seq in ("<f>", "<F>"):
            r.bind_all(seq, self._sc_full)

    def release_focus(self):
        """Move keyboard focus to the main window so Space / Ctrl shortcuts work again."""
        try:
            self.root.focus_set()
        except tk.TclError:
            pass

    def _drop_outside(self, e):
        pop = self._open_drop
        if pop is not None:
            try:
                if str(e.widget).startswith(str(pop.top)) or e.widget is pop.c:
                    return
            except Exception:
                pass
            pop.close()
        # a click on anything that is not an input field or dropdown takes focus away from them
        if (getattr(e, "num", 1) in (1, 2, 3) and self._sc_in_main(e)
                and not isinstance(e.widget, (tk.Entry, tk.Text, tk.Listbox, RoundEntry, RoundCombo, PillSlider))):
            self.release_focus()

    def wheel_adjust(self, e):
        """Mouse wheel over a FOCUSED dropdown or slider changes its value (wheel down = next / less).
        Returns True when the event was used, so the sidebar does not scroll as well."""
        memo = getattr(self, "_wheel_memo", None)
        if memo and memo[0] == e.serial:
            return memo[1]
        used = False
        try:
            if self._open_drop is None:                              # main window and every pop-up window
                w = self.root.winfo_containing(e.x_root, e.y_root)
                while w is not None and not isinstance(w, (RoundCombo, PillSlider)):
                    w = getattr(w, "master", None)
                if w is not None and (isinstance(w, RoundCombo) or self.root.focus_get() is w):   # dropdown: hover is enough; slider: click it first
                    if getattr(e, "num", 0) == 4:
                        up = True
                    elif getattr(e, "num", 0) == 5:
                        up = False
                    else:
                        up = e.delta > 0
                    if isinstance(w, PillSlider):
                        used = w.wheel(1 if up else -1)
                    else:
                        used = w.wheel(-1 if up else 1)
        except (KeyError, tk.TclError):
            used = False
        self._wheel_memo = (e.serial, used)
        return used

    def _on_wheel_any(self, e):
        if self.wheel_adjust(e):
            return "break"

    def _drop_on_move(self, e):
        if self._open_drop is not None and e.widget is self.root:
            self._open_drop.close()

    def _sc_in_main(self, e):
        try:
            return e.widget.winfo_toplevel() is self.root
        except Exception:
            return False

    def _sc_typing(self):
        try:
            fw = self.root.focus_get()
        except (KeyError, tk.TclError):
            return False
        return isinstance(fw, (tk.Entry, tk.Text, tk.Listbox, RoundCombo))

    def _sc_save(self, e):
        if not self._sc_in_main(e):
            return
        if self.mode.get() == "Batch":
            self.status_var.set("Switch to Single mode to save one image")
        else:
            self.save_image()
        return "break"

    def _sc_undo(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.history_undo()
            return "break"

    def _sc_redo(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.history_redo()
            return "break"

    def _sc_auto(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.generate_random()
            return "break"

    # ── Seed ─────────────────────────────────────────────────────────────────
    def _seed_from_text(self, *a):
        text = self.seed_var.get().strip()
        try:
            v = int(text)
        except (ValueError, tk.TclError):
            return
        wrapped = v % 2 ** 31
        if wrapped != self._noise_seed:
            self._noise_seed = wrapped
            self.schedule_preview()
        if wrapped != v:
            self.seed_var.set(str(wrapped))

    def new_seed(self):
        self.noise_seed = random.randint(0, 2 ** 31 - 1)
        self.schedule_preview()

    # ── Direction slider <-> "45°" text ───────────────────────────────────────
    def _direction_from_text(self, *a):
        if self._dir_sync:
            return
        try:
            v = float(self.direction.get().replace("°", ""))
        except (ValueError, tk.TclError):
            return
        self._dir_sync = True
        try:
            self.direction_deg.set(min(360.0, max(0.0, v)))
        finally:
            self._dir_sync = False

    def _direction_from_slider(self, *a):
        if self._dir_sync:
            return
        try:
            deg = int(round(float(self.direction_deg.get())))
        except (ValueError, tk.TclError):
            return
        self._dir_sync = True
        try:
            self.direction.set(f"{deg}°")
        finally:
            self._dir_sync = False

    def _update_custom_xy_state(self, *a):
        on = self.other_direction.get() == "Custom"
        for name in ("custom_x_entry", "custom_y_entry"):
            ent = getattr(self, name, None)
            if ent is not None:
                ent.configure(state="normal" if on else "disabled")

    # ── Undo / Redo over the last 5 auto-generated images ───────────────────────
    HIST_MAX = 5
    _HIST_SKIP = ("name", "zoom_level", "temperature", "width", "height", "aspect_ratio",
                  "lock_intensity", "lock_secondary_intensity", "lock_opacities")

    def _history_snapshot(self):
        snap = self.get_current_settings()
        self.get_voronoi_points(1, 1)                       # make sure the Voronoi layout exists
        snap["noise_seed"] = self.noise_seed
        snap["voronoi_points"] = [tuple(p) for p in self.voronoi_points]
        return snap

    def _hist_sig(self, snap):
        d = {k: v for k, v in snap.items() if k not in self._HIST_SKIP + ("noise_seed", "voronoi_points")}
        return json.dumps(d, sort_keys=True, default=str)

    def _history_dirty(self):
        """True when the settings were edited by hand after the current history image."""
        if not (0 <= self._hist_idx < len(self._hist)):
            return False
        try:
            return self._hist_sig(self.get_current_settings()) != self._hist_sig(self._hist[self._hist_idx])
        except (tk.TclError, ValueError):
            return False

    def _history_push(self):
        snap = self._history_snapshot()
        del self._hist[self._hist_idx + 1:]                 # a new image discards the redo branch
        self._hist.append(snap)
        del self._hist[:-self.HIST_MAX]
        self._hist_idx = len(self._hist) - 1
        self._refresh_history_buttons()

    def _history_restore(self, index):
        snap = dict(self._hist[index])
        cur = self.get_current_settings()
        for k in self._HIST_SKIP:                           # size, zoom and locks stay as they are now
            if k in cur:
                snap[k] = cur[k]
        self.noise_seed = snap.get("noise_seed", self.noise_seed)
        self.apply_preset(snap)
        self.voronoi_points = [tuple(p) for p in snap.get("voronoi_points", [])]
        self._hist_idx = index
        self.schedule_preview()
        self._refresh_history_buttons()

    def history_undo(self):
        if self.batch_running or self._hist_idx < 0:
            return
        if self._history_dirty():
            self._history_restore(self._hist_idx)           # first go back to the saved image itself
        elif self._hist_idx > 0:
            self._history_restore(self._hist_idx - 1)

    def history_redo(self):
        if self.batch_running:
            return
        if self._hist_idx + 1 < len(self._hist):
            self._history_restore(self._hist_idx + 1)

    def _refresh_history_buttons(self):
        if not hasattr(self, "undo_btn"):
            return
        can_undo = self._hist_idx >= 0 and (self._hist_idx > 0 or self._history_dirty())
        can_redo = self._hist_idx + 1 < len(self._hist)
        self.undo_btn.configure(state="normal" if can_undo else "disabled")
        self.redo_btn.configure(state="normal" if can_redo else "disabled")

    def toggle_batch_entry(self):
        batch = self.mode.get() == "Batch"
        self.batch_entry.configure(state="normal" if batch else "disabled")
        self.format_dropdown.configure(state="readonly" if batch else "disabled")
        self.save_button.configure(state="disabled" if batch else "normal")
        self.auto_button.configure(text="Generate Batch" if batch else "Auto Generate")

    # ── Theme application ────────────────────────────────────────────────────
    def _configure_ttk(self, t):
        st = self.style
        st.configure(".", background=t["surface"], foreground=t["text"], fieldbackground=t["surface2"],
                     bordercolor=t["border"], lightcolor=t["surface2"], darkcolor=t["surface2"],
                     troughcolor=t["track"], focuscolor=t["surface2"], font=F(10))
        st.configure("TFrame", background=t["surface"])
        st.configure("TLabel", background=t["surface"], foreground=t["text"], font=F(10))
        st.configure("TCombobox", fieldbackground=t["surface2"], background=t["surface2"],
                     foreground=t["text"], arrowcolor=t["dim"], bordercolor=t["border"],
                     lightcolor=t["surface2"], darkcolor=t["surface2"], padding=4, relief="flat",
                     selectbackground=t["surface2"], selectforeground=t["text"], arrowsize=14)
        st.map("TCombobox",
               fieldbackground=[("disabled", t["bg"]), ("readonly", t["surface2"])],
               background=[("disabled", t["bg"]), ("active", t["surface2"])],
               foreground=[("disabled", t["dim"]), ("readonly", t["text"])],
               selectbackground=[("readonly", t["surface2"])], selectforeground=[("readonly", t["text"])],
               bordercolor=[("focus", t["accent"]), ("hover", t["accent"]), ("disabled", t["border"])],
               arrowcolor=[("disabled", t["track"]), ("hover", t["accent"])],
               lightcolor=[("focus", t["accent"])], darkcolor=[("focus", t["accent"])])
        st.configure("TEntry", fieldbackground=t["surface2"], foreground=t["text"], bordercolor=t["border"],
                     lightcolor=t["surface2"], darkcolor=t["surface2"], insertcolor=t["text"], padding=5)
        st.map("TEntry", bordercolor=[("focus", t["accent"]), ("disabled", t["border"])],
               fieldbackground=[("disabled", t["bg"])], foreground=[("disabled", _blend(t["dim"], t["bg"], 0.55))],
               lightcolor=[("focus", t["accent"])], darkcolor=[("focus", t["accent"])])
        st.configure("Horizontal.TProgressbar", troughcolor=t["track"], background=t["accent"],
                     bordercolor=t["track"], lightcolor=t["accent"], darkcolor=t["accent"], thickness=6)
        st.configure("TScrollbar", background=t["track"], troughcolor=t["surface2"], bordercolor=t["surface2"],
                     arrowcolor=t["dim"], lightcolor=t["track"], darkcolor=t["track"])
        for pat in ("*TCombobox*Listbox", "*Listbox"):
            self.root.option_add(pat + ".background", t["surface2"])
            self.root.option_add(pat + ".foreground", t["text"])
            self.root.option_add(pat + ".selectBackground", t["accent"])
            self.root.option_add(pat + ".selectForeground", t["on_accent"])
            self.root.option_add(pat + ".font", F(10))

    def apply_theme(self, theme_name):
        theme_name = THEME_ALIASES.get(theme_name, theme_name)
        if theme_name not in self.themes:
            theme_name = "midnight"
        dirty_before = getattr(self, "_dirty", False)
        t = self.theme = self._theme_for(theme_name)
        self.current_theme.set(theme_name)
        self._configure_ttk(t)
        self.root.configure(bg=t["bg"])

        alive = []
        for widget, fn in self._skins:
            try:
                if not widget.winfo_exists():
                    continue
                fn(widget, t) if fn else widget.retheme(t)
                alive.append((widget, fn))
            except tk.TclError:
                continue
        self._skins = alive

        if self._open_drop is not None:
            self._open_drop.close()

        style_titlebar(self.root, t)
        self.update_color_pickers()
        self.toggle_batch_entry()
        self._render_cache = None
        self.schedule_preview()
        self._dirty = dirty_before                    # a new theme does not change the picture

    @staticmethod
    def _exists(w):
        try:
            return bool(w.winfo_exists())
        except tk.TclError:
            return False

    # ── Color Pickers ──────────────────────────────────────────────────────
    CHIP, CHIP_GAP = 24, 5

    def _build_stop_editor(self, b):
        """Color bar (row 2), one small chip per color (row 3), the editor of the selected color (row 4)
        and three buttons (row 5). The same height for 2 or 12 colors."""
        self.stop_bar = StopBar(b, self)
        self.stop_bar.grid(row=2, column=0, sticky="ew", pady=(0, 2))
        Tooltip(self.stop_bar, self, "Click the bar to add a color  |  drag a dot to move it  |  "
                                     "double-click to change it  |  right-click to delete it")
        self.chip_cv = tk.Canvas(b, height=self.CHIP + 4, highlightthickness=0, bd=0, cursor="hand2")
        self.chip_cv.grid(row=3, column=0, sticky="ew", pady=(0, 8))
        self.chip_cv.bind("<ButtonPress-1>", self._chip_click)
        self.chip_cv.bind("<Configure>", lambda e: self._draw_chips())
        self.skin(self.chip_cv, lambda w, t: (w.configure(bg=t["surface"]), self._draw_chips()))

        ed = self._frame(b)
        ed.grid(row=4, column=0, sticky="ew")
        ed.columnconfigure(2, weight=1)
        self.stop_title = self._label(ed, "Stop 1", bold=True)
        self.stop_title.grid(row=0, column=0, sticky="w", padx=(0, 10))
        self.stop_swatch = ColorSwatch(ed, self, text="", width=104, height=30,
                                       command=lambda: self.pick_color(self._sel_stop))
        self.stop_swatch.grid(row=0, column=1, sticky="w")
        Tooltip(self.stop_swatch, self, "Click to change this color")
        self._label(ed, "Opacity", color="dim").grid(row=0, column=3, padx=(8, 0))
        self._ed_opacity = tk.StringVar(value="100")
        _oc = RoundCombo(ed, self, textvariable=self._ed_opacity, values=[str(i) for i in range(0, 101, 10)], width=4,
                         justify="center", height=28)
        _oc.grid(row=0, column=4)
        Tooltip(_oc, self, "Opacity of this color (%)")
        self._label(ed, "Position", color="dim").grid(row=1, column=0, sticky="w", pady=(8, 0))
        self._ed_pos = tk.DoubleVar(value=0.0)
        PillSlider(ed, self, variable=self._ed_pos, from_=0, to=100, width=110,
                   tip="Where this color sits on the bar").grid(
            row=1, column=1, columnspan=3, sticky="ew", pady=(8, 0), padx=(4, 0))
        self.stop_pct = self._label(ed, "0%", color="dim", size=9, anchor="e", width=4)
        self.stop_pct.grid(row=1, column=4, sticky="e", pady=(8, 0))
        self._ed_pos.trace_add("write", self._on_ed_pos)
        self._ed_opacity.trace_add("write", self._on_ed_opacity)

        # blending: the color space (whole gradient) and the transition from this stop to the next one
        self._label(ed, "Blend in", color="dim").grid(row=2, column=0, sticky="w", pady=(8, 0))
        bc = self._combo(ed, self.blend_mode, BLEND_MODES, width=7, justify="center")
        bc.grid(row=2, column=1, sticky="w", pady=(8, 0))
        Tooltip(bc, self, "Color used to mix with other colors.")
        self._label(ed, "To next", color="dim").grid(row=2, column=3, padx=(8, 4), pady=(8, 0))
        self._ed_trans = tk.StringVar(value="Smooth")
        tc = self._combo(ed, self._ed_trans, TRANSITIONS, width=6, justify="center")
        tc.grid(row=2, column=4, pady=(8, 0))
        Tooltip(tc, self, "How two colors blend.")
        self._ed_trans.trace_add("write", self._on_ed_trans)
        self.blend_mode.trace_add("write", self._on_blend_mode)

        ab = self._frame(b)
        ab.grid(row=5, column=0, sticky="ew", pady=(8, 0))
        ab.columnconfigure((0, 1, 2), weight=1, uniform="stopbtn")
        for i, (text, cmd) in enumerate((("+ Add Color", self.add_color_gap), ("Spread Evenly", self.spread_stops),
                                         ("Delete Stop", lambda: self.remove_stop(self._sel_stop)))):
            RoundButton(ab, self, text=text, style="secondary", height=30, fill=True, size=9, command=cmd).grid(
                row=0, column=i, sticky="ew", padx=(0, 4) if i < 2 else (0, 0))
        self.refresh_editor()

    def _draw_chips(self):
        cv = getattr(self, "chip_cv", None)
        if cv is None:
            return
        try:
            t = self.theme
            cv.delete("all")
            cw, gap, ch = self._chip_geom()
            for i in range(self._num()):
                x = 2 + i * (cw + gap)
                sel = i == self._sel_stop
                col = self.colors[i].upper()
                edge = t["accent"] if sel else _blend(t["text"], t["surface"], 0.3)
                cv.create_image(x, 2 + (self.CHIP - ch) // 2, anchor="nw", image=_photo(
                    ("stopchip", col, sel, edge, cw, ch),
                    lambda c=col, e=edge, s=sel: _rr(cw, ch, 7, c, e, 3 if s else 1)))
        except tk.TclError:
            pass

    def _chip_geom(self):
        """(chip width, gap, chip height): one row, rectangular, as wide as the card allows."""
        n = max(1, self._num())
        try:
            W = self.chip_cv.winfo_width()
        except tk.TclError:
            W = 1
        if W < 60:
            W = 330
        gap = 4 if n > 8 else 5
        cw = max(16, min(46, (W - 4 - (n - 1) * gap) // n))
        ch = self.CHIP - 2 if cw < 30 else self.CHIP - 2          # a little lower than wide
        return cw, gap, ch

    def _chip_click(self, e):
        cw, gap, _ch = self._chip_geom()
        i = int((e.x - 2) // (cw + gap))
        if 0 <= i < self._num() and (e.x - 2) % (cw + gap) < cw:
            self.select_stop(i)

    def refresh_editor(self):
        """Show the selected stop in the editor row (color, position, opacity)."""
        if not hasattr(self, "_ed_pos"):
            return
        i = max(0, min(self._num() - 1, self._sel_stop))
        self._sel_stop = i
        self._ed_busy = True
        try:
            pos = round(self.color_positions[i] * 100, 1)
            self.stop_title.configure(text=f"Stop {i + 1}")
            self.stop_swatch.set(self.colors[i].upper())
            self._ed_pos.set(pos)
            self.stop_pct.configure(text=f"{int(round(pos))}%")
            self._ed_opacity.set(str(int(round(self.color_opacities[i] * 100))))
            self._ed_trans.set(self.stop_trans[i] if self.stop_trans[i] in TRANSITIONS else "Smooth")
        finally:
            self._ed_busy = False

    def _on_ed_trans(self, *a):
        if self._ed_busy:
            return
        v = self._ed_trans.get()
        if v in TRANSITIONS:
            self.stop_trans[self._sel_stop] = v
            self._refresh_stop_bar()
            self.schedule_preview()

    def _on_blend_mode(self, *a):
        self._refresh_stop_bar()
        self.schedule_preview()

    def stop_lut(self, n=None):
        """The color ramp of the current stops (blend mode and transitions included) as a (4096, 4) table."""
        n = self._num() if n is None else n
        order = sorted(range(n), key=lambda k: self.color_positions[k])
        return build_stop_lut(
            [self.color_positions[k] for k in order],
            [tuple(self.hex_to_rgb(self.colors[k])) + (int(round(self.color_opacities[k] * 255)),) for k in order],
            self.blend_mode.get() if self.blend_mode.get() in BLEND_MODES else "RGB",
            [self.stop_trans[k] for k in order])

    def _on_ed_pos(self, *a):
        if self._ed_busy:
            return
        v = self._safe_get(self._ed_pos, 0.0)
        self.stop_pct.configure(text=f"{int(round(v))}%")
        self._ed_src = True
        try:
            self.position_vars[self._sel_stop].set(v)
        finally:
            self._ed_src = False

    def _on_ed_opacity(self, *a):
        if self._ed_busy:
            return
        self._ed_src = True
        try:
            self.opacity_vars[self._sel_stop].set(self._ed_opacity.get())
        finally:
            self._ed_src = False

    def add_color_gap(self):
        """'+ Add color': put a new stop in the middle of the widest gap."""
        pos = sorted([0.0, 1.0] + [self.color_positions[k] for k in range(self._num())])
        gap, p = max(((b - a, (a + b) / 2) for a, b in zip(pos, pos[1:])), key=lambda g: g[0])
        self.add_stop(p)

    def schedule_preview(self, *args):
        if getattr(self, "_track_dirty", False):
            self._dirty = True
        if hasattr(self, "_preview_after_id"):
            try:
                self.root.after_cancel(self._preview_after_id)
            except (tk.TclError, ValueError):
                pass
        self._preview_after_id = self.root.after(int(self.update_delay * 1000), self.update_preview)

    def update_color_pickers(self, *args):
        try:
            num = int(self.num_colors.get())
            num = min(max(num, 2), MAX_COLORS)
        except ValueError:
            num = 2
            self.num_colors.set("2")
        self._sel_stop = min(self._sel_stop, num - 1)

        color_options = [c.upper() for c in self.colors[:num]]
        if self.contrast_combo1:
            self.contrast_combo1.configure(values=color_options)
            if self.contrast_color1.get() not in color_options:
                self.contrast_color1.set(color_options[0] if color_options else "#FFFFFF")
        if self.contrast_combo2:
            self.contrast_combo2.configure(values=color_options)
            if self.contrast_color2.get() not in color_options:
                self.contrast_color2.set(
                    color_options[1] if len(color_options) > 1
                    else (color_options[0] if color_options else "#000000"))

        if self._harmony_refresh:                          # Palette Tools > Harmony: Base Color list follows the Colors card
            try:
                self._harmony_refresh()
            except tk.TclError:
                self._harmony_refresh = None
        if self._contrast_refresh:                         # Color Contrast: text color lists follow the Colors card
            try:
                self._contrast_refresh()
            except tk.TclError:
                self._contrast_refresh = None

        self._refresh_stop_bar()
        self._draw_chips()
        self.refresh_editor()
        if self.canvas:
            self.schedule_preview()

    def pick_color(self, index):
        win = self.make_dialog(f"Choose Color {index + 1}", 380, 470)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(0, weight=1)

        current = self.colors[index].upper()
        color_var = tk.StringVar(value=current)
        self._label(body, f"Color {index + 1}", size=13, bold=True).grid(row=0, column=0, sticky="w")
        plane = ColorPlane(body, self, current, command=lambda hx: color_var.set(hx))
        plane.grid(row=1, column=0, pady=(12, 12))

        row = self._frame(body)
        row.grid(row=2, column=0, sticky="ew")
        row.columnconfigure(1, weight=1)
        old = ColorSwatch(row, self, text=current, width=96, height=34)
        old.set(current, "Current")
        old.grid(row=0, column=0, padx=(0, 10))
        hex_entry = self._entry(row, color_var, width=10)
        hex_entry.grid(row=0, column=1, sticky="ew", padx=(0, 10))
        new = ColorSwatch(row, self, text=current, width=96, height=34)
        new.set(current, "New")
        new.grid(row=0, column=2)

        quick = self._frame(body)
        quick.grid(row=3, column=0, sticky="w", pady=(14, 0))
        for i, hx in enumerate(("#FF5C5C", "#FF9F43", "#FFD166", "#4ADE80", "#2DD4BF", "#3B9CFF",
                                "#7C5CFF", "#C471ED", "#FF5C9A", "#FFFFFF", "#8A8FA3", "#111118")):
            sw = ColorSwatch(quick, self, text=hx, width=24, height=24, command=lambda h=hx: color_var.set(h))
            sw.set(hx, "")
            sw.grid(row=0, column=i, padx=(0, 5))

        btns = self._frame(body)
        btns.grid(row=4, column=0, sticky="ew", pady=(18, 0))
        btns.columnconfigure((0, 1), weight=1, uniform="b")

        def confirm():
            hex_color = color_var.get().upper()
            if self.is_valid_hex_color(hex_color):
                self.colors[index] = hex_color
                self.update_color_pickers()
                win.destroy()
            else:
                messagebox.showerror("Error", "Invalid hex color code. Use format #RRGGBB (e.g., #FFFFFF).")

        RoundButton(btns, self, text="Cancel", style="secondary", height=36, fill=True,
                    command=win.destroy).grid(row=0, column=0, sticky="ew", padx=(0, 5))
        ok_button = RoundButton(btns, self, text="OK", style="primary", height=36, fill=True, command=confirm)
        ok_button.grid(row=0, column=1, sticky="ew", padx=(5, 0))

        def on_change(*args):
            hx = color_var.get().upper()
            if self.is_valid_hex_color(hx):
                new.set(hx, "New")
                if hx != plane.hex():
                    plane.set_hex(hx)
                hex_entry.configure(foreground=self.theme["text"])
                ok_button.configure(state="normal")
            else:
                hex_entry.configure(foreground=self.theme["bad"])
                ok_button.configure(state="disabled")

        color_var.trace_add("write", on_change)
        hex_entry.focus_set()
        hex_entry.bind("<Return>", lambda e: confirm())

    # ── Resolution ──────────────────────────────────────────────────────────
    def update_resolution(self, *args):
        if self._res_updating:
            return
        if self.size_preset.get() != "Custom Size":
            self.size_preset.set("Custom Size")
        ratio = self.aspect_ratio.get()
        if ratio != "Custom":
            try:
                width = int(self.width.get())
                if width > 0:
                    w, h = map(int, ratio.split(":"))
                    self._res_updating = True
                    self.height.set(max(1, int(round(width * h / w))))
            except (ValueError, tk.TclError):
                pass          # field is empty while typing - ignore
            finally:
                self._res_updating = False
        self.schedule_preview()

    def on_height_edited(self, *args):
        if self._res_updating:
            return
        if self.size_preset.get() != "Custom Size":
            self.size_preset.set("Custom Size")
        if self.aspect_ratio.get() != "Custom":
            self._res_updating = True
            try:
                self.aspect_ratio.set("Custom")
            finally:
                self._res_updating = False
        self.schedule_preview()

    # ── Color helpers ─────────────────────────────────────────────────────
    @staticmethod
    def rgb_float_to_hex(rgb):
        r, g, b = (max(0, min(255, int(round(c * 255)))) for c in rgb)
        return f"#{r:02X}{g:02X}{b:02X}"

    def hex_to_rgb(self, hex_color):
        try:
            hex_color = hex_color.lstrip("#")
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        except Exception:
            return (255, 255, 255)

    def get_contrast_color(self, hex_color):
        try:
            r, g, b = self.hex_to_rgb(hex_color)
            brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255
            return "#EEEEEE" if brightness < 0.5 else "#333333"
        except Exception:
            return "#333333"

    def calculate_wcag_contrast(self, hex_color1, hex_color2):
        if not hasattr(self, "_contrast_cache"):
            self._contrast_cache = {}

        key = (hex_color1, hex_color2)
        if key in self._contrast_cache:
            return self._contrast_cache[key]

        try:
            rgb1 = [x / 255.0 for x in self.hex_to_rgb(hex_color1)]
            rgb2 = [x / 255.0 for x in self.hex_to_rgb(hex_color2)]

            def gamma_correct(c):
                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

            rgb1 = [gamma_correct(c) for c in rgb1]
            rgb2 = [gamma_correct(c) for c in rgb2]

            L1 = 0.2126 * rgb1[0] + 0.7152 * rgb1[1] + 0.0722 * rgb1[2]
            L2 = 0.2126 * rgb2[0] + 0.7152 * rgb2[1] + 0.0722 * rgb2[2]

            if L1 < L2:
                L1, L2 = L2, L1

            contrast_ratio = round((L1 + 0.05) / (L2 + 0.05), 2)
            self._contrast_cache[key] = contrast_ratio
            return contrast_ratio

        except Exception:
            return 1.0

    def suggest_contrast_color(self, hex_color, target_ratio=4.5):
        try:
            rgb = [x / 255.0 for x in self.hex_to_rgb(hex_color)]
            h, l, s = rgb_to_hls(*rgb)
            rgb_gamma = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
            input_luminance = 0.2126 * rgb_gamma[0] + 0.7152 * rgb_gamma[1] + 0.0722 * rgb_gamma[2]

            luminance_steps = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
            for new_l in luminance_steps:
                new_rgb = hls_to_rgb(h, new_l, s)
                new_hex = self.rgb_float_to_hex(new_rgb)
                if new_hex.upper() == hex_color.upper():
                    continue
                if self.calculate_wcag_contrast(hex_color, new_hex) >= target_ratio:
                    return new_hex

            new_h = (h + 0.5) % 1.0
            for new_l in luminance_steps:
                new_rgb = hls_to_rgb(new_h, new_l, s)
                new_hex = self.rgb_float_to_hex(new_rgb)
                if new_hex.upper() == hex_color.upper():
                    continue
                if self.calculate_wcag_contrast(hex_color, new_hex) >= target_ratio:
                    return new_hex

            return "#000000" if input_luminance > 0.5 else "#FFFFFF"
        except Exception:
            rgb = [x / 255.0 for x in self.hex_to_rgb(hex_color)]
            rgb_gamma = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
            lum = 0.2126 * rgb_gamma[0] + 0.7152 * rgb_gamma[1] + 0.0722 * rgb_gamma[2]
            return "#000000" if lum > 0.5 else "#FFFFFF"

    # ── Color contrast: WCAG levels, pick / swap colors, live text preview, fix suggestions ──
    def _norm_hex(self, text):
        """'abc', '#aabbcc' -> '#AABBCC'; None when it is not a color."""
        s = str(text).strip().lstrip("#")
        if re.fullmatch(r"[0-9A-Fa-f]{3}", s):
            s = "".join(ch * 2 for ch in s)
        return "#" + s.upper() if re.fullmatch(r"[0-9A-Fa-f]{6}", s) else None

    def _lum(self, hex_color):
        def lin(c):
            c /= 255.0
            return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
        r, g, b = self.hex_to_rgb(hex_color)
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

    def _ratio(self, a, b):
        """Exact WCAG ratio (not rounded, so 4.496 never passes as 4.5)."""
        la, lb = self._lum(a), self._lum(b)
        hi, lo = max(la, lb), min(la, lb)
        return (hi + 0.05) / (lo + 0.05)

    def _fix_contrast(self, change, other, target):
        """Closest lightness change of `change` (same hue and saturation) that reaches `target` against `other`."""
        h, l, s = rgb_to_hls(*(c / 255.0 for c in self.hex_to_rgb(change)))
        best = None
        for k in range(0, 201):
            for sign in (1, -1):
                nl = l + sign * k * 0.005
                if not 0.0 <= nl <= 1.0:
                    continue
                cand = self.rgb_float_to_hex(hls_to_rgb(h, nl, s))
                if self._ratio(cand, other) >= target:
                    return cand
        for cand in ("#000000", "#FFFFFF"):
            if self._ratio(cand, other) >= target:
                best = cand
                break
        return best

    def show_contrast_comparison(self):
        win = self.make_dialog("Color Contrast", 470, 640)
        outer = self._frame(win)
        outer.pack(fill="both", expand=True, padx=22, pady=18)
        outer.columnconfigure(0, weight=1)
        t = self.theme
        num = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        palette = [c.upper() for c in self.colors[:num]]
        v1 = tk.StringVar(value=self._norm_hex(self.contrast_color1.get()) or palette[0])
        v2 = tk.StringVar(value=self._norm_hex(self.contrast_color2.get()) or palette[-1])
        note = tk.StringVar(value="")
        chip_draws = []                                  # redraw functions of every color-chip strip

        self._label(outer, "Color contrast", size=13, bold=True).grid(row=0, column=0, sticky="w")
        tab_var = tk.StringVar(value="Pair")
        Segmented(outer, self, ["Pair", "Palette", "On Picture"], tab_var, seg_width=110, height=34).grid(
            row=1, column=0, sticky="w", pady=(10, 0))
        stack = self._frame(outer)
        stack.grid(row=2, column=0, sticky="nsew", pady=(12, 0))
        stack.columnconfigure(0, weight=1)
        outer.rowconfigure(2, weight=1)
        pages = {}
        for name in ("Pair", "Palette", "On Picture"):
            pg = self._frame(stack)
            pg.grid(row=0, column=0, sticky="nsew")
            pg.columnconfigure(0, weight=1)
            pages[name] = pg
        self._label(outer, textvariable=note, color="dim", size=9, wraplength=420, justify="left").grid(
            row=3, column=0, sticky="w", pady=(8, 0))
        RoundButton(outer, self, text="Close", style="primary", height=36, fill=True,
                    command=win.destroy).grid(row=4, column=0, sticky="ew", pady=(10, 0))

        def set_palette(cols):
            """Write `cols` into the Colors card (positions, opacities and the rest stay) and refresh this window."""
            p = self.get_current_settings()
            p["colors"] = [c.upper() for c in cols] + [c for c in self.colors[len(cols):MAX_COLORS]]
            self.apply_preset(p)
            palette[:] = [c.upper() for c in self.colors[:num]]
            for d in chip_draws:
                d()
            refresh_pal()

        # ═══ Pair: two colors, ratio, WCAG levels, preview, fix suggestions ═══
        body = pages["Pair"]
        pk = self._frame(body)
        pk.grid(row=0, column=0, sticky="ew")
        pk.columnconfigure((0, 2), weight=1, uniform="pk")
        swatches = []
        CHIP, CGAP = 22, 4

        def make_picker(col, var, title):
            f = self._frame(pk)
            f.grid(row=0, column=col, sticky="ew")
            f.columnconfigure(1, weight=1)
            self._label(f, title, color="dim", size=9).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 4))
            sw = ColorSwatch(f, self, text="", width=34, height=30)
            sw.grid(row=1, column=0, padx=(0, 6))
            swatches.append(sw)

            def choose():
                got = colorchooser.askcolor(color=self._norm_hex(var.get()) or "#FFFFFF", parent=win)
                if got and got[1]:
                    var.set(got[1].upper())
            sw.command = choose
            self._entry(f, var, width=8).grid(row=1, column=1, sticky="ew")
            # the palette as color chips (6 per row): click one to use that color
            rows_n = max(1, -(-len(palette) // 6))
            cv = tk.Canvas(f, width=6 * (CHIP + CGAP) - CGAP, height=rows_n * (CHIP + CGAP) - CGAP, bd=0,
                           highlightthickness=0, cursor="hand2")
            cv.grid(row=2, column=0, columnspan=2, sticky="w", pady=(8, 0))

            def draw(*_):
                cv.delete("all")
                cur = self._norm_hex(var.get())
                for i, c in enumerate(palette):
                    x, y = (i % 6) * (CHIP + CGAP), (i // 6) * (CHIP + CGAP)
                    sel = cur == c
                    edge = t["accent"] if sel else _blend(t["text"], t["surface"], 0.3)
                    cv.create_image(x, y, anchor="nw", image=_photo(
                        ("cchip", c, sel, edge), lambda c=c, e=edge, s=sel: _rr(CHIP, CHIP, 7, c, e, 3 if s else 1)))

            def click(e):
                k, r = e.x // (CHIP + CGAP), e.y // (CHIP + CGAP)
                if k > 5 or e.x % (CHIP + CGAP) >= CHIP or e.y % (CHIP + CGAP) >= CHIP:
                    return
                i = r * 6 + k
                if 0 <= i < len(palette):
                    var.set(palette[i])
            cv.bind("<ButtonPress-1>", click)
            self.skin(cv, lambda w, th: (w.configure(bg=th["surface"]), draw()))
            var.trace_add("write", draw)
            chip_draws.append(draw)

        make_picker(0, v1, "Color 1")
        make_picker(2, v2, "Color 2")

        def swap():
            a, b = v1.get(), v2.get()
            v1.set(b)
            v2.set(a)
        RoundButton(pk, self, text="↔", style="secondary", height=30, width=40, command=swap).grid(
            row=0, column=1, padx=10, pady=(20, 0))

        ratio_var, rows = tk.StringVar(value=""), []
        self._label(body, textvariable=ratio_var, size=26, bold=True).grid(row=2, column=0, sticky="w", pady=(14, 4))
        lv = self._frame(body)
        lv.grid(row=3, column=0, sticky="ew")
        lv.columnconfigure(1, weight=1)
        levels = (("Normal text  AA", 4.5), ("Normal text  AAA", 7.0), ("Large text  AA", 3.0),
                  ("Large text  AAA", 4.5), ("UI components  AA", 3.0))
        for i, (name, need) in enumerate(levels):
            self._label(lv, f"{name}  (≥ {need:g}:1)", color="dim", size=9).grid(row=i, column=0, sticky="w")
            res = tk.Label(lv, text="", bd=0, font=F(9, True), anchor="e", bg=t["surface"])
            res.grid(row=i, column=1, sticky="e")
            rows.append((res, need))

        self._label(body, "PREVIEW", color="dim", size=8, bold=True).grid(row=4, column=0, sticky="w", pady=(14, 6))
        text_var, size_var = tk.StringVar(value="The quick brown fox"), tk.StringVar(value="Normal")
        pr = self._frame(body)
        pr.grid(row=5, column=0, sticky="ew")
        pr.columnconfigure(0, weight=1)
        self._entry(pr, text_var, width=16, justify="left").grid(row=0, column=0, sticky="ew", padx=(0, 8))
        Segmented(pr, self, ["Normal", "Large", "Bold"], size_var, seg_width=62, height=32).grid(row=0, column=1)
        prev = self._frame(body)
        prev.grid(row=6, column=0, sticky="ew", pady=(8, 0))
        prev.columnconfigure((0, 1), weight=1, uniform="pv")
        labs = []
        for col in range(2):
            lab = tk.Label(prev, text="", bd=0, pady=14, wraplength=190)
            lab.grid(row=0, column=col, sticky="ew", padx=(0, 5) if col == 0 else (5, 0))
            labs.append(lab)

        self._label(body, "FIX SUGGESTIONS", color="dim", size=8, bold=True).grid(row=7, column=0, sticky="w", pady=(14, 6))
        fixf = self._frame(body)
        fixf.grid(row=8, column=0, sticky="ew")
        fixf.columnconfigure(1, weight=1)

        def apply_fix(which, new):
            var = v1 if which == 1 else v2
            old = var.get()
            var.set(new)
            if old in palette:                               # the color belongs to the palette: change it there too
                i = palette.index(old)
                set_palette([new if k == i else c for k, c in enumerate(palette)])
                note.set(f"Color {i + 1} in the palette is now {new}.")
            else:
                note.set("Changed in this window only (that color is not in the palette).")

        def render(*_):
            a, b = self._norm_hex(v1.get()), self._norm_hex(v2.get())
            for w in fixf.winfo_children():
                w.destroy()
            if not a or not b:
                ratio_var.set("—")
                for res, _n in rows:
                    res.configure(text="", fg=t["dim"])
                self._label(fixf, "Type two valid hex colors (like #1A2B3C).", color="dim", size=9).grid(
                    row=0, column=0, columnspan=3, sticky="w")
                return
            for sw, v in zip(swatches, (a, b)):
                sw.set(v, "")
            r = self._ratio(a, b)
            ratio_var.set(f"{int(r * 100) / 100:.2f}:1")
            for res, need in rows:
                ok = r >= need
                res.configure(text="Pass" if ok else "Fail", fg=t["ok"] if ok else t["bad"])
            fs, bold = {"Normal": (11, False), "Large": (18, False), "Bold": (11, True)}[size_var.get()]
            txt = text_var.get() or " "
            labs[0].configure(text=txt, bg=a, fg=b, font=F(fs, bold))
            labs[1].configure(text=txt, bg=b, fg=a, font=F(fs, bold))
            row = 0
            for tgt, name in ((4.5, "AA"), (7.0, "AAA")):
                if r >= tgt:
                    continue
                for which, (chg, oth) in ((1, (a, b)), (2, (b, a))):
                    sug = self._fix_contrast(chg, oth, tgt)
                    if not sug:
                        continue
                    sw = ColorSwatch(fixf, self, text=sug, width=84, height=30)
                    sw.set(sug)
                    sw.grid(row=row, column=0, padx=(0, 10), pady=2)
                    self._label(fixf, f"Color {which} for {name}  ({self._ratio(sug, oth):.2f}:1)", size=9).grid(
                        row=row, column=1, sticky="w")
                    RoundButton(fixf, self, text="Apply", style="secondary", height=28, width=70, size=9,
                                command=lambda w=which, s=sug: apply_fix(w, s)).grid(row=row, column=2, pady=2)
                    row += 1
            if row == 0:
                self._label(fixf, "Normal text already passes AAA. Nothing to fix.", color="ok", size=9).grid(
                    row=0, column=0, columnspan=3, sticky="w")

        for var in (v1, v2, text_var, size_var):
            var.trace_add("write", render)

        # ═══ Palette: the best text color on every palette color, and a Fix palette button ═══
        pp = pages["Palette"]
        self._label(pp, "Check text color on each color from your palette. Red outline = fails the level.",
                    color="dim", size=9, wraplength=420, justify="left").grid(row=0, column=0, sticky="w")
        ctl = self._frame(pp)
        ctl.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        txt_modes = ["Best of Black / White", "White", "Black"] + list(dict.fromkeys(palette))
        levels_p = {"Large Text AA  (3:1)": 3.0, "Normal Text AA  (4.5:1)": 4.5, "Normal Text AAA  (7:1)": 7.0}
        tm = tk.StringVar(value=txt_modes[0])
        lvl = tk.StringVar(value="Normal Text AA  (4.5:1)")
        self._label(ctl, "Text Color", color="dim").grid(row=0, column=0, sticky="w", padx=(0, 10))
        tm_combo = self._combo(ctl, tm, txt_modes, width=19)
        tm_combo.swatches = True                               # color chip before each color
        tm_combo.grid(row=0, column=1, sticky="w")
        self._label(ctl, "Level", color="dim").grid(row=1, column=0, sticky="w", padx=(0, 10), pady=(8, 0))
        self._combo(ctl, lvl, list(levels_p), width=22).grid(row=1, column=1, sticky="w", pady=(8, 0))
        TW, TH, TG = 66, 48, 6
        trows = max(1, -(-len(palette) // 6))
        tiles = tk.Canvas(pp, width=6 * (TW + TG) - TG, height=trows * (TH + TG) - TG, bd=0, highlightthickness=0)
        self.skin(tiles, lambda w, th: w.configure(bg=th["surface"]))
        tiles.grid(row=2, column=0, sticky="w", pady=(14, 0))
        status = tk.StringVar(value="")
        self._label(pp, textvariable=status, size=10, bold=True).grid(row=3, column=0, sticky="w", pady=(10, 0))
        fix_hist = []

        def text_for(c):
            m = tm.get()
            if m == "White":
                return "#FFFFFF"
            if m == "Black":
                return "#000000"
            if m.startswith("#"):                          # one of the Colors card colors
                return self._norm_hex(m) or "#FFFFFF"
            return "#FFFFFF" if self._ratio(c, "#FFFFFF") >= self._ratio(c, "#000000") else "#000000"

        def refresh_pal(*_):
            need = levels_p.get(lvl.get(), 4.5)
            tiles.delete("all")
            bad = 0
            for i, c in enumerate(palette):
                tx = text_for(c)
                r = self._ratio(c, tx)
                ok = r >= need
                bad += 0 if ok else 1
                x, y = (i % 6) * (TW + TG), (i // 6) * (TH + TG)
                edge = _blend(t["text"], t["surface"], 0.25) if ok else t["bad"]
                tiles.create_image(x, y, anchor="nw", image=_photo(
                    ("ptile", c, edge, ok), lambda c=c, e=edge, o=ok: _rr(TW, TH, 10, c, e, 1 if o else 3)))
                tiles.create_text(x + TW / 2, y + 17, text="Aa", fill=tx, font=F(13, True))
                tiles.create_text(x + TW / 2, y + TH - 12, text=f"{r:.1f}:1", fill=tx, font=F(8, True))
            status.set("Every color passes." if not bad else f"{len(palette) - bad} of {len(palette)} pass, {bad} fail.")

        def fix_palette():
            need = levels_p.get(lvl.get(), 4.5)
            new, changed = list(palette), 0
            for i, c in enumerate(palette):
                tx = text_for(c)
                if c == tx or self._ratio(c, tx) >= need:
                    continue
                fixed = self._fix_contrast(c, tx, need)       # same hue and saturation, only the lightness moves
                if fixed and fixed.upper() != c:
                    new[i] = fixed.upper()
                    changed += 1
            if not changed:
                note.set("Nothing to fix: every color already passes.")
                return
            fix_hist.append(list(palette))
            set_palette(new)
            note.set(f"Adjusted {changed} color{'s' if changed != 1 else ''} in the Colors card. Undo fix goes back.")

        def undo_fix():
            if not fix_hist:
                note.set("Nothing to undo.")
                return
            set_palette(fix_hist.pop())
            note.set("Went back to the colors before the last fix.")

        fb = self._frame(pp)
        fb.grid(row=4, column=0, sticky="ew", pady=(10, 0))
        fb.columnconfigure((0, 1), weight=1, uniform="fx")
        RoundButton(fb, self, text="Fix Palette", icon="sparkle", style="primary", height=34, fill=True,
                    command=fix_palette).grid(row=0, column=0, sticky="ew", padx=(0, 4))
        RoundButton(fb, self, text="Undo Fix", style="secondary", height=34, fill=True, command=undo_fix).grid(
            row=0, column=1, sticky="ew", padx=(4, 0))
        self._label(pp, "Fix palette changes only the lightness of the colors that fail (hue and saturation stay), "
                        "for the text color and level above.", color="dim", size=9, wraplength=420,
                    justify="left").grid(row=5, column=0, sticky="w", pady=(8, 0))
        for var in (tm, lvl, v1):
            var.trace_add("write", refresh_pal)

        # ═══ On picture: is this text color readable on the real gradient? ═══
        pc = pages["On Picture"]
        self._label(pc, "Tests a text box at five places on your current picture and reports the worst contrast "
                        "found under it.", color="dim", size=9, wraplength=420, justify="left").grid(
            row=0, column=0, sticky="w")
        pctl = self._frame(pc)
        pctl.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        pt_modes = list(dict.fromkeys(palette)) + ["White", "Black"]
        pt = tk.StringVar(value=palette[0])
        plv = tk.StringVar(value="Normal Text  (4.5:1)")
        plevels = {"Normal Text  (4.5:1)": 4.5, "Large Text  (3:1)": 3.0}
        self._label(pctl, "Text Color", color="dim").grid(row=0, column=0, sticky="w", padx=(0, 10))
        pt_combo = self._combo(pctl, pt, pt_modes, width=11)
        pt_combo.swatches = True                               # color chip before each color
        pt_combo.grid(row=0, column=1, sticky="w")
        pswatch = ColorSwatch(pctl, self, text="", width=34, height=30)
        pswatch.grid(row=0, column=2, padx=(8, 0))
        self._label(pctl, "Needs", color="dim").grid(row=1, column=0, sticky="w", padx=(0, 10), pady=(8, 0))
        self._combo(pctl, plv, list(plevels), width=18).grid(row=1, column=1, columnspan=2, sticky="w", pady=(8, 0))
        pic = {"lum": None, "photo": None, "size": None}
        pcv = tk.Canvas(pc, width=360, height=10, bd=0, highlightthickness=0)
        self.skin(pcv, lambda w, th: w.configure(bg=th["surface"]))
        pcv.grid(row=2, column=0, sticky="w", pady=(12, 0))
        presult = self._frame(pc)
        presult.grid(row=3, column=0, sticky="ew", pady=(10, 0))
        presult.columnconfigure(1, weight=1)
        prow = {}
        for i, nm in enumerate(("Top-left", "Top-right", "Center", "Bottom-left", "Bottom-right")):
            self._label(presult, nm, color="dim", size=9).grid(row=i, column=0, sticky="w")
            a = tk.Label(presult, text="", bd=0, font=F(9), anchor="e", bg=t["surface"], fg=t["text"])
            a.grid(row=i, column=1, sticky="e", padx=(0, 12))
            b = tk.Label(presult, text="", bd=0, font=F(9, True), anchor="e", width=5, bg=t["surface"])
            b.grid(row=i, column=2, sticky="e")
            prow[nm] = (a, b)

        def load_pic():
            """Render the current picture small (without the text / logo overlays) and keep its luminance."""
            if pic["lum"] is not None:
                return True
            try:
                ow, oh = max(1, int(self._safe_get(self.width, 1920))), max(1, int(self._safe_get(self.height, 1080)))
                k = min(360 / ow, 200 / oh)
                w, h = max(40, int(ow * k)), max(40, int(oh * k))
                im = self._generate_gradient_core(
                    w, h, self.gradient_type.get(), self.direction.get(), self.other_direction.get(),
                    self.effect.get(), self.secondary_effect.get(), self.intensity.get(),
                    self.secondary_intensity.get(), None).convert("RGBA")
                bgc = (0, 0, 0) if self.ov_background.get() == "Black" else (255, 255, 255)
                flat = Image.alpha_composite(Image.new("RGBA", im.size, bgc + (255,)), im).convert("RGB")
                lin = _srgb_to_lin(np.asarray(flat, dtype=np.float64))
                pic["lum"] = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
                pic["photo"] = ImageTk.PhotoImage(flat)
                pic["size"] = (w, h)
                return True
            except Exception as e:
                note.set(f"Could not render the picture: {e}")
                return False

        def refresh_pic(*_):
            if tab_var.get() != "On Picture" or not load_pic():
                return
            w, h = pic["size"]
            hexc = self._norm_hex(pt.get()) or {"White": "#FFFFFF", "Black": "#000000"}.get(pt.get(), "#FFFFFF")
            pswatch.set(hexc, "")
            need = plevels[plv.get()]
            lt = self._lum(hexc)
            L = pic["lum"]
            contrast = (np.maximum(L, lt) + 0.05) / (np.minimum(L, lt) + 0.05)
            bw, bh, m = int(w * 0.36), int(h * 0.16), int(w * 0.04)
            spots = {"Top-left": (m, m), "Top-right": (w - m - bw, m), "Center": ((w - bw) // 2, (h - bh) // 2),
                     "Bottom-left": (m, h - m - bh), "Bottom-right": (w - m - bw, h - m - bh)}
            pcv.configure(width=w, height=h)
            pcv.delete("all")
            pcv.create_image(0, 0, anchor="nw", image=pic["photo"])
            worst_all = 99.0
            for nm, (x0, y0) in spots.items():
                reg = contrast[y0:y0 + bh, x0:x0 + bw]
                worst, typ = float(reg.min()), float(np.median(reg))
                worst_all = min(worst_all, worst)
                ok = worst >= need
                col = t["ok"] if ok else t["bad"]
                pcv.create_rectangle(x0, y0, x0 + bw, y0 + bh, outline=col, width=2)
                pcv.create_text(x0 + bw / 2, y0 + bh / 2, text="Aa", fill=hexc, font=F(12, True))
                a, b = prow[nm]
                a.configure(text=f"worst {worst:.1f}:1    typical {typ:.1f}:1", fg=t["text"])
                b.configure(text="Pass" if ok else "Fail", fg=col)
            note.set("Readable everywhere we tested." if worst_all >= need else
                     f"Hard to read in some places (worst {worst_all:.1f}:1). Try another text color or a text box.")

        tab_var.trace_add("write", lambda *a: (pages[tab_var.get()].tkraise(), note.set(""), refresh_pic()))
        for var in (pt, plv, v1, v2):
            var.trace_add("write", refresh_pic)

        def colors_changed():
            """The Colors card changed while this window is open: refill the color lists and redraw."""
            nonlocal num
            num = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
            palette[:] = [c.upper() for c in self.colors[:num]]
            tm_combo.configure(values=["Best of Black / White", "White", "Black"] + list(dict.fromkeys(palette)))
            if tm.get() not in tm_combo._values:
                tm.set("Best of Black / White")
            pt_combo.configure(values=list(dict.fromkeys(palette)) + ["White", "Black"])
            if pt.get() not in pt_combo._values:
                pt.set(palette[0])
            for d in chip_draws:
                d()
            refresh_pal()
            pic["lum"] = None                              # the picture changed too
            refresh_pic()
        self._contrast_refresh = colors_changed
        win.bind("<Destroy>", lambda e: setattr(self, "_contrast_refresh", None) if e.widget is win else None, add="+")
        render()
        refresh_pal()
        pages["Pair"].tkraise()                    # the pages share one spot: show the first one right away

    # ══ size presets, export options, overlays, palette tools ═══════════
    def _on_size_preset(self, *args):
        label = self.size_preset.get()
        for name, w, h in SIZE_PRESETS:
            if name == label and w:
                self._res_updating = True
                try:
                    self.width.set(w)
                    self.height.set(h)
                    ratio = "Custom"
                    for rname, (a, b) in (("16:9", (16, 9)), ("4:3", (4, 3)), ("5:4", (5, 4)), ("1:1", (1, 1))):
                        if w * b == h * a:
                            ratio = rname
                    self.aspect_ratio.set(ratio)
                finally:
                    self._res_updating = False
                self.schedule_preview()
                return

    def _export_options(self):
        """(quality, flatten) for save_image_file, from the Output card."""
        # White / Black are already baked into the picture; Transparent is kept (JPEG flattens it onto white)
        return int(round(self._safe_get(self.export_quality, 95))), None

    # ── Overlays: text, logo, background ───────────────────────
    OV_POSITIONS = ["Top-left", "Top-center", "Top-right", "Center",
                    "Bottom-left", "Bottom-center", "Bottom-right"]

    def _build_overlay_card(self, parent):
        card, b = self._card(parent, "Overlays", icon="layers", rpad=3)        # +3 px right: this column has a scrollbar
        b.columnconfigure(1, weight=1)
        self._form_row(b, 1, "Text")
        tr = self._frame(b)
        tr.grid(row=1, column=1, sticky="ew", pady=4)
        tr.columnconfigure(1, weight=1)
        Toggle(tr, self, self.ov_text_on, tip="Add this text on top of the picture").grid(row=0, column=0, padx=(0, 8))
        self._entry(tr, self.ov_text, width=14, justify="left").grid(row=0, column=1, sticky="ew")
        self._form_row(b, 2, "Text style")
        ts = self._frame(b)
        ts.grid(row=2, column=1, sticky="ew", pady=4)
        ts.columnconfigure((0, 1), weight=1, uniform="ts")
        self._combo(ts, self.ov_text_pos, self.OV_POSITIONS, width=8).grid(row=0, column=0, sticky="ew")
        self._combo(ts, self.ov_text_color, ["Auto", "White", "Black"], width=6).grid(
            row=0, column=1, sticky="ew", padx=(6, 0))
        self._form_row(b, 3, "Text size")
        PillSlider(b, self, variable=self.ov_text_size, from_=1.5, to=20.0, tip="Text size (% of the picture width)").grid(
            row=3, column=1, sticky="ew", pady=4)
        self._form_row(b, 4, "Logo")
        lg = self._frame(b)
        lg.grid(row=4, column=1, sticky="ew", pady=4)
        lg.columnconfigure(2, weight=1)
        RoundButton(lg, self, text="Choose...", style="secondary", height=30, width=84,
                    command=self.choose_logo).grid(row=0, column=0)
        RoundButton(lg, self, text="Clear", style="secondary", height=30, width=64,
                    command=self.clear_logo).grid(row=0, column=1, padx=(6, 0))
        self._label(lg, textvariable=self.ov_logo_name, color="dim", size=9).grid(
            row=0, column=2, sticky="w", padx=(8, 0))
        self._form_row(b, 5, "Logo place")
        self._combo(b, self.ov_logo_pos, self.OV_POSITIONS, width=16).grid(row=5, column=1, sticky="ew", pady=4)
        self._form_row(b, 6, "Logo size")
        PillSlider(b, self, variable=self.ov_logo_size, from_=4.0, to=60.0, tip="Logo size (% of the picture width)").grid(
            row=6, column=1, sticky="ew", pady=4)
        self._form_row(b, 7, "Opacity")
        PillSlider(b, self, variable=self.ov_opacity, from_=10.0, to=100.0, tip="Opacity of the text and logo").grid(
            row=7, column=1, sticky="ew", pady=4)
        return card

    def choose_logo(self):
        path = filedialog.askopenfilename(
            title="Choose a logo (PNG with transparency works best)",
            filetypes=[("Images", "*.png *.jpg *.jpeg *.webp *.bmp *.gif"), ("All files", "*.*")])
        if not path:
            return
        try:
            img = Image.open(path)
            img.load()
            img = img.convert("RGBA")
            img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        except Exception as e:
            messagebox.showerror("Logo", f"Could not open this image: {e}")
            return
        self._ov_logo = img
        self._ov_logo_stamp += 1
        name = os.path.basename(path)
        self.ov_logo_name.set(name if len(name) <= 24 else name[:21] + "...")
        self.schedule_preview()

    def clear_logo(self):
        self._ov_logo = None
        self._ov_logo_stamp += 1
        self.ov_logo_name.set("No logo chosen")
        self.schedule_preview()

    def _overlay_sig(self):
        g = self._safe_get
        return (bool(g(self.ov_text_on, False)), str(g(self.ov_text, "")), self.ov_text_pos.get(),
                round(g(self.ov_text_size, 5.0), 2), self.ov_text_color.get(),
                round(g(self.ov_opacity, 90.0), 1), self.ov_logo_pos.get(), round(g(self.ov_logo_size, 18.0), 2),
                self._ov_logo_stamp, self.ov_background.get())

    @staticmethod
    def _ov_xy(W, H, w, h, pos, m):
        x = m if "left" in pos else (W - w - m if "right" in pos else (W - w) // 2)
        y = m if pos.startswith("Top") else (H - h - m if pos.startswith("Bottom") else (H - h) // 2)
        return int(x), int(y)

    @staticmethod
    def _ov_paste(img, layer, x, y):
        """alpha-composite `layer` onto `img` at (x, y), clipped to the picture."""
        W, H = img.size
        sx, sy = max(0, -x), max(0, -y)
        x, y = max(0, x), max(0, y)
        lw, lh = min(layer.width - sx, W - x), min(layer.height - sy, H - y)
        if lw > 0 and lh > 0:
            img.alpha_composite(layer.crop((sx, sy, sx + lw, sy + lh)), dest=(x, y))

    def _apply_overlays(self, image):
        """Background, logo and text on top of the finished gradient (never breaks a render)."""
        try:
            g = self._safe_get
            txt = str(g(self.ov_text, "")).strip() if g(self.ov_text_on, False) else ""
            bg = self.ov_background.get()
            if not (txt or self._ov_logo is not None or bg in ("White", "Black")):
                return image
            W, H = image.size
            margin = int(round(W * 0.035))
            op = min(1.0, max(0.05, g(self.ov_opacity, 90.0) / 100.0))
            img = image.convert("RGBA")
            if bg in ("White", "Black"):
                solid = Image.new("RGBA", img.size, (255, 255, 255, 255) if bg == "White" else (0, 0, 0, 255))
                img = Image.alpha_composite(solid, img)

            if self._ov_logo is not None:
                lw = max(4, int(round(W * g(self.ov_logo_size, 18.0) / 100.0)))
                lh = max(1, int(round(self._ov_logo.height * lw / self._ov_logo.width)))
                logo = self._ov_logo.resize((lw, lh), Image.Resampling.LANCZOS)
                if op < 1.0:
                    logo.putalpha(logo.getchannel("A").point(lambda v: int(v * op)))
                x, y = self._ov_xy(W, H, lw, lh, self.ov_logo_pos.get(), margin)
                self._ov_paste(img, logo, x, y)

            if txt:
                size = max(8, int(round(W * g(self.ov_text_size, 5.0) / 100.0)))
                font = get_pil_font(size)
                l, t, r, b = ImageDraw.Draw(img).multiline_textbbox((0, 0), txt, font=font, align="center")
                tw, th = int(math.ceil(r - l)), int(math.ceil(b - t))
                x, y = self._ov_xy(W, H, tw, th, self.ov_text_pos.get(), margin)
                mode = self.ov_text_color.get()
                if mode == "White":
                    col = (255, 255, 255)
                elif mode == "Black":
                    col = (20, 20, 26)
                else:                                   # Auto: dark text on light areas, white on dark areas
                    box = (max(0, x), max(0, y), min(W, x + tw), min(H, y + th))
                    area = img.crop(box) if box[2] > box[0] and box[3] > box[1] else img
                    avg = area.convert("RGB").resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
                    col = (20, 20, 26) if (avg[0] * 0.299 + avg[1] * 0.587 + avg[2] * 0.114) > 150 else (255, 255, 255)
                pad = max(2, size // 4)
                layer = Image.new("RGBA", (tw + 2 * pad, th + 2 * pad), (0, 0, 0, 0))
                ImageDraw.Draw(layer).multiline_text((pad - l, pad - t), txt, font=font,
                                                     fill=col + (int(255 * op),), align="center")
                self._ov_paste(img, layer, x - pad, y - pad)

            return img
        except Exception as e:
            print(f"Warning: overlays skipped: {e}")
            return image

    # ── Copy as code (CSS / SVG) ──────────────────────────────────────────
    @staticmethod
    def _code_rgba(c, o):
        if o >= 0.995:
            return c
        r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
        return f"rgba({r}, {g}, {b}, {o:.2f})"

    def _code_pairs(self):
        """Stops for CSS / SVG. With the plain RGB blend and Smooth transitions these are the real stops;
        otherwise the ramp is sampled (about 33 points plus both sides of every stop) so the code matches."""
        n = self._num()
        if self.blend_mode.get() == "RGB" and all(t == "Smooth" for t in self.stop_trans[:n]):
            return self._palette_pairs()
        lut = self.stop_lut(n)
        rev = self.reverse_colors.get()
        if rev:
            lut = lut[::-1]
        xs = {round(k / 32, 4) for k in range(33)}
        for k in range(n):
            p = (1 - self.color_positions[k]) if rev else self.color_positions[k]
            for d in (-0.0005, 0.0, 0.0005):
                xs.add(round(min(max(p + d, 0.0), 1.0), 4))
        out = []
        for x in sorted(xs):
            c = lut[int(round(x * (len(lut) - 1)))]
            out.append((x, "#%02X%02X%02X" % (int(c[0]), int(c[1]), int(c[2])), float(c[3]) / 255.0))
        return out

    def gradient_code(self, kind):
        """(text, note) - this gradient as CSS or SVG. Linear, Radial and Conical are exact; the other types
        have no CSS / SVG form, so a linear version of the same colors is given and the note says so."""
        pairs = self._code_pairs()                                      # [(0-1 position, '#HEX', 0-1 opacity)]
        W = max(int(self._safe_get(self.width, 1920)), 1)
        H = max(int(self._safe_get(self.height, 1080)), 1)
        gtype = self.gradient_type.get()
        try:
            deg = float(self.direction.get().replace("°", ""))
        except ValueError:
            deg = 0.0
        exact = gtype in ("Linear", "Radial") or (gtype == "Conical" and kind == "css")
        shape = gtype if exact else "Linear"
        bg = {"White": "#FFFFFF", "Black": "#000000"}.get(self.ov_background.get())
        # the app's linear gradient runs along (cos, sin) in picture-relative coordinates, so in pixels the
        # direction is (cos / W, sin / H); CSS then spans corner to corner exactly like the app does
        vx, vy = math.cos(math.radians(deg)) / W, math.sin(math.radians(deg)) / H
        css_angle = math.degrees(math.atan2(vx, -vy)) % 360
        cx, cy = self.get_center(W, H, self.other_direction.get())
        if kind == "css":
            stops = ", ".join(f"{self._code_rgba(c, o)} {round(p * 100, 2):g}%" for p, c, o in pairs)
            if shape == "Radial":
                grad = f"radial-gradient(circle farthest-corner at {cx / W * 100:.1f}% {cy / H * 100:.1f}%, {stops})"
            elif shape == "Conical":
                grad = f"conic-gradient(from {(270 - deg) % 360:.1f}deg at {cx / W * 100:.1f}% {cy / H * 100:.1f}%, {stops})"
            else:
                grad = f"linear-gradient({css_angle:.1f}deg, {stops})"
            text = f"background: {grad}{', ' + bg if bg else ''};"
        else:
            if shape == "Radial":
                r = math.hypot(max(cx, W - cx), max(cy, H - cy))
                head = (f'<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="{cx:.1f}" cy="{cy:.1f}" '
                        f'r="{r:.1f}">')
                tail = "</radialGradient>"
            else:
                ux, uy = math.sin(math.radians(css_angle)), -math.cos(math.radians(css_angle))
                half = (W * abs(ux) + H * abs(uy)) / 2
                head = (f'<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="{W / 2 - ux * half:.1f}" '
                        f'y1="{H / 2 - uy * half:.1f}" x2="{W / 2 + ux * half:.1f}" y2="{H / 2 + uy * half:.1f}">')
                tail = "</linearGradient>"
            stop_lines = "".join(
                f'      <stop offset="{p:.4f}" stop-color="{c}"' + ("" if o >= 0.995 else f' stop-opacity="{o:.2f}"') + "/>\n"
                for p, c, o in pairs)
            text = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
                    f"  <defs>\n    {head}\n{stop_lines}    {tail}\n  </defs>\n"
                    + (f'  <rect width="{W}" height="{H}" fill="{bg}"/>\n' if bg else "")
                    + f'  <rect width="{W}" height="{H}" fill="url(#g)"/>\n</svg>')
        if not exact:
            note = f"{gtype} has no {kind.upper()} form: copied a linear version of the same colors"
        elif self.effect.get() != "None" or self.secondary_effect.get() != "None":
            note = "effects and overlays are not part of the code"
        else:
            note = ""
        return text, note

    def copy_gradient_code(self, kind):
        try:
            text, note = self.gradient_code(kind)
            self.root.clipboard_clear()
            self.root.clipboard_append(text)
            self.root.update()
            msg = f"Copied as {kind.upper()}" + (f"  ({note})" if note else "")
        except Exception as e:
            msg = f"Could not copy the code: {e}"
        self.status_var.set(msg)
        self.root.after(5000, lambda: self.status_var.set("Ready") if self.status_var.get() == msg else None)

    def _sc_copy_css(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.copy_gradient_code("css")
            return "break"

    # ── Guides: thirds, golden ratio, safe area and social crops (preview only, never saved) ──
    GUIDE_OPTS = ["Off", "Thirds", "Golden Ratio", "Centre Cross", "Safe Area (90%)",
                  "Crop 1:1", "Crop 4:5", "Crop 9:16", "Crop 16:9"]

    def _draw_guides(self):
        c = self.canvas
        c.delete("guides")
        mode = self.guides.get()
        if mode == "Off" or getattr(self, "photo", None) is None or not getattr(self, "_display_size", None):
            return
        if self._safe_get(self.zoom_level, 1.0) > 1.001:                # guides belong to the whole picture
            return
        dw, dh = self._display_size
        x0, y0 = (c.winfo_width() - dw) // 2, (c.winfo_height() - dh) // 2
        x1, y1 = x0 + dw, y0 + dh
        lines, rects, label = [], [], None
        if mode in ("Thirds", "Golden ratio"):
            f = (1 / 3, 2 / 3) if mode == "Thirds" else (0.382, 0.618)
            for k in f:
                lines.append((x0 + dw * k, y0, x0 + dw * k, y1))
                lines.append((x0, y0 + dh * k, x1, y0 + dh * k))
        elif mode == "Centre cross":
            lines += [((x0 + x1) / 2, y0, (x0 + x1) / 2, y1), (x0, (y0 + y1) / 2, x1, (y0 + y1) / 2)]
        elif mode.startswith("Safe"):
            rects.append((x0 + dw * 0.05, y0 + dh * 0.05, x1 - dw * 0.05, y1 - dh * 0.05))
        elif mode.startswith("Crop"):
            a, b = (int(v) for v in mode.split()[1].split(":"))
            ratio = a / b
            cw, ch = (dh * ratio, dh) if dw / dh > ratio else (dw, dw / ratio)
            rx0, ry0 = (x0 + x1 - cw) / 2, (y0 + y1 - ch) / 2
            rects.append((rx0, ry0, rx0 + cw, ry0 + ch))
            label = (rx0 + 8, ry0 + 6, mode.split()[1])
        for ln in lines:
            c.create_line(*ln, fill="#000000", width=3, stipple="gray50", tags="guides")
            c.create_line(*ln, fill="#FFFFFF", width=1, dash=(5, 4), tags="guides")
        for rc in rects:
            c.create_rectangle(*rc, outline="#000000", width=3, stipple="gray50", tags="guides")
            c.create_rectangle(*rc, outline="#FFFFFF", width=1, dash=(5, 4), tags="guides")
        if label:
            c.create_text(label[0] + 1, label[1] + 1, text=label[2], anchor="nw", fill="#000000", tags="guides")
            c.create_text(label[0], label[1], text=label[2], anchor="nw", fill="#FFFFFF", tags="guides")
        c.tag_raise("guides")

    def _sc_guides(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            i = self.GUIDE_OPTS.index(self.guides.get()) if self.guides.get() in self.GUIDE_OPTS else 0
            self.guides.set(self.GUIDE_OPTS[(i + 1) % len(self.GUIDE_OPTS)])
            self.status_var.set(f"Guides: {self.guides.get()}")
            return "break"

    # ── Palette tools: extract, copy as code, save / load ───────────────────
    def _palette_pairs(self):
        """[(position 0-1, '#HEX', opacity 0-1)] exactly as rendered (Reverse applied), sorted by position."""
        st = self._live_render_state()
        cols = [c.upper() for c in st["colors"]]
        pos = list(st["positions"])
        ops = [o / 255.0 for o in st["opacities"]]
        if st["reverse"]:
            cols.reverse()
            ops.reverse()
            pos = [1 - p for p in reversed(pos)]
        return sorted(zip(pos, cols, ops), key=lambda p: p[0])

    def palette_text(self, kind):
        pairs = self._palette_pairs()

        def css_color(c, o):
            if o >= 0.995:
                return c
            r, g, b = self.hex_to_rgb(c)
            return f"rgba({r}, {g}, {b}, {o:.2f})"

        if kind == "hex":
            return "\n".join(c for _, c, _ in pairs)
        if kind == "json":
            return json.dumps({"colors": [c for _, c, _ in pairs],
                               "positions": [round(p, 3) for p, _, _ in pairs],
                               "opacity": [round(o, 2) for _, _, o in pairs]}, indent=2)
        if kind == "css_vars":
            return ":root {\n" + "".join(f"  --gradient-{i + 1}: {c};\n" for i, (_, c, _) in enumerate(pairs)) + "}"
        try:
            deg = float(self.direction.get().replace("\u00b0", ""))
        except ValueError:
            deg = 0.0
        stops = ", ".join(f"{css_color(c, o)} {round(p * 100, 1):g}%" for p, c, o in self._code_pairs())
        return f"background: linear-gradient({(deg + 90) % 360:g}deg, {stops});"

    def load_palettes(self):
        try:
            with open(PALETTES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return []
        out = []
        for p in data if isinstance(data, list) else []:
            try:
                cols = [str(c).upper() for c in p.get("colors", []) if self.is_valid_hex_color(str(c).upper())][:MAX_COLORS]
                name = str(p.get("name", "")).strip()[:40]
            except AttributeError:
                continue
            if len(cols) >= 2 and name:
                out.append({"name": name, "colors": cols})
        return out

    def save_palettes(self, items):
        try:
            with open(PALETTES_PATH, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=1)
            return True
        except OSError as e:
            messagebox.showerror("Palettes", f"Could not save your palettes: {e}")
            return False

    def _apply_palette_colors(self, colors):
        """Use `colors` (2 up to MAX_COLORS hex values) as the current palette; stops are spread evenly."""
        cols = [c.upper() for c in colors if self.is_valid_hex_color(c.upper())][:MAX_COLORS]
        if len(cols) < 2:
            return
        p = self.get_current_settings()
        p["num_colors"] = str(len(cols))
        p["colors"] = cols + [c for c in self.colors[len(cols):MAX_COLORS]]
        p.pop("color_positions", None)
        self.apply_preset(p)

    PICK_MODES = ["Dominant", "Vivid", "Muted / pastel", "Most different", "Light to dark", "Warm only", "Cool only"]

    def _extract_image_colors(self, path, n, mode="Dominant"):
        """About `n` colors of an image, chosen by `mode` (nothing is applied). Dominant = the most common colors;
        Vivid = the most saturated; Muted / pastel = soft light colors; Most different = a varied set;
        Light to dark = even steps of brightness; Warm only / Cool only = just those hues."""
        im = Image.open(path)
        im.load()
        im = im.convert("RGB")
        im.thumbnail((240, 240))
        if mode == "Dominant":
            q = im.quantize(colors=n, method=0)                      # 0 = median cut
            pal = q.getpalette()
            cols = []
            for _, i in sorted(q.getcolors(), reverse=True):
                c = "#%02X%02X%02X" % tuple(pal[i * 3:i * 3 + 3])
                if c not in cols:
                    cols.append(c)
            if len(cols) < 2:
                raise ValueError("this image has fewer than two different colors")
            return cols

        # a finer palette (up to 64 colors) with how common each one is, then pick from it by `mode`
        q = im.quantize(colors=64, method=0)
        pal = q.getpalette()
        found = sorted(q.getcolors(), reverse=True)
        total = float(sum(c for c, _ in found)) or 1.0
        cand = []
        for cnt, i in found:
            rgb = tuple(pal[i * 3:i * 3 + 3])
            h, l, sat = rgb_to_hls(*(v / 255.0 for v in rgb))
            lab = _rgb_to_oklab(np.array(rgb, dtype=np.float64))
            cand.append({"hex": "#%02X%02X%02X" % rgb, "pop": cnt / total, "hue": h * 360.0, "sat": sat,
                         "lab": lab, "L": float(lab[0]), "chroma": float(math.hypot(lab[1], lab[2]))})

        def dist(a, b):
            return float(np.linalg.norm(a["lab"] - b["lab"]))

        def pick(order, limit):
            """Walk `order`, keep colors that differ enough from those already kept (relaxing if needed)."""
            chosen = []
            for gap in (0.07, 0.04, 0.02, 0.0):
                for c in order:
                    if len(chosen) >= limit:
                        return chosen
                    if c not in chosen and all(dist(c, k) >= gap for k in chosen):
                        chosen.append(c)
            return chosen

        if mode == "Vivid":
            chosen = pick(sorted([c for c in cand if c["pop"] >= 0.0015], key=lambda c: -c["chroma"]) or cand, n)
        elif mode == "Muted / pastel":
            chosen = pick(sorted(cand, key=lambda c: -(c["L"] - 2.5 * abs(c["chroma"] - 0.07))), n)
        elif mode == "Most different":
            chosen = [cand[0]]
            while len(chosen) < min(n, len(cand)):
                far = max((c for c in cand if c not in chosen), key=lambda c: min(dist(c, k) for k in chosen))
                if min(dist(far, k) for k in chosen) < 0.02:
                    break
                chosen.append(far)
        elif mode == "Light to dark":
            ordered = sorted(cand, key=lambda c: c["L"])
            m = len(ordered)
            idx = [round(k * (m - 1) / max(1, n - 1)) for k in range(min(n, m))]
            chosen = pick([ordered[i] for i in idx], n) or ordered[:n]
            chosen = sorted(chosen, key=lambda c: c["L"])
        elif mode in ("Warm only", "Cool only"):
            def kind_ok(c):
                if c["sat"] < 0.12:
                    return False
                warm = c["hue"] <= 75 or c["hue"] >= 320
                return warm if mode == "Warm only" else (150 <= c["hue"] <= 285)
            chosen = pick([c for c in cand if kind_ok(c)], n)
        else:
            chosen = pick(cand, n)
        cols = []
        for c in chosen:
            if c["hex"] not in cols:
                cols.append(c["hex"])
        if len(cols) < 2:
            raise ValueError("this image has too few colors of that kind. Try another mode")
        return cols

    def parse_palette_text(self, text):
        """Pull colors out of pasted text: hex codes (#RRGGBB, RRGGBB, #RGB), a Coolors link
        (coolors.co/264653-2a9d8f-e9c46a), or GIMP .gpl lines ('38 70 83 name')."""
        out = []

        def add(h):
            h = self._norm_hex(h)
            if h and h not in out:
                out.append(h)
        pat = (r"(?<![0-9A-Za-z])(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|(?=[0-9A-Fa-f]*[0-9])[0-9A-Fa-f]{6})"
               r"(?![0-9A-Za-z])")
        for m in re.finditer(pat, text):
            add(m.group(1))
        if not out:
            for line in text.splitlines():
                m = re.match(r"^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s|$)", line)
                if m and all(int(g) <= 255 for g in m.groups()[:3]):
                    add("%02X%02X%02X" % tuple(int(g) for g in m.groups()[:3]))
        return out

    def open_palette_tools(self):
        win = self.make_dialog("Palette Tools", 470, 640)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(0, weight=1)
        self._label(body, "Palette Tools", size=13, bold=True).grid(row=0, column=0, sticky="w")
        self._label(body, "These work on the colors in the Colors card.", color="dim", size=9).grid(
            row=1, column=0, sticky="w", pady=(2, 10))
        note = tk.StringVar(value="")
        hist = []                                           # earlier palettes, for Undo
        note_t = {"t": 0.0}                                 # when the last message appeared
        note.trace_add("write", lambda *a: note_t.__setitem__("t", time.monotonic()) if note.get() else None)

        def clear_note(*_):
            """An option changed: the old message no longer applies (a message just shown is left alone)."""
            if note.get() and time.monotonic() - note_t["t"] > 0.5:
                note.set("")

        def cur_cols():
            n = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
            return [c.upper() for c in self.colors[:n]]

        def apply_cols(cols, msg):
            old = cur_cols()
            cols = [c.upper() for c in cols][:MAX_COLORS]
            if len(cols) < 2 or cols == old:
                note.set("No change.")
                return
            hist.append(old)
            self._apply_palette_colors(cols)
            note.set(msg)

        # tabs: every page sits in the same grid cell, the chosen one is raised
        tab_var = tk.StringVar(value="Library")
        Segmented(body, self, ["Library", "Edit", "Harmony", "Import"], tab_var, seg_width=100, height=34).grid(
            row=2, column=0, sticky="w")
        stack = self._frame(body)
        stack.grid(row=3, column=0, sticky="nsew", pady=(12, 0))
        stack.columnconfigure(0, weight=1)
        body.rowconfigure(3, weight=1)
        pages = {}
        for name in ("Library", "Edit", "Harmony", "Import"):
            pg = self._frame(stack)
            pg.grid(row=0, column=0, sticky="nsew")
            pg.columnconfigure(0, weight=1)
            pages[name] = pg
        tab_var.trace_add("write", lambda *a: (pages[tab_var.get()].tkraise(), note.set("")))
        pages["Library"].tkraise()                 # the pages share one spot: show the first one right away
        lib = pages["Library"]

        # ═══ Library: extract, copy as, saved palettes ═══
        # ── Extract colors from an image: preview ALL found colors, the user picks which ones to import ──
        exv = self._frame(lib)                        # the chooser; it takes the place of the library while it is open
        exv.columnconfigure(0, weight=1)
        ex = {"path": None, "cols": [], "sel": [], "order": "Dark to Light"}
        cnt_var, file_var, sel_var = tk.StringVar(value="12"), tk.StringVar(), tk.StringVar()
        mode_var = tk.StringVar(value="Dominant")
        N = MAX_COLORS
        SELECT_ITEMS = [f"First {N}", "First 8", "First 6", "First 4", "Every 2nd", "Most Vivid", "Lightest",
                        "Darkest", "Most Varied", "Warm Only", "Cool Only", f"Random {N}", "None"]
        ORDER_ITEMS = ["Dark to Light", "Light to Dark", "As Found", "By Hue", "Warm to Cool", "As Clicked", "Random"]
        CW, CH, GAP, COLS = 98, 40, 6, 4
        hd = self._frame(exv)                         # title on the left, the "another image" button on the right
        hd.grid(row=0, column=0, sticky="ew")
        hd.columnconfigure(0, weight=1)
        self._label(hd, "Colors from the image", size=11, bold=True).grid(row=0, column=0, sticky="w")
        other = RoundButton(hd, self, text="", icon="image", style="secondary", height=30, width=36,
                            command=lambda: extract())
        other.grid(row=0, column=1, sticky="e")
        Tooltip(other, self, "Choose another image")
        self._label(exv, textvariable=file_var, color="dim", size=9).grid(row=1, column=0, sticky="w", pady=(0, 8))
        cr = self._frame(exv)
        cr.grid(row=2, column=0, sticky="w")
        self._label(cr, "Colors to find:", color="dim").grid(row=0, column=0, padx=(0, 6))
        self._combo(cr, cnt_var, ["4", "6", "8", "10", "12", "16", "20"], width=5, justify="center").grid(row=0, column=1)
        self._label(cr, "Pick:", color="dim").grid(row=0, column=2, padx=(24, 6))
        self._combo(cr, mode_var, self.PICK_MODES, width=14).grid(row=0, column=3)
        grid_cv = tk.Canvas(exv, width=COLS * CW + (COLS - 1) * GAP, height=10, bd=0, highlightthickness=0)
        self.skin(grid_cv, lambda w, t: w.configure(bg=t["surface"]))
        grid_cv.grid(row=3, column=0, sticky="w", pady=(12, 0))
        self._label(exv, textvariable=sel_var, color="dim", size=9).grid(row=4, column=0, sticky="w", pady=(10, 8))
        xb = self._frame(exv)                         # one row: Select / Order list, Clear, Back, Use Selected
        xb.grid(row=5, column=0, sticky="ew")
        xb.columnconfigure(0, weight=1, uniform="pk")
        xb.columnconfigure(1, weight=1, uniform="pk")
        sel_pick = tk.StringVar(value="Select...")            # shows your last Select pick
        ord_pick = tk.StringVar(value=ex["order"])             # always shows the current order
        RoundCombo(xb, self, textvariable=sel_pick, values=SELECT_ITEMS, width=7, height=34).grid(
            row=0, column=0, sticky="ew", padx=(0, 4))
        RoundCombo(xb, self, textvariable=ord_pick, values=ORDER_ITEMS, width=11, height=34).grid(
            row=0, column=1, sticky="ew", padx=(0, 4))

        def lib_widgets():
            return [w for w in lib.winfo_children() if w is not exv]

        def show_chooser():
            for w in lib_widgets():
                w.grid_remove()
            exv.grid(row=0, column=0, sticky="nsew")

        def hide_chooser():
            exv.grid_remove()
            for w in lib_widgets():
                w.grid()

        def hls_of(c):
            return rgb_to_hls(*(v / 255.0 for v in self.hex_to_rgb(c)))

        def chroma_of(c):
            h, l, sat = hls_of(c)
            return sat * (1 - abs(2 * l - 1))

        def warmth_of(c):                              # 0 = orange (warmest) ... 0.5 = blue (coolest)
            d = abs(hls_of(c)[0] - 0.08)
            return min(d, 1 - d)

        def ordered(sel):
            mode = ex["order"]
            if mode == "Light to Dark":
                return sorted(sel, key=bright_of, reverse=True)
            if mode == "As Found":
                return sorted(sel, key=ex["cols"].index)
            if mode == "By Hue":
                return sorted(sel, key=lambda c: (round(hls_of(c)[0], 3), bright_of(c)))
            if mode == "Warm to Cool":
                return sorted(sel, key=warmth_of)
            if mode == "As Clicked":
                return list(sel)
            if mode == "Random":
                out = sorted(sel)
                random.Random(",".join(out)).shuffle(out)       # the same colors always shuffle the same way
                return out
            return sorted(sel, key=bright_of)

        def draw_grid():
            note.set("")                               # no info line here; a warning shows until the next change
            t = self.theme
            cv = grid_cv
            cv.delete("all")
            n = len(ex["cols"])
            cv.configure(height=max(1, -(-n // COLS)) * (CH + GAP) - GAP)
            order = ordered(ex["sel"])                           # the order the colors will have in the palette
            for i, c in enumerate(ex["cols"]):
                x, y = (i % COLS) * (CW + GAP), (i // COLS) * (CH + GAP)
                sel = c in ex["sel"]
                edge = t["accent"] if sel else _blend(t["text"], t["surface"], 0.3)
                cv.create_image(x, y, anchor="nw", image=_photo(
                    ("xsw", c, sel, edge), lambda c=c, e=edge, s=sel: _rr(CW, CH, 10, c, e, 3 if s else 1)))
                cv.create_text(x + CW / 2 - (6 if sel else 0), y + CH / 2, text=c, fill=_contrast_text(c), font=F(9, True))
                if sel:
                    k = order.index(c) + 1
                    cv.create_image(x + CW - 3, y + 3, anchor="ne", image=_photo(
                        ("xbadge", k, t["accent"], t["on_accent"]),
                        lambda k=k: _ring(20, 10, 2, t["on_accent"], fill=t["accent"], label=k,
                                          label_color=t["on_accent"], label_px=9)))
            sel_var.set(f"Selected {len(ex['sel'])} of {MAX_COLORS}   Order: {ex['order']}")

        def on_grid_click(e):
            col, row = e.x // (CW + GAP), e.y // (CH + GAP)
            if e.x % (CW + GAP) >= CW or e.y % (CH + GAP) >= CH or col >= COLS:
                return
            i = row * COLS + col
            if not 0 <= i < len(ex["cols"]):
                return
            c = ex["cols"][i]
            if c in ex["sel"]:
                ex["sel"].remove(c)
            elif len(ex["sel"]) >= MAX_COLORS:
                note.set(f"A palette holds up to {MAX_COLORS} colors.")
                return
            else:
                ex["sel"].append(c)
            draw_grid()
        grid_cv.bind("<ButtonPress-1>", on_grid_click)
        grid_cv.configure(cursor="hand2")

        def run_extract():
            try:
                ex["cols"] = self._extract_image_colors(ex["path"], int(cnt_var.get()), mode_var.get())
            except Exception as e:
                note.set(f"Could not read colors from this image: {e}")
                return False
            ex["sel"] = ex["cols"][:min(MAX_COLORS, len(cur_cols()))]      # start with the most common colors, as many as the palette has now
            return True

        def extract():
            path = filedialog.askopenfilename(
                parent=win, title="Pick an image to take colors from",
                filetypes=[("Images", "*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff"), ("All files", "*.*")])
            if not path:
                return
            ex["path"] = path
            file_var.set(os.path.basename(path))
            if run_extract():
                show_chooser()
                draw_grid()

        def recount(*_):
            if ex["path"] and exv.winfo_ismapped() and run_extract():
                draw_grid()
        cnt_var.trace_add("write", recount)
        mode_var.trace_add("write", recount)

        def use_selected():
            cols = ordered(ex["sel"])
            if len(cols) < 2:
                note.set("Select at least two colors.")
                return
            apply_cols(cols, f"Imported {len(cols)} colors from {file_var.get()}.")
            hide_chooser()

        def clear_sel():
            ex["sel"] = []
            draw_grid()

        def choose(label):
            cols = ex["cols"]
            if label == f"Select: First {N}":
                got = cols[:N]
            elif label.startswith("Select: First "):
                got = cols[:int(label.split()[-1])]
            elif label == "Select: Every 2nd":
                got = cols[::2][:N]
            elif label.startswith("Select: Most Vivid"):
                got = sorted(cols, key=chroma_of, reverse=True)[:N]
            elif label.startswith("Select: Lightest"):
                got = sorted(cols, key=bright_of, reverse=True)[:N]
            elif label.startswith("Select: Darkest"):
                got = sorted(cols, key=bright_of)[:N]
            elif label.startswith("Select: Most Varied"):
                got = [cols[0]] if cols else []
                rest = cols[1:]
                while rest and len(got) < N:
                    far = max(rest, key=lambda c: min(sum((a - b) ** 2 for a, b in zip(
                        self.hex_to_rgb(c), self.hex_to_rgb(g))) for g in got))
                    got.append(far)
                    rest.remove(far)
            elif label == "Select: Warm Only":
                got = [c for c in cols if chroma_of(c) > 0.05 and (hls_of(c)[0] <= 1 / 6 or hls_of(c)[0] >= 11 / 12)][:N]
            elif label == "Select: Cool Only":
                got = [c for c in cols if chroma_of(c) > 0.05 and 0.33 <= hls_of(c)[0] <= 0.75][:N]
            elif label.startswith("Select: Random"):
                got = random.sample(cols, min(N, len(cols)))
            elif label == "Select: None":
                got = []
            elif label.startswith("Order: "):
                ex["order"] = label[7:]
                draw_grid()
                return
            else:
                return
            if not got and label != "Select: None":
                note.set("No colors in this image match that choice.")
                return
            ex["sel"] = [c for c in cols if c in got] if "Random" not in label else got
            draw_grid()

        def on_sel(*_):
            if ex["cols"] and sel_pick.get() != "Select...":
                choose("Select: " + sel_pick.get())

        def on_ord(*_):
            if ex["cols"]:
                choose("Order: " + ord_pick.get())
        sel_pick.trace_add("write", on_sel)
        ord_pick.trace_add("write", on_ord)
        for i, (text, icon, tip, cmd, style, bw) in enumerate((
                ("", "reset", "Clear Selection", clear_sel, "secondary", 36),
                ("", "back", "Back", hide_chooser, "secondary", 36),
                ("Use Selected", None, None, use_selected, "primary", 94))):
            b = RoundButton(xb, self, text=text, icon=icon, style=style, height=34, width=bw, size=9, command=cmd)
            b.grid(row=0, column=i + 2, padx=(0, 4) if i < 2 else (0, 0))
            if tip:
                Tooltip(b, self, tip)

        RoundButton(lib, self, text="Extract colors from an image...", icon="sparkle", style="secondary",
                    height=34, fill=True, command=extract).grid(row=0, column=0, sticky="ew")

        self._label(lib, "COPY AS", color="dim", size=8, bold=True).grid(row=1, column=0, sticky="w", pady=(14, 6))
        cp = self._frame(lib)
        cp.grid(row=2, column=0, sticky="ew")
        cp.columnconfigure((0, 1), weight=1, uniform="cp")

        def copy(kind, label):
            try:
                win.clipboard_clear()
                win.clipboard_append(self.palette_text(kind))
                note.set(f"Copied as {label}.")
            except tk.TclError:
                note.set("Could not reach the clipboard.")

        for i, (text, kind) in enumerate((("CSS Gradient", "css"), ("CSS Variables", "css_vars"),
                                          ("JSON", "json"), ("HEX List", "hex"))):
            RoundButton(cp, self, text=text, style="secondary", height=32, fill=True,
                        command=lambda k=kind, t=text: copy(k, t)).grid(
                row=i // 2, column=i % 2, sticky="ew", padx=(0, 4) if i % 2 == 0 else (4, 0), pady=(0, 6))

        self._label(lib, "PALETTES", color="dim", size=8, bold=True).grid(row=3, column=0, sticky="w", pady=(10, 6))
        items = [dict(p, builtin=True) for p in BUILTIN_PALETTES] + self.load_palettes()
        lb = tk.Listbox(lib, width=10, height=7, bd=0, highlightthickness=1, activestyle="none", exportselection=False,
                        font=F(10))
        self.skin(lb, lambda w, t: w.configure(bg=t["surface2"], fg=t["text"], selectbackground=t["accent"],
                                               selectforeground=t["on_accent"], highlightbackground=t["border"],
                                               highlightcolor=t["accent"]))
        lb.grid(row=4, column=0, sticky="ew")
        strip = tk.Canvas(lib, height=22, bd=0, highlightthickness=0)
        self.skin(strip, lambda w, t: w.configure(bg=t["surface"]))
        strip.grid(row=5, column=0, sticky="ew", pady=(6, 0))

        def refill(select=None):
            lb.delete(0, "end")
            for n, p in enumerate(items, 1):                  # serial number + left padding (3 spaces is about 10 px)
                lb.insert("end", f"   {n:02d}   " + p["name"] + ("" if p.get("builtin") else "   (yours)"))
            if select is not None and 0 <= select < len(items):
                lb.selection_set(select)
            draw_strip()

        def current():
            sel = lb.curselection()
            return items[sel[0]] if sel else None

        def draw_strip(*_):
            strip.delete("all")
            p = current()
            if not p:
                return
            w = max(strip.winfo_width(), 100)
            n = len(p["colors"])
            for i, c in enumerate(p["colors"]):
                strip.create_rectangle(i * w / n, 0, (i + 1) * w / n, 22, fill=c, outline=c)

        def load(*_):
            p = current()
            if p:
                apply_cols(p["colors"], f"Loaded {p['name']}.")

        def delete():
            p = current()
            if not p or p.get("builtin"):
                note.set("Built-in palettes cannot be deleted.")
                return
            items.remove(p)
            self.save_palettes([{"name": q["name"], "colors": q["colors"]} for q in items if not q.get("builtin")])
            refill()
            note.set(f"Deleted {p['name']}.")

        lb.bind("<<ListboxSelect>>", draw_strip)
        lb.bind("<Double-Button-1>", load)
        strip.bind("<Configure>", draw_strip)
        bt = self._frame(lib)
        bt.grid(row=6, column=0, sticky="ew", pady=(8, 0))
        bt.columnconfigure((0, 1), weight=1, uniform="pb")
        RoundButton(bt, self, text="Use Selected", style="primary", height=32, fill=True, command=load).grid(
            row=0, column=0, sticky="ew", padx=(0, 4))
        RoundButton(bt, self, text="Delete", style="secondary", height=32, fill=True, command=delete).grid(
            row=0, column=1, sticky="ew", padx=(4, 0))

        sv = self._frame(lib)
        sv.grid(row=7, column=0, sticky="ew", pady=(10, 0))
        sv.columnconfigure(1, weight=1)
        name_var = tk.StringVar()
        self._label(sv, "Name", color="dim").grid(row=0, column=0, padx=(0, 8))
        self._entry(sv, name_var, width=14, justify="left").grid(row=0, column=1, sticky="ew")

        def save_current():
            name = name_var.get().strip()[:40]
            if not name:
                note.set("Type a name first.")
                return
            cols = [c for _, c, _ in self._palette_pairs()]
            mine = [p for p in items if not p.get("builtin") and p["name"].lower() != name.lower()]
            mine.append({"name": name, "colors": cols})
            if self.save_palettes([{"name": q["name"], "colors": q["colors"]} for q in mine]):
                items[:] = [p for p in items if p.get("builtin")] + mine
                refill(len(items) - 1)
                name_var.set("")
                note.set(f"Saved {name}.")

        RoundButton(sv, self, text="Save Current", style="secondary", height=30, width=110,
                    command=save_current).grid(row=0, column=2, padx=(8, 0))

        # ═══ Edit: sort and adjust the colors you already have ═══
        ed = pages["Edit"]
        ed.columnconfigure((0, 1), weight=1, uniform="ed")

        def hue_of(c):
            return rgb_to_hls(*(v / 255.0 for v in self.hex_to_rgb(c)))[0]

        def bright_of(c):
            return sum(w * v for w, v in zip((0.299, 0.587, 0.114), self.hex_to_rgb(c)))

        def shifted(dl=0.0, ds=0.0):
            def fn(cols):
                out = []
                for c in cols:
                    h, l, s = rgb_to_hls(*(v / 255.0 for v in self.hex_to_rgb(c)))
                    out.append(self.rgb_float_to_hex(hls_to_rgb(h, min(0.97, max(0.03, l + dl)),
                                                                min(1.0, max(0.0, s + ds)))))
                return out
            return fn

        def shuffled(cols):
            c = list(cols)
            random.shuffle(c)
            return c

        def edit_group(row, title, buttons):
            self._label(ed, title, color="dim", size=8, bold=True).grid(
                row=row, column=0, columnspan=2, sticky="w", pady=(0, 6) if row == 0 else (14, 6))
            for i, (text, fn, msg) in enumerate(buttons):
                RoundButton(ed, self, text=text, style="secondary", height=34, fill=True,
                            command=lambda f=fn, m=msg: apply_cols(f(cur_cols()), m)).grid(
                    row=row + 1 + i // 2, column=i % 2, sticky="ew",
                    padx=(0, 4) if i % 2 == 0 else (4, 0), pady=(0, 6))

        edit_group(0, "SORT", [
            ("By Hue", lambda c: sorted(c, key=hue_of), "Sorted by hue."),
            ("By Brightness", lambda c: sorted(c, key=bright_of), "Sorted dark to light."),
            ("Reverse Order", lambda c: list(reversed(c)), "Order reversed."),
            ("Shuffle", shuffled, "Shuffled.")])
        edit_group(3, "ADJUST ALL COLORS", [
            ("Lighter", shifted(dl=0.08), "All colors lighter."),
            ("Darker", shifted(dl=-0.08), "All colors darker."),
            ("More Saturated", shifted(ds=0.12), "More saturated."),
            ("Less Saturated", shifted(ds=-0.12), "Less saturated.")])
        self._label(ed, "Stops are spread evenly after an edit. Undo restores the previous colors.",
                    color="dim", size=9).grid(row=7, column=0, columnspan=2, sticky="w", pady=(6, 0))

        # ═══ Harmony: build a palette from one base color ═══
        hm = pages["Harmony"]
        hm.columnconfigure(1, weight=1)
        base_var = tk.StringVar(value=self.colors[0].upper())
        scheme_var = tk.StringVar(value=self.scheme_var.get())
        self._label(hm, "Base Color", color="dim").grid(row=0, column=0, sticky="w", padx=(0, 10), pady=(0, 8))
        hb = self._frame(hm)
        hb.grid(row=0, column=1, sticky="w", pady=(0, 8))
        hsw = ColorSwatch(hb, self, text="", width=34, height=30)
        hsw.grid(row=0, column=0, padx=(0, 8))

        custom = {"on": False}                          # True = the base color was typed or picked, not chosen from the list
        sync = {"busy": False}
        base_pick = tk.StringVar(value=base_var.get())     # what the list shows (mirrors the base color)

        def pick_base():                                   # the swatch opens the color picker
            got = colorchooser.askcolor(color=self._norm_hex(base_var.get()) or "#FFFFFF", parent=win)
            if got and got[1]:
                base_var.set(got[1].upper())
        hsw.command = pick_base
        base_combo = self._combo(hb, base_pick, [], width=12)
        base_combo.swatches = True                         # color chip before each hex code
        base_combo.grid(row=0, column=1, sticky="w", padx=(0, 6))
        self._entry(hb, base_var, width=9).grid(row=0, column=2, sticky="w")    # type a HEX code here

        def refresh_base_list(*_):
            """List = the colors in the Colors card right now."""
            opts = list(dict.fromkeys(cur_cols()))
            base_combo.configure(values=opts)
            cur = self._norm_hex(base_var.get())
            if cur and cur not in opts and not custom["on"]:
                base_var.set(opts[0])                       # the chosen palette color left the palette: use Color 1

        def on_base_pick(*_):                               # you chose a color from the list
            if sync["busy"]:
                return
            v = base_pick.get()
            if v != base_var.get():
                base_var.set(v)

        def on_base_var(*_):                                # you typed or picked a color
            b = self._norm_hex(base_var.get())
            if b:
                custom["on"] = b not in cur_cols()
                if base_pick.get() != b:
                    sync["busy"] = True
                    base_pick.set(b)
                    sync["busy"] = False
        base_pick.trace_add("write", on_base_pick)
        base_var.trace_add("write", on_base_var)
        refresh_base_list()

        def on_colors_changed():                            # the Colors card changed: refill the list, drop old messages
            refresh_base_list()
            clear_note()
        self._harmony_refresh = on_colors_changed
        win.bind("<Destroy>", lambda e: setattr(self, "_harmony_refresh", None) if e.widget is win else None, add="+")
        self._label(hm, "Harmony", color="dim").grid(row=1, column=0, sticky="w", padx=(0, 10), pady=(0, 8))
        self._combo(hm, scheme_var,
                    ["Complementary", "Analogous", "Monochromatic", "Triadic", "Tetradic", "Square", "Shades",
                     "Compound", "Pentadic", "Hexadic", "Split-Complementary"], width=19).grid(
            row=1, column=1, sticky="w", pady=(0, 8))
        hn = tk.StringVar(value=str(min(max(int(self.num_colors.get()), 2), MAX_COLORS)))
        self._label(hm, "Colors", color="dim").grid(row=2, column=0, sticky="w", padx=(0, 10), pady=(0, 8))
        self._combo(hm, hn, [str(i) for i in range(2, MAX_COLORS + 1)], width=6, justify="center").grid(
            row=2, column=1, sticky="w", pady=(0, 8))
        hstrip = tk.Canvas(hm, height=44, bd=0, highlightthickness=0)
        self.skin(hstrip, lambda w, t: w.configure(bg=t["surface"]))
        hstrip.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(4, 0))
        preview = {"key": None, "cols": []}

        def draw_hstrip(*_):
            b = self._norm_hex(base_var.get())
            hstrip.delete("all")
            if not b:
                preview["key"], preview["cols"] = None, []
                hstrip.create_text(8, 22, anchor="w", text="Type a valid base color (like #1A2B3C).",
                                   fill=self.theme["dim"], font=F(9))
                return
            hsw.set(b, "")
            key = (b, scheme_var.get(), hn.get(), self.temp_var.get())
            if key != preview["key"]:                  # new settings: make a new preview (and remember it)
                preview["key"] = key
                preview["cols"] = self.harmony_palette(b, scheme_var.get(), int(hn.get())) or []
            cols = preview["cols"]
            w = max(hstrip.winfo_width(), 100)
            n = len(cols)
            per = n if n <= 6 else 6                    # at most 6 colors per row; the rest go on a second row
            need_h = 44 if n <= 6 else 92
            if int(float(hstrip.cget("height"))) != need_h:
                hstrip.configure(height=need_h)
                win.after_idle(refit_dialog)
            for i, c in enumerate(cols):
                r, k = divmod(i, 6) if n > 6 else (0, i)
                x0, x1 = round(k * w / per), round((k + 1) * w / per)
                y0 = r * 48
                hstrip.create_rectangle(x0, y0, x1, y0 + 44, fill=c, outline=c)
                fg = _contrast_text(c)
                hstrip.create_text((x0 + x1) / 2, y0 + (22 if i else 17), text=c.upper(), fill=fg, font=F(8, True))
                if i == 0:
                    hstrip.create_text((x0 + x1) / 2, y0 + 31, text="BASE", fill=fg, font=F(7))

        def refit_dialog():
            try:
                win.update_idletasks()
                win.geometry(f"{max(win._min_w, win.winfo_reqwidth())}x{win.winfo_reqheight()}")
            except tk.TclError:
                pass
        hstrip.bind("<Configure>", draw_hstrip)
        for var in (base_var, scheme_var, hn):
            var.trace_add("write", draw_hstrip)
            var.trace_add("write", clear_note)
        self._label(hm, "The color palette preview updates as you change the options.",
                    color="dim", size=9, wraplength=400, justify="left").grid(
            row=4, column=0, columnspan=2, sticky="w", pady=(4, 10))

        def make_harmony():
            b = self._norm_hex(base_var.get())
            cols = preview["cols"]
            if not b or len(cols) < 2:
                note.set("Type a valid base color first (like #1A2B3C).")
                return
            hist.append(cur_cols())
            self.num_colors.set(str(len(cols)))
            self.update_color_pickers()
            for i, c in enumerate(cols[:MAX_COLORS]):        # exactly the colors shown in the preview
                self.colors[i] = c
            self.update_color_pickers()
            note.set(f"{scheme_var.get()} palette made from {b}.")

        RoundButton(hm, self, text="Use this Palette", icon="sparkle", style="primary", height=36, fill=True,
                    command=make_harmony).grid(row=5, column=0, columnspan=2, sticky="ew")

        # ═══ Import: paste hex codes, a Coolors link, or load a file ═══
        im = pages["Import"]
        self._label(im, "Paste hex codes, a Coolors link, or JSON / GPL text. Up to 12 colors are used.",
                    color="dim", size=9, wraplength=400, justify="left").grid(row=0, column=0, sticky="w", pady=(0, 6))
        txt = tk.Text(im, width=10, height=7, bd=0, highlightthickness=1, wrap="word", font=F(10), undo=True)
        self.skin(txt, lambda w, t: w.configure(bg=t["surface2"], fg=t["text"], insertbackground=t["text"],
                                                selectbackground=t["accent"], selectforeground=t["on_accent"],
                                                highlightbackground=t["border"], highlightcolor=t["accent"]))
        txt.grid(row=1, column=0, sticky="ew")
        istrip = tk.Canvas(im, height=26, bd=0, highlightthickness=0)
        self.skin(istrip, lambda w, t: w.configure(bg=t["surface"]))
        istrip.grid(row=2, column=0, sticky="ew", pady=(8, 0))
        found = []

        def read_text(*_):
            found[:] = self.parse_palette_text(txt.get("1.0", "end"))[:MAX_COLORS]
            istrip.delete("all")
            w = max(istrip.winfo_width(), 100)
            for i, c in enumerate(found):
                istrip.create_rectangle(i * w / len(found), 0, (i + 1) * w / len(found), 26, fill=c, outline=c)
            if txt.get("1.0", "end").strip():
                note.set(f"Found {len(found)} color{'s' if len(found) != 1 else ''}." if found else
                         "No colors found in this text.")
            else:
                clear_note()
        txt.bind("<KeyRelease>", read_text)
        istrip.bind("<Configure>", read_text)

        def load_file():
            path = filedialog.askopenfilename(
                parent=win, title="Open a palette file",
                filetypes=[("Palette files", "*.gpl *.json *.txt *.css *.scss *.hex"), ("All files", "*.*")])
            if not path:
                return
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    data = f.read(200000)
            except OSError as e:
                note.set(f"Could not read the file: {e}")
                return
            txt.delete("1.0", "end")
            txt.insert("1.0", data)
            read_text()

        def use_import():
            if len(found) < 2:
                note.set("Need at least two colors.")
                return
            cols = found[:MAX_COLORS]
            hist.append(cur_cols())
            self.num_colors.set(str(len(cols)))
            self.update_color_pickers()
            self._apply_palette_colors(cols)
            note.set(f"Imported {len(cols)} colors.")

        ib = self._frame(im)
        ib.grid(row=3, column=0, sticky="ew", pady=(10, 0))
        ib.columnconfigure((0, 1), weight=1, uniform="ib")
        RoundButton(ib, self, text="Open file...", style="secondary", height=34, fill=True, command=load_file).grid(
            row=0, column=0, sticky="ew", padx=(0, 4))
        RoundButton(ib, self, text="Use These Colors", style="primary", height=34, fill=True,
                    command=use_import).grid(row=0, column=1, sticky="ew", padx=(4, 0))

        # ═══ shared bottom: note, Undo, Close ═══
        self._label(body, textvariable=note, color="dim", size=9).grid(row=4, column=0, sticky="w", pady=(8, 0))
        bb = self._frame(body)
        bb.grid(row=5, column=0, sticky="ew", pady=(8, 0))
        bb.columnconfigure((0, 1), weight=1, uniform="bb")

        def undo():
            if not hist:
                note.set("Nothing to undo.")
                return
            prev = hist.pop()
            self.num_colors.set(str(len(prev)))
            self.update_color_pickers()
            self._apply_palette_colors(prev)
            note.set("Undone.")
        RoundButton(bb, self, text="Undo", style="secondary", height=34, fill=True, command=undo).grid(
            row=0, column=0, sticky="ew", padx=(0, 4))
        RoundButton(bb, self, text="Close", style="secondary", height=34, fill=True, command=win.destroy).grid(
            row=0, column=1, sticky="ew", padx=(4, 0))
        refill()
        pages["Library"].tkraise()

    # ══ v4.0: color-stop bar, copy to clipboard, full-screen preview ════════
    def _refresh_stop_bar(self):
        bar = getattr(self, "stop_bar", None)
        if bar is not None:
            bar._draw()

    def _stops_sorted(self):
        n = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        return sorted(((self.color_positions[i], self.hex_to_rgb(self.colors[i]), self.color_opacities[i])
                       for i in range(n)), key=lambda s: s[0])

    def _ramp_at(self, p):
        """(r, g, b, opacity 0-1) of the current gradient at position p (0-1)."""
        lut = self.stop_lut()
        c = lut[int(round(min(max(p, 0.0), 1.0) * (len(lut) - 1)))]
        return (float(c[0]), float(c[1]), float(c[2]), float(c[3]) / 255.0)

    def add_stop(self, p):
        """Add a color at position p (0-1). Returns its index, or None when the maximum is already used."""
        try:
            n = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        except (ValueError, tk.TclError):
            n = 2
        if n >= MAX_COLORS:
            self.status_var.set(f"Up to {MAX_COLORS} colors are possible")
            return None
        r, g, b, a = self._ramp_at(p)
        self.colors[n] = "#%02X%02X%02X" % (int(round(r)), int(round(g)), int(round(b)))
        self.color_opacities[n] = a
        self.color_positions[n] = p
        self.stop_trans[n] = "Smooth"
        self._keep_positions = True
        try:
            self.num_colors.set(str(n + 1))
        finally:
            self._keep_positions = False
        self.select_stop(n)
        return n

    def move_stop(self, index, p):
        if 0 <= index < len(self.position_vars):
            self.position_vars[index].set(p * 100)

    def remove_stop(self, index):
        try:
            n = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        except (ValueError, tk.TclError):
            n = 2
        if n <= 2:
            self.status_var.set("At least 2 colors are needed")
            return
        for k in range(index, MAX_COLORS - 1):
            self.colors[k] = self.colors[k + 1]
            self.color_opacities[k] = self.color_opacities[k + 1]
            self.color_positions[k] = self.color_positions[k + 1]
            self.stop_trans[k] = self.stop_trans[k + 1]
        self.stop_trans[MAX_COLORS - 1] = "Smooth"
        self._keep_positions = True
        try:
            self.num_colors.set(str(n - 1))
        finally:
            self._keep_positions = False
        self.select_stop(min(index, n - 2))

    def _sc_copy(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.copy_image_to_clipboard()
            return "break"

    def _sc_full(self, e):
        if self._sc_in_main(e) and not self._sc_typing() and self._open_drop is None:
            self.open_fullscreen_preview()
            return "break"

    def copy_image_to_clipboard(self):
        """Render the picture at the Output size (at most 25 megapixels) and copy it."""
        if self.batch_running:
            return
        try:
            if self.show_palette.get():
                image = self.generate_palette(1200, 500)
            else:
                size = self.get_export_size()
                if size is None:
                    return
                w, h = size
                note = ""
                if w * h > 25_000_000:
                    f = (25_000_000 / float(w * h)) ** 0.5
                    w, h = max(1, int(w * f)), max(1, int(h * f))
                    note = " (reduced to 25 megapixels)"
                self.status_var.set(f"Rendering {w} x {h} ...")
                self.root.configure(cursor="watch")
                self.root.update()
                if w * h >= PROGRESS_PIXELS:
                    self._open_progress("Copying picture", f"{w} x {h} px")
                try:
                    image = self.generate_gradient(
                        w, h, self.gradient_type.get(), self.direction.get(), self.other_direction.get(),
                        self.effect.get(), self.secondary_effect.get(), self.intensity.get(),
                        self.secondary_intensity.get())
                finally:
                    self._close_progress()
            flatten = self._export_options()[1]
            ok, msg = copy_image_to_clipboard(image, flatten)
            self.status_var.set((f"Picture copied to the clipboard" + (note if not self.show_palette.get() else ""))
                                if ok else msg)
            if not ok:
                messagebox.showinfo("Copy", msg)
        except RenderCancelled:
            self.status_var.set("Copy canceled")
        except Exception as e:
            self.status_var.set("Error")
            messagebox.showerror("Copy", f"Could not copy the picture: {e}")
        finally:
            self.root.configure(cursor="")

    def open_fullscreen_preview(self):
        """Full-screen view of the current picture. Esc / click = close, Space = new image, arrows = undo / redo."""
        if self.batch_running:
            return
        win = tk.Toplevel(self.root)
        win.configure(bg="#000000")
        win.title("Gradient Gen preview")
        sw, sh = win.winfo_screenwidth(), win.winfo_screenheight()
        try:
            win.attributes("-fullscreen", True)
        except tk.TclError:
            win.geometry(f"{sw}x{sh}+0+0")
        cv = tk.Canvas(win, bg="#000000", highlightthickness=0, bd=0)
        cv.pack(fill="both", expand=True)
        holder = {"photo": None, "after": None}

        def render(*_):
            holder["after"] = None
            try:
                cw, ch = max(win.winfo_width(), 200), max(win.winfo_height(), 200)
                try:
                    w, h = max(1, int(self.width.get())), max(1, int(self.height.get()))
                except (ValueError, tk.TclError):
                    w, h = 16, 9
                k = min(cw / w, ch / h)
                fw, fh = max(1, int(w * k)), max(1, int(h * k))
                if self.show_palette.get():
                    img = self.generate_palette(fw, fh)
                else:
                    img = self.generate_gradient(
                        fw, fh, self.gradient_type.get(), self.direction.get(), self.other_direction.get(),
                        self.effect.get(), self.secondary_effect.get(), self.intensity.get(),
                        self.secondary_intensity.get())
                img = img.convert("RGBA")
                if img.getchannel("A").getextrema()[0] < 255:
                    img = Image.alpha_composite(self._checker(fw, fh, 12), img)
                holder["photo"] = ImageTk.PhotoImage(img.convert("RGB"))
                cv.delete("all")
                cv.create_image(cw // 2, ch // 2, image=holder["photo"])
                cv.create_text(cw // 2, ch - 18, fill="#8A8FA3", font=F(9),
                               text="Esc close   |   Space new image   |   Left / Right undo / redo", tags="hint")
                cv.after(3500, lambda: cv.delete("hint"))
            except tk.TclError:
                pass

        def later(*_):
            if holder["after"] is not None:
                try:
                    win.after_cancel(holder["after"])
                except (tk.TclError, ValueError):
                    pass
            holder["after"] = win.after(120, render)

        def new_image(e=None):
            if self.mode.get() == "Single":
                self.generate_random()
                later()
            return "break"

        def undo(e=None):
            self.history_undo()
            later()
            return "break"

        def redo(e=None):
            self.history_redo()
            later()
            return "break"

        win.bind("<Escape>", lambda e: win.destroy())
        win.bind("<ButtonPress-1>", lambda e: win.destroy())
        win.bind("<space>", new_image)
        win.bind("<Left>", undo)
        win.bind("<Right>", redo)
        win.bind("<Configure>", later)
        def ensure_full():                      # some window managers ignore -fullscreen
            try:
                if win.winfo_width() < sw * 0.9:
                    win.geometry(f"{sw}x{sh}+0+0")
            except tk.TclError:
                pass

        win.after(100, ensure_full)
        win.after(250, render)
        win.focus_force()

    def is_valid_hex_color(self, hex_color):
        return isinstance(hex_color, str) and re.match(r"^#[0-9A-Fa-f]{6}$", hex_color) is not None

    def center_toplevel(self, toplevel, width, height):
        self.root.update_idletasks()
        main_x = self.root.winfo_x()
        main_y = self.root.winfo_y()
        main_width = self.root.winfo_width()
        main_height = self.root.winfo_height()
        pos_x = max(0, main_x + (main_width - width) // 2)
        pos_y = max(0, main_y + (main_height - height) // 2)
        toplevel.geometry(f"{width}x{height}+{pos_x}+{pos_y}")

    # ── Geometry helpers ──────────────────────────────────────────────────
    def get_center(self, width, height, position):
        if position == "Center":
            return width / 2, height / 2
        elif position == "Top-left":
            return width * 0.1, height * 0.1
        elif position == "Top-right":
            return width * 0.9, height * 0.1
        elif position == "Bottom-left":
            return width * 0.1, height * 0.9
        elif position == "Bottom-right":
            return width * 0.9, height * 0.9
        elif position == "Top-center":
            return width / 2, height * 0.1
        elif position == "Bottom-center":
            return width / 2, height * 0.9
        elif position == "Left-center":
            return width * 0.1, height / 2
        elif position == "Right-center":
            return width * 0.9, height / 2
        elif position == "Custom":
            try:
                x = int(self.custom_x.get() * width / 100)
                y = int(self.custom_y.get() * height / 100)
                return max(0, min(width - 1, x)), max(0, min(height - 1, y))
            except Exception:
                return width // 2, height // 2
        return width / 2, height / 2

    # ── Voronoi / noise / hex helpers ─────────────────────────────────────
    def get_voronoi_points(self, width, height):
        if not self.voronoi_points or len(self.voronoi_points) != 10:
            rv = random.Random(self.noise_seed + 11)           # seeded: same seed = same layout
            self.voronoi_points = [(rv.random(), rv.random()) for _ in range(10)]
        return [(x * width, y * height) for x, y in self.voronoi_points]

    @staticmethod
    def _fade(t):
        return t * t * t * (t * (t * 6 - 15) + 10)

    def _perlin_layer(self, x, y, perm, gx, gy):
        """One octave of 2-D gradient (Perlin) noise. x is (1,W), y is (H,1)."""
        x0 = np.floor(x)
        y0 = np.floor(y)
        xf = (x - x0).astype(np.float32)
        yf = (y - y0).astype(np.float32)
        xi = x0.astype(np.int64) & 255
        yi = y0.astype(np.int64) & 255

        def grad(ix, iy, dx, dy):
            h = perm[perm[ix] + iy]
            return gx[h] * dx + gy[h] * dy

        n00 = grad(xi, yi, xf, yf)
        n10 = grad(xi + 1, yi, xf - 1, yf)
        n01 = grad(xi, yi + 1, xf, yf - 1)
        n11 = grad(xi + 1, yi + 1, xf - 1, yf - 1)
        u = self._fade(xf)
        v = self._fade(yf)
        a = n00 + u * (n10 - n00)
        b = n01 + u * (n11 - n01)
        return a + v * (b - a)

    def generate_perlin_noise(self, width, height, cells=5.0, octaves=4, seed_off=0):
        """Real fractal Perlin noise, resolution independent (cells are relative to width)."""
        cw = min(width, 1200)                       # compute small, upscale (noise is smooth)
        ch = max(1, int(round(height * cw / width)))
        rng = np.random.RandomState((self.noise_seed + seed_off) % 2 ** 31)
        perm = rng.permutation(256).astype(np.int64)
        perm = np.concatenate([perm, perm])
        ang = rng.uniform(0, 2 * np.pi, 256).astype(np.float32)
        gx, gy = np.cos(ang), np.sin(ang)
        xs = (np.arange(cw, dtype=np.float32) / cw)[None, :]
        ys = (np.arange(ch, dtype=np.float32) / cw)[:, None]
        total = np.zeros((ch, cw), dtype=np.float32)
        amp, freq, norm = 1.0, cells, 0.0
        for o in range(octaves):
            total += amp * self._perlin_layer(xs * freq + o * 5.17, ys * freq + o * 3.31, perm, gx, gy)
            norm += amp
            amp *= 0.5
            freq *= 2.0
        t = np.clip(0.5 + (total / norm) * PERLIN_GAIN, 0.0, 1.0).astype(np.float32)
        if (cw, ch) != (width, height):
            img = Image.fromarray(t).resize((width, height), Image.Resampling.BICUBIC)
            t = np.clip(np.asarray(img, dtype=np.float32), 0.0, 1.0)
        return t

    def generate_julia(self, width, height, angle_deg, max_iter=64):
        """Smooth escape-time Julia set. The Direction setting selects the constant c."""
        cw = min(width, 1000)
        ch = max(1, int(round(height * cw / width)))
        re_ = (np.arange(cw, dtype=np.float64) / cw - 0.5) * 3.0
        im_ = (np.arange(ch, dtype=np.float64) / cw - (ch / cw) / 2.0) * 3.0
        z = re_[None, :] + 1j * im_[:, None]
        pos = (angle_deg % 360) / 45.0                  # Direction picks one of 8 well-formed sets
        i0 = int(pos) % 8
        frac = pos - int(pos)
        c = JULIA_C[i0] * (1 - frac) + JULIA_C[(i0 + 1) % 8] * frac
        n = np.full(z.shape, float(max_iter), dtype=np.float32)
        alive = np.ones(z.shape, dtype=bool)
        for k in range(max_iter):
            z[alive] = z[alive] ** 2 + c
            mag = np.abs(z)
            esc = alive & (mag > 16.0)
            if esc.any():
                n[esc] = (k + 1 - np.log(np.log(mag[esc])) / math.log(2)).astype(np.float32)
                alive &= ~esc
            if not alive.any():
                break
        t = np.sqrt(np.clip(n / max_iter, 0.0, 1.0)).astype(np.float32)
        if (cw, ch) != (width, height):
            img = Image.fromarray(t).resize((width, height), Image.Resampling.BICUBIC)
            t = np.clip(np.asarray(img, dtype=np.float32), 0.0, 1.0)
        return t

    @staticmethod
    def hex_lattice_distance(u, v, hs):
        """Distance from (u, v) to the nearest point of a staggered (hexagonal) lattice."""
        row_h = hs * math.sqrt(3) / 2
        r0 = np.round(v / row_h)
        best = None
        for dr in (-1, 0, 1):
            r = r0 + dr
            cy = r * row_h
            off = np.mod(r, 2) * (hs / 2)
            cx = np.round((u - off) / hs) * hs + off
            d = np.hypot(u - cx, v - cy)
            best = d if best is None else np.minimum(best, d)
        return best

    def generate_kaleidoscope(self, width, height, segments=6):
        x, y = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
        center_x, center_y = width / 2, height / 2
        angle = np.arctan2(y - center_y, x - center_x)
        radius = np.hypot(x - center_x, y - center_y)
        t = (np.sin(angle * segments) + 1) / 2 * (radius / np.max(radius))
        return np.clip(t, 0, 1)

    # ── Main gradient generation ──────────────────────────────────────────
    def _live_render_state(self):
        try:
            num = int(self.num_colors.get())
        except ValueError:
            num = 2
            self.num_colors.set("2")
        num = min(max(num, 2), MAX_COLORS)
        opacities = []
        for i in range(num):
            try:
                opacity = int(round(float(self.opacity_vars[i].get()) / 100 * 255))
            except ValueError:
                opacity = int(round(self.color_opacities[i] * 255))
            opacities.append(opacity)
        return {"colors": list(self.colors[:num]),
                "positions": [float(self.position_vars[i].get()) / 100 for i in range(num)],
                "opacities": opacities, "reverse": self.reverse_colors.get(),
                "blend": self.blend_mode.get(), "trans": list(self.stop_trans[:num])}

    def _preset_render_state(self, p):
        """Everything the renderer reads, taken from a saved preset instead of the live window."""
        def num_in(v, d, lo, hi):
            try:
                return min(hi, max(lo, float(v)))
            except (TypeError, ValueError):
                return d
        n = str(p.get("num_colors", "2"))
        n = int(n) if n in [str(k) for k in range(2, MAX_COLORS + 1)] else 2
        cols = []
        for c in list(p.get("colors", []))[:MAX_COLORS]:
            c = str(c).upper()
            cols.append(c if self.is_valid_hex_color(c) else "#CCCCCC")
        cols += ["#CCCCCC"] * (MAX_COLORS - len(cols))
        ops = [num_in(o, 1.0, 0.0, 1.0) for o in list(p.get("color_opacities", []))[:MAX_COLORS]]
        ops += [1.0] * (MAX_COLORS - len(ops))
        raw = p.get("color_positions")
        if isinstance(raw, list) and len(raw) >= n:
            pos = [num_in(v, 0.0, 0.0, 1.0) for v in raw[:MAX_COLORS]]
            pos += [0.0] * (MAX_COLORS - len(pos))
        else:
            pos = [i / (n - 1) for i in range(n)] + [0.0] * (MAX_COLORS - n)
        try:
            seed = int(p["noise_seed"]) % 2 ** 31
        except (KeyError, TypeError, ValueError):
            seed = zlib.crc32(json.dumps(p.get("colors", []), default=str).encode()) % 2 ** 31
        rv = random.Random(seed + 11)
        bm = p.get("blend_mode", "RGB")
        tr = [t if t in TRANSITIONS else "Smooth" for t in list(p.get("stop_trans", []))[:MAX_COLORS]]
        tr += ["Smooth"] * (MAX_COLORS - len(tr))
        return {"colors": cols[:n], "positions": pos[:n], "opacities": [int(round(o * 255)) for o in ops[:n]],
                "blend": bm if bm in BLEND_MODES else "RGB", "trans": tr[:n],
                "reverse": bool(p.get("reverse_colors", False)), "seed": seed,
                "custom_x": num_in(p.get("custom_x", 50), 50, 0, 100),
                "custom_y": num_in(p.get("custom_y", 50), 50, 0, 100),
                "voronoi": [(rv.random(), rv.random()) for _ in range(10)]}

    def generate_gradient(self, width, height, gradient_type, direction,
                          other_direction, effect, secondary_effect,
                          intensity, secondary_intensity, state=None):
        args = (width, height, gradient_type, direction, other_direction, effect, secondary_effect,
                intensity, secondary_intensity)
        if state is None:
            img = self._generate_gradient_core(*args, None)
            self._progress(0.9, "Finishing")
            return self._apply_overlays(img)
        saved = (self._noise_seed, self.voronoi_points, self.custom_x, self.custom_y)
        try:                                     # render from `state` without touching the window
            self._noise_seed = state["seed"]
            self.voronoi_points = list(state["voronoi"])
            self.custom_x = _Const(state["custom_x"])
            self.custom_y = _Const(state["custom_y"])
            return self._generate_gradient_core(*args, state)
        finally:
            self._noise_seed, self.voronoi_points, self.custom_x, self.custom_y = saved

    def _generate_gradient_core(self, width, height, gradient_type, direction,
                                other_direction, effect, secondary_effect,
                                intensity, secondary_intensity, state):
        width = max(1, int(width))
        height = max(1, int(height))
        st = state if state is not None else self._live_render_state()
        colors, positions, opacities = list(st["colors"]), list(st["positions"]), list(st["opacities"])

        # the color ramp as a table (blend mode and transitions included); Reverse simply flips it
        blend = st.get("blend", "RGB")
        trans = list(st.get("trans") or [])
        trans += ["Smooth"] * (len(colors) - len(trans))
        order = sorted(range(len(positions)), key=lambda k: positions[k])
        lut = build_stop_lut([positions[k] for k in order],
                             [tuple(self.hex_to_rgb(colors[k])) + (opacities[k],) for k in order],
                             blend if blend in BLEND_MODES else "RGB", [trans[k] for k in order])
        self._progress(0.05, "Preparing")

        if st["reverse"]:
            lut = lut[::-1]
            colors = list(reversed(colors))
            positions = [1 - p for p in reversed(positions)]
            opacities = list(reversed(opacities))

        sorted_pairs = sorted(zip(positions, colors, opacities), key=lambda p: p[0])
        positions, colors, opacities = zip(*sorted_pairs)

        x, y = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
        # Every pattern size is defined for a 450 px wide reference image and scales with the
        # image width, so the saved image looks like the preview at any resolution.
        scale = 450.0 / width          # reference units per pixel
        ref = width / 450.0            # pixels per reference unit

        try:
            angle_deg = float(direction.replace("°", ""))
        except ValueError:
            print(f"Warning: Invalid direction '{direction}', defaulting to 0°")
            self.status_var.set("Invalid direction, defaulting to 0°")
            self.root.after(2000, lambda: self.status_var.set("Ready"))
            angle_deg = 0

        angle_rad = math.radians(angle_deg)
        dx = math.cos(angle_rad)
        dy = math.sin(angle_rad)
        lead_amt = None                      # only the "Stained glass" type sets this

        if gradient_type == "Linear":
            x_norm = x / max(width - 1, 1)
            y_norm = y / max(height - 1, 1)
            t = x_norm * dx + y_norm * dy
            t_range = np.max(t) - np.min(t)
            t = np.clip((t - np.min(t)) / (t_range if t_range != 0 else 1), 0, 1)
        elif gradient_type == "Radial":
            cx, cy = self.get_center(width, height, other_direction)
            t = np.minimum(
                np.hypot(x - cx, y - cy) / np.hypot(max(cx, width - cx), max(cy, height - cy)), 1.0
            )
        elif gradient_type == "Conical":
            cx, cy = self.get_center(width, height, other_direction)
            t = (np.arctan2(y - cy, x - cx) / (2 * np.pi) + 0.5 + angle_deg / 360) % 1.0
        elif gradient_type == "Diamond":
            cx, cy = self.get_center(width, height, other_direction)
            max_dist = (max(abs(cx), abs(width - cx)) + max(abs(cy), abs(height - cy)))
            t = np.minimum((np.abs(x - cx) + np.abs(y - cy)) / max_dist, 1.0)
        elif gradient_type == "Spiral":
            cx, cy = self.get_center(width, height, other_direction)
            max_radius = np.hypot(max(cx, width - cx), max(cy, height - cy))
            radius = np.hypot(x - cx, y - cy)
            angle = np.arctan2(y - cy, x - cx)
            t = (radius / max_radius + (angle / (2 * np.pi) + angle_deg / 360)) % 1.0
        elif gradient_type == "Plasma":
            t = (np.sin(x * 0.05 * scale + dx) + np.cos(y * 0.05 * scale + dy) + 2) / 4
        elif gradient_type == "Voronoi":
            d = None
            for px, py in self.get_voronoi_points(width, height):
                dist = np.hypot(x - px, y - py)
                d = dist if d is None else np.minimum(d, dist)
            t = np.minimum(d / (max(width, height) / 4), 1.0)
        elif gradient_type == "Cylindrical":
            cx, cy = self.get_center(width, height, other_direction)
            x_rot = (x - cx) * dx + (y - cy) * dy + cx
            max_dist = max(abs(cx), abs(width - cx), 1)
            t = np.minimum(np.abs(x_rot - cx) / max_dist, 1.0)
        elif gradient_type == "Pixelated":
            block = max(1.0, 13.0 * ref)
            x_rot = (x - width / 2) * dx + (y - height / 2) * dy + width / 1.7
            t = (np.floor(x_rot / block) * block / width + np.floor(y / block) * block / height) / 1.7
        elif gradient_type == "Abstract":
            t = (np.sin((x * dx + y * dy) * 0.05 * scale + np.cos(y * 0.05 * scale)) + 1) / 2
        elif gradient_type == "Parametric":
            cx, cy = self.get_center(width, height, other_direction)
            t = (np.sin(x * 0.02 * scale + cx / width) * np.cos(y * 0.02 * scale + cy / height) + 1) / 2
        elif gradient_type == "Hexagonal":
            d = self.hex_lattice_distance(x * scale, y * scale, 20.0)
            t = np.minimum(d / 56.25, 1.0)
        elif gradient_type == "Perlin":
            t = self.generate_perlin_noise(width, height)
        elif gradient_type == "Wave":
            t = (np.sin(x * 0.05 * scale * dx + y * 0.05 * scale * dy) + 1) / 2
        elif gradient_type == "Starburst":
            cx, cy = self.get_center(width, height, other_direction)
            angle = np.arctan2(y - cy, x - cx)
            t = np.clip((np.sin(angle * 8) + 1) / 2, 0, 1)
        elif gradient_type == "Kaleidoscope":
            t = self.generate_kaleidoscope(width, height, segments=6)
        elif gradient_type == "Tiled":
            ts = max(1.0, 50.0 * ref)
            xi = np.floor(x / ts)
            yi = np.floor(y / ts)
            t = np.clip(((xi + yi) % 2) / 2 + ((x - xi * ts) / ts) / 2, 0, 1)
        elif gradient_type == "Swirl":
            cx, cy = self.get_center(width, height, other_direction)
            radius = np.hypot(x - cx, y - cy)
            angle = np.arctan2(y - cy, x - cx)
            t = (radius / max(np.max(radius), 1e-6) + angle / (2 * np.pi) * 2) % 1.0
        elif gradient_type == "Bilinear":
            x_norm = x / max(width - 1.0, 1.0)
            y_norm = y / max(height - 1.0, 1.0)
            t = np.clip((x_norm + y_norm) / 2.0, 0, 1)
        elif gradient_type == "Fractal":
            t = self.generate_julia(width, height, angle_deg)
        elif gradient_type == "Mesh":
            # soft blended color blobs; the layout follows the seed and is rotated by Direction
            rng_m = np.random.default_rng(self.noise_seed)
            nb = 9
            gx, gy = np.meshgrid((np.arange(3) + 0.5) / 3, (np.arange(3) + 0.5) / 3)
            pts = np.stack([gx.ravel(), gy.ravel()], axis=1) + (rng_m.random((nb, 2)) - 0.5) * (0.7 / 3)
            vals = rng_m.permutation(np.linspace(0.0, 1.0, nb))
            ar = height / float(width)
            ccx, ccy = 0.5, 0.5 * ar
            px, py = pts[:, 0], pts[:, 1] * ar
            rx = np.clip(ccx + (px - ccx) * dx - (py - ccy) * dy, 0.0, 1.0)
            ry = np.clip(ccy + (px - ccx) * dy + (py - ccy) * dx, 0.0, ar)
            xn, yn = x / float(width), y / float(width)
            num_m = np.zeros((height, width), dtype=np.float32)
            den_m = np.zeros((height, width), dtype=np.float32)
            inv = 1.0 / (2 * 0.19 ** 2)
            for k in range(nb):
                w_k = np.exp(-((xn - rx[k]) ** 2 + (yn - ry[k]) ** 2) * inv).astype(np.float32)
                num_m += w_k * np.float32(vals[k])
                den_m += w_k
            t = num_m / np.maximum(den_m, 1e-12)
            lo_m, hi_m = float(t.min()), float(t.max())
            t = np.clip((t - lo_m) / max(hi_m - lo_m, 1e-6), 0, 1)
        elif gradient_type == "Aurora":
            # layered, wavy light ribbons; Direction rotates the flow
            rng_a = np.random.default_rng(self.noise_seed + 7)
            ph = rng_a.random(4) * 2 * np.pi
            ccx, ccy = 0.5, 0.5 * height / float(width)
            xn, yn = x / float(width) - ccx, y / float(width) - ccy
            u = xn * dx + yn * dy
            v = -xn * dy + yn * dx
            tau = 2 * np.pi
            wv = (v + 0.10 * np.sin(tau * 1.3 * u + ph[0]) + 0.06 * np.sin(tau * 2.7 * u + ph[1] + 2 * v)
                  + 0.04 * np.sin(tau * 0.6 * u + ph[2]))
            band = 0.5 + 0.5 * np.sin(tau * 1.6 * wv + ph[3])
            ramp = np.clip(wv * 0.9 + 0.5, 0, 1)
            t = np.clip(0.55 * band + 0.45 * ramp, 0, 1).astype(np.float32)
        elif gradient_type == "Marble":
            # flowing veins from domain-warped noise; Direction turns the vein axis, the seed changes the pattern
            n1 = self.generate_perlin_noise(width, height, cells=2.4, octaves=3, seed_off=101)
            n2 = self.generate_perlin_noise(width, height, cells=5.0, octaves=2, seed_off=202)
            ccx, ccy = 0.5, 0.5 * height / float(width)
            xn, yn = x / float(width) - ccx, y / float(width) - ccy
            u = xn * dx + yn * dy
            s_m = u * 2.2 + (n1 - 0.5) * 3.2 + (n2 - 0.5) * 0.9
            veins = (0.5 + 0.5 * np.sin(s_m * 2 * np.pi)) ** 1.6
            body = np.clip(0.5 + (n1 - 0.5) * 1.1 + u * 0.35, 0, 1)
            t = np.clip(0.62 * body + 0.38 * veins, 0, 1).astype(np.float32)
        elif gradient_type == "Contour":
            # topographic bands that follow a noise surface; Direction tilts the slope
            n_c = self.generate_perlin_noise(width, height, cells=2.2, octaves=3, seed_off=303)
            n_c = (n_c - float(n_c.min())) / max(float(n_c.max() - n_c.min()), 1e-6)
            lin_c = (x / max(width - 1, 1)) * dx + (y / max(height - 1, 1)) * dy
            lin_c = (lin_c - float(lin_c.min())) / max(float(lin_c.max() - lin_c.min()), 1e-9)
            levels = 9
            fs = (0.8 * n_c + 0.2 * lin_c) * levels
            q_c = np.minimum(np.floor(fs), levels - 1)
            t = q_c / (levels - 1)
            if height > 1 and width > 1:
                gy_c, gx_c = np.gradient(fs)
                edge = np.minimum(fs - np.floor(fs), 1.0 - (fs - np.floor(fs))) / np.maximum(np.hypot(gx_c, gy_c), 1e-6)
                line = edge < max(0.8, 1.3 * ref)                 # thin line on every band edge
                t = np.where(line, np.clip(t + np.where(t < 0.5, 0.28, -0.28), 0, 1), t)
            t = t.astype(np.float32)
        elif gradient_type == "Halftone":
            # dot screen at 45 deg: big dots at the start of the ramp, small dots at the end
            lin_h = (x / max(width - 1, 1)) * dx + (y / max(height - 1, 1)) * dy
            lo_h, hi_h = float(lin_h.min()), float(lin_h.max())
            span_h = (hi_h - lo_h) if (hi_h - lo_h) > 1e-9 else 1.0
            pitch = max(4.0, 14.0 * ref)
            c45 = s45 = math.sqrt(0.5)
            gu = (x * c45 + y * s45) / pitch
            gv = (-x * s45 + y * c45) / pitch
            iu, iv = np.floor(gu), np.floor(gv)
            dist = np.hypot(gu - iu - 0.5, gv - iv - 0.5)
            cu, cv = (iu + 0.5) * pitch, (iv + 0.5) * pitch           # dot centre back in pixels
            xc, yc = cu * c45 - cv * s45, cu * s45 + cv * c45
            lc = (np.clip(xc / max(width - 1, 1), 0, 1) * dx + np.clip(yc / max(height - 1, 1), 0, 1) * dy - lo_h) / span_h
            lc = np.clip(lc, 0.0, 1.0)
            rad = 0.7071 * np.sqrt(1.0 - lc)
            cov = np.clip((rad - dist) * pitch + 0.5, 0.0, 1.0)
            t = ((1.0 - cov) + cov * (0.5 * lc)).astype(np.float32)
        elif gradient_type == "Dither":
            # ordered (Bayer) dither between your color stops
            lin_d = (x / max(width - 1, 1)) * dx + (y / max(height - 1, 1)) * dy
            lo_d, hi_d = float(lin_d.min()), float(lin_d.max())
            r_d = np.clip((lin_d - lo_d) / ((hi_d - lo_d) if (hi_d - lo_d) > 1e-9 else 1.0), 0.0, 1.0)
            bay = np.array([[0, 2], [3, 1]])
            for _ in range(2):
                bay = np.block([[4 * bay, 4 * bay + 2], [4 * bay + 3, 4 * bay + 1]])
            cell = max(1, int(round(2 * ref)))
            thr = ((bay + 0.5) / 64.0)[(y.astype(np.int32) // cell) % 8, (x.astype(np.int32) // cell) % 8]
            nlev = len(positions)
            s_d = r_d * (nlev - 1)
            base = np.minimum(np.floor(s_d), nlev - 2)
            lvl = (base + ((s_d - base) > thr)).astype(np.int32)
            t = np.asarray(positions, dtype=np.float64)[lvl]
        elif gradient_type == "Silk":
            # long satin folds that flow along Direction; the seed changes the folds
            n_s = self.generate_perlin_noise(width, height, cells=1.6, octaves=2, seed_off=404)
            ph_s = np.random.default_rng(self.noise_seed + 29).random(3) * 2 * np.pi
            ccx, ccy = 0.5, 0.5 * height / float(width)
            xn, yn = x / float(width) - ccx, y / float(width) - ccy
            u = xn * dx + yn * dy                       # along the flow
            v = -xn * dy + yn * dx                      # across the flow
            tau = 2 * np.pi
            fold = (v * 2.4 + 0.55 * np.sin(tau * 0.55 * u + ph_s[0])
                    + 0.28 * np.sin(tau * 1.15 * u + ph_s[1] + 1.7 * v) + (n_s - 0.5) * 1.1)
            sheen = 0.5 + 0.5 * np.sin(tau * fold)
            shade = sheen * sheen * (3 - 2 * sheen)     # smoothstep: wide soft highlights
            t = np.clip(0.7 * shade + 0.3 * np.clip(0.5 + fold * 0.18, 0, 1), 0, 1).astype(np.float32)
        elif gradient_type == "Stained glass":
            # voronoi glass pieces colored from the palette, with dark lead lines between them
            rng_g = np.random.default_rng(self.noise_seed + 23)
            cs = max(8.0, width / 7.0)                  # piece size follows the image width
            gxn, gyn = int(math.ceil(width / cs)), int(math.ceil(height / cs))
            jit = rng_g.random((gyn + 2, gxn + 2, 2)) * 0.8 + 0.1       # one point per grid cell (+ 1-cell border)
            pxf = (((np.arange(gxn + 2)[None, :] - 1) + jit[..., 0]) * cs).astype(np.float32).ravel()
            pyf = (((np.arange(gyn + 2)[:, None] - 1) + jit[..., 1]) * cs).astype(np.float32).ravel()
            valf = rng_g.random((gyn + 2) * (gxn + 2)).astype(np.float32)
            row_w = gxn + 2
            base = ((np.minimum((y // cs).astype(np.int32), gyn - 1) + 1) * row_w
                    + np.minimum((x // cs).astype(np.int32), gxn - 1) + 1)     # grid cell of every pixel
            offs = [oy * row_w + ox for oy in (-1, 0, 1) for ox in (-1, 0, 1)]
            d1 = np.full((height, width), 1e9, dtype=np.float32)
            n1 = np.zeros((height, width), dtype=np.int32)
            for o in offs:                                  # nearest glass piece among the 3 x 3 cells around
                idx = base + o
                dd = np.hypot(x - pxf[idx], y - pyf[idx])
                closer = dd < d1
                n1 = np.where(closer, idx, n1)
                d1 = np.where(closer, dd, d1)
            cell_val = valf[n1]
            p1x, p1y = pxf[n1], pyf[n1]
            edge = np.full((height, width), 1e9, dtype=np.float32)      # distance to the nearest piece border
            for o in offs:
                idx = base + o
                qx, qy = pxf[idx], pyf[idx]
                dq = np.hypot(x - qx, y - qy)
                sep = np.maximum(np.hypot(qx - p1x, qy - p1y), 1e-6)
                edge = np.minimum(edge, np.where(idx == n1, 1e9, (dq * dq - d1 * d1) / (2 * sep)))
            lin_g = (x / max(width - 1, 1)) * dx + (y / max(height - 1, 1)) * dy
            lin_g = (lin_g - float(lin_g.min())) / max(float(lin_g.max() - lin_g.min()), 1e-9)
            t = np.clip(0.72 * cell_val + 0.28 * lin_g + 0.10 * np.clip(1.0 - d1 / (0.75 * cs), 0, 1),
                        0, 1).astype(np.float32)
            half = max(1.0, 1.2 * ref)                      # half the lead-line width, in pixels
            soft = max(1.0, ref)
            lead_amt = np.clip((half + 0.5 * soft - edge) / soft, 0.0, 1.0).astype(np.float32)
        else:
            t = np.clip(x / max(width - 1, 1), 0, 1)       # fallback: linear

        # Colors from the ramp table
        self._progress(0.45, "Coloring")
        pixels = apply_lut(t, lut)
        self._progress(0.55, "Coloring")

        if lead_amt is not None:
            pixels[..., :3] = np.rint(pixels[..., :3] * (1.0 - 0.88 * lead_amt[..., None])).astype(np.uint8)
        image = Image.fromarray(pixels)

        # Apply effects sequentially
        for eff_no, (eff, eff_intensity) in enumerate([(effect, intensity), (secondary_effect, secondary_intensity)]):
            if eff == "None":
                continue
            self._progress(0.6 + 0.15 * eff_no, f"Effect: {eff.replace('_', ' ')}")
            temp_image = image.copy()
            if eff == "Edge_detect":
                img_array = np.array(temp_image.convert("L"))
                edges = np.abs(np.gradient(img_array)[0])
                max_e = np.max(edges)
                edges = (edges / (max_e if max_e != 0 else 1) * 255 * eff_intensity).astype(np.uint8)
                edge_image = Image.fromarray(edges).convert("RGBA")
                image = Image.blend(image, edge_image, eff_intensity)
            elif eff == "Color_invers":
                img_array = np.array(temp_image)
                img_array[..., :3] = 255 - img_array[..., :3]
                image = Image.fromarray(img_array)
            elif eff == "Noise":
                rng = np.random.default_rng()
                img_array = np.array(temp_image)
                mask_n = rng.random((height, width), dtype=np.float32) < eff_intensity
                noise = (rng.random((height, width, 3), dtype=np.float32) * 110 - 50) * eff_intensity
                img_array[mask_n, :3] = np.clip(
                    img_array[mask_n, :3] + noise[mask_n], 0, 255).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Grain":
                rng = np.random.default_rng()
                img_array = np.array(temp_image)
                noise = (rng.random((height, width), dtype=np.float32) * 70 - 30) * eff_intensity
                img_array[..., :3] = np.clip(
                    img_array[..., :3] + noise[..., None], 0, 255).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Wave":
                img_array = np.array(temp_image)
                offset = (np.sin(x * 0.05 * scale + y * 0.05 * scale) * 30 * eff_intensity).astype(np.int32)
                img_array[..., :3] = np.clip(
                    img_array[..., :3] + offset[..., None], 0, 255).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Blur":
                image = temp_image.filter(ImageFilter.GaussianBlur(radius=eff_intensity * 25 * ref))
            elif eff == "Glow":
                temp = temp_image.filter(ImageFilter.GaussianBlur(radius=eff_intensity * 40 * ref))
                image = Image.blend(image, temp, eff_intensity)
            elif eff == "Ripples":
                img_array = np.array(temp_image)
                cx_r, cy_r = self.get_center(width, height, other_direction)
                radius = np.hypot(x - cx_r, y - cy_r)
                offset = (np.sin(radius * 0.1 * scale) * 30 * eff_intensity).astype(np.int32)
                img_array[..., :3] = np.clip(
                    img_array[..., :3] + offset[..., None], 0, 255).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Liquidify":
                img_array = np.array(temp_image)
                x_new = np.clip((x + np.sin(y * 0.05 * scale) * 20 * eff_intensity * ref).astype(np.int32),
                                0, width - 1)
                y_new = np.clip((y + np.cos(x * 0.05 * scale) * 15 * eff_intensity * ref).astype(np.int32),
                                0, height - 1)
                image = Image.fromarray(img_array[y_new, x_new])
            elif eff == "Posterize":
                alpha = temp_image.getchannel("A")                  # keep the opacity
                img_array = np.array(temp_image.convert("RGB"))
                levels = max(1, int(8 * (1 - eff_intensity * 1.8)))
                img_array = np.round(img_array / 255 * levels) * (255 / levels)
                image = Image.fromarray(img_array.astype(np.uint8)).convert("RGBA")
                image.putalpha(alpha)
            elif eff == "Vignette":
                img_array = np.array(temp_image)
                cx_v, cy_v = self.get_center(width, height, other_direction)
                radius = np.hypot(x - cx_v, y - cy_v)
                max_radius = np.hypot(np.max(x), np.max(y))
                factor = 1 - (radius / max(max_radius, 1e-6)) * eff_intensity
                img_array[..., :3] = (img_array[..., :3] * factor[..., None]).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Sepia":
                img_array = np.array(temp_image)
                sepia_matrix = np.array([
                    [0.393, 0.769, 0.189],
                    [0.349, 0.686, 0.168],
                    [0.272, 0.534, 0.131]
                ])
                img_array[..., :3] = np.clip(
                    np.dot(img_array[..., :3].astype(np.float32), sepia_matrix.T), 0, 255
                ).astype(np.uint8)
                image = Image.fromarray(img_array)
            elif eff == "Solarize":
                img_array = np.array(temp_image)
                threshold = 128 * (1 - eff_intensity)
                img_array[..., :3] = np.where(
                    img_array[..., :3] > threshold,
                    255 - img_array[..., :3],
                    img_array[..., :3]
                )
                image = Image.fromarray(img_array)
            elif eff == "Bloom":
                img_array = np.array(temp_image)
                bright = img_array[..., :3].mean(axis=2) > 128
                temp_b = temp_image.filter(ImageFilter.GaussianBlur(radius=eff_intensity * 20 * ref))
                img_array[bright] = np.array(temp_b)[bright]
                image = Image.fromarray(img_array)
            elif eff == "Mosaic":
                block = max(2, int(round((2 + eff_intensity * 30) * ref)))   # strength now matters
                bw, bh = max(1, width // block), max(1, height // block)
                image = temp_image.resize((bw, bh), Image.Resampling.NEAREST).resize(
                    (width, height), Image.Resampling.NEAREST)
            elif eff == "Distort":
                img_array = np.array(temp_image)
                x_new = np.clip((x + np.sin(y * 0.1 * scale) * 20 * eff_intensity * ref).astype(np.int32),
                                0, width - 1)
                y_new = np.clip((y + np.cos(x * 0.1 * scale) * 20 * eff_intensity * ref).astype(np.int32),
                                0, height - 1)
                image = Image.fromarray(img_array[y_new, x_new])
            elif eff == "Emboss":
                embossed = temp_image.filter(ImageFilter.EMBOSS).convert("RGBA")
                image = Image.blend(image, embossed, eff_intensity)
            elif eff == "Sharpen":
                enhancer = ImageEnhance.Sharpness(temp_image)
                image = enhancer.enhance(1 + eff_intensity * 10)
            elif eff == "Chromatic":
                # red and blue are pushed apart along Direction; the split grows towards the edges
                arr = np.array(temp_image)
                sh = eff_intensity * 60 * ref
                half_w, half_h = width / 2.0, height / 2.0
                rn = np.hypot(x - half_w, y - half_h) / max(math.hypot(half_w, half_h), 1e-6)
                kk = 0.3 + 0.7 * rn
                ox = np.rint(dx * sh * kk).astype(np.int32)
                oy = np.rint(dy * sh * kk).astype(np.int32)
                xi, yi = x.astype(np.int32), y.astype(np.int32)
                out = arr.copy()
                out[..., 0] = arr[np.clip(yi + oy, 0, height - 1), np.clip(xi + ox, 0, width - 1), 0]
                out[..., 2] = arr[np.clip(yi - oy, 0, height - 1), np.clip(xi - ox, 0, width - 1), 2]
                image = Image.fromarray(out)
            elif eff == "Pixel_sort":
                # sorts pixels by brightness inside short horizontal runs (seeded, so preview = export)
                arr = np.array(temp_image)
                run = max(2, min(width, int(round((10 + eff_intensity * 300) * ref))))
                n_run = width // run
                if n_run > 0:
                    rng_p = np.random.default_rng(self.noise_seed + 5)
                    band_h = max(1, int(round(3 * ref)))
                    n_band = -(-height // band_h)
                    pick = rng_p.random((n_band, n_run)) < 0.6
                    pick = np.repeat(pick, band_h, axis=0)[:height]
                    core = arr[:, :n_run * run].reshape(height, n_run, run, 4)
                    lum = core[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
                    order = np.argsort(lum, axis=2, kind="stable")
                    sorted_core = np.take_along_axis(core, order[..., None], axis=2)
                    core = np.where(pick[:, :, None, None], sorted_core, core)
                    arr[:, :n_run * run] = core.reshape(height, n_run * run, 4)
                image = Image.fromarray(arr)
            elif eff == "Frosted":
                # blur + tiny random pixel scatter + a touch of white = frosted glass
                rng_f = np.random.default_rng(self.noise_seed + 3)
                soft = np.array(temp_image.filter(ImageFilter.GaussianBlur(radius=eff_intensity * 18 * ref)))
                rr = max(1, int(round((1 + eff_intensity * 14) * ref)))
                ox = rng_f.integers(-rr, rr + 1, size=(height, width))
                oy = rng_f.integers(-rr, rr + 1, size=(height, width))
                xi = np.clip(x.astype(np.int32) + ox, 0, width - 1)
                yi = np.clip(y.astype(np.int32) + oy, 0, height - 1)
                arr = soft[yi, xi]
                mix = 0.05 + eff_intensity * 0.35
                arr[..., :3] = np.rint(arr[..., :3] * (1 - mix) + 255 * mix).astype(np.uint8)
                image = Image.fromarray(arr)
            elif eff == "Glitch":
                # torn horizontal bands + red/blue split + scanlines (seeded, so preview = export)
                arr = np.array(temp_image)
                out = arr.copy()
                rng_g = np.random.default_rng(self.noise_seed + 13)
                for _ in range(max(3, int(3 + eff_intensity * 24))):
                    y0 = int(rng_g.integers(0, height))
                    bh = int(rng_g.uniform(0.01, 0.08) * height) + 1
                    shift = int(rng_g.uniform(-1, 1) * eff_intensity * 0.4 * width)
                    out[y0:y0 + bh] = np.roll(arr[y0:y0 + bh], shift, axis=1)
                split = max(1, int(eff_intensity * 0.04 * width))
                out[..., 0] = np.roll(out[..., 0], split, axis=1)
                out[..., 2] = np.roll(out[..., 2], -split, axis=1)
                half = max(1, int(round(1.5 * ref)))
                dark = ((y.astype(np.int32) // half) % 2) == 0
                out[..., :3] = np.where(dark[..., None],
                                        (out[..., :3] * (1 - (0.1 + eff_intensity * 0.6))).astype(np.uint8),
                                        out[..., :3])
                image = Image.fromarray(out)
            elif eff == "Gradient_map":
                # re-color by brightness using your own palette colors (dark -> first stop, bright -> last stop)
                arr = np.array(temp_image)
                lum = (arr[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)) / 255.0
                lum = (lum - lum.min()) / max(float(lum.max() - lum.min()), 1e-6)
                mapped = apply_lut(lum, lut)[..., :3].astype(np.float32)
                mixg = min(1.0, eff_intensity * 2.0)
                arr[..., :3] = np.rint(arr[..., :3] * (1 - mixg) + mapped * mixg).astype(np.uint8)
                image = Image.fromarray(arr)
            elif eff == "Light_leak":
                # warm film light streaks and soft flares, blended with "screen"
                arr = np.array(temp_image)
                cw_l = min(width, 900)
                ch_l = max(1, int(round(height * cw_l / width)))
                rng_l = np.random.default_rng(self.noise_seed + 17)
                ar_l = height / float(width)
                gxl, gyl = np.meshgrid((np.arange(cw_l, dtype=np.float32) + 0.5) / cw_l,
                                       (np.arange(ch_l, dtype=np.float32) + 0.5) / cw_l)
                warm = np.array([(255, 140, 60), (255, 90, 110), (255, 200, 90), (255, 120, 190)], dtype=np.float32)
                leak = np.zeros((ch_l, cw_l, 3), dtype=np.float32)
                for _ in range(3):
                    cx_l, cy_l = rng_l.uniform(-0.1, 1.1), rng_l.uniform(-0.1, 1.1) * ar_l
                    ang_l, wid_l = rng_l.uniform(0, np.pi), rng_l.uniform(0.07, 0.18)
                    col_l = warm[int(rng_l.integers(len(warm)))]
                    d_l = np.abs((gxl - cx_l) * np.sin(ang_l) - (gyl - cy_l) * np.cos(ang_l))
                    al_l = (gxl - cx_l) * np.cos(ang_l) + (gyl - cy_l) * np.sin(ang_l)
                    leak += (np.exp(-(d_l / wid_l) ** 2) * np.exp(-(al_l / 0.55) ** 2))[..., None] * col_l
                for _ in range(2):
                    cx_l, cy_l = rng_l.uniform(0.1, 0.9), rng_l.uniform(0.1, 0.9) * ar_l
                    r_l = rng_l.uniform(0.03, 0.08)
                    g_l = np.clip(1 - np.hypot(gxl - cx_l, gyl - cy_l) / r_l, 0, 1) ** 2 * 0.5
                    leak += g_l[..., None] * np.array([255, 235, 210], dtype=np.float32)
                leak = np.clip(leak / 255.0, 0, 1)
                if (cw_l, ch_l) != (width, height):
                    leak = np.stack([np.asarray(Image.fromarray(leak[..., c]).resize(
                        (width, height), Image.Resampling.BICUBIC)) for c in range(3)], axis=-1)
                amt = min(1.0, eff_intensity * 2.0)
                rgb_l = arr[..., :3].astype(np.float32) / 255.0
                arr[..., :3] = np.rint((1.0 - (1.0 - rgb_l) * (1.0 - np.clip(leak, 0, 1) * amt)) * 255).astype(np.uint8)
                image = Image.fromarray(arr)
            elif eff == "Anti_band":
                # fine triangular noise that hides the visible color steps of smooth gradients
                arr = np.array(temp_image)
                rng_b = np.random.default_rng(self.noise_seed + 19)
                amp = 0.8 + eff_intensity * 8.0
                nz = (rng_b.random((height, width), dtype=np.float32)
                      + rng_b.random((height, width), dtype=np.float32) - 1.0) * amp
                arr[..., :3] = np.clip(np.rint(arr[..., :3].astype(np.float32) + nz[..., None]), 0, 255).astype(np.uint8)
                image = Image.fromarray(arr)

        return image

    # ── Canvas interaction ──────────────────────────────────────────────────
    def preview_size(self):
        """Render size for the preview. The picture is shown fitted to the canvas (self._display_size)."""
        try:
            w = max(1, int(self.width.get()))
            h = max(1, int(self.height.get()))
        except (ValueError, tk.TclError):
            w, h = 16, 9
        cw = max(self.canvas.winfo_width() - 2 * PREVIEW_PAD, 60)
        ch = max(self.canvas.winfo_height() - 2 * PREVIEW_PAD, 60)
        aspect = w / h
        if cw / ch <= aspect:
            dw, dh = cw, max(1, int(round(cw / aspect)))
        else:
            dw, dh = max(1, int(round(ch * aspect))), ch
        self._display_size = (dw, dh)
        pw, ph = dw, dh
        if pw * ph > PREVIEW_MAX_PIXELS:                      # keep live rendering fast on big windows
            f = (PREVIEW_MAX_PIXELS / (pw * ph)) ** 0.5
            pw, ph = max(1, int(pw * f)), max(1, int(ph * f))
        return pw, ph

    def _clamp_offsets(self, zoom, pw, ph):
        mx = pw * (zoom - 1) / 2 / zoom
        my = ph * (zoom - 1) / 2 / zoom
        self.canvas_offset_x.set(max(-mx, min(mx, self.canvas_offset_x.get())))
        self.canvas_offset_y.set(max(-my, min(my, self.canvas_offset_y.get())))

    def zoom_canvas(self, event):
        if event.num == 4 or event.delta > 0:
            self.zoom_level.set(min(self.zoom_level.get() + 0.1, 4.0))
        elif event.num == 5 or event.delta < 0:
            self.zoom_level.set(max(self.zoom_level.get() - 0.1, 1.0))
        self.schedule_preview()

    def start_pan(self, event):
        self.drag_start_x = event.x
        self.drag_start_y = event.y

    def pan_canvas(self, event):
        zoom = self.zoom_level.get()
        if zoom <= 1.0:
            return                                   # nothing to pan at 1x
        self.canvas_offset_x.set(self.canvas_offset_x.get() + (event.x - self.drag_start_x) / zoom)
        self.canvas_offset_y.set(self.canvas_offset_y.get() + (event.y - self.drag_start_y) / zoom)
        self.drag_start_x = event.x
        self.drag_start_y = event.y
        self.update_preview()                        # cheap: re-crops the cached render

    def _render_key(self, rw, rh):
        try:
            num = min(max(int(self.num_colors.get()), 2), MAX_COLORS)
        except ValueError:
            num = 2
        sg = self._safe_get
        return (
            rw, rh, self.show_palette.get(), self.gradient_type.get(), self.direction.get(),
            self.other_direction.get(), self.effect.get(), self.secondary_effect.get(),
            round(sg(self.intensity, 0.0), 4), round(sg(self.secondary_intensity, 0.0), 4),
            num, tuple(c.upper() for c in self.colors[:num]),
            tuple(round(float(self.position_vars[i].get()), 2) for i in range(num)),
            tuple(str(self.opacity_vars[i].get()) for i in range(num)),
            self.reverse_colors.get(), sg(self.custom_x, 50), sg(self.custom_y, 50),
            self.blend_mode.get(), tuple(self.stop_trans[:num]),
            tuple(map(tuple, self.voronoi_points)), self.noise_seed, self._overlay_sig(),
        )

    @staticmethod
    def _checker(w, h, size=8):
        yy, xx = np.mgrid[0:h, 0:w]
        odd = (((xx // size) + (yy // size)) % 2).astype(bool)
        shade = np.where(odd, 255, 204).astype(np.uint8)
        return Image.fromarray(np.stack([shade, shade, shade, np.full_like(shade, 255)], axis=2))

    # ── Preview update ─────────────────────────────────────────────────────
    def update_preview(self, *args):
        if not self.canvas or getattr(self, "_prog", None):
            return                                    # no preview while a big export is being rendered
        self.preview_pending = False
        self.last_update_time = time.time()
        try:
            pw, ph = self.preview_size()
            zoom = max(1.0, self.zoom_level.get())
            rw, rh = int(pw * zoom), int(ph * zoom)
            self._clamp_offsets(zoom, pw, ph)

            key = self._render_key(rw, rh)
            if self._render_cache and self._render_cache[0] == key:
                full = self._render_cache[1]
            else:
                self.status_var.set("Generating...")
                self.root.update_idletasks()
                if self.show_palette.get():
                    full = self.generate_palette(rw, rh)
                else:
                    full = self.generate_gradient(
                        rw, rh,
                        self.gradient_type.get(), self.direction.get(),
                        self.other_direction.get(), self.effect.get(),
                        self.secondary_effect.get(), self.intensity.get(),
                        self.secondary_intensity.get()
                    )
                self._render_cache = (key, full)

            left = (rw - pw) // 2 - int(self.canvas_offset_x.get() * zoom)
            top = (rh - ph) // 2 - int(self.canvas_offset_y.get() * zoom)
            left = max(0, min(rw - pw, left))
            top = max(0, min(rh - ph, top))
            image = full.crop((left, top, left + pw, top + ph))
            self.image = image

            shown = image
            if image.getchannel("A").getextrema()[0] < 255:       # show transparency honestly
                shown = Image.alpha_composite(self._checker(pw, ph), image)
            dw, dh = self._display_size
            if shown.size != (dw, dh):
                shown = shown.convert("RGBA").resize((dw, dh), Image.Resampling.LANCZOS)
            self.photo = ImageTk.PhotoImage(round_corners(shown, 10))
            self.canvas.delete("all")
            self.canvas.create_image(self.canvas.winfo_width() // 2, self.canvas.winfo_height() // 2,
                                     anchor=tk.CENTER, image=self.photo)
            self._draw_guides()
            self.status_var.set("Ready")
            self._refresh_history_buttons()
        except Exception as e:
            self.status_var.set("Error")
            messagebox.showerror("Error", f"Failed to generate preview: {str(e)}")

    # ── Random generation ──────────────────────────────────────────────────
    def _randomize(self, batch=False):
        """Randomise everything that is not locked (Auto Generate and Batch share this)."""
        self.voronoi_points = []
        if not self.lock_seed.get():
            self.noise_seed = random.randint(0, 2 ** 31 - 1)
        # the number of colors must be chosen BEFORE the colors themselves
        if not self.lock_num_colors.get():
            self.num_colors.set(str(random.randint(2, MAX_COLORS)))     # 2 ... 12 colors
        if not self.lock_colors.get():
            num = int(self.num_colors.get())
            for i in range(num):
                self.colors[i] = "#{:06X}".format(random.randint(0, 0xFFFFFF))
                if not self.lock_opacities.get():
                    opacity = random.choice([0.2, 0.4, 0.6, 0.8, 1.0] if batch else [0.6, 0.8, 1.0])
                    self.color_opacities[i] = opacity
                    self.opacity_vars[i].set(str(int(opacity * 100)))
        if not self.lock_gradient_type.get():
            self.gradient_type.set(random.choice(
                ["Linear", "Radial", "Conical", "Diamond", "Spiral",
                 "Kaleidoscope", "Swirl", "Cylindrical", "Pixelated", "Perlin", "Starburst",
                 "Mesh", "Aurora", "Marble", "Contour", "Silk"]
                if batch else
                ["Linear", "Radial", "Conical", "Diamond", "Spiral", "Plasma",
                 "Kaleidoscope", "Tiled", "Swirl", "Cylindrical", "Pixelated",
                 "Abstract", "Perlin", "Wave", "Starburst", "Mesh", "Aurora", "Marble", "Contour",
                 "Halftone", "Dither", "Silk", "Stained glass"]))
        if not self.lock_direction.get():
            self.direction.set(f"{random.randrange(0, 360, 5)}°")
        if not self.lock_other_direction.get():
            self.other_direction.set(random.choice(
                ["Center", "Right-center"] if batch else
                ["Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right", "Right-center"]))
        effects = (["None", "Noise", "Grain", "Blur", "Wave", "Ripples",
                    "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"] if batch else
                   ["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples",
                    "Liquidify", "Posterize", "Vignette", "Bloom", "Mosaic", "Distort",
                    "Chromatic", "Frosted", "Pixel_sort", "Glitch", "Gradient_map", "Light_leak",
                    "Anti_band"])
        effects2 = (["None", "Noise", "Grain", "Blur", "Glow", "Wave", "Ripples",
                     "Liquidify", "Vignette", "Bloom", "Mosaic", "Distort"] if batch else effects)
        if not self.lock_effect.get():
            self.effect.set(random.choice(effects))
        if not self.lock_secondary_effect.get():
            self.secondary_effect.set(random.choice(effects2))
        lo = 0.0 if batch else 0.1
        if not self.lock_intensity.get():
            self.intensity.set(random.uniform(lo, 0.5))
        if not self.lock_secondary_intensity.get():
            self.secondary_intensity.set(random.uniform(lo, 0.5))
        self.update_color_pickers()

    def generate_random(self):
        if self.batch_running:
            return
        if self.mode.get() == "Single":
            self._randomize(batch=False)
            self._history_push()
        else:
            self._run_batch_generation()

    # ── Batch generation ──────────────────────────────────────────────────
    def _run_batch_generation(self):
        if self.batch_running:
            return
        try:
            batch_size = int(self.batch_size.get())
            if not (2 <= batch_size <= 100):
                raise ValueError("Batch size must be between 2 and 100")
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid batch size (2–100).")
            self.status_var.set("Error")
            self.root.after(3000, lambda: self.status_var.set("Ready"))
            return

        size = self.get_export_size()
        if size is None:
            return
        w, h = size

        if self.lock_colors.get() and not messagebox.askyesno(
                "Colors are locked",
                "'🔒 Colors' is ON, so every image will use the same colors.\n\nContinue anyway?"):
            return

        folder = filedialog.askdirectory(initialdir=self.last_folder if self.last_folder else os.getcwd())
        if not folder:
            self.status_var.set("Batch generation canceled")
            self.root.after(3000, lambda: self.status_var.set("Ready"))
            return

        self.last_folder = folder
        os.makedirs(folder, exist_ok=True)
        self.batch_running = True
        self.auto_button.configure(state="disabled")
        self.root.configure(cursor="watch")
        self.status_var.set(f"Preparing to generate {batch_size} images...")
        self.batch_progress_bar.grid()
        self.batch_progress_var.set(0.0)
        self.root.update()

        file_ext = {"PNG": ".png", "JPEG": ".jpg", "WebP": ".webp"}.get(self.file_format.get(), ".png")
        error_log = []
        state = {"ok": 0, "counter": 0}

        def next_path():                     # never overwrite an existing file
            while True:
                state["counter"] += 1
                path = os.path.join(folder, f"Gradient_{state['counter']:03d}{file_ext}")
                if not os.path.exists(path):
                    return path

        def finish():
            self.batch_progress_var.set(100)
            self.batch_progress_bar.grid_remove()
            if error_log:
                try:
                    with open(os.path.join(folder, "batch_errors.log"), "w", encoding="utf-8") as f:
                        f.write(f"Batch Generation Errors ({time.strftime('%Y-%m-%d %H:%M:%S')}):\n")
                        for err in error_log:
                            f.write(f"{err}\n")
                except OSError:
                    pass
            self.batch_running = False
            self.auto_button.configure(state="normal")
            self.root.configure(cursor="")
            self.status_var.set(f"Completed {state['ok']}/{batch_size} images, {len(error_log)} failed")
            self.root.after(3000, lambda: self.status_var.set("Ready"))

        def process_image(i):
            if i >= batch_size:
                finish()
                return
            self.status_var.set(f"Generating image {i + 1} of {batch_size}")
            self.root.update()
            try:
                self._randomize(batch=True)
                image = self.generate_gradient(
                    w, h,
                    self.gradient_type.get(), self.direction.get(),
                    self.other_direction.get(), self.effect.get(),
                    self.secondary_effect.get(), self.intensity.get(),
                    self.secondary_intensity.get()
                )
                save_image_file(image, next_path(), *self._export_options())
                state["ok"] += 1
                self.batch_progress_var.set((i + 1) / batch_size * 100)
            except Exception as e:
                error_log.append(f"Image {i + 1}: {str(e)}")
            self.root.after(10, lambda: process_image(i + 1))

        process_image(0)

    # ── Palette generation ──────────────────────────────────────────────────
    def generate_palette(self, width=600, height=250, save=False):
        try:
            num = int(self.num_colors.get())
        except ValueError:
            num = 2
            self.num_colors.set("2")
        num = min(max(num, 2), MAX_COLORS)
        colors = [color.upper() for color in self.colors[:num]]
        opacities = []
        for i in range(num):
            try:
                opacities.append(float(self.opacity_vars[i].get()) / 100)
            except ValueError:
                opacities.append(self.color_opacities[i])
        if self.reverse_colors.get():
            colors = colors[::-1]
            opacities = opacities[::-1]

        image = Image.new("RGBA", (width, height), (255, 255, 255, 255))
        draw = ImageDraw.Draw(image)
        # up to 6 colors go in one row; 7-12 colors are split over two rows so nothing is cramped
        cols_n = num if num <= 6 else (num + 1) // 2
        rows_n = -(-num // cols_n)
        gap = max(4, width // (cols_n * 10))
        sw = max(8, (width - gap * (cols_n + 1)) // cols_n)
        top = max(6, height // 25)
        rowh = height if rows_n == 1 else (height - top) // rows_n
        sh = int(rowh * 0.60)
        fs = max(8, min(int(sw / 8.5), int(rowh / 14)))
        font = get_pil_font(fs)
        small = get_pil_font(max(7, int(fs * 0.85)))

        for i, (color, opacity) in enumerate(zip(colors, opacities)):
            x0 = gap + (i % cols_n) * (sw + gap)
            y0 = top + (i // cols_n) * rowh
            draw.rectangle((x0, y0, x0 + sw, y0 + sh), fill=color)
            ty = y0 + sh + max(4, fs // 2)
            r, g, b = self.hex_to_rgb(color)
            draw.text((x0, ty), color, fill=(0, 0, 0, 255), font=font)
            draw.text((x0, ty + int(fs * 1.5)), f"RGB {r},{g},{b}", fill=(40, 40, 40, 255), font=small)
            draw.text((x0, ty + int(fs * 2.7)), f"Opacity {int(round(opacity * 100))}%",
                      fill=(40, 40, 40, 255), font=small)

        if save:
            try:
                file_path = filedialog.asksaveasfilename(
                    defaultextension=".png", initialfile="Palette.png",
                    filetypes=[("PNG files", "*.png"), ("JPEG files", "*.jpg *.jpeg")]
                )
                if file_path:
                    file_path = save_image_file(image, file_path)
                    self.status_var.set(f"Palette saved to {file_path}")
                else:
                    self.status_var.set("Save canceled")
            except Exception as e:
                self.status_var.set("Error")
                messagebox.showerror("Error", f"Failed to save palette: {str(e)}")
        return image

    # ── Color palette generator ──────────────────────────────────────────────
    def generate_color_palette(self, base_color, harmony, num_colors):
        try:
            palette = self.harmony_palette(base_color, harmony, num_colors)
            if palette is None:
                return
            for i in range(min(num_colors, len(palette))):
                self.colors[i] = palette[i]
            self.update_color_pickers()
        except Exception as e:
            self.status_var.set(f"Error generating palette: {str(e)}")
            self.root.after(2000, lambda: self.status_var.set("Ready"))

    def harmony_palette(self, base_color, harmony, num_colors):
        """The colors 'Generate palette' would use (including the Warm / Cool setting). Nothing is applied."""
        try:
            rgb = self.hex_to_rgb(base_color)
            h, l, s = rgb_to_hls(*(c / 255.0 for c in rgb))
            palette = [base_color]

            if harmony == "Complementary":
                new_h = (h + 0.5) % 1.0
                new_rgb = hls_to_rgb(new_h, l, s)
                palette.append(self.rgb_float_to_hex(new_rgb))
                if num_colors > 2:
                    palette.extend([base_color] * (num_colors - 2))
            elif harmony == "Analogous":
                angles = [-0.083, 0.083]
                if num_colors > 3:
                    angles.extend([-0.166, 0.166, -0.25, 0.25][:num_colors - 3])
                for ang in angles:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Monochromatic":
                lightness_steps = [max(0.1, l - 0.2), min(0.9, l + 0.2)]
                if num_colors > 3:
                    lightness_steps.extend(
                        [max(0.1, l - 0.3), min(0.9, l + 0.3),
                         max(0.1, l - 0.15), min(0.9, l + 0.15)][:num_colors - 3]
                    )
                for new_l in lightness_steps:
                    new_rgb = hls_to_rgb(h, new_l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Triadic":
                angles = [0.333, 0.667]
                if num_colors > 3:
                    angles.extend([0.0, 0.333, 0.667][:num_colors - 3])
                for ang in angles:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony in ("Tetradic", "Square"):
                if harmony == "Tetradic":              # rectangle: 0, 60, 180, 240 degrees
                    base_angles, extra = [0.1667, 0.5, 0.6667], [0.3333, 0.8333]
                else:                                  # square: 0, 90, 180, 270 degrees
                    base_angles, extra = [0.25, 0.5, 0.75], [0.125, 0.875]
                angles = base_angles + extra[:max(0, num_colors - 4)]
                for ang in angles:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Split-Complementary":
                angles = [0.4167, 0.5833]
                if num_colors > 3:
                    angles.extend([0.0, 0.4167, 0.5833][:num_colors - 3])
                for ang in angles:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Shades":
                lightness_steps = [max(0.1, l - 0.3), max(0.1, l - 0.15),
                                   min(0.9, l + 0.15), min(0.9, l + 0.3)]
                if num_colors > 5:
                    lightness_steps.extend([max(0.1, l - 0.45), min(0.9, l + 0.45)][:num_colors - 5])
                for new_l in lightness_steps[:num_colors - 1]:
                    new_rgb = hls_to_rgb(h, new_l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Compound":
                angles = [0.5, 0.4167, 0.5833]
                if num_colors > 4:
                    angles.extend([0.333, 0.667][:num_colors - 4])
                for ang in angles:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Pentadic":
                for ang in [0.2, 0.4, 0.6, 0.8][:num_colors - 1]:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))
            elif harmony == "Hexadic":
                for ang in [0.1667, 0.3333, 0.5, 0.6667, 0.8333][:num_colors - 1]:
                    new_rgb = hls_to_rgb((h + ang) % 1.0, l, s)
                    palette.append(self.rgb_float_to_hex(new_rgb))

            palette = palette[:num_colors]
            if len(palette) < num_colors:
                palette.extend([base_color] * (num_colors - len(palette)))

            # never hand back two identical colors: shift lightness (and a little hue) of repeats
            seen = set()
            for i, col in enumerate(palette):
                key = col.upper()
                if key in seen:
                    hh, ll, ss = rgb_to_hls(*(c / 255.0 for c in self.hex_to_rgb(col)))
                    for step in range(1, 40):
                        delta = 0.12 * (((step + 1) // 2 - 1) % 5 + 1) * (1 if step % 2 else -1)
                        dh = 0.02 * ((step - 1) // 10) * (1 if step % 4 < 2 else -1)
                        cand = self.rgb_float_to_hex(hls_to_rgb((hh + dh) % 1.0, min(0.92, max(0.08, ll + delta)), ss))
                        if cand not in seen and cand not in palette:
                            palette[i], key = cand, cand
                            break
                seen.add(key)

            temp = self.temp_var.get()
            if temp == "New Scheme":
                for i in range(len(palette)):
                    rgb2 = self.hex_to_rgb(palette[i])
                    hh, ll, ss = rgb_to_hls(*(c / 255.0 for c in rgb2))
                    hh = (hh + random.uniform(-0.1, 0.1)) % 1.0
                    ss = min(1.0, ss * 1.2)
                    new_rgb2 = hls_to_rgb(hh, ll, ss)
                    palette[i] = self.rgb_float_to_hex(new_rgb2)
            elif temp != "Neutral":
                for i in range(1, len(palette)):
                    rgb2 = self.hex_to_rgb(palette[i])
                    hh, ll, ss = rgb_to_hls(*(c / 255.0 for c in rgb2))
                    # nudge the hue toward orange (Warm) or blue (Cool) along the short way round
                    target = 0.08 if temp == "Warm" else 0.60
                    diff = ((target - hh + 0.5) % 1.0) - 0.5
                    hh = (hh + max(-0.06, min(0.06, diff))) % 1.0
                    new_rgb2 = hls_to_rgb(hh, ll, ss)
                    palette[i] = self.rgb_float_to_hex(new_rgb2)

            return palette
        except Exception as e:
            self.status_var.set(f"Error generating palette: {str(e)}")
            self.root.after(2000, lambda: self.status_var.set("Ready"))
            return None

    # ── Presets ──────────────────────────────────────────────────────────────
    def load_settings(self):
        try:
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, "r") as f:
                    settings = json.load(f)
                    theme = THEME_ALIASES.get(settings.get("theme", "midnight"), settings.get("theme", "midnight"))
                    if theme in self.themes:
                        return theme
            return "midnight"
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error loading settings: {e}")
            return "midnight"

    def save_settings(self, theme_name):
        self.prefs["theme"] = theme_name
        self._save_prefs()

    @staticmethod
    def _read_prefs():
        """Preferences from the settings file (missing or damaged values fall back to the defaults)."""
        prefs = dict(DEFAULT_PREFS)
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                acc = str(data.get("accent", "") or "")
                prefs["accent"] = acc.upper() if re.match(r"^#[0-9A-Fa-f]{6}$", acc) else ""
                fmt = data.get("default_format", "PNG")
                prefs["default_format"] = fmt if fmt in ("PNG", "JPEG", "WebP") else "PNG"
                folder = str(data.get("default_folder", "") or "")
                prefs["default_folder"] = folder if os.path.isdir(folder) else ""
                prefs["confirm_close"] = bool(data.get("confirm_close", True))
                prefs["theme"] = data.get("theme", "midnight")
                prefs["tooltips"] = bool(data.get("tooltips", True))
                bgp = data.get("default_background", "Transparent")
                prefs["default_background"] = bgp if bgp in ("Transparent", "White", "Black") else "Transparent"
                prefs["remember_window"] = bool(data.get("remember_window", False))
                geo = str(data.get("window_geometry", "") or "")
                prefs["window_geometry"] = geo if re.match(r"^\d+x\d+[+-]\d+[+-]\d+$", geo) else ""
                prefs["window_zoomed"] = bool(data.get("window_zoomed", False))
        except (OSError, ValueError):
            pass
        return prefs

    def _save_prefs(self):
        try:
            with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
                json.dump(self.prefs, f, indent=4)
        except OSError as e:
            print(f"Error saving settings: {e}")

    def _theme_for(self, name):
        """The chosen theme, with your own accent color on top when you set one in Settings."""
        base = self.themes[name]
        acc = str(self.prefs.get("accent", "") or "")
        if not re.match(r"^#[0-9A-Fa-f]{6}$", acc):
            return base
        t = dict(base)
        t["accent"] = acc.upper()
        t["accent_hover"] = _blend("#FFFFFF", acc, 0.25)
        t["on_accent"] = _contrast_text(acc)
        return t

    def load_presets(self):
        paths = [PRESETS_PATH, os.path.join(app_dir(), "GG_Presets.json"), "GG_Presets.json"]
        for path in paths:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.presets = [p for p in data if isinstance(p, dict)] if isinstance(data, list) else []
                return
            except Exception:
                continue
        self.presets = []

    def save_presets(self):
        try:
            with open(PRESETS_PATH, "w", encoding="utf-8") as f:
                json.dump(self.presets, f, indent=2)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save presets: {str(e)}")

    def get_current_settings(self):
        return {
            "name": "Preset",
            "gradient_type": self.gradient_type.get(),
            "direction": self.direction.get(),
            "other_direction": self.other_direction.get(),
            "custom_x": self.custom_x.get(),
            "custom_y": self.custom_y.get(),
            "effect": self.effect.get(),
            "secondary_effect": self.secondary_effect.get(),
            "intensity": self.intensity.get(),
            "secondary_intensity": self.secondary_intensity.get(),
            "num_colors": self.num_colors.get(),
            "colors": [color.upper() for color in self.colors[:MAX_COLORS]],
            "color_opacities": self.color_opacities[:MAX_COLORS],
            "color_positions": self.color_positions[:MAX_COLORS],
            "reverse_colors": self.reverse_colors.get(),
            "blend_mode": self.blend_mode.get(),
            "stop_trans": list(self.stop_trans[:MAX_COLORS]),
            "lock_intensity": self.lock_intensity.get(),
            "lock_secondary_intensity": self.lock_secondary_intensity.get(),
            "lock_opacities": self.lock_opacities.get(),
            "zoom_level": self.zoom_level.get(),
            "temperature": self.temp_var.get(),
            "width": self._safe_get(self.width, 1920),
            "height": self._safe_get(self.height, 1080),
            "aspect_ratio": self.aspect_ratio.get(),
            "noise_seed": self.noise_seed
        }

    def apply_preset(self, preset):
        try:
            def as_float(v, default, lo, hi):
                try:
                    return min(hi, max(lo, float(v)))
                except (TypeError, ValueError):
                    return default

            self.gradient_type.set(preset.get("gradient_type", "Linear"))
            self.direction.set(preset.get("direction", "0°"))
            self.other_direction.set(preset.get("other_direction", "Center"))
            self.effect.set(preset.get("effect", "None"))
            self.secondary_effect.set(preset.get("secondary_effect", "None"))
            self.intensity.set(as_float(preset.get("intensity", 0.1), 0.1, 0.0, 0.5))
            self.secondary_intensity.set(as_float(preset.get("secondary_intensity", 0.1), 0.1, 0.0, 0.5))

            n = str(preset.get("num_colors", "2"))
            if n not in [str(k) for k in range(2, MAX_COLORS + 1)]:
                n = "2"
            self.num_colors.set(n)

            cols = []
            for c in list(preset.get("colors", []))[:MAX_COLORS]:
                c = str(c).upper()
                cols.append(c if self.is_valid_hex_color(c) else "#CCCCCC")
            defaults = list(DEFAULT_COLORS)
            self.colors = cols + defaults[len(cols):] if cols else defaults

            ops = [as_float(o, 1.0, 0.0, 1.0) for o in list(preset.get("color_opacities", []))[:MAX_COLORS]]
            self.color_opacities = ops + [1.0] * (MAX_COLORS - len(ops))

            raw = preset.get("color_positions")
            if isinstance(raw, list) and len(raw) >= int(n):
                pos = [as_float(p, 0.0, 0.0, 1.0) for p in raw[:MAX_COLORS]]
                self.color_positions = pos + DEFAULT_POSITIONS[len(pos):]
            else:
                self.distribute_positions(int(n))

            bm = preset.get("blend_mode", "RGB")
            self.blend_mode.set(bm if bm in BLEND_MODES else "RGB")
            tr = [t if t in TRANSITIONS else "Smooth" for t in list(preset.get("stop_trans", []))[:MAX_COLORS]]
            self.stop_trans = tr + ["Smooth"] * (MAX_COLORS - len(tr))
            self.custom_x.set(as_float(preset.get("custom_x", 50), 50, 0, 100))
            self.custom_y.set(as_float(preset.get("custom_y", 50), 50, 0, 100))
            self.reverse_colors.set(bool(preset.get("reverse_colors", False)))
            self.lock_intensity.set(bool(preset.get("lock_intensity", False)))
            self.lock_secondary_intensity.set(bool(preset.get("lock_secondary_intensity", False)))
            self.lock_opacities.set(bool(preset.get("lock_opacities", False)))
            self.zoom_level.set(as_float(preset.get("zoom_level", 1.0), 1.0, 1.0, 4.0))
            self.temp_var.set(preset.get("temperature", "Neutral"))
            try:
                if "noise_seed" in preset:
                    self.noise_seed = int(preset["noise_seed"]) % 2 ** 31
            except (TypeError, ValueError):
                pass

            try:
                w, h = int(preset["width"]), int(preset["height"])
                if 1 <= w <= MAX_DIM and 1 <= h <= MAX_DIM:
                    self._res_updating = True
                    try:
                        if (w, h) != (self._safe_get(self.width), self._safe_get(self.height)):
                            self.size_preset.set("Custom Size")
                        self.width.set(w)
                        self.height.set(h)
                        self.aspect_ratio.set(preset.get("aspect_ratio", "Custom"))
                    finally:
                        self._res_updating = False
            except (KeyError, TypeError, ValueError):
                pass          # older presets have no resolution

            self.voronoi_points = []
            self.sync_color_widgets()          # sliders + opacity boxes drive the renderer
            self.update_color_pickers()
            self.schedule_preview()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to apply preset: {str(e)}")

    def preset_thumbnail(self, p, size=(72, 40)):
        key = json.dumps(p, sort_keys=True, default=str)
        photo = self._thumb_cache.get(key)
        if photo is not None:
            return photo

        def num_in(v, d):
            try:
                return min(0.5, max(0.0, float(v)))
            except (TypeError, ValueError):
                return d
        try:
            st = self._preset_render_state(p)
            im = self.generate_gradient(
                144, 80, str(p.get("gradient_type", "Linear")), str(p.get("direction", "0°")),
                str(p.get("other_direction", "Center")), str(p.get("effect", "None")),
                str(p.get("secondary_effect", "None")), num_in(p.get("intensity", 0.1), 0.1),
                num_in(p.get("secondary_intensity", 0.1), 0.1), state=st)
            im = Image.alpha_composite(self._checker(144, 80, 6), im.convert("RGBA"))
        except Exception:
            im = Image.new("RGBA", (144, 80), (90, 90, 110, 255))
        im = im.resize(size, Image.Resampling.LANCZOS)
        photo = ImageTk.PhotoImage(round_corners(im, 7))
        self._thumb_cache[key] = photo
        return photo

    def open_preset_window(self):
        win = self.make_dialog("Manage Presets", 500, 600)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(0, weight=1)
        t = self.theme

        self._label(body, "Presets", size=13, bold=True).grid(row=0, column=0, sticky="w")
        self._label(body, "Name", color="dim", size=9).grid(row=1, column=0, sticky="w", pady=(10, 4))
        name_var = tk.StringVar(value="New Preset Name")
        self._entry(body, name_var, width=30, justify="left").grid(row=2, column=0, sticky="ew")
        self._label(body, "Saved presets   (click: select  |  double-click: load  |  star: favourite)",
                    color="dim", size=9).grid(row=3, column=0, sticky="w", pady=(14, 4))
        holder = ScrollFrame(body, self, bgkey="surface", width=440)
        holder.canvas.configure(height=260)
        holder.grid(row=4, column=0, sticky="ew")
        holder.inner.columnconfigure(0, weight=1)
        sel = {"i": None}
        rows = {}

        def row_bg(i):
            return _blend(t["accent"], t["surface2"], 0.32) if i == sel["i"] else t["surface2"]

        def paint():
            for i, widgets in rows.items():
                c = row_bg(i)
                for w in widgets:
                    try:
                        w.configure(bg=c)
                    except tk.TclError:
                        pass

        def select(i):
            sel["i"] = i
            name_var.set(self.presets[i].get("name", ""))
            paint()

        def need():
            i = sel["i"]
            if i is None or not (0 <= i < len(self.presets)):
                return None
            return i

        def toggle_fav(i):
            self.presets[i]["favorite"] = not self.presets[i].get("favorite", False)
            self.save_presets()
            rebuild()

        def rebuild():
            for w in holder.inner.winfo_children():
                w.destroy()
            rows.clear()
            order = sorted(range(len(self.presets)), key=lambda k: (not self.presets[k].get("favorite"), k))
            if not order:
                self._label(holder.inner, "No presets yet. Set up a look, type a name above and press "
                            "Save Current.", color="dim", size=9, bgkey="surface", wraplength=400,
                            justify="left").grid(row=0, column=0, sticky="w", pady=10)
            for pos, i in enumerate(order):
                p = self.presets[i]
                bg = row_bg(i)
                row = tk.Frame(holder.inner, bd=0, highlightthickness=0, bg=bg)
                row.grid(row=pos, column=0, sticky="ew", pady=3, padx=(0, 12))
                row.columnconfigure(1, weight=1)
                img = self.preset_thumbnail(p)
                th = tk.Label(row, image=img, bd=0, bg=bg)
                th.grid(row=0, column=0, padx=(8, 10), pady=8)
                nm = tk.Label(row, text=p.get("name", "Unnamed"), anchor="w", font=F(10), bd=0, bg=bg, fg=t["text"])
                nm.grid(row=0, column=1, sticky="ew")
                fav = bool(p.get("favorite"))
                star = RoundButton(row, self, icon="star_fill" if fav else "star",
                                   style="primary" if fav else "ghost", height=30, radius=9, bgkey="surface2",
                                   command=lambda k=i: toggle_fav(k))
                star.grid(row=0, column=2, padx=(6, 8))
                Tooltip(star, self, "Remove from favourites" if fav else "Add to favourites (shown first)")
                rows[i] = (row, th, nm)
                for w in (row, th, nm):
                    w.bind("<Button-1>", lambda e, k=i: select(k))
                    w.bind("<Double-Button-1>", lambda e, k=i: (select(k), load_preset()))
            holder.canvas.yview_moveto(0)

        def save_preset():
            name = name_var.get().strip()
            if not name:
                messagebox.showerror("Error", "Preset name cannot be empty")
                return
            preset = self.get_current_settings()
            preset["name"] = name
            preset["favorite"] = False
            for k, existing in enumerate(self.presets):
                if existing.get("name") == name:
                    preset["favorite"] = bool(existing.get("favorite", False))
                    self.presets[k] = preset
                    sel["i"] = k
                    break
            else:
                self.presets.append(preset)
                sel["i"] = len(self.presets) - 1
            self.save_presets()
            rebuild()

        def load_preset():
            i = need()
            if i is None:
                messagebox.showerror("Error", "Select a preset to load")
                return
            self.apply_preset(self.presets[i])

        def random_preset():
            if not self.presets:
                messagebox.showerror("Error", "No presets saved yet")
                return
            pool = [p for p in self.presets if p.get("favorite")] or self.presets
            self.apply_preset(random.choice(pool))

        def rename_preset():
            i = need()
            if i is None:
                messagebox.showerror("Error", "Select a preset to rename")
                return
            new_name = name_var.get().strip()
            if not new_name:
                messagebox.showerror("Error", "New preset name cannot be empty")
                return
            self.presets[i]["name"] = new_name
            self.save_presets()
            rebuild()

        def delete_preset():
            i = need()
            if i is None:
                messagebox.showerror("Error", "Select a preset to delete")
                return
            del self.presets[i]
            sel["i"] = None
            self.save_presets()
            rebuild()

        def export_preset():
            i = need()
            if i is None:
                messagebox.showerror("Error", "Select a preset to export")
                return
            try:
                file_path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON files", "*.json")])
                if file_path:
                    with open(file_path, "w", encoding="utf-8") as f:
                        json.dump(self.presets[i], f, indent=2)
                    self.status_var.set(f"Preset exported to {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export preset: {str(e)}")

        def import_preset():
            try:
                file_path = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])
                if file_path:
                    with open(file_path, "r", encoding="utf-8") as f:
                        preset = json.load(f)
                    if not isinstance(preset, dict) or "name" not in preset:
                        raise ValueError("Invalid preset format")
                    self.presets.append(preset)
                    self.save_presets()
                    rebuild()
                    self.status_var.set(f"Preset imported from {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to import preset: {str(e)}")

        r1 = self._frame(body)
        r1.grid(row=5, column=0, sticky="ew", pady=(14, 6))
        r1.columnconfigure((0, 1, 2), weight=1, uniform="p")
        RoundButton(r1, self, text="Load", style="primary", height=36, fill=True, command=load_preset).grid(
            row=0, column=0, sticky="ew", padx=(0, 4))
        RoundButton(r1, self, text="Save Current", style="secondary", height=36, fill=True,
                    command=save_preset).grid(row=0, column=1, sticky="ew", padx=4)
        rnd = RoundButton(r1, self, text="Random", icon="sparkle", style="secondary", height=36, fill=True,
                          command=random_preset)
        rnd.grid(row=0, column=2, sticky="ew", padx=(4, 0))
        Tooltip(rnd, self, "Apply a random preset (from your favourites if you have any)")
        r2 = self._frame(body)
        r2.grid(row=6, column=0, sticky="ew")
        r2.columnconfigure((0, 1, 2, 3), weight=1, uniform="q")
        for i, (text, cmd) in enumerate((("Rename", rename_preset), ("Delete", delete_preset),
                                         ("Import", import_preset), ("Export", export_preset))):
            RoundButton(r2, self, text=text, style="ghost", height=32, fill=True,
                        command=cmd).grid(row=0, column=i, sticky="ew", padx=2)
        rebuild()

    # ── Reset ────────────────────────────────────────────────────────────────
    def reset_settings(self):
        self.num_colors.set("2")
        self.other_direction.set("Center")
        self.custom_x.set(50)
        self.custom_y.set(50)
        self.lock_colors.set(True)
        self.lock_num_colors.set(True)
        self.lock_direction.set(False)
        self.lock_other_direction.set(False)
        self.lock_effect.set(False)
        self.lock_secondary_effect.set(False)
        self.lock_gradient_type.set(False)
        self.lock_opacities.set(False)
        self.lock_seed.set(False)
        self.gradient_type.set("Linear")
        self.direction.set("0°")
        self.effect.set("None")
        self.secondary_effect.set("None")
        self.intensity.set(0.0)
        self.secondary_intensity.set(0.0)
        self.colors = list(DEFAULT_COLORS)
        self.color_opacities = [1.0] * MAX_COLORS
        self.color_positions = list(DEFAULT_POSITIONS)
        self._sel_stop = 0
        self.stop_trans = ["Smooth"] * MAX_COLORS
        self.blend_mode.set("RGB")
        self.reverse_colors.set(False)
        self.lock_intensity.set(False)
        self.lock_secondary_intensity.set(False)
        self.show_palette.set(False)
        self.zoom_level.set(1.0)
        self.voronoi_points = []
        self.hex_centers = {}
        self.canvas_offset_x.set(0)
        self.canvas_offset_y.set(0)
        self.temp_var.set("Neutral")
        self.scheme_var.set("Complementary")
        self.mode.set("Single")
        self.batch_size.set("10")
        self.file_format.set(self.prefs["default_format"])
        self.size_preset.set("Custom Size")
        self.export_quality.set(95)
        self.ov_text_on.set(False)
        self.ov_background.set(self.prefs["default_background"])
        self.guides.set("Off")
        self.clear_logo()

        for i in range(MAX_COLORS):
            self.position_vars[i].set(self.color_positions[i] * 100)
            self.opacity_vars[i].set(str(int(self.color_opacities[i] * 100)))

        self.update_color_pickers()
        self.schedule_preview()

    # ── About ──────────────────────────────────────────────────────────────
    def show_about(self):
        win = self.make_dialog("About", 430, 590)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=26, pady=20)

        try:
            self.gg_image = ImageTk.PhotoImage(fit_width(asset_image("GG.png"), 330))
            lab = tk.Label(body, image=self.gg_image, bd=0)
            self.skin(lab, lambda w, t: w.configure(bg=t["surface"]))
            lab.pack()
        except Exception:
            self._label(body, "Gradient Gen", size=20, bold=True, anchor="center").pack()
        self._label(body, f"Version {APP_VERSION}", color="dim", anchor="center").pack(pady=(4, 0))
        self._sep(body).pack(fill="x", pady=14)

        self._label(body, "A powerful gradient generation tool with multiple gradient types and effects.",
                    wraplength=370, justify="left").pack(anchor="w")
        bullets = ["Multiple Gradient Types", "Color & Opacity Controls", "Effects & Intensities",
                   "Preset Management", "Batch Mode", "8 Color Themes", "Real-time Preview"]
        for text in bullets:
            row = self._frame(body)
            row.pack(anchor="w", pady=1, padx=(10, 0))
            self._label(row, "●", color="accent", size=6).pack(side="left", padx=(0, 9))
            self._label(row, text, color="text", size=10).pack(side="left")

        dev = self._frame(body)
        dev.pack(fill="x", pady=(18, 6))
        try:
            ns_image = ImageTk.PhotoImage(asset_image("NS.png"))
            ns_label = tk.Label(dev, image=ns_image, bd=0)
            ns_label.image = ns_image
            self.skin(ns_label, lambda w, t: w.configure(bg=t["surface"]))
            ns_label.pack(side="left", padx=(0, 14))
        except Exception:
            self._label(dev, "NS", size=16, bold=True).pack(side="left", padx=(0, 14))
        who = self._frame(dev)
        who.pack(side="left")
        self._label(who, "Developed by", color="dim", size=8).pack(anchor="w")
        self._label(who, "Nihad Square", color="accent", size=12, bold=True).pack(anchor="w")

        for text in ("Product: Premium", f"Build: {APP_BUILD}", f"Version: {APP_VERSION}"):
            self._label(body, text, color="dim", size=8).pack(anchor="w")
        self._sep(body).pack(fill="x", pady=12)
        self._label(body, "© 2025-2026 Nihad Square. All rights reserved.", color="dim", size=9,
                    anchor="center").pack()
        link = tk.Label(body, text="GitHub", font=(UI_FONT, 10, "underline"), cursor="hand2", bd=0)
        self.skin(link, lambda w, t: w.configure(bg=t["surface"], fg=t["accent"]))
        link.pack(pady=(8, 0))
        link.bind("<Button-1>", lambda e: webbrowser.open_new("https://github.com/nihadsquare/gradient-gen"))

    # ── Tutorial ──────────────────────────────────────────────────────────────
    def show_tutorial(self):
        win = self.make_dialog("Tutorial", 470, 640)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=24, pady=20)
        self._label(body, "Quick start", size=13, bold=True).pack(anchor="w", pady=(0, 12))
        steps = ["Gradient: pick a type, then set Direction and Position.",
                 "Colors: up to 12. Click a dot or a chip to pick one, then set its color, position and opacity. On the bar: click to add, drag to move, double-click to change, right-click to delete.",
                 "Blend In (RGB, HSL or OKLab) sets how colors mix; To Next sets how each color moves on (Smooth, Ease, Step, Hold).",
                 "Generate Palette makes matching colors. Palette Tools holds Library, Edit, Harmony and Import.",
                 "Library: Extract Colors from an image, choose how many to find and how to Pick them. Use the Select and Order lists to pick groups (First 12, Most Vivid, Warm Only ...) or set the number order, then Use Selected.",
                 "Effects: add up to two and set their strength.",
                 "Auto Generate picks 2 to 12 colors at random. Lock icons keep a setting fixed; Seed keeps a pattern, the dice makes a new one.",
                 "Undo / Redo steps through your last 5 Auto Generate images. Presets save your looks; star favorites or try Random.",
                 "Output: size presets, PNG / JPEG / WebP, quality and Background. Overlays add text or a logo. Big exports show a progress bar with Cancel.",
                 "Copy as: Image (Ctrl+C), CSS (Ctrl+K), SVG. Guides (G) show thirds, safe area and crop frames on the preview only.",
                 "Settings (header): theme, accent color, default format, background and folder, Tooltips, Remember Window and the closing question.",
                 "Shortcuts: Ctrl+S save, Ctrl+Z / Ctrl+Y undo / redo, Space auto generate, F full screen, G guides."]
        for i, text in enumerate(steps, 1):
            row = self._frame(body)
            row.pack(fill="x", pady=4)
            chip = tk.Label(row, text=str(i), font=F(9, True), width=2, bd=0)
            self.skin(chip, lambda w, t: w.configure(bg=t["accent"], fg=t["on_accent"]))
            chip.pack(side="left", padx=(0, 12))
            self._label(row, text, wraplength=380, justify="left").pack(side="left")
        RoundButton(body, self, text="Got it", style="primary", height=36, fill=True, command=win.destroy).pack(
            fill="x", pady=(18, 0))

    # ── Progress with Cancel (big exports) ─────────────────────────────────────
    def _open_progress(self, title, text):
        """Small modal window with a bar and a Cancel button. The render reports to it between its steps."""
        win = self.make_dialog(title, 360, 150)
        body = self._frame(win)
        body.pack(fill="both", expand=True, padx=22, pady=18)
        body.columnconfigure(0, weight=1)
        self._label(body, title, size=12, bold=True).grid(row=0, column=0, sticky="w")
        info = self._label(body, text, color="dim", size=9)
        info.grid(row=1, column=0, sticky="w", pady=(2, 10))
        var = tk.DoubleVar(value=0.0)
        ttk.Progressbar(body, variable=var, maximum=100, mode="determinate").grid(row=2, column=0, sticky="ew")
        prog = {"win": win, "var": var, "label": info, "cancel": False}

        def cancel():
            prog["cancel"] = True
            info.configure(text="Cancelling ...")
        RoundButton(body, self, text="Cancel", style="secondary", height=32, width=110, command=cancel).grid(
            row=3, column=0, sticky="e", pady=(14, 0))
        win.protocol("WM_DELETE_WINDOW", cancel)
        self._prog = prog
        win.update()

    def _progress(self, frac, text=None):
        """Called by the renderer between its steps: moves the bar, keeps the window alive, honours Cancel."""
        p = getattr(self, "_prog", None)
        if p is None:
            return
        try:
            if text and not p["cancel"]:
                p["label"].configure(text=text)
            p["var"].set(frac * 100)
            p["win"].update()
        except tk.TclError:
            pass
        if p["cancel"]:
            raise RenderCancelled()

    def _close_progress(self):
        p = getattr(self, "_prog", None)
        self._prog = None
        if p is not None:
            try:
                p["win"].destroy()
            except tk.TclError:
                pass

    # ── Save image ──────────────────────────────────────────────────────────
    def save_image(self):
        if self.image is None:
            messagebox.showerror("Error", "No image generated yet. Click 'Auto Generate' or adjust settings.")
            return
        try:
            if self.show_palette.get():
                self.generate_palette(1200, 500, save=True)
                self.status_var.set("Ready")
                return

            size = self.get_export_size()
            if size is None:
                return
            width, height = size

            # ask WHERE first, so Cancel does not waste a long render
            safe_type = re.sub(r"[^A-Za-z0-9_-]+", "", self.gradient_type.get())
            fmt = self.prefs.get("default_format", "PNG")
            ext = {"PNG": ".png", "JPEG": ".jpg", "WebP": ".webp"}.get(fmt, ".png")
            kinds = {"PNG": ("PNG files", "*.png"), "JPEG": ("JPEG files", "*.jpg *.jpeg"),
                     "WebP": ("WebP files", "*.webp")}
            options = dict(defaultextension=ext, initialfile=f"Gradient_{safe_type}_{width}x{height}{ext}",
                           filetypes=[kinds[fmt]] + [v for k, v in kinds.items() if k != fmt])
            if self.last_folder:
                options["initialdir"] = self.last_folder
            file_path = filedialog.asksaveasfilename(**options)
            if not file_path:
                self.status_var.set("Save canceled")
                return

            self.status_var.set(f"Rendering {width} x {height} ...")
            self.root.configure(cursor="watch")
            self.root.update()
            if width * height >= PROGRESS_PIXELS:
                self._open_progress("Saving image", f"{width} x {height} px")
            try:
                image = self.generate_gradient(
                    width, height,
                    self.gradient_type.get(), self.direction.get(),
                    self.other_direction.get(), self.effect.get(),
                    self.secondary_effect.get(), self.intensity.get(),
                    self.secondary_intensity.get()
                )
                self._progress(0.97, "Writing the file")
                file_path = save_image_file(image, file_path, *self._export_options())
            finally:
                self._close_progress()
            self.last_folder = os.path.dirname(file_path)
            self._dirty = False
            self.status_var.set(f"Image saved to {file_path}")
        except RenderCancelled:
            self.status_var.set("Save canceled")
        except MemoryError:
            self.status_var.set("Error")
            messagebox.showerror("Out of memory", "This size needs more memory than is available. Try a smaller size.")
        except Exception as e:
            self.status_var.set("Error")
            messagebox.showerror("Error", f"Failed to save image: {str(e)}")
        finally:
            self.root.configure(cursor="")


# ── Embedded assets (GG.ico / GG.png / NS.png) ───────────────────────────────
ASSETS = {
    "GG.ico": """
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
c57Qk51rZIRvhCuleueqmrZ4kn89IczeVGSI2BHLkB0i/cI65eq0C47/cD91hrNa5eQbYQYlMxzFNcTEBwQVCZXbZdPuihwVUgmf
+3THu5GhU5f0o1lPcBDLTU+VCCul7c2U1c25fGPu+F3DXZanGhWkTTv36YusdYuI5ZJXN364nyRkFB9hXSw1QnHKsxv/G5+vlCr5
NHdK6pMXM7aNmqZQ1qKYCNsbdu2btNwrC/sA4WMeu9pIZEtUyJ56sUoztf98Z9nnq1sPKNUw2eWx853LnV3q/WQLR2oMCn+yODxr
vIiWq9PJsXIhhgWeXSOtK3ROhb99F6I+K2xceI5olWShzuT4nB3XZmm0QIM//lxsgVaxSOrgTFkjgwWn7h3dKfZSfFrMP+Hjv2q3
vqd59Yio8Lws09IRuXNPhcvtcjza/tnkXK/M6zmW07a9fjpeZrtYiFbZlFy7U5lHg1Uj4o+KjVjnudlL/YdXeJHHjdLKsFXWZWNO
0Z7RjpzUHDbEQ9rzgrP74IUjzqqPkxAf7qxeJvk0dZX1sBvqRwe3CdVyW+68dLTsAps7QqHiC1rMEa7c/ih/nE7+klspS3u2eaVa
PDRVbufzyuO7bz8ZI3xq0vlFrcPUTjlbfpHvf+/Ie8vzx2fprjkdeU9O5GzCta+2BZ4h0uclgmyKr0SIVNgVq+WuCpcuVCnZploS
Q5t8T7XXzvnlq3bOr/JVnLdkjXzbYUNEL4kvaPm8T/qZYQ8mvHq2+0j31KxMqQezdynta6/RVaRoveqcDV+LEQ5UznqmSLq8R8O8
Pl4kJ2ploVPEyq+RMXPyPb97zzSf1FNy1sTNU74OpWmKh4iWtZw52WTyaPEyh/M7UnrERUrsbxXWUyZUOfZa0PnvSt6bjstFh+0N
j3ObLzbJbnF6m7GDY3PkFmgYn0jcHbRbblpm9uOgnVcWdy9U2e0n469LG5z0ffaJj29SWj03lLoQqFCWEdM/8fvYSYsn758vUlaQ
muJyoTztY3RY/7AM4RSRBUqxVwa27+m6GpE4LT1U6bxOiNM0e+MxhYGuuaEihKqjllBmzPHEKuPcIhGnxUk/nueK2zuUWRZ3sF96
IXz3NW2zXU93ntUSuqRU+IboezXdSbKrUIXbiP2FC0XKvHPHhY+6H+kw+kHYuEzXYruS4o/iaxUX7ZBObR0VKmF/pUKymPbyjVYH
s+IvqU6BgW/Kd6V23rWkOGKxjvCwUY4Oc9ZEXFm8Qyq1Y1SQUJD7he9awh8/jplr7itb5pdr0yY0Rats6Mx9uiVRBam78v/16HVv
7bYJ96XNbHsvzkIdcpUzqNQuDimpmJpQejF6R6eFYrHqczq8Ex6zvgXqfs/cXpnrzltPW+06TVv4WOSLHPEF8oUTu4bJGCeGh0os
aOs43Pll1Wipey8uFyVcWRxklT34lXZE/EHhY0tfvA37kTm1akn4/Cdz5+7J7HJkl4pectd3iyTVk5b5tg5pU9h2sqTceQPRoQpA
QNU5ek/TQyUdvRwSr14NjvDvGHXCWe1qcDeNH1eDCwapR/qnd1oX4GF/r7v2S9uxV6ZLJpquj/TvSPN7rXRDyEdtd8XAfplK57rG
3FWZ6ejw5PHzs2qXhIctWWmYIuFo43R6akgP0eAVG9RHzslPXyHr1K1rqLLbwAg/2YxtV76ODa5UcwjSzIm7IddP8kqnkQF6K0Ve
Jj10Uwq3nWNtMy1RZv2tkarWe/w6blK/euZ6ye0dHYJ6rTm752ae+NKlxZUeG/unXE67339acsHV4Gfyix8oCnfe5ZF7Ml9tydQv
WqXthedP3L+tpGxv5sA8r8zjIRPvJSfvXO10vezmhS0aoU6L8+abpVe0fuymfC7CL1Z7gK7kxk8Vcx1SdOSzZXbYLJm9zrnMRiqi
qpfoqEmzzIsd9gy8bi5x/JDZ5EnbLzo+NP3sPXmSsKENGlea6XJVT83Ie/JvzgQtaz/xrthYlUupz9JeBcTOcF/zWG7YZUVESY+S
/MuDPAo9JGct3DvletCumKpXqcnej+88Gm+TY/pZZr2vhd23/ptVf5gsi8zq7aMwO6nw+iCJnPJ/zdzXeKnaRYwUcxpwvVTl8dXL
X8cWV9g5hIZrD+goedA9wU1Z4mpw5jex96ulr/YTn3pEbc5dozW3ZUfmXb+ZpfTkm/Lc+WsvWoVP6bn6pOexOy4yJ6Mn5MuGP+iY
sVtp/f3H86oclt/OMLUg9G8fzFAQPVipLTojf646kfjJ4th8hScP255RI2yLO98zvOa/1eVRVFBelJrmPIs+r+TM7EtoZw7PFis4
lTDz1kZhhR+oI/L91IWPhxVkvDy89KrRpZRoLSMrB8m9CnujTt048a51dKHsM8sWm8cuHTJVNavNtTMdT83Pzr82ZZKMoY3rXY1U
y+6qUYeLZq8Sv6S+fpH2zAGHL6beqdhlZOQYU5Be4janWC/1RuYu8dSP7vGvNj4YW+EVRizTvN+9bU8bpyCtMQteD+3R0+HOiO9f
N4+tcm6TMfXJobPLAuNMDyl59l0QqtZ5wPjX2tbz5C+luKv2eyS2SH5DWfyybPeB6nMU/jMaObD9gHNrogZnR18u9DaaJHO7je64
jWYxO62Lt3UavelH/D9qidrL2k28azlj+fARs14ET7w78+mVxePCtbzeiofd9RjRWdh05Uon/7EVBVNDzs3cNOuLV8py/08rh577
7n3ynLMomljHri0urhBrvXHHqFlVZrGZPSI2Xw7/YWv/Pfm8SkYMevzmSeJTE++mdhnj6LA5cKT3EgnDDW//09B0kKswLsmOdB7X
LvPe0FOqKbIV80tGrV0fL+u0SX3UnOKszW1CN997IXFzcGB8y+tDe6zd42ggZrih/9yPiXHakhu9D7hkL3wZN63gntzRxzPiVMum
jo+SMDyYYZO2+Gju95MTZOQuiVb0LPlwd6Wo9tnbneeIll3wztE9df67l6r6XD2gsO00LbuT8fN72i4wXhOz6M2P5e5ruvtf17qh
sMMpp9h/7ZEtiy/2Mo1pF9g+aNzo/Kz9dv/dMXG4++ylSpsX4XGtj+Y65kdUOAlXfHqZNUs5vK1YfGJpinTyRofLEcP/Sz+rpv88
eUd65+zwhBVuOfJZ+x/dVfD4Z+0zuwv+XdyUxfRPZ13aTUQHxmZq6MftHGJ/7fh+OYuUCsuTM1ad8J8brn1ot4tkiGqyxGWtmdOD
9/bqmXDju9JW86czv0ioac5R6qOEZmdFy8+PyrZui9O9IhE74eiDu4fSR/UQj3w15Kpcv2OHr5xR+PLIMmvrlF7TJ7//saXNfKfb
G95u3jJ//bW8cW1eCHlHSojky1dKjZig13nEYKHx7yqHewkfvPboeYXB9aicf1+XucnIZnvdNdKcaJOitCjeNX2L7ykZH4MhoeKP
k32zNW9vl3Rr72DafcUqh5v5mSIBsY83D56z/X+RN4K3S7sHt3tx+ULmtnMhY/dKd/lKu6SSlGwzBm2drfPuG3S8kX3j6pMf+q0+
XjU98fZNUJR/bvnJpOyvEet6+0j7LdyacHnyUb2JURKL8/5D7GLG7QdLBg6Yt2zL94yTgwAp3/wltyqVhMRtNLiy7d5SmoxwzsLi
McNmf1ki/nHcxAqd656aV890fBQ1+sTUssO2d8UqRkTuVuoVrGHpumb3pA5tLQt0gnoFf7i5ZEub0Oi8hwgdj1+EF2S4BKUtlrh3
MCgux0Qm353mm7CpRLN35ASbnDMd1dTnrt7/aYlam6S4IUeS+m25nzTVUy/nYoCM27vRu5ePHP11yMb0ey9ctny6N9vcvmLWgdMn
0QS5jibIfjuVlvM8XioXzyqpCDP+nz9t0EvC5v7XXWcGPa+4sFl1Yed1gUWJAQ5LR26+n1XkrCwWEHtydzuhncq+leY7UrrphFq+
u7977eniEbma4rdKp3246bV5+Lxl/0NoQHPD9FDbCHn9kgm+KbesZROV5HKHnT+z1OtKuo2EapsHU6vyixe/LvQO/jI7XMvola2K
99NKieTz90pV9l3or9965a0vWVFIIpI8q/l9Uo8Ypzuf3w83tyjda3RkgWzGfxdOz7538IJEcoeU8w/FukiFeT9eG2q/zcm8pBAu
Lc7ddjPP5+WbIsXE1H+Ovpp30qbXyZ573CP8Yg7MWHnvxdmOQzdf0lmpM27jFtWFNoFXiuL9u1z5kBZ4p3PX8D4pPTR+zHTJ3Zs5
f9rHgbTp+e3PfVv68smaVdMq8tsrfz67bFtKrwN3LV0G6Mhq0vIdfPsqhs93XSJhFyX+ccyxBZ1vrHJI+/DyVY/h5bpplU6vXOIv
Phfr8r2N+I/sh3odx21EfGbh+mVnd603kB2jddVMNlD6GzFy6O73PZSiHlaG9vYcKC33WUkjtkzz1rUuWWd2Zym1fro8Z63vopjK
2Ra3uk078/RFu2VDDtyd5K0SKOKj9uD5waRsjf3RPuWbx6Zlms6zeNX1u1mHkf3nVAn7Viq+O2Hpkdv5VZLKOpObOgmzTU5IOmsl
KKN7yqpcA8fFl8h7mjx8+r/dy3U+KCqEdd01qAva2HbrCiX59jg9a6N+i1LCzzVDXii//aD+tD1yHunnnOWPdBwqP1IlmlaiMHLA
ro0nREcoJSofmS3yOHnNkZKIY8btaAsX+efOO/ng+aT9m4kUbymptL4Tv37xVnF/IjZhsndaa9uvy8ukPhJnlfxe99kf631NUSzB
wp1WHv3mwAXLXevWD7t/Td7eXTS+V/TO1ctmRM2cfbTF3hAppwE+57Vdl6CnSrkkLXs1RPvwR6d89/i3GX6zj/q0O9YLdVHkUX/a
3d2jxXI36k5ZEdDhQv+ETDvUGdd0uxzVwF4nac4aSwImHr216GhXF9F4uejAfQ/uKnqE3Pd4Fz2x0Cot0/u8qqsEal/I77XVGVp3
p/QN4Tuc4qYP96AphF1KldvonyQ8zVA55NgT/aD7YxRmuYpq51n2p73XPO1k5FM0cJrJu1GSbbWFMyUQb5G80qbyfqL1Wcnl/ufG
e4/3QJceChJ61Ov25FZWbx1G9vY+r53WMpq2e7vpzH2P7p9D7a73f5D85mLk7u7tJy+RdF7mt+z6nfOGBkOFksb8K7Wo1cSv0oC+
8JCJfR29DBxF3/5YLnq5hV/gmuX+6sMl/i1/Vl713mfXTadi4zTr+S2DNeQjWjmEjpxi4hr6cEjQu5KZuT0SaJ0HjJ1VlbF5eLn5
kfltE6c/+WZ7xspbJ3T9xYWiWTuQFHd8+pXXd4Rkrnjuf9Zz57G4gcF9954TPpazNXjG8mO0xG+P7jx4qlXg7ueuPD9i5AbtAZe/
qCCJZ0ip+D9F4jtsFhdkKERZHXpm2t4t5+6apUV7BiQZv2vhrduONkU/Nfjo9G8VnU1TSkYHEpWehoeuT+pvMGYEyI8dNqmn3YoZ
kaX0utDg87c110F08zSx6XbXKFD1UfqRBRe/ll/Sn6iZpPD1xZn3ywYFEsJZbXLKD/S8ar7MIe2mjozhnKp2O5xSzmStLkhH+yf6
5HKsh+qj6Har9Fs+GbCuRfTAQXM3nrvWedr7lavMzDvoqZxuL5zpKW+H1qXHm9Yp0f5vzkSpeGj6vX4ptlw+bvj84QaR/nYy7VdN
WH9s+pUBj1Tnzj/hobHnWGHwoWeSdjPk/zOKX3/6sjbaXR5u2UPMI960HmmBFpLy51fqK8OWv1qtP10qrUXIsRVFGYjXPL2ZrJ6U
bbTDZpWWkUJU37R9vho/pszXObAx0m9iloZ3YnmncZ0rHIJsK7X0W03t/nXR+2Gob4v8j536/M+b1nFPPO73fCdlb/N1NFpk7WUm
oZYOJ6/zF/cZKFuUgKTba4hggDPlyAo/o0nr8zYE9Z6x54eRUNKwziMH5H0+3UtJ1DAi4aS1ee48m+KLdhUjvInBAXrLnkWFn503
sED8CHHJpnM3g3U+X2Uev62KVroR6vBumXerdjTjq8db0xYOmWEzZOrzMJvBaQfX9TUUfWHuW9lJXf3S0oTp7sGhRlX/W/m/yAyL
s2W62h1WXolJTpoY/XaQY9vdmdeMjjp0V31kmr5wx6zZ0fJC46+Ubsp/fqRL+o7DlZVlvVVDv2i+Oj3/f/M7Z8dML6tSHPk6mnYq
c9WlRO0PSzfvyxgboOnQjrZo9Uh3mqjOlWiapGuUgpB8hEx7YW1JNU9RZ3nzFZJh2qNVFWguN01/u9A24KrGB9c9i6sWJDy+OTH1
km7HjsOygu6YGvWYQXuZFBw9vtQspl3UwA6SnWKm3Br16HFhac4e3UWIFyocPZzY/1aqpQ9aEdcqpqzvvldVP25PgK2LfL85/5S/
3fcwY9f5N7nXkIzcZ3aFsptI6asHnf32xyYM6uJ2OETocayOpGFM4X/jD31ReXtCS16om65Z8LOZZ1tFjQzM89R/HZQwxN773Eyb
vJdDlaXPjsrzVN+25n3Oip3Ro170Q0Jr/y552+2u5hdnGbxe1dskdsSoD12W7lytPWDPx6F73/Tos/+Sz0O7JX1SVrzNUPL4KrtT
d5hrOXqEkNm9rYZHA1Zut+uWvWPngIux4fefo34jGSX1jN7NLSLGg0ecXXD9aYbEbI3+Gl7q1mZ9b109cf1YoVmU+LBeDp9ckr12
Oq1CO9xDOy80Da3GbT0/+/Dx0+dXRbR8hzjj20OlH+eNeyF8xsrTLHT79HdHPItCFi2oan3omXzU8aroQTaPeigdzjNb4XCtwmxZ
ZOCKGAdnjRuiI8Uexyb0S3E+PSvKp1DGt7LdEZvuqv0eW7+T75xQGk3T0C88ctHDxMb9clef/XPWhn+ecOtaH2XpG8cPm8nsmtan
aId1YNGHIxPUjHq/vuNy6LO2SN6FERUL3degxdNn9lH/w8mPbupt3/Vx2GW51uoJi+dIJTuLxh881fF9jx4zwi5auRyf0yXv/gRx
n70GrT5qB2npbFIfkGN06trhj16Li/aNHfSxu4F01lbtoF6mDmWeL1XTbl7+8ib4vQqScP0RJd/0eDXPRjLtoWd+ak/1pS1+uImO
GG4pM8ygx4YbJzwNXgclDrHfH1iKCPj57IiB7VWjTlcNXvjswux1j37YxLRLTAv2ufZqxapL6/SXSaa1QgzxdPn3034SaMvK2Ka3
QuOl7fpjI+OiaR+2JK1RCw27/LlAf5Ovn9GzlVNiArcmur24Vbr1UaaLgVvcmdExprbT5Pp8ulK+/foIhb0hkVu/tNnw3hAJOjHn
57dSCE/WET4mt7Ltd8nZmgRCmtmbWKH+lx5P7mH69HUhEkm8VNuGSAfLoAPRy7yTxCLT6fIKTxzNBweu0h9j3vuSxBXTNjeG/tvh
f8PuHQpKjB/isHSLerfz3RYul0zdMaHjrojRS/PsPogohC3UdryUWcTv4vtDL8zt+HK3tLako5tovGyi/VHFSJ/zSf/rKP48osv8
lj5b9Dd0P/9gv6tovFgimnJj3k5cijjMGcc1M9dY9JR5PX0x2j+CL65723rd2VWrLW57q3Tpi9idmXVFS6NJEYWu4bYrVY1yup+b
s7ZtVuy0+AHnRl6P0nr2yT6xx3Wv7MgJb9aZTD+AOKjOypHTcmWfmX/Vmfnw6rYhSqOylDScvrm9nn5/W4cY4albykOQxNl+5ZWe
R6KXvlp978VsU6uqY5Kz1GHjHTP9x3GtN2cGh0QPmRpt2/LxMPk+Jjtel8Q6pT8pXnx/s7+zjPKXG0k/rt5Qaxsi4bNFfccW/9ZK
gUV56IqYKTEdhz57oKO2pifiJ9uTCvVUtRbaSHfvhZjfSFVrkbz5alrfWy6LfOWt4jdeR1xcYtiNgl7EYDhOz/2qjnj7GcfLNzMH
o4a7bLTTftVlm7bwMTGfLStkkre8uGyjdEPBx2C9v/xt55FtlgbGyiFxWGhljwXxn+7IrL9PdMyYPMOddibh3UubJeLX8no5fb4z
a8nrhp0bu1dmt7XPshBavW6m2Egbd8fvG2NXXRYLDR2eEJ1mb7hBRcqtV8quku7yEf/Mz1yyOSLgwNHcB0c/vN9Xbhz9vxc91se2
FJcKz6vc2G6Z47ALJTmbtxB9biVeUNWP3RPg4KITKmNoEzFyQIHuxsUaEW49Jt1Q8VBAMi0SYWxVkEza+5+7fvsvLSp4Hi+d4Nxq
X9Dsy77CuSKPz0/LQjLf8tvDxwR/P6i/of24jccKDZZFZqFW0Wm85/5pEnPnt7CwCbsX4GT3yDs/cKu41g35KCuHUM29IUsPzNjo
89XodLnlkfmLtYfoLtuqecJl02eadOqtWSozp1s+2WLSF5EnJi5w0bFFwwcnDupy+1maipnMcrTDIBHR/5PvrcT/1i/fi45jgYOV
No8NdhvTwvXp+Clxfq9fSCxHIlDApKN+h2MT3l/0fJ68DMk7nl893aZutzt3uev563PjTzwXG9wi9eKXtytUcsSLe8aLrz8/ZGiM
elC/QdFaRi+/Sx8KGOZuEDlS+dh0OFr5m8ROjk771zPfdNGEJ5NcDXZql6yNObKgm/yh3qVTc23fPh4yF5hrnJ7MpJhXeY/nz468
t3w0YRM24oK0/SfaJbEeIkG2xS/PLHVVnpuULfv+o9XGflXCiT16nIyYEtPH6JnnuZk+b5VazF6boaUzruUo1YJOnXZqz1z+Ndux
o+TBOdkaaOva8HQgOhg/eP82OFkt7Zir8vdJKbu9Ulrunp2ztEVxia/KP+1oj8P18pfSJl+/fkv6SqfTx9AZI6Pi5abHrksuOnoc
nyMhMinhyhR0qO1x0ihh8TFD6/OfTXakOD9Pdj09ayXaHmHLnS/rNKDjsiEzN753Hvo9ubhdscb4oBBDe4Uw1TLH3CVhl3cX+Vzo
deDa11XFi3UdQtc8fH/7TrH+njV6m9T3rHZCg9ipYP/MA82lrDZXTD+3ayGc+fGWRNllJNzHHrB4Hp2V8eJB51c/pCPWuGl4xeRM
Svr8Q+tAF/2uy32Fp3bXE6YVKxerFifsLpo446nrkic3vowLTlY3Olql66O22VPqdptdA2x9z83p76bsuzpDa4qMx5H+kdFpL9wP
V96blre475Cg1ntDEq5tSAl7m64Y0fdlkkJXvYJbRZEWqUUzp784I5y5VnJmGNHyooRqz/KP9ruMZ0ZPFJ3aam/ImsjEvV97j56K
dmzv43OW3NVT7uVnlO2SvaPDuJaHli+T8fimqx6V287rwuev3dWHzH18IVzrkGVUrv871DYhtn1x4fPQ/GcitDLF4kmpN9ZeupB8
3Gxm2GZ0FindtP/BXdMuhCpIXVE3367y77Q983vE/aEgYRwK7rErc/PhDSXJktvuWZaZfpaq0NUo7XS6X//s5GVFnRU9vkYZ5kz8
sP+fvNm3lcYL5Ue3FYu/Ji0ZPpyW3eKizbsLH1oWuq0R2uG0qiD9xInynuvNTVcg2eip6jKH9LKbF1Q150lHnfj2KTnN5dggxysV
L1UGHr4Y0SclAk5EDzfq2EbuqMx+nPxj1hChKjtTkS6lVZkJEpnthB+HxwlXyRWX7y76NuLJE9udNxM/Dru2f/jI4O+ThsRViqz0
XSCH9nm/6ecSdksbxr9dPWTbd0eTYZWi/5TaL7m5IUe2e+qN8M5FbzZ9e1laoVscmHrbOye4yLT3LXeDdaaHpuddH2cbmtf/8Tp3
15137hAGR4dWaD14XqD/cEG/odt8s+SMhJxkKzy/xPjOC30SSTu1MHdTeIrIAqt3XYocz/sNjat029g/bl3fGKlX32cMufTNYNGx
6Ztflj2fplY2P79iiEysutOH+yLjf+SOC/NqM/xDh6HSyYnnkt6pqWl2k08ccbrc3GqcveHUkC7D3bNy9z5Z/OmKpmvYmc62q/rF
pcTsMFxtEJf0cZje+3vXZdPeJH202vmk+3nV5Dcy9tmE0KnnQhdsQp48N81tY+ztQlMpm5IrnSoRtkpYjqbk/fj+ZSWbLz1dXS3H
vRkT1qJYeF5UTtF91bdBJ1ReLXFs4Vygckbyskax9ynVZ9IOkhcPf/pSmGqrHThu0TELhXntd9xOPZh6MrV/5owfNj2Knh98YfO/
k7RTKvEekts9w+M8lqi6pZrlaubGpFbGxAWJRa2J8RZLWKY5ymn5sBDCoVhxmsKUYpvIRz+sKjr+aB2W3uJBO3GFedGjpJIPlZ2M
KdLwmi9WKhzketTSQVZD6NbzTuu0d8urFBrHjVt4LXt56qRUo6zJLx4a7wpKnCR8rI/LYHcd2lTLYenS0qnK0xSNxXv6JSnFdj8m
t3P7ommpEfl3i9rNy77zJV+zSmbeweSHh0M+aa9YaNHSnWafnNDab59Np3ft5o13S9ikmbPom0z2kznPRZ6Jr6Bt0ShV8E/vNK1V
4S2nnDnJMkNcpV2SHnb+dis3690W2sx5/8n6Rd/bpnaEdpQWGmFd5neKdrFloe6zJa2jB3e7NkzMNWrfrrfPeu06+SXj+KX5jxye
PsxZvxs9VrFVWPr4o9tbd9Zxv+E7I//dzTjxz/nyL0TnTXG1mGkr1WOnm7TLk85C9mqzFWK3z285pWTcvX8vvO+XsrljYM6KB1LO
XbpEtDSZJ/agVe6/1+ePydV/apEkZ9yidKfjkuMhSeN0/EaVyD/rWyI/5L8NoWLP727838snO06p/xhbkmg2+ZVuWL9XM2Iev828
suJKavDMli9Ccp/np/fssErbcq7U82Fb3aa9vZdcdUYv8Ouue2fvbxLOvNtykbzQ8pjHNvcG6yZLxPZX7Xb+g+tENIvGnbkQnxOD
kIhm+0m3JzT7OO3bcyL6WSd9XXLvic2r3i1Sx042D/STn9rOMCrHfc+LFpzlhzST1ckZLZGU9cM5Tm/TEcd3L20HdZHaeyFOXfHG
sPeW2stERm357/Q4d9q3FWlfx0pemVkYrRkBu8vzMw9MD72cZ+Gdky3+UvX9xzF2h4K10OlAIVHZt1K479vJE1tK+LXo9HBT8LOD
6ncdPqTpKXn23djv0o4DUg92pKTeem/jHTv4vhe6Qy1S69D0KW8Ixah3TzZ1lYz1nDtxZpb+qBFjq74EFKj468zxufwhLTAgdsZA
R4V9ht3SC0USlU9Kh14/vSVj7ejH+zLNyjcUpFyruL9OYpR8C5G9IeFfNoWoZQz3DRBdv+ha3tEZ797rLQ0MJbQ2jzQ/qbovxsRq
uIfyuR7Dq+JEX3S6safroimrvlWMHRK00vCx0xXU0kPT6MUnfK+hR14NTo29ERox/d3MjEhtmYI7xiFLv2wK3XJ+tuzD5K5GbacO
WfXvAdpMs3+OSl5p8bYz0eJL917mZuWa4j6lJa/zi7UHjD1dbvymdVy8/8LTwYMlpqwxO7l81clBC7csvVc0ek5+OtpVWz7dsmKn
vdVbBySQHk/6/E/avkc9Xy25Exu0H7V8aOdZpYL7njtbRA8cuDD84a3lqp6X9Jb0ve7nrHpB/r//Xh1rJX5kdsztx07pD7fkXOv9
LTz0Hw0v9zXdNZaUSxZ/lL5763K2iz1qxyj+7ISP779Hpj8ZnCGX7+HrPMGtWwfN/vpjFG/ojBxS8G+pkITuIZN5cql31owRSpLc
bp90tJvLgYvjSiqTTXZmub25+V7fWbbM836kvP8VuxKX7VvaH0TbrmiWRrb26GV7/x3fUvu2cLFVidoU1zMDxao6vHPt4PFGNH7M
fzcmpRbpDdXUCd4hVCV84qyO/ujetKdlyuU0SZ1tSalHj6cbJC+J7dHCefn9FNEKn/t5CoqvZqRq6Q2N7vDvbtqpT4apKmtNIjJn
mIg4SQRob/voNHoAbZBmmVFxr3Bp703e+Woti4+GH+04dPXufw+hy2WKzU6pSi7ZJl8mlvt4W9Do06VLVsStLBDtbzDwrDVRbpyr
WP56hJ1lybSX/x/jf84fkVLFDpty/kwoZGyY7fKAdYvAHkGLSSU3q4DlavEBTr795hbcf7Qf2DOVCjxmF2R4oCZowW3Dx8Nczhx2
6ak1g9YB9Yb5LHadcRJfqx48uG7wfZ5EhdAP9heJ97fKBs9VmPy63uzC99UWuzxvnzzI+qD5QD/ze5Yuz+nruUMa9Rn3s9icOuZr
cI/pD8uH2gMpl1jfMineWvy7dMvD/BPvPd6vF2TMSJ78+HB7w3cGeSfug28dNF8WvWvSqmp5zPnlzHF16fe5bnw/zLZw7JHfwS6x
sP5WJ38M+z6+P4pVc+qdzfXb9k+sq9xgmy6saNCw+MDeA9IXCj+L3DL2mKxwRWq99AGTXeI1rLkS0maaGVKH1b5z3frgz/zd9F89
t5VllFt7X+YN+Ruu/C91Fwjv0GfUXzT9W17EC9W2/ZZKDNYbWgtNDKPiMhWzKnNPlR3bcPbvqmnVvt67Oy84bXnqqZH04/bkaew3
zd8ocKxMsXe7kP9dm02fo0kBC3IK+/nf+X+zzJzz+6VBq7Q8Xf1c1jklNAEAC4BKTw==
""",
    "GG.png": """
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
""",
    "NS.png": """
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
fCA=
""",
}


# ── Main entry point ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        set_app_user_model_id()
        root = tk.Tk()
        UI_FONT = pick_ui_font(root)
        app = GradientGeneratorApp(root)
        root.mainloop()
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            messagebox.showerror("Error", f"Gradient Gen could not start:\n{e}")
        except Exception:
            pass
        sys.exit(1)
