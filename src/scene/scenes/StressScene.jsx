import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStress } from '../../deck/useDeck';
import { isCoarsePointer } from '../../lib/renderBench';

/**
 * 現場即時 GPU 壓力測試。
 *
 * 這一頁不是示意圖，是在**當下這台電腦**上實際量測：
 * 節點數逐級往上加，直到 fps 掉到門檻以下，回報這台機器的實用上限。
 *
 * 這樣就不必去借一台低階機器 —— 簡報跑在誰的機器上，就量誰的機器。
 * 現場放在投影筆電上跑出來的數字，比任何公開統計都有說服力。
 *
 * 位置只在階數改變時寫一次（不是每幀重算），所以量到的是
 * 「渲染能力」而不是「JS 寫矩陣的能力」——那是兩件不同的事。
 */

const ALL_STEPS = [10_000, 25_000, 50_000, 100_000, 200_000, 400_000, 700_000, 1_000_000];

/*
 * 觸控裝置只加壓到 40 萬。
 *
 * 不是怕量出難看的數字（加壓本來就是自我限制的：fps 一掉就停），
 * 是因為緩衝區在**進入這一頁時就配置到最大量**，還沒按開始加壓 ——
 * 一百萬點等於一進頁面就吃掉 12MB 並上傳 GPU。桌機無感，低階手機會很痛。
 * 砍到 40 萬是 4.8MB，而且還留了六階，該演的爬升過程一階都沒少。
 */
const STEPS = isCoarsePointer() ? ALL_STEPS.slice(0, 6) : ALL_STEPS;
const CLOUD_RADIUS = 15;
/* 拉到看得見球體輪廓的距離；點粒同步放大補回視覺尺寸 */
const VIEW_DISTANCE = CLOUD_RADIUS * 2.5;
const MAX_COUNT = STEPS[STEPS.length - 1];
const TARGET_FPS = 55;
const WINDOW_MS = 700; // 每一階觀察多久才下判斷

export const StressScene = () => {
  const running = useStress((s) => s.running);
  const step = useStress((s) => s.step);
  const meshRef = useRef();
  const camera = useThree((s) => s.camera);

  /*
   * 這個場景一定要自己設相機。
   *
   * 共用 canvas 的相機是上一個場景留下來的 —— 經營藍圖與語意地圖都會移動它，
   * 所以「從哪一頁翻進來」會決定這裡的遠近：有時剛好看得見，有時整團被 fog 吃掉。
   * lookAt 也要重設，因為前面的 OrbitControls 可能留下旋轉。
   */
  useEffect(() => {
    camera.position.set(0, CLOUD_RADIUS * 0.2, VIEW_DISTANCE);
    camera.far = Math.max(2000, VIEW_DISTANCE * 6);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  const acc = useRef({ frames: 0, elapsed: 0, settle: 0 });

  /** 一次配置到最大量，之後只改 mesh.count —— 不要每階重新配置緩衝區 */
  const positions = useMemo(() => {
    const out = new Float32Array(MAX_COUNT * 3);
    let s = 20260813;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < MAX_COUNT; i += 1) {
      // 均勻分佈在球體內
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const r = Math.cbrt(rand()) * CLOUD_RADIUS;
      const sr = Math.sqrt(1 - u * u);
      out[i * 3] = Math.cos(phi) * sr * r;
      out[i * 3 + 1] = u * r;
      out[i * 3 + 2] = Math.sin(phi) * sr * r;
    }
    return out;
  }, []);

  const colors = useMemo(() => {
    const out = new Float32Array(MAX_COUNT * 3);
    const a = new THREE.Color('#4fd1c5');
    const b = new THREE.Color('#5aa9e6');
    const c = new THREE.Color();
    for (let i = 0; i < MAX_COUNT; i += 1) {
      c.copy(a).lerp(b, (i % 997) / 997);
      out[i * 3] = c.r;
      out[i * 3 + 1] = c.g;
      out[i * 3 + 2] = c.b;
    }
    return out;
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setDrawRange(0, STEPS[0]);
    return g;
  }, [positions, colors]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // 只在階數改變時調整繪製範圍，不動緩衝區
  useLayoutEffect(() => {
    geometry.setDrawRange(0, STEPS[step] ?? STEPS[0]);
    acc.current = { frames: 0, elapsed: 0, settle: 0 };
  }, [geometry, step]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh) mesh.rotation.y += delta * 0.12;

    const a = acc.current;
    a.frames += 1;
    a.elapsed += delta;

    // 換階之後前 250ms 不採計，讓 GPU 進入穩定狀態
    if (a.settle < 0.25) {
      a.settle += delta;
      a.frames = 0;
      a.elapsed = 0;
      return;
    }

    if (a.elapsed < WINDOW_MS / 1000) return;

    const fps = a.frames / a.elapsed;
    a.frames = 0;
    a.elapsed = 0;

    const { report, nextStep, finish } = useStress.getState();
    report(Math.round(fps), STEPS[step]);

    if (!running) return;

    if (fps >= TARGET_FPS) {
      if (step >= STEPS.length - 1) finish(STEPS[step], true);
      else nextStep();
    } else {
      // 掉到門檻以下：上一階才是這台機器撐得住的量
      finish(step > 0 ? STEPS[step - 1] : 0, false);
    }
  });

  return (
    <>
      {/* fog 範圍跟著取景距離算，不要寫死 —— 寫死就會在相機一變就整團消失 */}
      <fog attach="fog" args={['#070a0f', VIEW_DISTANCE * 0.5, VIEW_DISTANCE * 2.4]} />
      <points ref={meshRef} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          size={0.12}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
    </>
  );
};

export { STEPS as STRESS_STEPS, TARGET_FPS as STRESS_TARGET_FPS };
