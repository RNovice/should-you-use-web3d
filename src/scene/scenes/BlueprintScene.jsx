import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useLongPressPick } from '../useLongPressPick';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadBlueprint, KINDS, KIND_LABELS } from '../../data/blueprint';
import { tierTarget } from '../../data/tiers';
import { useDeck, reportStats, setSelection, setPickable } from '../../deck/useDeck';
import { radialTreeLayout, edgeSegments, KIND_COLORS } from '../layout';

/** 節點間距（world unit）。球面半徑依這個值與節點數推算，密度維持定值。 */
const SPACING = 1.1;

const PALETTE = KIND_COLORS.map((hex) => new THREE.Color(hex));

/**
 * 渲染策略的切換點。
 *
 * InstancedMesh 的 draw call 不隨節點數成長，但**三角形數會**：
 * 最低面數的 icosahedron 也有 20 個三角形，一百萬顆就是兩千萬個三角形，
 * 每幀都要送進 GPU —— 實測會把分頁打掉。
 *
 * 超過這個門檻改用 point sprite：一個節點一個頂點，幾何量少 20 倍。
 * 在那個密度下單顆節點本來也只有一兩個像素，看起來沒有差別。
 * 這個切換本身就是研究結論之一，所以 HUD 會把當下用哪一種顯示出來。
 */
const POINT_THRESHOLD = 150000;

/** 邊在極高密度下只是一團霧，卻要付一百萬個線段的代價 —— 直接不畫 */
const EDGE_THRESHOLD = 150000;

/**
 * 一團節點（InstancedMesh 版）。
 *
 * 焦點與背景各一個 —— 這是解遮擋的關鍵：
 * 背景那團開 transparent 且關掉 depthWrite，所以它不會擋住內部結構。
 * three 會把透明物件排在不透明之後畫，depthTest 仍然開著，
 * 因此躲在焦點節點後方的背景節點會被正確剔除，前方的只留下一層薄霧。
 */
