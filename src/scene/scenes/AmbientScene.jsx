import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FORMATIONS, DEFAULT_FORMATION, POINT_COUNT } from '../formations';
import { getDotTexture } from '../dotTexture';

/**
 * 簡報頁的背景。
 *
 * 同一團點雲從第一頁活到最後一頁 —— 翻頁時它「重新編隊」變形到下一頁的隊形，
 * 所以每頁的裝飾都不一樣，而換頁效果就是那個變形本身。
 * 不需要另外做轉場，也不需要十四個獨立場景。
 *
 * 為什麼這是一團而不是每頁重建：重建會重新配置緩衝區、產生 GC，
 * 而且沒有辦法做「從上一個隊形變過去」這件事 —— 那是整個效果的重點。
 *
 * 注意：我們在報告裡明確建議「不要把常駐動畫放進產品」。
 * 簡報是一次性的十分鐘，產品是每天八小時 —— 這個雙重標準是刻意的，
 * 而且在「不建議導入」那一頁會主動講出來。
 */

const MORPH_SECONDS = 1.15;
const VIEW_DISTANCE = 46;

/** easeInOutCubic：兩端慢、中間快，看得清楚起點與終點 */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 這組 bias 是在這個可見半寬下調出來的（16:9、相機距離 46、fov 45） */
const BIAS_REFERENCE_HALF_WIDTH = 33.9;

/**
 * 把隊形寫進 buffer，並套用它的水平偏移。
 *
 * 偏移是必要的：文字區的遮罩壓在畫面左側，所以任何「左右有意義」的隊形
 * （兩團＝兩個部門、三個核＝三個問題）左邊那半會被遮罩吃掉，
 * 比喻就消失了。偏移把它們整團推到右側看得見的帶狀區域裡。
 *
 * 但 bias 是世界座標，而可見範圍取決於畫面比例：
 * 直立手機（393×852）的可見半寬只有 8.8，最大的 bias 是 17 ——
 * 整團會跑到畫面外，背景變成全黑（實測過）。
 * 所以偏移要按實際可見半寬等比縮放，而且直立時本來就沒有「右側留白帶」
 * 可以躲（文字是滿版的），縮到接近零剛好也是對的。
 */
const layout = (spec, target, halfWidth) => {
  spec.fill(target, POINT_COUNT);
  const bias = (spec.bias ?? 0) * (halfWidth / BIAS_REFERENCE_HALF_WIDTH);
  if (bias === 0) return;
  for (let i = 0; i < POINT_COUNT; i += 1) target[i * 3] += bias;
};

/** 相機在 z = VIEW_DISTANCE 看向原點時，畫面邊緣對應的世界座標半寬 */
const visibleHalfWidth = (camera) =>
  Math.tan(((camera.fov ?? 45) * Math.PI) / 360) * VIEW_DISTANCE * (camera.aspect || 1);

