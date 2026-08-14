/**
 * 3D 徑向樹佈局。
 *
 * 輸入是欄式結構（count + parent: Int32Array），不是物件陣列 ——
 * 最高檔位要跑一百萬個節點，物件與字串在那個量級會壓垮記憶體。
 * 樹的走訪用 CSR（compressed sparse row）表示子節點，避免產生一百萬個小陣列。
 *
 * 深度 = 半徑，這一點刻意保留 —— 經營藍圖的層級語意
 * （policy → strategy → plan → task）對應到「離中心多遠」，
 * 看的人不需要學新的閱讀規則。
 *
 * 兩個階段：
 *   1. 立體角錐分配（決定性、O(n)）—— 每個節點依子樹大小分到一塊球冠，
 *      子節點在該球冠內等面積鋪開。子樹因此成群，邊變短，毛線球消失。
 *   2. 鬆弛（迭代）—— 同層互斥推開擁擠，同時朝父節點方向收攏，
 *      再投影回自己那層的球面。
 *
 * 為什麼不用課本式的全域力導向 n-body 模擬：一萬個節點要收斂需要數百次迭代，
 * 未收斂時會抖。現場 demo 不能抖，也不能讓觀眾等。
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 球冠分配時留的縫隙 —— 給滿會讓相鄰子樹貼在一起 */
const CONE_PACKING = 0.85;

const RELAX_REPEL = 0.5;
const RELAX_ATTRACT = 0.05;

/** 節點成群之後同層不再均勻鋪滿球面，半徑要補償這個聚集 */
const CLUSTER_COMPENSATION = 1.35;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 鬆弛次數隨規模遞減。
 *
 * 鬆弛是 O(n × 鄰居)，一百萬個節點跑六次要十幾秒 —— 現場沒有人會等。
 * 好在錐形分配本身已經是決定性的均勻分佈，鬆弛只是修局部擁擠，
 * 規模越大、單一節點的視覺份量越小，少跑幾次看不出來。
 */
const relaxIterations = (count) => {
  if (count <= 20000) return 6;
  if (count <= 50000) return 2;
  return 0;
};

/**
 * 建 CSR 子節點索引 + BFS 順序 + 深度。
 *
 * parent 會先複製一份 —— 遇到環時要就地把節點改成根，不能污染呼叫端的資料。
 */
export const buildTree = (count, inputParent) => {
  const parent = Int32Array.from(inputParent);

  const childStart = new Int32Array(count + 1);
  for (let i = 0; i < count; i += 1) {
    if (parent[i] >= 0) childStart[parent[i] + 1] += 1;
  }
  for (let i = 0; i < count; i += 1) childStart[i + 1] += childStart[i];

  const cursor = Int32Array.from(childStart.subarray(0, count));
  const childList = new Int32Array(childStart[count]);
  for (let i = 0; i < count; i += 1) {
    if (parent[i] >= 0) childList[cursor[parent[i]]++] = i;
  }

  const order = new Int32Array(count);
  const depth = new Int32Array(count);
  const visited = new Uint8Array(count);
  let tail = 0;

  for (let i = 0; i < count; i += 1) {
    if (parent[i] === -1) {
      visited[i] = 1;
      order[tail++] = i;
    }
  }

  let head = 0;
  const drain = () => {
    while (head < tail) {
      const i = order[head++];
      for (let k = childStart[i]; k < childStart[i + 1]; k += 1) {
        const c = childList[k];
        if (visited[c]) continue;
        visited[c] = 1;
        depth[c] = depth[i] + 1;
        order[tail++] = c;
      }
    }
  };
  drain();

  // 環：BFS 走不到的節點就地當成新的根，不讓它們默默消失
  for (let i = 0; i < count; i += 1) {
    if (visited[i]) continue;
    parent[i] = -1;
    visited[i] = 1;
    depth[i] = 0;
    order[tail++] = i;
    drain();
  }

  return { parent, childStart, childList, order, depth };
};

/** 子樹大小。BFS order 裡父節點必定在子節點之前，所以反向累加即可。 */
const subtreeWeights = (order, parent, count) => {
  const weight = new Float32Array(count).fill(1);
  for (let k = count - 1; k >= 0; k -= 1) {
    const i = order[k];
    if (parent[i] >= 0) weight[parent[i]] += weight[i];
  }
  return weight;
};

