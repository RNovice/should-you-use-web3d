/**
 * 把語意地圖的量測結果導出給前端。
 *
 * 沿用 semantic-bench4 的管線（TF-IDF → LSA-40 → SMACOF），額外做兩件事：
 *   1. 在 LSA 空間分群，並替每一群取出代表詞 —— 地圖上標「群」不標「點」，
 *      2,279 個標籤擠在一起沒有人看得懂。
 *   2. 每張卡預先算好最相似的 8 張 —— 這是「找到之後用文字讀」的那份清單，
 *      3D 只負責帶你到附近。
 *
 * 標籤不重複寫進這個檔案，只存回 blueprint.json 的索引（src），
 * 省掉一份幾百 KB 的重複文字。
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = `${dirname(fileURLToPath(import.meta.url))}/..`;
const LSA_DIM = 40;
const LSA_ITERATIONS = 10;
const MDS_ITERATIONS = 1200;
const VOCAB_SIZE = 1200;
const CLUSTERS = 12;
const NEIGHBOURS = 8;

const cards = JSON.parse(readFileSync(`${APP}/public/data/blueprint.json`, 'utf8'));

const CJK = /[一-鿿]/;
const tokenize = (text) => {
  const tokens = [];
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9]{1,15}/g) ?? []) tokens.push(w);
  let run = '';
  const flush = () => {
    for (let i = 0; i + 1 < run.length; i += 1) tokens.push(run.slice(i, i + 2));
    if (run.length === 1) tokens.push(run);
    run = '';
  };
  for (const ch of text) {
    if (CJK.test(ch)) run += ch;
    else flush();
  }
  flush();
  return tokens;
};

const tokenized = cards.map((c) => tokenize(c.label));
const df = new Map();
tokenized.forEach((toks) => {
  for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
});

const vocab = [...df.entries()]
  .filter(([, c]) => c >= 2 && c <= cards.length * 0.5)
  .sort((a, b) => b[1] - a[1])
  .slice(0, VOCAB_SIZE)
  .map(([t]) => t);
const termIndex = new Map(vocab.map((t, i) => [t, i]));
const D = vocab.length;

// 保留原始索引，前端才能回頭取標籤
const kept = [];
tokenized.forEach((toks, i) => {
  if (toks.some((t) => termIndex.has(t))) kept.push(i);
});
const N = kept.length;
console.log(`卡片 ${cards.length} → 有效 ${N}（${cards.length - N} 張無有效詞彙）`);

const tfidf = new Float32Array(N * D);
kept.forEach((src, i) => {
  const tf = new Map();
  for (const t of tokenized[src]) {
    const j = termIndex.get(t);
    if (j !== undefined) tf.set(j, (tf.get(j) ?? 0) + 1);
  }
  let norm = 0;
  for (const [j, c] of tf) {
    const w = (1 + Math.log(c)) * Math.log(N / df.get(vocab[j]));
    tfidf[i * D + j] = w;
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [j] of tf) tfidf[i * D + j] /= norm;
});

/* ---------- LSA ---------- */

const orthonormalize = (V, rows, cols) => {
  for (let c = 0; c < cols; c += 1) {
    for (let p = 0; p < c; p += 1) {
      let dot = 0;
      for (let r = 0; r < rows; r += 1) dot += V[r * cols + c] * V[r * cols + p];
      for (let r = 0; r < rows; r += 1) V[r * cols + c] -= dot * V[r * cols + p];
    }
    let norm = 0;
    for (let r = 0; r < rows; r += 1) norm += V[r * cols + c] ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let r = 0; r < rows; r += 1) V[r * cols + c] /= norm;
  }
};

let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296 - 0.5;
};

const V = new Float32Array(D * LSA_DIM);
for (let i = 0; i < V.length; i += 1) V[i] = rand();
orthonormalize(V, D, LSA_DIM);

const AV = new Float32Array(N * LSA_DIM);
const R = new Float32Array(D * LSA_DIM);
for (let iter = 0; iter < LSA_ITERATIONS; iter += 1) {
  AV.fill(0);
  for (let i = 0; i < N; i += 1)
    for (let j = 0; j < D; j += 1) {
      const x = tfidf[i * D + j];
      if (x === 0) continue;
      for (let c = 0; c < LSA_DIM; c += 1) AV[i * LSA_DIM + c] += x * V[j * LSA_DIM + c];
    }
  R.fill(0);
  for (let i = 0; i < N; i += 1)
    for (let j = 0; j < D; j += 1) {
      const x = tfidf[i * D + j];
      if (x === 0) continue;
      for (let c = 0; c < LSA_DIM; c += 1) R[j * LSA_DIM + c] += x * AV[i * LSA_DIM + c];
    }
  V.set(R);
  orthonormalize(V, D, LSA_DIM);
}