export const AmbientScene = ({ formation = DEFAULT_FORMATION, intensity = 1 }) => {
  const camera = useThree((s) => s.camera);
  const dot = getDotTexture();
  const dimRef = useRef();
  const brightRef = useRef();

  const spec = FORMATIONS[formation] ?? FORMATIONS[DEFAULT_FORMATION];

  /*
   * 背景場景也要自己設相機 —— 共用 canvas 的相機是上一個場景留下來的，
   * 前面幾個 demo 都會移動它。不設就會出現「從某些頁翻進來看不到東西」。
   */
  useEffect(() => {
    camera.position.set(0, 4, VIEW_DISTANCE);
    camera.far = Math.max(2000, VIEW_DISTANCE * 6);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  const buffers = useMemo(() => {
    const live = new Float32Array(POINT_COUNT * 3);
    const from = new Float32Array(POINT_COUNT * 3);
    const to = new Float32Array(POINT_COUNT * 3);

    // 一開始就站好第一個隊形，避免第一幀從原點炸開
    layout(FORMATIONS[DEFAULT_FORMATION], to, BIAS_REFERENCE_HALF_WIDTH);
    live.set(to);
    from.set(to);

    /*
     * 兩個 geometry 共用同一份 position buffer，只是 drawRange 不同。
     *
     * 這是為了讓「少數發亮」那一頁能真的畫出一小群不一樣的點：
     * 被標記的點固定放在 buffer 前段，所以一個 drawRange 畫前 k 顆（亮、大），
     * 另一個畫其餘的（暗、小）。
     * 共用 BufferAttribute 表示每幀只上傳一次，代價就只是多一個 draw call。
     */
    const position = new THREE.BufferAttribute(live, 3);
    const dim = new THREE.BufferGeometry();
    dim.setAttribute('position', position);
    const bright = new THREE.BufferGeometry();
    bright.setAttribute('position', position);

    return { live, from, to, position, dim, bright };
  }, []);

  useEffect(
    () => () => {
      buffers.dim.dispose();
      buffers.bright.dispose();
    },
    [buffers],
  );

  const morph = useRef({ t: 1, key: DEFAULT_FORMATION });
  /** 目標水平角度。spin 會一直累加，其餘隊形在正面附近擺動 */
  const yaw = useRef(0);
  const colour = useRef({
    current: new THREE.Color(FORMATIONS[DEFAULT_FORMATION].accent),
    target: new THREE.Color(FORMATIONS[DEFAULT_FORMATION].accent),
  });

  // 這一頁要有幾顆發亮的點。85 / 2,331 是真的比例，不是隨手挑的數字
  const brightCount = spec.highlightRatio
    ? Math.round(spec.highlightRatio * POINT_COUNT)
    : 0;

  // 隊形換了：把目前的位置凍結成起點，算出新的終點，重新開始變形
  useEffect(() => {
    buffers.dim.setDrawRange(brightCount, POINT_COUNT - brightCount);
    buffers.bright.setDrawRange(0, brightCount);

    if (morph.current.key === formation) return;
    buffers.from.set(buffers.live);
    layout(spec, buffers.to, visibleHalfWidth(camera));
    morph.current = { t: 0, key: formation };
    colour.current.target.set(spec.accent);
  }, [formation, spec, buffers, brightCount, camera]);

  /*
   * 轉螢幕方向或改視窗大小時要重算 —— 偏移量取決於可見半寬，
   * 而半寬取決於畫面比例。不重算的話直立轉橫放後隊形會停在錯的位置。
   */
  const size = useThree((s) => s.size);
  useEffect(() => {
    const half = visibleHalfWidth(camera);
    layout(spec, buffers.to, half);
    if (morph.current.t >= 1) {
      buffers.live.set(buffers.to);
      buffers.position.needsUpdate = true;
    }
  }, [size.width, size.height, camera, spec, buffers]);

  useFrame((state, delta) => {
    const points = dimRef.current;
    if (!points) return;

    const m = morph.current;
    if (m.t < 1) {
      m.t = Math.min(1, m.t + delta / MORPH_SECONDS);
      const e = ease(m.t);
      const { live, from, to } = buffers;
      for (let i = 0; i < live.length; i += 1) {
        live[i] = from[i] + (to[i] - from[i]) * e;
      }
      buffers.position.needsUpdate = true;
      // 兩個 points 都關掉了視錐剔除，所以不必每幀重算 bounding sphere
    }

    const t = state.clock.elapsedTime;

    /*
     * 每個隊形有自己的動法。全部刻意很慢 ——
     * 背景動畫一旦搶戲，觀眾就在看動畫不在聽講者。
     *
     * 只有 spin 會一直累加轉下去，而那幾個隊形剛好都是放射對稱的
     * （星雲、圓環、球）—— 轉到哪個角度都一樣。
     * 其餘隊形的方向本身就是意思（分岔朝右、柱子朝上、兩團並列），
     * 一旦累加旋轉，翻到那一頁時的角度就取決於簡報開了多久：
     * 分岔可能剛好轉成朝著螢幕深處，兩條branch疊成一條，比喻就沒了。
     * 所以它們的目標角度改成在正面附近輕微擺動。
     */
    let posX = 0;
    let posY = 0;
    let scale = 1;
    let rotX = 0;

    switch (spec.motion) {
      case 'wave':
        yaw.current = Math.sin(t * 0.09) * 0.2;
        posY = Math.sin(t * 0.32) * 1.1;
        rotX = Math.sin(t * 0.18) * 0.09;
        break;
      case 'drift':
        yaw.current = Math.sin(t * 0.07) * 0.22;
        posX = Math.sin(t * 0.13) * 1.8;
        posY = Math.cos(t * 0.11) * 1.1;
        break;
      case 'pulse':
        yaw.current = Math.sin(t * 0.06) * 0.16;
        scale = 1 + Math.sin(t * 0.5) * 0.035;
        break;
      case 'spin':
      default:
        yaw.current += delta * 0.028;
        posY = Math.sin(t * 0.16) * 0.7;
        break;
    }

    /*
     * 追向目標角度，走最短路徑。
     * 從轉了好幾圈的 spin 隊形切到正面隊形時，直接 lerp 會慢慢倒轉好幾圈；
     * 把角度差收進 (-π, π] 就只轉必要的那一小段。
     */
    const diff = yaw.current - points.rotation.y;
    const shortest = Math.atan2(Math.sin(diff), Math.cos(diff));
    const rotY = points.rotation.y + shortest * (1 - Math.pow(0.05, delta));

    // 強調色也跟著隊形慢慢換過去
    const c = colour.current;
    c.current.lerp(c.target, 1 - Math.pow(0.02, delta));

    for (const p of [points, brightRef.current]) {
      if (!p) continue;
      p.rotation.y = rotY;
      p.rotation.x = rotX;
      p.position.set(posX, posY, 0);
      p.scale.setScalar(scale);
    }

    points.material.color.copy(c.current);

    /*
     * 發亮的那群等變形快完成才浮現 —— 不然點還在上一個隊形裡就先亮起來，
     * 看起來像閃爍而不是「這一小群不一樣」。
     */
    if (brightRef.current) {
      const reveal = brightCount > 0 ? clamp01((m.t - 0.55) / 0.45) : 0;
      brightRef.current.material.opacity = 0.95 * reveal * intensity;
    }
  });

  return (
    <>
      {/*
        霧只負責「更遠的更淡」這一點深度感，不該當成調暗的手段。
        近端原本壓在 0.45 倍距離，但點雲整團都在 0.7~1.3 倍之間 ——
        於是每顆點都先被霧掉 14~53%，混向的又是接近黑的底色，
        整個裝飾在畫面上平均只比底色亮 1/255。
      */}
      <fog attach="fog" args={['#070a0f', VIEW_DISTANCE * 0.95, VIEW_DISTANCE * 2.9]} />
      <points ref={dimRef} geometry={buffers.dim} frustumCulled={false}>
        <pointsMaterial
          map={dot}
          size={0.52}
          sizeAttenuation
          transparent
          opacity={0.88 * intensity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {brightCount > 0 && (
        <points ref={brightRef} geometry={buffers.bright} frustumCulled={false}>
          <pointsMaterial
            map={dot}
            color="#eafff9"
            size={1.3}
            sizeAttenuation
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </>
  );
};
