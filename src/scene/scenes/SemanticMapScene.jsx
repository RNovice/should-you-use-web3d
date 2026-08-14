import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import { useLongPressPick } from '../useLongPressPick';
import { useMobileUi } from '../../deck/useDeck';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadSemanticMap, clusterCentroids, searchCards } from '../../data/semanticMap';
import { useMapState } from '../../deck/useDeck';

/**
 * 語意地圖：2,331 張藍圖卡，位置代表「講的是不是同一件事」。
 *
 * 這一頁是針對經營藍圖 3D 版本的失敗做的修正，三個設計刻意跟它相反：
 *
 *   1. **3D 不負責讀內容。** 它只負責「找」，讀字一律在右側的文字清單。
 *      所以節點上沒有字，也不需要有字。
 *   2. **標群不標點。** 2,331 個標籤擠在一起沒有人看得懂，
 *      所以只標 12 個群的代表詞。
 *   3. **關聯用明線畫出來。** 選取後直接連到最相似的 8 張，
 *      不要求觀眾靠肉眼判斷 3D 空間中的遠近 —— 那正是上一版失敗的地方。
 *
 * 另外：不自轉、節點放大、hover 才有反應，都是為了讓它點得到。
 */

const MAP_RADIUS = 22;   // 匯出時已把座標正規化到這個半徑
const BASE_SCALE = 0.26;
const HOVER_SCALE = 0.7;
const SELECTED_SCALE = 0.95;
const MAX_LINKS = 8;
const SNAP_RADIUS_PX = 26;   // 點擊吸附半徑

