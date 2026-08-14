/**
 * 語意地圖的資料層。
 *
 * 座標與分群是離線算好的（scratchpad/semantic-export.mjs）：
 * TF-IDF(bigram) → LSA-40 → SMACOF 1200 次迭代。
 * 前端不重算 —— SMACOF 在 2,331 個點上要跑一分鐘，那不是瀏覽器該做的事。
 *
 * 標籤不重複存一份，只存回 blueprint.json 的索引，在這裡合併。
 */

const PALETTE = [
  '#4fd1c5', '#5aa9e6', '#f0a35e', '#c084fc', '#7ee787', '#f472b6',
  '#facc15', '#38bdf8', '#fb923c', '#a3e635', '#e879f9', '#94a3b8',
];

let promise = null;

export const loadSemanticMap = () => {
  promise ??= Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/semantic-map.json`).then((r) =>
      r.ok ? r.json() : null,
    ),
    fetch(`${import.meta.env.BASE_URL}data/blueprint.json`).then((r) =>
      r.ok ? r.json() : null,
    ),
  ])
    .then(([map, cards]) => {
      if (!map || !cards) return null;
      return {
        ...map,
        palette: PALETTE,
        labels: map.src.map((i) => cards[i]?.label ?? `節點 ${i}`),
        kinds: map.src.map((i) => cards[i]?.type ?? 'task'),
        // neighbours 存的是 blueprint.json 的索引（跨檔案才有意義），
        // 畫線與查表都需要換回地圖自己的索引
        srcToIndex: new Map(map.src.map((src, i) => [src, i])),
      };
    })
    .catch(() => null);

  return promise;
};

/** 群中心（用 3D 座標算），標籤要浮在這裡 */
export const clusterCentroids = (map) => {
  const k = map.clusters.length;
  const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
  map.cluster.forEach((c, i) => {
    sums[c][0] += map.positions3d[i * 3];
    sums[c][1] += map.positions3d[i * 3 + 1];
    sums[c][2] += map.positions3d[i * 3 + 2];
    sums[c][3] += 1;
  });
  return sums.map(([x, y, z, n]) => (n ? [x / n, y / n, z / n] : [0, 0, 0]));
};

/** 搜尋：回傳命中的卡片 index 集合。空字串代表不過濾。 */
export const searchCards = (map, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const hits = new Set();
  map.labels.forEach((label, i) => {
    if (label.toLowerCase().includes(q)) hits.add(i);
  });
  return hits;
};
