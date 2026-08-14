/**
 * 產生公開版用的經營藍圖假資料。
 *
 * 為什麼不是隨機散點：這份資料同時是效能量測的輸入，而佈局成本取決於
 * 樹的形狀（深度分佈、分支不均勻程度），不是節點總數。隨機散點會低估
 * 真實的佈局成本，量出來的數字就沒有參考價值。
 *
 * 所以這裡複製的是內部版本的**結構統計**，不是內容：
 *   2,331 節點｜69 個根｜深度分佈 69/149/224/609/1280
 *   type 分佈 task 1935、plan 204、strategy 102、policy 69、task-bpm 21
 *   分支數中位 2、最大 28（少數節點分支特別多，這是爆版的主因）
 *
 * 文字則全部重新生成：12 個主題各有自己的詞彙，主題之間刻意共用一部分詞。
 * 這樣語意地圖那頁跑出來才會有真的群集結構可看 —— 如果每張卡的用詞
 * 互不相干，降維之後就是一團均勻的雲，那一頁的論證會失去對象。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = `${dirname(fileURLToPath(import.meta.url))}/../public/data/blueprint.json`;

/** 固定 seed，重跑產出一模一樣 */
let seed = 20260814;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

/*
 * 12 個主題。動詞與量詞刻意跨主題共用，名詞才是主題專屬的 ——
 * 完全不重疊的詞彙會讓分群變得太容易，跟真實語料不像。
 */
const TOPICS = [
  { noun: ['營收', '毛利', '成本結構', '報價策略'], obj: ['季目標', '年度預算', '損益表'] },
  { noun: ['客戶滿意度', '回訪率', '服務品質', '客訴'], obj: ['調查', '追蹤表', '改善計畫'] },
  { noun: ['產品線', '功能模組', '版本', '需求規格'], obj: ['盤點', '排程', '驗收'] },
  { noun: ['自動化', '流程', '工單', '審批'], obj: ['導入', '重構', '文件化'] },
  { noun: ['資料倉儲', '報表', '指標定義', '資料品質'], obj: ['建置', '校正', '例行檢查'] },
  { noun: ['通路', '經銷商', '合約', '授權'], obj: ['簽訂', '續約', '盤點'] },
  { noun: ['人才', '教育訓練', '職能', '接班梯隊'], obj: ['規劃', '評鑑', '課程'] },
  { noun: ['資安', '權限', '稽核', '備援'], obj: ['演練', '盤點', '報告'] },
  { noun: ['行銷活動', '素材', '曝光', '轉換率'], obj: ['投放', '製作', '成效檢討'] },
  { noun: ['系統穩定度', '效能', '延遲', '容量'], obj: ['監控', '優化', '壓力測試'] },
  { noun: ['夥伴', '生態系', '整合', 'API'], obj: ['洽談', '串接', '文件'] },
  { noun: ['專案管理', '里程碑', '風險', '資源配置'], obj: ['盤點', '調整', '週報'] },
];

const VERB = ['完成', '啟動', '檢討', '優化', '建立', '擴充', '評估', '收斂'];
const QUAL = ['第一季', '第二季', '第三季', '第四季', '本月內', '兩週內', '年度', '例行'];
const UNIT = ['個', '項', '份', '次'];

const label = (topic, deep) => {
  const t = TOPICS[topic];
  const parts = [];
  // 實測內部版的標籤長度中位數是 17 個字，太短的話 bigram 太少，
  // TF-IDF 會算不出東西 —— 長度本身也是語意地圖那頁的前提
  if (deep && chance(0.3)) parts.push(`${2024 + Math.floor(rand() * 3)}/${1 + Math.floor(rand() * 12)}/${1 + Math.floor(rand() * 28)}前`);
  if (chance(0.5)) parts.push(pick(QUAL));
  parts.push(pick(t.noun));
  if (chance(0.7)) parts.push(pick(t.obj));
  if (chance(0.4)) parts.push(`與${pick(t.noun)}`);
  parts.push(pick(VERB));
  if (deep && chance(0.45)) parts.push(`${1 + Math.floor(rand() * 30)}${pick(UNIT)}`);
  if (chance(0.25)) parts.push(`（${pick(t.obj)}）`);
  return parts.join('');
};

/* ---------- 依照實測的結構統計長出一棵樹 ---------- */

const TYPE_BY_DEPTH = ['policy', 'strategy', 'plan', 'task', 'task'];
const TARGET_DEPTH = [69, 149, 224, 609, 1280]; // 實測的深度分佈

const cards = [];
const nextId = { policy: 1, strategy: 1, plan: 1, task: 1, 'task-bpm': 1 };
let levelNodes = [];

for (let depth = 0; depth < TARGET_DEPTH.length; depth += 1) {
  const type = TYPE_BY_DEPTH[depth];
  const want = TARGET_DEPTH[depth];
  const made = [];

  for (let i = 0; i < want; i += 1) {
    // 少數父節點分支特別多（最大 28），那是 2D 佈局爆版的主因，要保留
    const parent = depth === 0 ? null : levelNodes[Math.floor(Math.pow(rand(), 1.8) * levelNodes.length)];
    const topic = depth === 0 ? Math.floor(rand() * TOPICS.length) : parent.topic;

    const card = {
      type,
      id: nextId[type]++,
      parent_type: parent ? parent.type : null,
      parent_id: parent ? parent.id : null,
      label: label(topic, depth >= 3),
    };
    card.topic = topic;
    cards.push(card);
    made.push(card);
  }
  levelNodes = made;
}

/*
 * 最深一層挑 21 張改成 task-bpm，對應內部版本的 type 分佈。
 * 只能從最後一層挑：轉換會改 id，而 id 一改，指著它的子節點就變成孤兒
 * （第一版沒注意，跑出來多了 8 個假的根節點）。最深一層必定是葉節點。
 */
for (let i = 0; i < 21; i += 1) {
  const c = levelNodes[Math.floor(rand() * levelNodes.length)];
  if (c.type !== 'task') continue;
  c.type = 'task-bpm';
  c.id = nextId['task-bpm']++;
}

const out = cards.map(({ topic, ...rest }) => rest);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

const count = (k) => out.filter((c) => c.type === k).length;
console.log(`寫入 ${OUT}`);
console.log(`  節點 ${out.length}｜policy ${count('policy')} strategy ${count('strategy')} plan ${count('plan')} task ${count('task')} task-bpm ${count('task-bpm')}`);
console.log(`  根節點 ${out.filter((c) => c.parent_id === null).length}`);
