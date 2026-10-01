/**
 * 1-bit images for the printer. Thermal printers have no grey: every dot is
 * black or not. Greys are faked with dithering; line art just needs a threshold.
 */

/** Rows of packed bits, most significant bit first, 1 = black. `width` is a multiple of 8. */
export interface Bitmap {
  width: number;
  height: number;
  bits: Uint8Array;
}

export type Dither = "threshold" | "atkinson";

/**
 * Turn greyscale (0 = black, 255 = white, one byte per pixel, row-major) into
 * a printable bitmap. The width is padded with white to a multiple of 8.
 *
 * Atkinson dithering keeps line art crisp (it only spreads 3/4 of the error)
 * while still giving soft shading on filled areas.
 */
export function toBitmap(grey: Uint8Array, width: number, height: number, opts: { dither?: Dither; threshold?: number } = {}): Bitmap {
  if (grey.length !== width * height) throw new RangeError(`expected ${width * height} pixels, got ${grey.length}`);
  const threshold = opts.threshold ?? 128;
  const padded = Math.ceil(width / 8) * 8;
  const bits = new Uint8Array((padded / 8) * height);
  const set = (x: number, y: number) => {
    bits[y * (padded / 8) + (x >> 3)]! |= 0x80 >> (x & 7);
  };

  if ((opts.dither ?? "atkinson") === "threshold") {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (grey[y * width + x]! < threshold) set(x, y);
    return { width: padded, height, bits };
  }

  const buf = Float32Array.from(grey);
  const spread = (x: number, y: number, err: number) => {
    if (x >= 0 && x < width && y < height) buf[y * width + x]! += err;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const old = buf[y * width + x]!;
      const black = old < threshold;
      if (black) set(x, y);
      const err = (old - (black ? 0 : 255)) / 8;
      spread(x + 1, y, err);
      spread(x + 2, y, err);
      spread(x - 1, y + 1, err);
      spread(x, y + 1, err);
      spread(x + 1, y + 1, err);
      spread(x, y + 2, err);
    }
  }
  return { width: padded, height, bits };
}

export function isBlack(bm: Bitmap, x: number, y: number): boolean {
  return (bm.bits[y * (bm.width / 8) + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
}

/** Base64 of the raw rows, as ePOS <image> wants. Works in Node and browsers. */
export function bitmapBase64(bm: Bitmap): string {
  let s = "";
  for (let i = 0; i < bm.bits.length; i += 0x8000) s += String.fromCharCode(...bm.bits.subarray(i, i + 0x8000));
  return btoa(s);
}
