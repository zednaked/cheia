// Decodificador mínimo de PNG (8 bits, RGB/RGBA/paleta, sem entrelaçamento):
// o suficiente para os tiles Terrarium, sem dependências.
import { inflateSync } from 'node:zlib';

export function decodePNG(buf) {
  let p = 8, W = 0, H = 0, type = 0, palette = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      W = data.readUInt32BE(0);
      H = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG não suportado');
      type = data[9];
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = { 2: 3, 6: 4, 3: 1 }[type];
  if (!bpp) throw new Error(`PNG tipo ${type} não suportado`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = W * bpp;
  const px = new Uint8Array(H * stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = px.subarray(y * stride, (y + 1) * stride);
    const up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = v;
    }
  }
  // sempre devolve RGB
  const rgb = new Uint8Array(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    if (type === 3) rgb.set(palette.subarray(px[k] * 3, px[k] * 3 + 3), k * 3);
    else for (let c = 0; c < 3; c++) rgb[k * 3 + c] = px[k * bpp + c];
  }
  return { W, H, rgb };
}
