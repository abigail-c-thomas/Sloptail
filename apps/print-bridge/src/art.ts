import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { toBitmap, type Bitmap } from "@sloptail/printer";

/**
 * Model-drawn SVG to printer dots. resvg renders it (a full SVG renderer, so
 * gradients, masks and curves come out as the model meant), then greys are
 * dithered for the thermal printer.
 */

let ready: Promise<void> | null = null;

function init(): Promise<void> {
  ready ??= (async () => {
    const wasm = await readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"));
    await initWasm(wasm);
  })();
  return ready;
}

/** Render `svg` `widthDots` wide on white and dither it. */
export async function svgToBitmap(svg: string, widthDots: number): Promise<Bitmap> {
  await init();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: widthDots },
    background: "white",
    // Nothing external: no fonts, no files. Drawings aren't allowed text anyway.
    font: { loadSystemFonts: false },
  });
  const image = resvg.render();
  const { width, height, pixels } = image;
  const grey = new Uint8Array(width * height);
  for (let i = 0; i < grey.length; i++) {
    const [r, g, b, a] = [pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!, pixels[i * 4 + 3]! / 255];
    grey[i] = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a));
  }
  image.free();
  resvg.free();
  return toBitmap(grey, width, height);
}
