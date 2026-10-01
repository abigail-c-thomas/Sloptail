import { toBitmap, type Bitmap } from "@sloptail/printer";

/**
 * The browser's version of the print bridge's rasterizer: draw the SVG on a
 * canvas, then dither exactly as the printer path does. Loaded through an
 * <img>, so nothing in the SVG can run.
 */
export async function svgToBitmap(svg: string, widthDots: number): Promise<Bitmap> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const height = Math.round((widthDots * (img.naturalHeight || 1)) / (img.naturalWidth || 1));
  const canvas = document.createElement("canvas");
  canvas.width = widthDots;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, widthDots, height);
  ctx.drawImage(img, 0, 0, widthDots, height);
  const { data } = ctx.getImageData(0, 0, widthDots, height);
  const grey = new Uint8Array(widthDots * height);
  for (let i = 0; i < grey.length; i++) grey[i] = Math.round(0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!);
  return toBitmap(grey, widthDots, height);
}