/** 每層球殼的半徑：深度基準與密度需求取大值 */
const shellRadii = (depth, count, spacing) => {
  let maxDepth = 0;
  for (let i = 0; i < count; i += 1) if (depth[i] > maxDepth) maxDepth = depth[i];

  const perDepth = new Int32Array(maxDepth + 1);
  for (let i = 0; i < count; i += 1) perDepth[depth[i]] += 1;

  const radii = new Float32Array(maxDepth + 1);
  for (let d = 0; d <= maxDepth; d += 1) {
    if (d === 0 && perDepth[0] === 1) {
      radii[0] = 0;
      continue;
    }
    // 4πr² = n·spacing² → r = spacing·√(n/4π)
    const density =
      spacing * Math.sqrt(perDepth[d] / (4 * Math.PI)) * CLUSTER_COMPENSATION;
    radii[d] = Math.max(2.5 + d * 3.2, density);
  }

  return { radii, maxDepth };
};

/** 以 w 為主軸的正交基底 */
const basisFrom = (wx, wy, wz) => {
  const ax = Math.abs(wy) < 0.9 ? 0 : 1;
  const ay = Math.abs(wy) < 0.9 ? 1 : 0;
  let ux = ay * wz;
  let uy = -ax * wz;
  let uz = ax * wy - ay * wx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = wy * uz - wz * uy;
  const vy = wz * ux - wx * uz;
  const vz = wx * uy - wy * ux;
  return [ux, uy, uz, vx, vy, vz];
};

/**
 * 立體角錐分配。
 *
 * 球冠的立體角是 2π(1−cos α)，所以把父節點的球冠按子樹大小切開
 * 只要解 cos β = 1 − (w/W)(1 − cos α) —— 這是精確的等面積分割，不是近似。
 * 子節點方向用同一條式子鋪開（cos θ 均勻），因此 α = π（根節點）
 * 自然退化成整顆球面的均勻分佈。
 */
const allocateCones = (count, parent, childStart, childList, order, weight) => {
  const dir = new Float32Array(count * 3);
  const half = new Float32Array(count);

  // root 拿整顆球面。多個 root 就沿黃金角錯開，避免疊在同一點。
  let rootSeen = 0;
  for (let i = 0; i < count; i += 1) {
    if (parent[i] !== -1) continue;
    const phi = GOLDEN_ANGLE * rootSeen;
    rootSeen += 1;
    dir[i * 3] = Math.sin(phi) * 0.001;
    dir[i * 3 + 1] = 1;
    dir[i * 3 + 2] = Math.cos(phi) * 0.001;
    half[i] = Math.PI;
  }

  for (let k = 0; k < count; k += 1) {
    const i = order[k];
    const from = childStart[i];
    const to = childStart[i + 1];
    const K = to - from;
    if (K === 0) continue;

    const wx = dir[i * 3];
    const wy = dir[i * 3 + 1];
    const wz = dir[i * 3 + 2];
    const [ux, uy, uz, vx, vy, vz] = basisFrom(wx, wy, wz);

    const cosA = Math.cos(half[i]);
    let W = 0;
    for (let t = from; t < to; t += 1) W += weight[childList[t]];

    for (let t = from; t < to; t += 1) {
      const c = childList[t];
      const slot = t - from;

      // 單一子節點就對齊父節點方向，長鏈才不會歪成螺旋
      const cosT =
        K === 1 ? 1 : clamp(1 - (1 - cosA) * ((slot + 0.5) / K), -1, 1);
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = GOLDEN_ANGLE * slot;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);

      dir[c * 3] = cosT * wx + sinT * (cp * ux + sp * vx);
      dir[c * 3 + 1] = cosT * wy + sinT * (cp * uy + sp * vy);
      dir[c * 3 + 2] = cosT * wz + sinT * (cp * uz + sp * vz);

      const frac = (weight[c] / W) * CONE_PACKING;
      half[c] = Math.acos(clamp(1 - frac * (1 - cosA), -1, 1));
    }
  }

  return dir;
};

const cellHash = (cx, cy, cz, d) =>
  (cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791) ^ (d * 2654435761);

/**
 * 鬆弛：同層互斥 + 朝父節點收攏 + 投影回球面。
 *
 * 只跟同一層的節點比對 —— 不同層本來就隔著半徑差，
 * 而且這讓空間格把層當成第四個維度切開，省掉大量無用比對。
 */
