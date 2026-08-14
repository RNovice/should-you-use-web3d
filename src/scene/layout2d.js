/**
 * 2D 樹狀圖佈局 —— 就是產品現在在用的那種。
 *
 * 存在的目的不是拿來用，是拿來當對照組：
 * 葉節點依 DFS 順序橫向排開，父節點置中於子節點之上。
 * 這是所有 2D 樹狀圖的共同結構，也是它的死穴 ——
 * **總寬度隨葉節點數線性成長**，而深度只影響高度。
 *
 * 換句話說：節點數翻十倍，畫布就要寬十倍。這不是實作問題，
 * 是把樹畫在平面上的先天限制。
 */

import { buildTree } from './layout';

export const tidyTreeLayout = (data, { nodeGap = 1.6, levelGap = 3.6 } = {}) => {
  const count = data.count;
  if (count === 0) {
    return { positions: new Float32Array(), width: 0, height: 0, leafCount: 0 };
  }

  const { parent, childStart, childList, order, depth } = buildTree(count, data.parent);
  const x = new Float32Array(count);

  /*
   * 葉節點依 DFS 順序取得 x —— 必須是 DFS 而不是 BFS，
   * 同一棵子樹的葉子才會連在一起，父節點置中後才不會出現交叉的邊。
   */
  let leafCursor = 0;
  const stack = [];
  for (let i = count - 1; i >= 0; i -= 1) if (parent[i] === -1) stack.push(i);

  while (stack.length) {
    const i = stack.pop();
    const from = childStart[i];
    const to = childStart[i + 1];
    if (from === to) {
      x[i] = leafCursor * nodeGap;
      leafCursor += 1;
    } else {
      // 反向推入，pop 出來才是原本的子節點順序
      for (let k = to - 1; k >= from; k -= 1) stack.push(childList[k]);
    }
  }

  // 反向 BFS：子節點必定先於父節點被處理，父節點取子節點的平均
  for (let k = count - 1; k >= 0; k -= 1) {
    const i = order[k];
    const from = childStart[i];
    const to = childStart[i + 1];
    if (from === to) continue;
    let sum = 0;
    for (let t = from; t < to; t += 1) sum += x[childList[t]];
    x[i] = sum / (to - from);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let maxDepth = 0;
  for (let i = 0; i < count; i += 1) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (depth[i] > maxDepth) maxDepth = depth[i];
  }

  const centerX = (minX + maxX) / 2;
  const height = maxDepth * levelGap;

  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = x[i] - centerX;
    positions[i * 3 + 1] = height / 2 - depth[i] * levelGap;
    positions[i * 3 + 2] = 0;
  }

  return {
    positions,
    width: maxX - minX,
    height,
    leafCount: leafCursor,
    nodeGap,
  };
};

/**
 * 把 2D 佈局的寬度換算成真實像素。
 *
 * 產品的卡片實際寬度約 220px、卡片之間留 40px —— 這個數字才是聽眾有感的：
 * 「你要橫向捲動五萬個像素」比「寬度是 N 個單位」有力得多。
 */
export const CARD_WIDTH_PX = 220;
export const CARD_GAP_PX = 40;

export const widthInPixels = (leafCount) =>
  Math.max(0, leafCount * (CARD_WIDTH_PX + CARD_GAP_PX) - CARD_GAP_PX);