const E = new Float32Array(N * LSA_DIM);
for (let i = 0; i < N; i += 1) {
  for (let j = 0; j < D; j += 1) {
    const x = tfidf[i * D + j];
    if (x === 0) continue;
    for (let c = 0; c < LSA_DIM; c += 1) E[i * LSA_DIM + c] += x * V[j * LSA_DIM + c];
  }
  let norm = 0;
  for (let c = 0; c < LSA_DIM; c += 1) norm += E[i * LSA_DIM + c] ** 2;
  norm = Math.sqrt(norm) || 1;
  for (let c = 0; c < LSA_DIM; c += 1) E[i * LSA_DIM + c] /= norm;
}
console.log('LSA 完成');

/* ---------- 距離矩陣 ---------- */

const dist = new Float32Array(N * N);
for (let i = 0; i < N; i += 1)
  for (let j = i + 1; j < N; j += 1) {
    let dot = 0;
    for (let k = 0; k < LSA_DIM; k += 1) dot += E[i * LSA_DIM + k] * E[j * LSA_DIM + k];
    const d = Math.sqrt(Math.max(0, 2 - 2 * dot));
    dist[i * N + j] = d;
    dist[j * N + i] = d;
  }

/* ---------- SMACOF ---------- */

const smacof = (dim) => {
  let s = 42;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
  const Y = new Float32Array(N * dim);
  for (let i = 0; i < Y.length; i += 1) Y[i] = r();
  const next = new Float32Array(N * dim);

  for (let iter = 0; iter < MDS_ITERATIONS; iter += 1) {
    next.fill(0);
    for (let i = 0; i < N; i += 1) {
      const oi = i * dim;
      let bii = 0;
      for (let j = 0; j < N; j += 1) {
        if (j === i) continue;
        const oj = j * dim;
        let d = 0;
        for (let k = 0; k < dim; k += 1) {
          const diff = Y[oi + k] - Y[oj + k];
          d += diff * diff;
        }
        d = Math.sqrt(d);
        const b = d > 1e-9 ? -dist[i * N + j] / d : 0;
        bii -= b;
        for (let k = 0; k < dim; k += 1) next[oi + k] += b * Y[oj + k];
      }
      for (let k = 0; k < dim; k += 1) next[oi + k] = (next[oi + k] + bii * Y[oi + k]) / N;
    }
    Y.set(next);
  }
  return Y;
};

console.log('SMACOF 2D…');
let t0 = performance.now();
const Y2 = smacof(2);
console.log(`  ${Math.round(performance.now() - t0)} ms`);
console.log('SMACOF 3D…');
t0 = performance.now();
const Y3 = smacof(3);
console.log(`  ${Math.round(performance.now() - t0)} ms`);

/** 置中並縮放到固定尺度，前端才不用猜相機距離 */
const normalize = (Y, dim, target) => {
  const centre = new Float64Array(dim);
  for (let i = 0; i < N; i += 1)
    for (let k = 0; k < dim; k += 1) centre[k] += Y[i * dim + k];
  for (let k = 0; k < dim; k += 1) centre[k] /= N;

  let maxR = 0;
  for (let i = 0; i < N; i += 1) {
    let r = 0;
    for (let k = 0; k < dim; k += 1) r += (Y[i * dim + k] - centre[k]) ** 2;
    maxR = Math.max(maxR, Math.sqrt(r));
  }
  const scale = target / (maxR || 1);
  const out = [];
  for (let i = 0; i < N; i += 1)
    for (let k = 0; k < dim; k += 1)
      out.push(Number(((Y[i * dim + k] - centre[k]) * scale).toFixed(3)));
  return out;
};

/* ---------- k-means 分群 ---------- */

const kmeans = (k) => {
  let s = 99;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const centroids = new Float32Array(k * LSA_DIM);
  for (let c = 0; c < k; c += 1) {
    const pick = Math.floor(r() * N);
    for (let d = 0; d < LSA_DIM; d += 1) centroids[c * LSA_DIM + d] = E[pick * LSA_DIM + d];
  }
  const assign = new Int32Array(N);

  for (let iter = 0; iter < 40; iter += 1) {
    for (let i = 0; i < N; i += 1) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c += 1) {
        let sim = 0;
        for (let d = 0; d < LSA_DIM; d += 1) sim += E[i * LSA_DIM + d] * centroids[c * LSA_DIM + d];
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      assign[i] = best;
    }
    centroids.fill(0);
    const counts = new Int32Array(k);
    for (let i = 0; i < N; i += 1) {
      counts[assign[i]] += 1;
      for (let d = 0; d < LSA_DIM; d += 1) centroids[assign[i] * LSA_DIM + d] += E[i * LSA_DIM + d];
    }
    for (let c = 0; c < k; c += 1) {
      let norm = 0;
      for (let d = 0; d < LSA_DIM; d += 1) norm += centroids[c * LSA_DIM + d] ** 2;
      norm = Math.sqrt(norm) || 1;
      for (let d = 0; d < LSA_DIM; d += 1) centroids[c * LSA_DIM + d] /= norm;
    }
  }
  return assign;
};

const assign = kmeans(CLUSTERS);

