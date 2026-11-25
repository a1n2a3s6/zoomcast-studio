/**
 * Zero-dependency pure TypeScript GIF89a encoder with a uniform 216-color
 * web-safe + 40-shade grayscale palette (256 colors total) and LZW compression
 * for 1-click GitHub README animated loop exports.
 */
export class LocalGifEncoder {
  private readonly width: number;
  private readonly height: number;
  private readonly delayCs: number;
  private readonly chunks: Uint8Array[] = [];
  private readonly palette: Uint8Array;

  constructor(width: number, height: number, fps = 15) {
    this.width = width;
    this.height = height;
    this.delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
    this.palette = LocalGifEncoder.buildPalette();
    this.writeHeader();
  }

  private static buildPalette(): Uint8Array {
    const pal = new Uint8Array(256 * 3);
    let idx = 0;
    // 6x6x6 RGB color cube (216 colors)
    for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 6; g++) {
        for (let b = 0; b < 6; b++) {
          pal[idx++] = Math.round((r * 255) / 5);
          pal[idx++] = Math.round((g * 255) / 5);
          pal[idx++] = Math.round((b * 255) / 5);
        }
      }
    }
    // 40-step neutral grayscale ramp for crisp dark matte NLE UI tones
    for (let i = 0; i < 40; i++) {
      const v = Math.round((i * 255) / 39);
      pal[idx++] = v;
      pal[idx++] = v;
      pal[idx++] = v;
    }
    return pal;
  }

  private writeBytes(bytes: number[]): void {
    this.chunks.push(new Uint8Array(bytes));
  }

  private writeHeader(): void {
    const w = this.width;
    const h = this.height;
    // Header "GIF89a"
    this.writeBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    // Logical Screen Descriptor: width, height, GCT flag (256 colors = 0xF7), bg=0, aspect=0
    this.writeBytes([w & 0xff, (w >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff, 0xf7, 0x00, 0x00]);
    // Global Color Table (768 bytes)
    this.chunks.push(this.palette);
    // NETSCAPE2.0 Infinite Loop Application Extension
    this.writeBytes([
      0x21, 0xff, 0x0b,
      0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
      0x03, 0x01, 0x00, 0x00, 0x00,
    ]);
  }

  private quantizeRgba(rgba: Uint8ClampedArray): Uint8Array {
    const pixelCount = this.width * this.height;
    const indices = new Uint8Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];

      // Use high-resolution grayscale ramp when saturation is very low
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
      if (maxC - minC <= 12) {
        const lum = (r * 77 + g * 150 + b * 29) >> 8;
        indices[i] = 216 + Math.min(39, Math.round((lum * 39) / 255));
      } else {
        const ri = Math.round((r * 5) / 255);
        const gi = Math.round((g * 5) / 255);
        const bi = Math.round((b * 5) / 255);
        indices[i] = ri * 36 + gi * 6 + bi;
      }
    }
    return indices;
  }

  private lzwEncode(indices: Uint8Array): Uint8Array {
    const minCodeSize = 8;
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;

    const out: number[] = [minCodeSize];
    const subBlock: number[] = [];

    let bitBuffer = 0;
    let bitCount = 0;

    const emitCode = (code: number, size: number) => {
      bitBuffer |= code << bitCount;
      bitCount += size;
      while (bitCount >= 8) {
        subBlock.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;
        if (subBlock.length === 255) {
          out.push(255, ...subBlock);
          subBlock.length = 0;
        }
      }
    };

    const dict = new Map<number, number>();
    let nextCode = eoiCode + 1;
    let codeSize = minCodeSize + 1;

    emitCode(clearCode, codeSize);

    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const existing = dict.get(key);
      if (existing !== undefined) {
        prefix = existing;
      } else {
        emitCode(prefix, codeSize);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          emitCode(clearCode, codeSize);
          dict.clear();
          nextCode = eoiCode + 1;
          codeSize = minCodeSize + 1;
        }
        prefix = k;
      }
    }

    emitCode(prefix, codeSize);
    emitCode(eoiCode, codeSize);

    if (bitCount > 0) {
      subBlock.push(bitBuffer & 0xff);
    }
    if (subBlock.length > 0) {
      out.push(subBlock.length, ...subBlock);
    }
    out.push(0x00); // Block terminator
    return new Uint8Array(out);
  }

  addFrame(imageData: ImageData): void {
    const w = this.width;
    const h = this.height;
    // Graphic Control Extension
    this.writeBytes([
      0x21, 0xf9, 0x04, 0x04,
      this.delayCs & 0xff, (this.delayCs >> 8) & 0xff,
      0x00, 0x00,
    ]);
    // Image Descriptor
    this.writeBytes([
      0x2c, 0x00, 0x00, 0x00, 0x00,
      w & 0xff, (w >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff,
      0x00,
    ]);
    const indices = this.quantizeRgba(imageData.data);
    this.chunks.push(this.lzwEncode(indices));
  }

  finish(): Blob {
    // GIF Trailer
    this.writeBytes([0x3b]);
    return new Blob(this.chunks as BlobPart[], { type: 'image/gif' });
  }
}
