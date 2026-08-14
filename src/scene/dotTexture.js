import * as THREE from 'three';

/**
 * 點雲用的柔邊圓點。
 *
 * 沒有貼圖的 gl.POINTS 是硬邊正方形 —— 放大之後很明顯是方塊，
 * 在深色底上看起來像壞掉的像素而不是光點。
 * 一張 64×64 的徑向漸層就解決，而且全場共用同一個 texture。
 *
 * 加法混合下透明邊緣不會貢獻顏色（src 會先乘上自己的 alpha），
 * 所以不需要另外給 alphaMap。
 */
let cached = null;

export const getDotTexture = () => {
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  cached = new THREE.CanvasTexture(canvas);
  return cached;
};
