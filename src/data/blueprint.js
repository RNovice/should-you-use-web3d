/**
 * 經營藍圖的資料層。
 *
 * 內部格式刻意用「欄式」而不是物件陣列：
 *   { count, parent: Int32Array, kind: Uint8Array, labels: string[] | null }
 *
 * 理由是最高檔位要跑到一百萬個節點。物件陣列在那個量級會產生一百萬個
 * 字串 id 與一百萬個物件，記憶體與 GC 直接吃掉我們要量測的東西。
 * 欄式結構下擴增與佈局都只是在 typed array 上跑迴圈。
 *
 * 資料來源優先序：
 *   1. public/data/blueprint.json —— 依真實結構統計生成的快照（見 tools/generate-blueprint.mjs）
 *   2. 程式生成 —— 快照不存在時的退路
 */

/** 真實 API 的節點型別，由高層到低層 */
export const KINDS = ['policy', 'strategy', 'plan', 'task', 'task-bpm'];
const KIND_INDEX = new Map(KINDS.map((k, i) => [k, i]));

/** 產品裡對使用者顯示的名稱 */
export const KIND_LABELS = {
  policy: '經營目標',
  strategy: '策略',
  plan: '計畫',
  task: '任務',
  'task-bpm': '流程任務',
};

/**
 * 每種 type 的文字放在不同欄位 —— 這是實際 API 的樣子，不是設計失誤，
 * 因為每種節點在後端是不同的表。
 */
const LABEL_FIELD = {
  policy: 'policy',
  strategy: 'strategy_name',
  plan: 'strategy_name',
  task: 'plan',
  'task-bpm': 'plan',
};

/**
 * 超過這個節點數就不保留標籤。
 *
 * 擴增時標籤是共用同一個字串物件（只多一個指標），所以成本遠低於直覺 ——
 * 門檻設在點揀選失效的地方就夠了，不需要更早放棄。
 */
const LABEL_BUDGET = 200000;

const labelOf = (n) =>
  n.label ?? n[LABEL_FIELD[n.type]] ?? n.title ?? n.name ?? null;

/**
 * 把 API 回應正規化成欄式結構。
 *
 * 關鍵在父指標是多型的（parent_type + parent_id）：
 * id 只在同一個 type 內唯一，跨 type 會撞號（實測這份資料有 84 次）。
 * 只用 id 當 key 會把樹接錯，而且不會報錯 —— 只會安靜地長出錯誤的結構。
 */
export const normalize = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const count = raw.length;
  const key = (type, id) => `${type ?? ''}:${id}`;
  const indexByKey = new Map();

  raw.forEach((n, i) => indexByKey.set(key(n.type, n.id), i));

  const parent = new Int32Array(count);
  const kind = new Uint8Array(count);
  const labels = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const n = raw[i];
    const pid = n.parent_id ?? n.parentId ?? null;
    parent[i] =
      pid === null || pid === undefined
        ? -1
        : (indexByKey.get(key(n.parent_type ?? n.type, pid)) ?? -1);
    if (parent[i] === i) parent[i] = -1;

    kind[i] = KIND_INDEX.get(n.type ?? n.kind) ?? KIND_INDEX.get('task');
    labels[i] = labelOf(n) ?? `節點 ${i}`;
  }

  return { count, parent, kind, labels };
};

/**
 * 擴增到目標節點數。
 *
 * 整份結構重複複製，每一份的根掛到第一份的某個節點上。
 * 節點的分支特性與深度分佈因此被保留 —— 這對效能量測的可信度很重要，
 * 隨機散點會低估佈局成本（沒有深度、沒有分支不均）。
 */
export const amplify = (base, target) => {
  const { count, parent, kind, labels } = base;
  if (count === 0) return base;
  if (count === target) return base;

  if (count > target) {
    // 截斷時把指向被切掉範圍的父指標改成根，不留斷鏈
    const p = new Int32Array(target);
    for (let i = 0; i < target; i += 1) p[i] = parent[i] < target ? parent[i] : -1;
    return {
      count: target,
      parent: p,
      kind: kind.slice(0, target),
      labels: labels ? labels.slice(0, target) : null,
    };
  }

  const outParent = new Int32Array(target);
  const outKind = new Uint8Array(target);
  const keepLabels = labels && target <= LABEL_BUDGET;
  const outLabels = keepLabels ? new Array(target) : null;

  for (let g = 0; g < target; g += 1) {
    const src = g % count;
    const offset = g - src; // 每一份都是長度 count 的連續區塊
    const p = parent[src];

    if (p >= 0) {
      const candidate = p + offset;
      outParent[g] = candidate < target ? candidate : -1;
    } else {
      // 第一份保留原本的根；後續每一份掛到第一份的某個節點下
      outParent[g] = offset === 0 ? -1 : ((offset / count) * 7919) % count;
    }

    outKind[g] = kind[src];
    if (keepLabels) outLabels[g] = labels[src];
  }

  return { count: target, parent: outParent, kind: outKind, labels: outLabels };
};

/**
 * 程式生成的退路。
 * 分支數刻意不均勻 —— 真實藍圖不是完美的 n 元樹，
 * 而 2D 佈局爆版的主因正是分支不均造成的寬度膨脹。
 */
export const generateBlueprint = (target, seed = 1) => {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const parent = new Int32Array(target).fill(-1);
  const kind = new Uint8Array(target);
  const depth = new Int32Array(target);
  const keepLabels = target <= LABEL_BUDGET;
  const labels = keepLabels ? new Array(target) : null;

  if (keepLabels) labels[0] = '公司三年經營目標';

  const open = [0];
  for (let i = 1; i < target; i += 1) {
    const pickIndex = Math.floor(rand() ** 2 * open.length);
    const parentIdx = open[pickIndex] ?? 0;

    parent[i] = parentIdx;
    depth[i] = depth[parentIdx] + 1;
    kind[i] = Math.min(depth[i], KINDS.length - 1);
    if (keepLabels) labels[i] = `${KINDS[kind[i]]} ${i}`;

    if (depth[i] < 5) open.push(i);
    if (rand() < 0.35 && open.length > 1) open.splice(pickIndex, 1);
  }

  return { count: target, parent, kind, labels };
};

let snapshotPromise = null;

/** 快照只讀一次，切檔位時重複使用 */
const loadSnapshot = () => {
  snapshotPromise ??= fetch(`${import.meta.env.BASE_URL}data/blueprint.json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => (json ? normalize(json) : null))
    .catch(() => null); // 快照不存在是預期狀況，不需要吵

  return snapshotPromise;
};

/**
 * 統一入口。
 * @param target 目標節點數；null 表示「照快照原本的大小」（真實資料檔位）
 */
export const loadBlueprint = async (target) => {
  const snapshot = await loadSnapshot();

  if (snapshot) {
    return {
      data: target === null ? snapshot : amplify(snapshot, target),
      source: 'snapshot',
      snapshotCount: snapshot.count,
    };
  }

  const fallbackTarget = target ?? 2331;
  return {
    data: generateBlueprint(fallbackTarget),
    source: 'generated',
    snapshotCount: fallbackTarget,
  };
};