const relax = (positions, depth, parent, radii, spacing, count, iterations) => {
  if (iterations === 0) return;

  const cell = spacing * 1.6;
  const push = new Float32Array(count * 3);

  for (let iter = 0; iter < iterations; iter += 1) {
    const grid = new Map();
    for (let i = 0; i < count; i += 1) {
      const h = cellHash(
        Math.floor(positions[i * 3] / cell),
        Math.floor(positions[i * 3 + 1] / cell),
        Math.floor(positions[i * 3 + 2] / cell),
        depth[i],
      );
      const bucket = grid.get(h);
      if (bucket) bucket.push(i);
      else grid.set(h, [i]);
    }

    push.fill(0);

    for (let i = 0; i < count; i += 1) {
      const xi = positions[i * 3];
      const yi = positions[i * 3 + 1];
      const zi = positions[i * 3 + 2];
      const cx = Math.floor(xi / cell);
      const cy = Math.floor(yi / cell);
      const cz = Math.floor(zi / cell);

      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let oz = -1; oz <= 1; oz += 1) {
            const bucket = grid.get(cellHash(cx + ox, cy + oy, cz + oz, depth[i]));
            if (!bucket) continue;

            for (const j of bucket) {
              // hash 會碰撞，所以還是要實際比對層數與距離
              if (j === i || depth[j] !== depth[i]) continue;
              const dx = xi - positions[j * 3];
              const dy = yi - positions[j * 3 + 1];
              const dz = zi - positions[j * 3 + 2];
              const dist = Math.hypot(dx, dy, dz);
              if (dist >= spacing || dist === 0) continue;

              const strength = (spacing - dist) / dist;
              push[i * 3] += dx * strength;
              push[i * 3 + 1] += dy * strength;
              push[i * 3 + 2] += dz * strength;
            }
          }
        }
      }
    }

    for (let i = 0; i < count; i += 1) {
      const r = radii[depth[i]];
      if (r === 0) continue;

      let x = positions[i * 3] + push[i * 3] * RELAX_REPEL;
      let y = positions[i * 3 + 1] + push[i * 3 + 1] * RELAX_REPEL;
      let z = positions[i * 3 + 2] + push[i * 3 + 2] * RELAX_REPEL;

      const p = parent[i];
      if (p >= 0) {
        const pl =
          Math.hypot(positions[p * 3], positions[p * 3 + 1], positions[p * 3 + 2]) || 1;
        x += ((positions[p * 3] / pl) * r - x) * RELAX_ATTRACT;
        y += ((positions[p * 3 + 1] / pl) * r - y) * RELAX_ATTRACT;
        z += ((positions[p * 3 + 2] / pl) * r - z) * RELAX_ATTRACT;
      }

      const l = Math.hypot(x, y, z) || 1;
      positions[i * 3] = (x / l) * r;
      positions[i * 3 + 1] = (y / l) * r;
      positions[i * 3 + 2] = (z / l) * r;
    }
  }
};

/**
 * @param data { count, parent } 欄式結構
 * @returns { positions, depth, parent, maxRadius, maxDepth, iterations }
 */
export const radialTreeLayout = (data, { spacing = 1.1 } = {}) => {
  const count = data.count;
  if (count === 0) {
    return {
      positions: new Float32Array(),
      depth: new Int32Array(),
      parent: new Int32Array(),
      maxRadius: 0,
      maxDepth: 0,
      iterations: 0,
    };
  }

  const { parent, childStart, childList, order, depth } = buildTree(count, data.parent);
  const weight = subtreeWeights(order, parent, count);
  const { radii, maxDepth } = shellRadii(depth, count, spacing);
  const dir = allocateCones(count, parent, childStart, childList, order, weight);

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = radii[depth[i]];
    positions[i * 3] = dir[i * 3] * r;
    positions[i * 3 + 1] = dir[i * 3 + 1] * r;
    positions[i * 3 + 2] = dir[i * 3 + 2] * r;
  }

  const iterations = relaxIterations(count);
  relax(positions, depth, parent, radii, spacing, count, iterations);

  let maxRadius = 0;
  for (let d = 0; d <= maxDepth; d += 1) maxRadius = Math.max(maxRadius, radii[d]);

  // weight 就是子樹大小，點選聚焦時要顯示「這個節點底下有幾個」，順手回傳
  return { positions, depth, parent, subtreeSize: weight, maxRadius, maxDepth, iterations };
};

/**
 * 邊的線段頂點。
 * @param keep 傳入子節點 index，回傳這條邊要不要納入 ——
 *   用來把邊拆成「焦點」與「背景」兩份，解遮擋時分開畫。
 */
export const edgeSegments = (parent, positions, keep) => {
  const count = parent.length;

  let n = 0;
  for (let i = 0; i < count; i += 1) {
    if (parent[i] >= 0 && keep(i)) n += 1;
  }

  const out = new Float32Array(n * 6);
  let w = 0;
  for (let i = 0; i < count; i += 1) {
    const p = parent[i];
    if (p < 0 || !keep(i)) continue;
    out[w++] = positions[i * 3];
    out[w++] = positions[i * 3 + 1];
    out[w++] = positions[i * 3 + 2];
    out[w++] = positions[p * 3];
    out[w++] = positions[p * 3 + 1];
    out[w++] = positions[p * 3 + 2];
  }
  return out;
};

/** 顏色依序對應 data/blueprint.js 的 KINDS */
export const KIND_COLORS = [
  '#4fd1c5', // policy
  '#5aa9e6', // strategy
  '#8b9fd4', // plan
  '#7d8b9c', // task
  '#f0a35e', // task-bpm
];