/** 每群的代表詞：群內平均 TF-IDF 減去全體平均，取最突出的幾個 */
const clusterTerms = () => {
  const globalMean = new Float64Array(D);
  for (let i = 0; i < N; i += 1)
    for (let j = 0; j < D; j += 1) globalMean[j] += tfidf[i * D + j];
  for (let j = 0; j < D; j += 1) globalMean[j] /= N;

  const out = [];
  for (let c = 0; c < CLUSTERS; c += 1) {
    const mean = new Float64Array(D);
    let count = 0;
    for (let i = 0; i < N; i += 1) {
      if (assign[i] !== c) continue;
      count += 1;
      for (let j = 0; j < D; j += 1) mean[j] += tfidf[i * D + j];
    }
    if (count === 0) {
      out.push({ terms: [], size: 0 });
      continue;
    }
    for (let j = 0; j < D; j += 1) mean[j] = mean[j] / count - globalMean[j];
    const top = [...mean.keys()]
      .sort((a, b) => mean[b] - mean[a])
      .slice(0, 4)
      .map((j) => vocab[j]);
    out.push({ terms: top, size: count });
  }
  return out;
};

const clusters = clusterTerms();
clusters.forEach((c, i) => console.log(`  群 ${i}｜${c.size} 張｜${c.terms.join(' ')}`));

/* ---------- 每張卡的最近鄰 ---------- */

const neighbours = [];
for (let i = 0; i < N; i += 1) {
  const idx = [];
  for (let j = 0; j < N; j += 1) if (j !== i) idx.push(j);
  idx.sort((a, b) => dist[i * N + a] - dist[i * N + b]);
  neighbours.push(idx.slice(0, NEIGHBOURS).map((j) => kept[j]));
}

/* ---------- 真的把指標算出來 ---------- */

/*
 * 這兩個數字是第 10 頁的頭條，一定要對應到實際出貨的資料。
 * 原本的匯出腳本把當初 bench 跑出來的值寫死在 payload 裡 ——
 * 換一份資料重跑，數字卻不會變，等於公開展示一個對這份資料不成立的結果。
 */
const stressOf = (Y, dim) => {
  let num = 0;
  let den = 0;
  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      let d = 0;
      for (let k = 0; k < dim; k += 1) {
        const diff = Y[i * dim + k] - Y[j * dim + k];
        d += diff * diff;
      }
      d = Math.sqrt(d);
      const delta = dist[i * N + j];
      num += (delta - d) ** 2;
      den += delta * delta;
    }
  }
  return Math.sqrt(num / den);
};

const knnOf = (getD, k) => {
  const out = new Int32Array(N * k);
  for (let i = 0; i < N; i += 1) {
    const idx = [];
    for (let j = 0; j < N; j += 1) if (j !== i) idx.push(j);
    idx.sort((a, b) => getD(i, a) - getD(i, b));
    for (let r = 0; r < k; r += 1) out[i * k + r] = idx[r];
  }
  return out;
};

const preservationOf = (Y, dim, trueNN, k) => {
  const getD = (i, j) => {
    let d = 0;
    for (let t = 0; t < dim; t += 1) {
      const diff = Y[i * dim + t] - Y[j * dim + t];
      d += diff * diff;
    }
    return d;
  };
  const embNN = knnOf(getD, k);
  let kept2 = 0;
  for (let i = 0; i < N; i += 1) {
    const set = new Set();
    for (let r = 0; r < k; r += 1) set.add(trueNN[i * k + r]);
    for (let r = 0; r < k; r += 1) if (set.has(embNN[i * k + r])) kept2 += 1;
  }
  return kept2 / (N * k);
};

console.log('計算 kNN@10 保留率與 stress…');
const K = 10;
const trueNN = knnOf((i, j) => dist[i * N + j], K);
const pres2 = preservationOf(Y2, 2, trueNN, K);
const pres3 = preservationOf(Y3, 3, trueNN, K);
const stress2 = stressOf(Y2, 2);
const stress3 = stressOf(Y3, 3);
console.log(`  2D 保留率 ${(pres2 * 100).toFixed(1)}%  stress ${stress2.toFixed(4)}`);
console.log(`  3D 保留率 ${(pres3 * 100).toFixed(1)}%  stress ${stress3.toFixed(4)}`);
console.log(`  3D 相對高出 ${(((pres3 - pres2) / pres2) * 100).toFixed(1)}%`);

const payload = {
  generatedFrom: 'public/data/blueprint.json',
  method: `TF-IDF(bigram) → LSA-${LSA_DIM} → SMACOF ${MDS_ITERATIONS} iters`,
  cardCount: N,
  skipped: cards.length - N,
  // 量測結果，直接放進資料裡讓 UI 可以誠實顯示
  preservation: { k: K, twoD: pres2, threeD: pres3 },
  stress: { twoD: stress2, threeD: stress3 },
  src: kept,
  cluster: Array.from(assign),
  clusters,
  positions2d: normalize(Y2, 2, 22),
  positions3d: normalize(Y3, 3, 22),
  neighbours,
};

const path = `${APP}/public/data/semantic-map.json`;
writeFileSync(path, JSON.stringify(payload));
console.log(`\n輸出 ${path}`);
console.log(`大小 ${(readFileSync(path).length / 1024).toFixed(0)} KB`);