const InstancedCloud = ({ indices, positions, kind, scale, opacity, onPick, onMiss }) => {
  const meshRef = useRef();
  const count = indices.length;
  const press = useLongPressPick();

  /*
   * R3F 給的 instanceId 是「這團裡的第幾顆」，不是節點編號 ——
   * 焦點與背景是兩團不同的 instanced mesh，一定要透過 indices 換回真正的節點。
   */
  const handleClick = useCallback(
    (e) => {
      if (!onPick || e.instanceId === undefined) return;
      // 手機收合時：輕點不算，要按住才選；短按改成收起卡片（詳見 useLongPressPick）
      if (!press.accepts()) {
        onMiss?.();
        return;
      }
      e.stopPropagation();
      onPick(indices[e.instanceId]);
    },
    [onPick, onMiss, indices, press],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const dummy = new THREE.Object3D();
    for (let slot = 0; slot < count; slot += 1) {
      const i = indices[slot];
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(slot, dummy.matrix);
      mesh.setColorAt(slot, PALETTE[kind[i]] ?? PALETTE[3]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [indices, positions, kind, scale, count]);

  const detail = count > 4000 ? 0 : 1;
  const transparent = opacity < 1;

  return (
    <instancedMesh
      key={`${count}-${detail}`}
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      onClick={onPick ? handleClick : undefined}
      onPointerDown={onPick ? press.onPointerDown : undefined}
      // 點到空白處（沒命中這團）就取消選取，省掉一顆專門接射線的背景球
      onPointerMissed={onMiss}
    >
      <icosahedronGeometry args={[1, detail]} />
      <meshStandardMaterial
        roughness={0.45}
        metalness={0.1}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
    </instancedMesh>
  );
};

/** 一團節點（point sprite 版）。極高密度時取代 InstancedCloud。 */
const PointCloud = ({ indices, positions, kind, scale, opacity }) => {
  const count = indices.length;

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let slot = 0; slot < count; slot += 1) {
      const i = indices[slot];
      pos[slot * 3] = positions[i * 3];
      pos[slot * 3 + 1] = positions[i * 3 + 1];
      pos[slot * 3 + 2] = positions[i * 3 + 2];
      const c = PALETTE[kind[i]] ?? PALETTE[3];
      col[slot * 3] = c.r;
      col[slot * 3 + 1] = c.g;
      col[slot * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [indices, positions, kind, count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={scale * 2}
        sizeAttenuation
        vertexColors
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </points>
  );
};

const NodeCloud = ({ total, onPick, onMiss, ...props }) => {
  if (props.indices.length === 0) return null;
  // point sprite 沒有 mesh 可以射線命中，超過門檻就沒有點揀選
  return total > POINT_THRESHOLD ? (
    <PointCloud {...props} />
  ) : (
    <InstancedCloud {...props} onPick={onPick} onMiss={onMiss} />
  );
};

/**
 * 選取節點到根的整條路徑。
 *
 * 這是 3D 版本真正比 2D 多出來的東西：在 2D 樹狀圖裡要知道一個任務
 * 掛在哪個經營目標底下，得一路往上捲；這裡點一下就整條亮起來。
 */
/** 路徑最多標幾顆。實際藍圖深度不到 10，留這麼多是防呆。 */
const MAX_PATH_MARKERS = 64;
const MARKER_HEAD = new THREE.Color('#ffffff');
const MARKER_TAIL = new THREE.Color('#4fd1c5');

const AncestorPath = ({ chain, positions, markerRadius }) => {
  const markersRef = useRef();

  /*
   * 標記球用單一 InstancedMesh 而不是一顆一個 mesh。
   *
   * 一顆一個 mesh 的話 draw call 會隨路徑長度跳動 —— 現場有人盯著 HUD
   * 看到數字忽大忽小，會開始懷疑「draw call 與節點數無關」這個論點。
   * 這裡固定成一個。
   */
  useLayoutEffect(() => {
    const mesh = markersRef.current;
    if (!mesh || !chain) return;

    const dummy = new THREE.Object3D();
    const n = Math.min(chain.length, MAX_PATH_MARKERS);

    for (let k = 0; k < n; k += 1) {
      const i = chain[k];
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(markerRadius * (k === 0 ? 1 : 0.65));
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
      mesh.setColorAt(k, k === 0 ? MARKER_HEAD : MARKER_TAIL);
    }

    // 只畫實際用到的數量，其餘的實例不送進 GPU
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [chain, positions, markerRadius]);

  const geometry = useMemo(() => {
    if (!chain || chain.length < 2) return null;
    const verts = new Float32Array((chain.length - 1) * 6);
    for (let k = 0; k < chain.length - 1; k += 1) {
      const a = chain[k];
      const b = chain[k + 1];
      verts.set(
        [
          positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2],
          positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2],
        ],
        k * 6,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return g;
  }, [chain, positions]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!chain) return null;

  return (
    <>
      {geometry && (
        <lineSegments geometry={geometry} frustumCulled={false} renderOrder={10}>
          <lineBasicMaterial color="#4fd1c5" depthTest={false} transparent opacity={0.9} />
        </lineSegments>
      )}
      <instancedMesh
        ref={markersRef}
        args={[undefined, undefined, MAX_PATH_MARKERS]}
        frustumCulled={false}
        renderOrder={11}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial depthTest={false} transparent opacity={0.85} />
      </instancedMesh>
    </>
  );
};

/**
 * 主力 demo：經營藍圖的 3D 佈局。
 *
 * 資料是 2,331 個節點的經營藍圖快照，各檔位由它擴增而來。
 * 節點文字是生成的，但深度分佈與分支不均勻程度複製自真實資料 ——
 * 佈局成本取決於樹的形狀，隨機散點會低估它。
 *
 * 核心論證在 InstancedMesh —— 所有節點共用一份幾何與材質，
 * draw call 數量與節點數無關。這是 DOM（每張卡一個 element）
 * 與 Canvas 2D（每格重繪）都做不到的。
 *
 * TODO(D3)：點選聚焦（射線揀選 + 鏡頭飛行）。
 * TODO(D4)：視覺打磨與效能調校。
 */
export const BlueprintScene = () => {
  const tier = useDeck((s) => s.tier);
  const focusDepth = useDeck((s) => s.focusDepth);
  const camera = useThree((s) => s.camera);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const controlsRef = useRef();
  const flight = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    loadBlueprint(tierTarget(tier)).then(({ data: d, source }) => {
      if (cancelled) return;
      reportStats({ source });
      setPickable(d.count <= POINT_THRESHOLD);
      setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [tier]);

  const layout = useMemo(() => {
    if (!data || data.count === 0) return null;

    const started = performance.now();
    const result = radialTreeLayout(data, { spacing: SPACING });
    const layoutMs = performance.now() - started;

    reportStats({
      nodes: data.count,
      maxDepth: result.maxDepth,
      layoutMs: Math.round(layoutMs),
      iterations: result.iterations,
      strategy: data.count > POINT_THRESHOLD ? 'Points' : 'InstancedMesh',
    });

    return result;
  }, [data]);

  // 焦點／背景切分。切片改變時不必重算佈局，只是重新分組。
  const split = useMemo(() => {
    if (!layout) return null;
    const { depth } = layout;
    const count = depth.length;

    let focusCount = 0;
    for (let i = 0; i < count; i += 1) if (depth[i] <= focusDepth) focusCount += 1;

    const focus = new Int32Array(focusCount);
    const context = new Int32Array(count - focusCount);
    let f = 0;
    let c = 0;
    for (let i = 0; i < count; i += 1) {
      if (depth[i] <= focusDepth) focus[f++] = i;
      else context[c++] = i;
    }
    return { focus, context };
  }, [layout, focusDepth]);

  const edges = useMemo(() => {
    if (!layout || layout.depth.length > EDGE_THRESHOLD) return null;
    const { parent, positions, depth } = layout;
    return {
      focus: edgeSegments(parent, positions, (i) => depth[i] <= focusDepth),
      context: edgeSegments(parent, positions, (i) => depth[i] > focusDepth),
    };
  }, [layout, focusDepth]);

  const focusEdgeGeometry = useLineGeometry(edges?.focus);
  const contextEdgeGeometry = useLineGeometry(edges?.context);

  const maxRadius = layout?.maxRadius ?? 0;

  // 鏡頭自動取景：檔位切換後整棵樹仍然完整入鏡
  useEffect(() => {
    if (!maxRadius) return;
    const distance = maxRadius * 2.8 + 6;
    flight.current = null;
    camera.position.set(0, maxRadius * 0.5, distance);
    camera.far = Math.max(2000, distance * 4);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [maxRadius, camera]);

  // 選取節點到根的路徑。guard 是為了擋住資料有環時的無窮迴圈。
  const chain = useMemo(() => {
    if (selected === null || !layout) return null;
    const out = [];
    const guard = new Set();
    let i = selected;
    while (i >= 0 && !guard.has(i)) {
      guard.add(i);
      out.push(i);
      i = layout.parent[i];
    }
    return out;
  }, [selected, layout]);

  // 把選取內容送到 DOM 側欄
  useEffect(() => {
    if (!chain || !layout || !data) {
      setSelection(null);
      return;
    }
    const describe = (i) => ({
      label: data.labels?.[i] ?? `節點 #${i}`,
      kind: KIND_LABELS[KINDS[data.kind[i]]] ?? '節點',
    });
    setSelection({
      ...describe(selected),
      depth: layout.depth[selected],
      subtreeSize: Math.round(layout.subtreeSize[selected]),
      // 由根往下排，讀起來才是「這個任務屬於哪個目標」
      ancestors: chain.slice(1).reverse().map(describe),
    });
  }, [chain, selected, layout, data]);

  // 鏡頭飛行：選到節點後平滑移過去，不要瞬間跳 —— 瞬移會讓人失去空間感
  useEffect(() => {
    if (selected === null || !layout) {
      flight.current = null;
      return;
    }
    const p = new THREE.Vector3(
      layout.positions[selected * 3],
      layout.positions[selected * 3 + 1],
      layout.positions[selected * 3 + 2],
    );
    const outward = p.length() > 0.001 ? p.clone().normalize() : new THREE.Vector3(0, 0, 1);

    /*
     * 從球體外面看進來，而不是飛到節點臉上。
     *
     * 這裡要展示的是「這個節點往上屬於誰」，所以鏡頭必須同時框住節點與
     * 它到中心的整條路徑；貼太近就只剩一堆球擋在前面，路徑反而看不見。
     * 注視點取節點與原點的中間，讓路徑落在畫面中央。
     */
    const orbit = Math.max(22, maxRadius * 2.3);
    flight.current = {
      pos: outward.clone().multiplyScalar(orbit).add(new THREE.Vector3(0, maxRadius * 0.35, 0)),
      look: p.clone().multiplyScalar(0.5),
    };
  }, [selected, layout, maxRadius]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!flight.current || !controls) return;

    // 用指數逼近，跟 frame rate 無關
    const k = 1 - Math.pow(0.002, delta);
    camera.position.lerp(flight.current.pos, k);
    controls.target.lerp(flight.current.look, k);
    controls.update();

    if (camera.position.distanceTo(flight.current.pos) < 0.2) flight.current = null;
  });

  const handlePick = useCallback((node) => setSelected(node), []);
  const clearSelection = useCallback(() => setSelected(null), []);

  // Esc 取消選取。翻頁鍵不受影響 —— DeckRoot 沒有綁 Escape。
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!layout || !split) return null;

  return (
    <>
      {/* fog 隨取景距離縮放，換檔位時遠近層次才一致 */}
      <fog attach="fog" args={['#070a0f', maxRadius * 1.4, maxRadius * 4.6 + 30]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 12, 6]} intensity={1.5} />

      <NodeCloud
        total={data.count}
        indices={split.focus}
        positions={layout.positions}
        kind={data.kind}
        scale={SPACING * 0.3}
        opacity={1}
        onPick={handlePick}
        onMiss={clearSelection}
      />
      <NodeCloud
        total={data.count}
        indices={split.context}
        positions={layout.positions}
        kind={data.kind}
        scale={SPACING * 0.2}
        opacity={0.16}
      />

      {focusEdgeGeometry && (
        <lineSegments geometry={focusEdgeGeometry} frustumCulled={false}>
          <lineBasicMaterial color="#3d4c60" transparent opacity={0.45} />
        </lineSegments>
      )}
      {contextEdgeGeometry && (
        <lineSegments geometry={contextEdgeGeometry} frustumCulled={false}>
          <lineBasicMaterial
            color="#2a3444"
            transparent
            opacity={0.07}
            depthWrite={false}
          />
        </lineSegments>
      )}

      <AncestorPath
        chain={chain}
        positions={layout.positions}
        markerRadius={Math.max(0.7, maxRadius * 0.035)}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={maxRadius * 8 + 40}
        // 選取後停止自轉：正在讀一條路徑時畫面還在轉會看不下去
        autoRotate={selected === null}
        autoRotateSpeed={0.35}
      />
    </>
  );
};

/** 線段 geometry 的建立與釋放。忘記 dispose 在切檔位時會穩定漏記憶體。 */
const useLineGeometry = (vertices) => {
  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return g;
  }, [vertices]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
};
