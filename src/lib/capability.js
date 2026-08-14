/**
 * 偵測「現在這台電腦」的 3D 能力。
 *
 * Q15 的補丁：相容性矩陣的數字來自公開統計，容易被問「那我們客戶呢」。
 * 這支程式讓簡報當場在投影筆電上跑出真實結果 ——
 * 成本一小時，但比借舊機器實測更省事，戲劇效果更強。
 *
 * WebGPU 必須真的取到 adapter 才算支援：navigator.gpu 存在不代表
 * 底層驅動可用，這個差異在企業客戶的環境裡（舊驅動、遠端桌面、VDI）很常見。
 */

const unmaskedRenderer = (gl) => {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || null;
  } catch {
    return null;
  }
};

export const detectCapability = async () => {
  const canvas = document.createElement('canvas');
  const gl2 = canvas.getContext('webgl2');
  const gl = gl2 ?? canvas.getContext('webgl');

  const result = {
    webgl2: Boolean(gl2),
    webgl1: Boolean(gl),
    gpu: gl ? (unmaskedRenderer(gl) ?? '無法取得（瀏覽器遮蔽）') : '無 WebGL',
    maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : null,
    dpr: window.devicePixelRatio,
    webgpu: false,
  };

  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      result.webgpu = Boolean(adapter);
    } catch {
      result.webgpu = false;
    }
  }

  // 用完就釋放，別留著佔 context 額度
  gl?.getExtension('WEBGL_lose_context')?.loseContext();

  return result;
};
