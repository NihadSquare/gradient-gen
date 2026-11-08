// The uploaded logo lives outside the store (it is an image object, not plain data).
export const logoState: { image: HTMLImageElement | null; name: string } = { image: null, name: "" };

export function loadLogo(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      logoState.image = img;
      logoState.name = file.name;
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not an image the browser can read."));
    };
    img.src = url;
  });
}

export function clearLogo() {
  if (logoState.image) URL.revokeObjectURL(logoState.image.src);
  logoState.image = null;
  logoState.name = "";
}
