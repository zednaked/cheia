// Área simulada: um bloco de tiles Web Mercator. Tudo (relevo, satélite, OSM)
// é alinhado a esta grade.
export const REGION = {
  name: 'Curitiba e RMC',
  z: 12,          // zoom dos tiles de relevo (1 px ≈ 34 m em Curitiba)
  x0: 1484, y0: 2345,
  nx: 6, ny: 6,   // 6×6 tiles de 256 px = grade de 1536×1536 células
  imageryZ: 14,   // zoom da imagem de satélite
};

export function tile2lon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}
export function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}
export function lon2tx(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}
export function lat2ty(lat, z) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

export function bbox(r = REGION) {
  return {
    west: tile2lon(r.x0, r.z),
    east: tile2lon(r.x0 + r.nx, r.z),
    north: tile2lat(r.y0, r.z),
    south: tile2lat(r.y0 + r.ny, r.z),
  };
}

// Tamanho da célula em metros (no centro da região).
export function cellSize(r = REGION) {
  const lat = tile2lat(r.y0 + r.ny / 2, r.z);
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** r.z);
}

// lon/lat -> coordenada fracionária [0,1] dentro da região (u para leste, v para sul)
export function lonLatToUV(lon, lat, r = REGION) {
  return [
    (lon2tx(lon, r.z) - r.x0) / r.nx,
    (lat2ty(lat, r.z) - r.y0) / r.ny,
  ];
}
