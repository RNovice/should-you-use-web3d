import * as THREE from 'three';

/**
 * 三種渲染方式的效能量測。
 *
 * **依序執行，不並排。** 並排跑三個渲染器看起來比較有戲，但三者會搶同一個
 * 主執行緒與同一顆 GPU，量到的數字對三者都是錯的。要拿數字去說服人，
 * 就只能一次跑一種。
 *
 * 三種方式做的事完全一樣：N 個方塊，每幀重算位置後畫出來。
 * 位置計算是共用的成本，對三者公平；差別只在「怎麼把它畫到畫面上」。
 *
 * 節點畫成方塊而不是圓 —— Canvas 2D 的 arc() 比 fillRect() 慢得多，
 * 用圓形會把「Canvas 2D 慢」的結論灌水成「arc 慢」。
 */

/**
 * DOM 現場量測的上限。
 *
 * 兩萬節點是量得出來的（離線實測 2,979 ms／幀），但過程中瀏覽器會停止回應十幾秒 ——
 * 現場報告不能為了一個已知的數字把畫面鎖住。所以上限壓到五千，
 * 更高的檔位改為顯示離線量到的結果，或直接標明建不出來。
 */
export const DOM_LIMIT = 5000;

/** 量測環境（粗指標裝置看到的就是這台的數字） */
export const RECORDED_ON = 'Apple M1 · Chrome · DPR 1';

/**
 * 桌機實測的完整矩陣。
 *
 * 手機不跑這個量測，改顯示這裡的數字。兩個理由：
 *   1. 在手機上跑 20 萬／一百萬有把分頁跑掛的風險；
 *   2. 更重要的是整份論證的前提是「客戶的企業筆電」——
 *      手機量到的數字對那個結論沒有意義，秀出來只會誤導。
 * 所以手機看到的是標明來源的桌機數字，而不是一個跑不動的按鈕。
 *
 * dom: null 代表建立那麼多 element 本身就會鎖住瀏覽器，量不出來。
 */
export const RECORDED = {
  1000: {
    dom: { fps: 60, frameMs: 16.7, jsMs: 0.8, drawCalls: null },
    canvas2d: { fps: 60, frameMs: 16.7, jsMs: 0.3, drawCalls: null },
    webgl: { fps: 60, frameMs: 16.7, jsMs: 0.5, drawCalls: 1 },
  },
  5000: {
    dom: { fps: 26, frameMs: 37.8, jsMs: 3.5, drawCalls: null },
    canvas2d: { fps: 60, frameMs: 16.7, jsMs: 1.3, drawCalls: null },
    webgl: { fps: 60, frameMs: 16.7, jsMs: 1.5, drawCalls: 1 },
  },
  20000: {
    dom: { fps: 0.3, frameMs: 2979, jsMs: 17.6, drawCalls: null },
    canvas2d: { fps: 60, frameMs: 16.7, jsMs: 2.4, drawCalls: null },
    webgl: { fps: 60, frameMs: 16.7, jsMs: 3.7, drawCalls: 1 },
  },
  200000: {
    dom: null,
    canvas2d: { fps: 20, frameMs: 49.3, jsMs: 47.8, drawCalls: null },
    webgl: { fps: 60, frameMs: 16.8, jsMs: 13.7, drawCalls: 1 },
  },
  1000000: {
    dom: null,
    canvas2d: { fps: 2.8, frameMs: 353.8, jsMs: 308.9, drawCalls: null },
    webgl: { fps: 14, frameMs: 73.9, jsMs: 71.1, drawCalls: 1 },
  },
};

/**
 * 粗指標＝觸控裝置。
 * 用 pointer: coarse 而不是螢幕寬度 —— 手機橫放是 852px 寬，
 * 比桌機斷點還寬，用寬度判斷會把橫放的手機當成桌機。
 */
export const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)').matches === true;


/** 離線量到的 DOM 結果，供超過現場上限的檔位引用 */
export const DOM_OFFLINE = {
  20000: { fps: 0.3, frameMs: 2979, jsMs: 17.6 },
};

/** 單幀超過這個時間就提早中止 —— 已經知道結論，沒必要把分頁卡到底 */
const BAIL_FRAME_MS = 500;

export const MODES = [
  { key: 'dom', label: 'DOM', hint: '每個節點一個 div，每幀更新 transform' },
  { key: 'canvas2d', label: 'Canvas 2D', hint: '每幀清空後重畫每一個節點' },
  { key: 'webgl', label: 'WebGL Instanced', hint: '共用幾何，單次 draw call' },
];

const TAU = Math.PI * 2;

/** 每個節點在單位圓上的軌道參數。三種模式共用同一份，確保畫的是同一批東西。 */
const makeOrbits = (count) => {
  const orbits = new Float32Array(count * 3); // radius, phase, speed
  let s = 20260811;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    orbits[i * 3] = 0.08 + rand() * 0.42;
    orbits[i * 3 + 1] = rand() * TAU;
    orbits[i * 3 + 2] = 0.15 + rand() * 0.5;
  }
  return orbits;
};

/** 把軌道參數換算成這一幀的畫面座標。三種模式共用。 */
const positionsAt = (orbits, count, t, w, h, out) => {
  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.min(w, h);
  for (let i = 0; i < count; i += 1) {
    const r = orbits[i * 3] * scale;
    const a = orbits[i * 3 + 1] + t * orbits[i * 3 + 2];
    out[i * 2] = cx + Math.cos(a) * r;
    out[i * 2 + 1] = cy + Math.sin(a) * r * 0.62;
  }
};

const NODE_PX = 6;

/* ---------- DOM ---------- */

