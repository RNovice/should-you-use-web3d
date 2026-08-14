import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadBlueprint } from '../../data/blueprint';
import { useDeck, reportStats } from '../../deck/useDeck';
import { radialTreeLayout, KIND_COLORS } from '../layout';
import { tidyTreeLayout, widthInPixels } from '../layout2d';

const PALETTE = KIND_COLORS.map((hex) => new THREE.Color(hex));
const SPACING = 1.1;

/**
 * 同一棵樹，2D 樹狀圖與 3D 球面佈局之間連續變形。
 *
 * 刻意做成「變形」而不是「並排」：並排看到的是兩張圖，
 * 變形看到的是**同一批節點被重新安排**，那個瞬間才會讓人理解
 * 3D 沒有增加資訊，只是換了一種擺法，而擺法決定了能不能看。
 */
export const LayoutCompareScene = () => {
  const morphTarget = useDeck((s) => s.morph);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.viewport);
  const [data, setData] = useState(null);
  const meshRef = useRef();
  const edgeRef = useRef();
  const morph = useRef(morphTarget);

  useEffect(() => {
    let cancelled = false;
    // 固定用真實藍圖 —— 這一頁論證的是佈局，不是規模
    loadBlueprint(null).then(({ data: d }) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => {
    if (!data || data.count === 0) return null;

    const flat = tidyTreeLayout(data, { nodeGap: SPACING * 1.5 });
    const sphere = radialTreeLayout(data, { spacing: SPACING });

    reportStats({
      nodes: data.count,
      leafCount: flat.leafCount,
      width2dPx: widthInPixels(flat.leafCount),
    });

    return {
      flat,
      sphere,
      parent: sphere.parent,
      edgeCount: sphere.parent.reduce((n, p) => (p >= 0 ? n + 1 : n), 0),
    };
  }, [data]);

  // 每幀寫入的緩衝區，先配置好避免每幀重新配置
  const buffers = useMemo(() => {
    if (!model || !data) return null;
    const edges = new Float32Array(model.edgeCount * 6);
    const geometry = new THREE.BufferGeometry();
    // 屬性要在這裡就掛上去 —— 放進 useEffect 的話，
    // 第一次 useFrame 可能比 effect 早跑，attributes.position 會是 undefined
    geometry.setAttribute('position', new THREE.BufferAttribute(edges, 3));
    return {
      positions: new Float32Array(data.count * 3),
      edges,
      geometry,
      dummy: new THREE.Object3D(),
    };
  }, [model, data]);

  useEffect(() => {
    const g = buffers?.geometry;
    return () => g?.dispose();
  }, [buffers]);

  // 節點顏色只需要設一次，變形過程中不變
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !data) return;
    for (let i = 0; i < data.count; i += 1) {
      mesh.setColorAt(i, PALETTE[data.kind[i]] ?? PALETTE[3]);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((_, delta) => {
    if (!model || !buffers || !data) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    // 平滑逼近目標值，跟 frame rate 無關
    const k = 1 - Math.pow(0.004, delta);
    morph.current += (morphTarget - morph.current) * k;
    const t = morph.current;
    // easeInOutCubic：兩端慢、中間快，看得清楚起點與終點
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const { flat, sphere } = model;
    const { positions, edges, dummy } = buffers;
    const count = data.count;

    for (let i = 0; i < count; i += 1) {
      const j = i * 3;
      positions[j] = flat.positions[j] + (sphere.positions[j] - flat.positions[j]) * e;
      positions[j + 1] =
        flat.positions[j + 1] + (sphere.positions[j + 1] - flat.positions[j + 1]) * e;
      positions[j + 2] =
        flat.positions[j + 2] + (sphere.positions[j + 2] - flat.positions[j + 2]) * e;

      dummy.position.set(positions[j], positions[j + 1], positions[j + 2]);
      dummy.scale.setScalar(SPACING * 0.32);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    let w = 0;
    for (let i = 0; i < count; i += 1) {
      const p = model.parent[i];
      if (p < 0) continue;
      edges[w++] = positions[i * 3];
      edges[w++] = positions[i * 3 + 1];
      edges[w++] = positions[i * 3 + 2];
      edges[w++] = positions[p * 3];
      edges[w++] = positions[p * 3 + 1];
      edges[w++] = positions[p * 3 + 2];
    }
    buffers.geometry.attributes.position.needsUpdate = true;
    buffers.geometry.computeBoundingSphere();

    /*
     * 鏡頭也跟著變形。
     *
     * 2D 端要退到能把整個寬度塞進畫面的距離 —— 那個距離本身就是論證：
     * 節點越多、鏡頭要退得越遠、每張卡就越小，最後小到看不見字。
     */
    const fit2D = (flat.width / 2 + 4) / Math.tan((camera.fov * Math.PI) / 360) / viewport.aspect;
    const fit3D = sphere.maxRadius * 2.8 + 6;
    const distance = fit2D + (fit3D - fit2D) * e;

    camera.position.set(0, sphere.maxRadius * 0.5 * e, distance);
    camera.far = Math.max(2000, distance * 4);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  if (!data || !model || !buffers) return null;

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 12, 6]} intensity={1.5} />

      <instancedMesh
        key={data.count}
        ref={meshRef}
        args={[undefined, undefined, data.count]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.45} metalness={0.1} />
      </instancedMesh>

      <lineSegments ref={edgeRef} geometry={buffers.geometry} frustumCulled={false}>
        <lineBasicMaterial color="#3d4c60" transparent opacity={0.4} />
      </lineSegments>
    </>
  );
};