export const SemanticMapScene = () => {
  const morphTarget = useMapState((s) => s.morph);
  const query = useMapState((s) => s.query);
  const hovered = useMapState((s) => s.hovered);
  const selected = useMapState((s) => s.selected);
  const setHovered = useMapState((s) => s.setHovered);
  const setSelected = useMapState((s) => s.setSelected);

  const [map, setMap] = useState(null);
  const meshRef = useRef();
  const controlsRef = useRef();
  const press = useLongPressPick();
  const morph = useRef(morphTarget);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  /*
   * 這一頁的相機要退到整團都入鏡。
   * 共用 canvas 的預設相機是給經營藍圖那頁用的（距離 34），
   * 而語意地圖的半徑就是 22 —— 沿用預設會直接站在雲的正中間。
   */
  useEffect(() => {
    const distance = MAP_RADIUS * 2.9;
    camera.position.set(0, MAP_RADIUS * 0.35, distance);
    camera.far = Math.max(2000, distance * 4);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [camera]);

  /*
   * 手機的 +／− 縮放。
   *
   * 觸控裝置沒有滾輪，而雙指捏合在 OrbitControls 裡跟旋轉共用同一組手指，
   * 小螢幕上很難只做其中一件。按鈕是最不會出錯的做法。
   *
   * 沿著「相機 → 目標」這條線推拉，並夾在 OrbitControls 自己的
   * minDistance／maxDistance 之間，免得推過頭鑽進雲裡或退到看不見。
   */
  const mapZoom = useMobileUi((s) => s.mapZoom);
  const lastZoom = useRef(0);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || mapZoom === lastZoom.current) return;
    const dir = Math.sign(mapZoom - lastZoom.current);
    lastZoom.current = mapZoom;

    const offset = camera.position.clone().sub(controls.target);
    const next = THREE.MathUtils.clamp(
      offset.length() * (dir > 0 ? 0.78 : 1.28),
      controls.minDistance,
      controls.maxDistance,
    );
    camera.position.copy(controls.target).add(offset.setLength(next));
    controls.update();
  }, [mapZoom, camera]);

  useEffect(() => {
    let cancelled = false;
    loadSemanticMap().then((m) => !cancelled && setMap(m));
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * 手動指定 bounding sphere。
   *
   * three 的 InstancedMesh 只在第一次 raycast 時算一次 boundingSphere 並永久快取。
   * 這個場景的矩陣是在 useFrame 才寫入的，所以那一次算到的是「全零矩陣」——
   * 得到一顆退化的球，之後每一條射線都被它擋掉，點擊與 hover 全部失效。
   *
   * 座標在匯出時已正規化到 MAP_RADIUS，所以直接給定精確範圍，
   * 比每幀重算便宜，也不會再踩到快取時機的問題。
   */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !map) return;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), MAP_RADIUS * 1.5);
  }, [map]);

  const palette = useMemo(
    () => (map ? map.palette.map((hex) => new THREE.Color(hex)) : []),
    [map],
  );
  const centroids = useMemo(() => (map ? clusterCentroids(map) : []), [map]);
  const hits = useMemo(() => (map ? searchCards(map, query) : null), [map, query]);

  // 每幀寫入的位置緩衝：2D 與 3D 之間插值
  const positions = useMemo(
    () => (map ? new Float32Array(map.cardCount * 3) : null),
    [map],
  );

  /*
   * 選取後連到最相似的 8 張 —— 關聯用明線畫，不要求肉眼判斷 3D 空間中的遠近。
   * 頂點在 useFrame 裡跟著位置一起更新，變形過程中線才不會脫節。
   */
  const links = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const verts = new Float32Array(MAX_LINKS * 6);
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return { geometry, verts };
  }, []);

  useEffect(() => () => links.geometry.dispose(), [links]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !map || !positions) return;

    const k = 1 - Math.pow(0.004, delta);
    morph.current += (morphTarget - morph.current) * k;
    const t = morph.current;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const dummy = new THREE.Object3D();
    const dim = map.cardCount;

    for (let i = 0; i < dim; i += 1) {
      const x2 = map.positions2d[i * 2];
      const y2 = map.positions2d[i * 2 + 1];
      const x3 = map.positions3d[i * 3];
      const y3 = map.positions3d[i * 3 + 1];
      const z3 = map.positions3d[i * 3 + 2];

      const x = x2 + (x3 - x2) * e;
      const y = y2 + (y3 - y2) * e;
      const z = z3 * e;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 搜尋沒命中的縮小、命中的維持原尺寸；hover 與選取再放大
      const matched = !hits || hits.has(i);
      let scale = matched ? BASE_SCALE : BASE_SCALE * 0.35;
      if (i === hovered) scale = HOVER_SCALE;
      if (i === selected) scale = SELECTED_SCALE;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const base = palette[map.cluster[i]] ?? palette[0];
      if (i === selected || i === hovered) {
        mesh.setColorAt(i, WHITE);
      } else if (matched) {
        mesh.setColorAt(i, base);
      } else {
        mesh.setColorAt(i, DIMMED);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // 連線跟著同一批位置更新
    if (selected !== null) {
      const list = map.neighbours[selected] ?? [];
      const { verts, geometry } = links;
      let w = 0;
      for (let n = 0; n < Math.min(list.length, MAX_LINKS); n += 1) {
        const j = map.srcToIndex.get(list[n]);
        if (j === undefined) continue;
        verts[w++] = positions[selected * 3];
        verts[w++] = positions[selected * 3 + 1];
        verts[w++] = positions[selected * 3 + 2];
        verts[w++] = positions[j * 3];
        verts[w++] = positions[j * 3 + 1];
        verts[w++] = positions[j * 3 + 2];
      }
      verts.fill(0, w);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeBoundingSphere();
    }
  });

  const handleMove = useCallback(
    (e) => {
      if (e.instanceId !== undefined) setHovered(e.instanceId);
    },
    [setHovered],
  );
  const handleOut = useCallback(() => setHovered(null), [setHovered]);

  /*
   * 點到空白時吸附到螢幕上最近的節點。
   *
   * 實測直接命中率只有約 38% —— 節點在螢幕上不到十個像素，
   * 要求使用者精準命中就是上一版「點擊不易」的老問題。
   * 這裡改成：射線沒打中就把所有節點投影到螢幕，取最近的一顆，
   * 超過門檻才真的算點空白。兩千多個點投影一次不到一毫秒，只在點擊時做。
   */
  const handleMissed = useCallback(
    (event) => {
      if (!map || !positions) return;
      /*
       * 吸附也要過長按閘門。
       * 只擋 handleClick 是不夠的 —— 沒打中幾何體時會走到這裡吸附最近的節點，
       * 輕點照樣選得到，「點一下不會」就沒有成立。
       * 短按在這個模式下改成收起卡片，使用者才有辦法把它關掉。
       */
      if (!press.accepts()) {
        setSelected(null);
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;

      const v = new THREE.Vector3();
      let best = -1;
      let bestDist = SNAP_RADIUS_PX * SNAP_RADIUS_PX;

      for (let i = 0; i < map.cardCount; i += 1) {
        v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).project(camera);
        if (v.z > 1) continue; // 在相機後方
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d = (sx - px) ** 2 + (sy - py) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }

      setSelected(best >= 0 ? best : null);
    },
    [map, positions, gl, camera, setSelected, press],
  );
  const handleClick = useCallback(
    (e) => {
      if (e.instanceId === undefined) return;
      // 手機收合時：輕點不算，要按住才選（詳見 useLongPressPick）
      if (!press.accepts()) {
        setSelected(null);
        return;
      }
      e.stopPropagation();
      setSelected(e.instanceId);
    },
    [setSelected, press],
  );

  if (!map) return null;

  return (
    <>
      <fog attach="fog" args={['#070a0f', 40, 130]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[8, 12, 6]} intensity={1.2} />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, map.cardCount]}
        frustumCulled={false}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
        onClick={handleClick}
        onPointerDown={press.onPointerDown}
        onPointerMissed={handleMissed}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.5} metalness={0.05} />
      </instancedMesh>

      {selected !== null && (
        <lineSegments geometry={links.geometry} frustumCulled={false} renderOrder={10}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.55} depthTest={false} />
        </lineSegments>
      )}

      {/* 標群不標點：12 個代表詞，不是 2,331 個標籤 */}
      {centroids.map((p, c) => {
        const info = map.clusters[c];
        if (!info || info.size === 0) return null;
        return (
          <Html
            key={c}
            position={[p[0], p[1], p[2]]}
            center
            style={{ pointerEvents: 'none', transition: 'opacity .3s' }}
          >
            <div
              style={{
                whiteSpace: 'nowrap',
                fontSize: 11,
                letterSpacing: '.05em',
                color: map.palette[c],
                background: 'rgba(7,10,15,.72)',
                border: `1px solid ${map.palette[c]}33`,
                borderRadius: 4,
                padding: '2px 7px',
                opacity: query ? 0.25 : 1,
              }}
            >
              {info.terms.slice(0, 2).join('·')}
              <span style={{ color: '#5b6675', marginLeft: 6 }}>{info.size}</span>
            </div>
          </Html>
        );
      })}

      {/* 預設不自轉 —— 會動的目標點不到 */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={140}
      />
    </>
  );
};

const WHITE = new THREE.Color('#ffffff');
const DIMMED = new THREE.Color('#1e2733');