const createDomRenderer = (host, count) => {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  const nodes = [];

  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div');
    el.style.cssText =
      `position:absolute;left:0;top:0;width:${NODE_PX}px;height:${NODE_PX}px;` +
      'background:#5aa9e6;border-radius:1px;will-change:transform;';
    layer.appendChild(el);
    nodes.push(el);
  }
  host.appendChild(layer);

  return {
    draw(pos) {
      for (let i = 0; i < count; i += 1) {
        // translate3d 讓瀏覽器走合成路徑，這是 DOM 方案最快的寫法 ——
        // 要比就比對手最好的版本
        nodes[i].style.transform = `translate3d(${pos[i * 2]}px,${pos[i * 2 + 1]}px,0)`;
      }
    },
    dispose() {
      layer.remove();
    },
  };
};

/* ---------- Canvas 2D ---------- */

const createCanvas2dRenderer = (host, count, w, h, dpr) => {
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:absolute;inset:0;width:${w}px;height:${h}px;`;
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#5aa9e6';

  return {
    draw(pos) {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < count; i += 1) {
        ctx.fillRect(pos[i * 2], pos[i * 2 + 1], NODE_PX, NODE_PX);
      }
    },
    dispose() {
      canvas.remove();
    },
  };
};

/* ---------- WebGL（three.js InstancedMesh） ---------- */

const createWebglRenderer = (host, count, w, h, dpr) => {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:absolute;inset:0;width:${w}px;height:${h}px;`;
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  /*
   * 正交相機讓世界座標直接等於像素座標，三種模式才畫在同一個位置。
   *
   * 注意 top=h、bottom=0 而不是反過來 —— 一開始我寫成 top=0、bottom=h
   * 想直接對齊 canvas 的 Y 軸向下，結果投影矩陣的 Y 縮放變成負值，
   * 三角形繞序整批反轉、全部被背面剔除：draw call 有、三角形數有，
   * 但一個像素都沒畫出來。Y 軸的翻轉要在放位置的時候做，不要動相機。
   */
  const camera = new THREE.OrthographicCamera(0, w, h, 0, -1, 1);

  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(NODE_PX, NODE_PX),
    new THREE.MeshBasicMaterial({ color: '#5aa9e6' }),
    count,
  );
  mesh.frustumCulled = false;
  scene.add(mesh);

  const dummy = new THREE.Object3D();

  return {
    draw(pos) {
      for (let i = 0; i < count; i += 1) {
        // Y 在這裡翻轉，對齊另外兩種模式的 canvas 座標
        dummy.position.set(pos[i * 2] + NODE_PX / 2, h - (pos[i * 2 + 1] + NODE_PX / 2), 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    },
    get drawCalls() {
      return renderer.info.render.calls;
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
};

const FACTORIES = {
  dom: createDomRenderer,
  canvas2d: (host, count, w, h, dpr) => createCanvas2dRenderer(host, count, w, h, dpr),
  webgl: (host, count, w, h, dpr) => createWebglRenderer(host, count, w, h, dpr),
};

/**
 * 量測單一模式。
 *
 * 回傳兩個時間，兩個都要看：
 *   frameMs —— 實際的幀間隔，使用者感受到的東西
 *   jsMs    —— 我們自己的 JavaScript 花掉的時間
 *
 * 兩者的差距就是瀏覽器在 JS 之外做的事（style recalc、layout、paint、composite）。
 * DOM 方案的成本幾乎全在這個差距裡 —— 也就是說**你 profile 自己的程式碼看不到它**，
 * 這是 DOM 渲染最容易被低估的原因。
 *
 * @returns {Promise<{fps:number, frameMs:number, jsMs:number, drawCalls:number|null}>}
 */
export const runMode = ({ mode, host, count, warmupMs = 600, measureMs = 2000, signal }) =>
  new Promise((resolve) => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio, 2);

    const renderer = FACTORIES[mode](host, count, w, h, dpr);
    const orbits = makeOrbits(count);
    const pos = new Float32Array(count * 2);

    let frames = 0;
    let jsTotalMs = 0;
    let bailed = false;
    let startedAt = null;
    let raf = 0;
    const t0 = performance.now();

    const finish = () => {
      cancelAnimationFrame(raf);
      const elapsed = (performance.now() - startedAt) / 1000;
      const drawCalls = 'drawCalls' in renderer ? renderer.drawCalls : null;
      renderer.dispose();
      // 低於 1 fps 時四捨五入會變成 0，而「0 fps」讀起來像沒跑成功。
      // 這種時候小數點才是有意義的資訊。
      const fps = elapsed > 0 ? frames / elapsed : 0;
      resolve({
        bailed,
        fps: Number(fps.toFixed(fps < 10 ? 1 : 0)),
        frameMs: frames > 0 ? Number(((elapsed * 1000) / frames).toFixed(1)) : 0,
        jsMs: frames > 0 ? Number((jsTotalMs / frames).toFixed(1)) : 0,
        drawCalls,
      });
    };

    const tick = () => {
      if (signal?.aborted) {
        cancelAnimationFrame(raf);
        renderer.dispose();
        resolve(null);
        return;
      }

      const now = performance.now();
      const frameStart = now;
      positionsAt(orbits, count, now / 1000, w, h, pos);
      renderer.draw(pos);

      // 暖身期間不計數：第一幀要建立圖層、編譯 shader、配置緩衝區
      if (now - t0 >= warmupMs) {
        if (startedAt === null) {
          startedAt = now;
        } else {
          frames += 1;
          const cost = performance.now() - frameStart;
          jsTotalMs += cost;
          if (cost > BAIL_FRAME_MS) {
            bailed = true;
            finish();
            return;
          }
        }
        if (now - startedAt >= measureMs) {
          finish();
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  });
