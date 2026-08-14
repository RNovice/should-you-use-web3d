import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 開場 30 秒的視覺震撼：AI Agent 正在工作。
 *
 * 它的任務只有一個 —— 讓人相信我們做得到。所以它不接真實資料，
 * 也不假裝有（Q17 的決定：半天硬上限）。觀眾不會去驗證它接了什麼，
 * 多花的每一小時都該給那個能被反駁的主力 demo。
 *
 * 視覺語言刻意延續產品已經在用的粒子效果 ——
 * 這不是空降一種新風格，是把既有的粒子語言往前推一步。
 */

const COUNT = 6000;
const MAX_RADIUS = 26;

/** 粒子從外圈螺旋收束到中心，抵達後回到外圈重來 */
const makeParticles = () => {
  const seed = { s: 20260811 };
  const rand = () => {
    seed.s = (seed.s * 1664525 + 1013904223) % 4294967296;
    return seed.s / 4294967296;
  };

  const angle = new Float32Array(COUNT);
  const tilt = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const swirl = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i += 1) {
    angle[i] = rand() * Math.PI * 2;
    // 集中在赤道附近，看起來才像一個盤面而不是一團霧
    tilt[i] = (rand() - 0.5) * (rand() - 0.5) * 2.4;
    speed[i] = 0.05 + rand() * 0.16;
    phase[i] = rand();
    swirl[i] = 2.2 + rand() * 3.4;
  }

  return { angle, tilt, speed, phase, swirl };
};

const COLD = new THREE.Color('#2a5f8f');
const WARM = new THREE.Color('#7ff0e4');

export const AgentScene = () => {
  const pointsRef = useRef();
  const coreRef = useRef();
  const ringsRef = useRef();

  const particles = useMemo(makeParticles, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);

  const ringGeometry = useMemo(() => {
    // 三個傾角不同的圓環，給粒子流一個可讀的骨架
    const points = [];
    const SEGMENTS = 96;
    for (let ring = 0; ring < 3; ring += 1) {
      const r = MAX_RADIUS * (0.42 + ring * 0.22);
      const tiltAngle = (ring - 1) * 0.5;
      for (let k = 0; k < SEGMENTS; k += 1) {
        const a0 = (k / SEGMENTS) * Math.PI * 2;
        const a1 = ((k + 1) / SEGMENTS) * Math.PI * 2;
        for (const a of [a0, a1]) {
          points.push(
            Math.cos(a) * r,
            Math.sin(a) * r * Math.sin(tiltAngle),
            Math.sin(a) * r * Math.cos(tiltAngle),
          );
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const pos = geometry.attributes.position.array;
    const col = geometry.attributes.color.array;
    const { angle, tilt, speed, phase, swirl } = particles;
    const color = new THREE.Color();

    for (let i = 0; i < COUNT; i += 1) {
      // p 從 0 走到 1 就是一次「由外向內」的行程，超過就回頭
      const p = (phase[i] + t * speed[i]) % 1;

      // 越靠近中心走得越快，看起來像被吸進去
      const r = MAX_RADIUS * Math.pow(1 - p, 1.6);
      const a = angle[i] + p * swirl[i];

      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = tilt[i] * r * 0.75;
      pos[i * 3 + 2] = Math.sin(a) * r;

      // 接近中心時由冷轉暖，讓「匯聚」這件事被看見
      color.copy(COLD).lerp(WARM, Math.pow(p, 2.2));
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    if (coreRef.current) {
      // 心跳：兩個頻率疊在一起，才不會像單調的閃爍
      const pulse = 1 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.03;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.y += delta * 0.06;
      ringsRef.current.rotation.x = Math.sin(t * 0.11) * 0.12;
    }
  });

  return (
    <>
      <fog attach="fog" args={['#070a0f', 24, 90]} />

      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          size={0.22}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <lineSegments ref={ringsRef} geometry={ringGeometry} frustumCulled={false}>
        <lineBasicMaterial
          color="#4fd1c5"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </lineSegments>

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.6, 2]} />
        <meshBasicMaterial
          color="#9ff6ec"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};
