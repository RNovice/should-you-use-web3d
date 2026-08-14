/**
 * 背景點雲的「隊形」。
 *
 * 每一頁指定一個隊形，翻頁時整團點會從上一個隊形變形到下一個 ——
 * 所以每頁的裝飾不同，而換頁效果就是那個變形本身，不需要另外做轉場。
 *
 * 隊形刻意跟該頁的內容有關（三層架構 → 三層平面、覆蓋率 → 同心圓環、
 * 兩個部門 → 兩團分離的雲），這樣裝飾就不只是裝飾。
 *
 * 共同約束：低飽和、慢速、不搶焦點。簡報是一次性的十分鐘，
 * 但那十分鐘裡講者才是主角。
 */

export const POINT_COUNT = 4200;

/** 固定 seed 的偽隨機 —— 同一個隊形每次都長一樣，翻回去不會變 */
const makeRand = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const TAU = Math.PI * 2;

/**
 * 每個隊形回傳 { fill(positions, count), accent, motion, bias?, highlightRatio? }
 *   motion: 'spin' 緩慢自轉｜'wave' 波動｜'drift' 漂移｜'pulse' 呼吸
 *   bias:   水平偏移。文字區的遮罩壓在左側，所以「左右有意義」的緊緻隊形
 *           （兩團＝兩個部門、三個核＝三個問題）要整團推到右邊才看得見。
 *           滿版的隊形（晶格、分層、柱狀）不需要，推了反而會出畫。
 */
export const FORMATIONS = {
  /** 星雲：球殼上的隨機分佈 */
  nebula: {
    accent: '#4fd1c5',
    motion: 'spin',
    fill: (p, n) => {
      const rand = makeRand(11);
      for (let i = 0; i < n; i += 1) {
        const u = rand() * 2 - 1;
        const phi = rand() * TAU;
        const r = 16 + rand() * 12;
        const sr = Math.sqrt(1 - u * u);
        p[i * 3] = Math.cos(phi) * sr * r;
        p[i * 3 + 1] = u * r * 0.7;
        p[i * 3 + 2] = Math.sin(phi) * sr * r;
      }
    },
  },

  /** 三層平面：對應 WebGL2 → Three.js → R3F 的三層堆疊 */
  layers: {
    accent: '#5aa9e6',
    motion: 'drift',
    fill: (p, n) => {
      const rand = makeRand(23);
      for (let i = 0; i < n; i += 1) {
        const layer = i % 3;
        p[i * 3] = (rand() - 0.5) * 46;
        p[i * 3 + 1] = (layer - 1) * 9 + (rand() - 0.5) * 1.2;
        p[i * 3 + 2] = (rand() - 0.5) * 30;
      }
    },
  },

  /** 規則晶格 + 波動：呼應「一次送一批給 GPU」 */
  lattice: {
    accent: '#4fd1c5',
    motion: 'wave',
    fill: (p, n) => {
      const rand = makeRand(29);
      const side = Math.ceil(Math.cbrt(n));
      for (let i = 0; i < n; i += 1) {
        const x = i % side;
        const y = Math.floor(i / side) % side;
        const z = Math.floor(i / (side * side));
        /*
         * 抖動是必要的：完全規則的晶格在透視下會排成放射線，
         * 那些線剛好穿過文字區，比雜訊還難讀。
         */
        const j = 1.4;
        p[i * 3] = (x / (side - 1) - 0.5) * 40 + (rand() - 0.5) * j;
        p[i * 3 + 1] = (y / (side - 1) - 0.5) * 22 + (rand() - 0.5) * j;
        p[i * 3 + 2] = (z / (side - 1) - 0.5) * 26 + (rand() - 0.5) * j;
      }
    },
  },

  /** 多環公轉：產品組態器那種「可以轉」的感覺 */
  orbits: {
    bias: 9,
    accent: '#c084fc',
    motion: 'spin',
    fill: (p, n) => {
      const rand = makeRand(37);
      const rings = 5;
      for (let i = 0; i < n; i += 1) {
        const ring = i % rings;
        const a = rand() * TAU;
        const r = 10 + ring * 4.2;
        const tilt = (ring - (rings - 1) / 2) * 0.42;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = Math.sin(a) * r * Math.sin(tilt) + (rand() - 0.5) * 0.8;
        p[i * 3 + 2] = Math.sin(a) * r * Math.cos(tilt);
      }
    },
  },

  /** 分支：呼應經營藍圖的樹狀結構 */
  branches: {
    bias: 11,
    accent: '#7ee787',
    motion: 'drift',
    fill: (p, n) => {
      const rand = makeRand(53);
      for (let i = 0; i < n; i += 1) {
        const depth = Math.floor(rand() * 5);
        const spread = 3.5 + depth * 4.4;
        const a = rand() * TAU;
        const r = Math.sqrt(rand()) * spread;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = 13 - depth * 6.2 + (rand() - 0.5) * 1.6;
        p[i * 3 + 2] = Math.sin(a) * r * 0.7;
      }
    },
  },

  /**
   * 判決：整齊的網格，少數點被推離隊伍。
   * 收窄成一片而不是跨滿版 —— 跨滿版的話中段整片落在文字底下，
   * 剩下的兩側看起來只是雜訊，看不出那是一個陣列。
   */
  verdict: {
    accent: '#f0a35e',
    motion: 'pulse',
    bias: 13,
    fill: (p, n) => {
      const rand = makeRand(67);
      const side = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i += 1) {
        const x = (i % side) / (side - 1) - 0.5;
        const y = Math.floor(i / side) / (side - 1) - 0.5;
        /*
         * 離群量要推在螢幕平面上（x / y），不能只推 z：
         * 只推深度的話投影完幾乎還在原位，看起來仍是一塊實心方陣，
         * 「少數點脫離隊伍」這個意思根本沒畫出來。
         */
        const rogue = rand() < 0.05;
        const a = rand() * TAU;
        const out = rogue ? 4 + rand() * 7 : 0;
        p[i * 3] = x * 22 + Math.cos(a) * out;
        p[i * 3 + 1] = y * 21 + Math.sin(a) * out * 0.8;
        p[i * 3 + 2] = rogue ? (rand() - 0.5) * 12 : 0;
      }
    },
  },

  /** 散開：呼應「拿掉了一個資訊通道」 */
  scatter: {
    accent: '#e8635f',
    motion: 'drift',
    fill: (p, n) => {
      const rand = makeRand(79);
      for (let i = 0; i < n; i += 1) {
        const fall = Math.pow(rand(), 2);
        p[i * 3] = (rand() - 0.5) * 52;
        p[i * 3 + 1] = 14 - fall * 34 + (rand() - 0.5) * 3;
        p[i * 3 + 2] = (rand() - 0.5) * 34;
      }
    },
  },

  /** 同心圓環：覆蓋率 */
  rings: {
    bias: 10,
    accent: '#38bdf8',
    motion: 'spin',
    fill: (p, n) => {
      const rand = makeRand(89);
      const rings = 7;
      for (let i = 0; i < n; i += 1) {
        const ring = i % rings;
        const a = rand() * TAU;
        const r = 5 + ring * 3.4;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = (rand() - 0.5) * 1.4;
        p[i * 3 + 2] = Math.sin(a) * r;
      }
    },
  },

  /** 柱狀：預算、量表。收窄成右側的一張長條圖 */
  columns: {
    accent: '#facc15',
    motion: 'wave',
    bias: 13,
    fill: (p, n) => {
      const rand = makeRand(101);
      const bars = 18;
      for (let i = 0; i < n; i += 1) {
        const bar = i % bars;
        const t = (bar / (bars - 1) - 0.5) * 19;
        const height = 4 + ((Math.sin(bar * 1.7) + 1) / 2) * 18;
        p[i * 3] = t;
        p[i * 3 + 1] = -11 + rand() * height;
        p[i * 3 + 2] = (rand() - 0.5) * 8;
      }
    },
  },

  /**
   * 少數發亮：大量節點中有一小群不一樣。
   * 用在「85 張卡提到 3D」那一頁 —— 比例就是真的 85 / 2,331。
   */
  highlight: {
    accent: '#4fd1c5',
    motion: 'spin',
    bias: 11,
    highlightRatio: 85 / 2331,
    fill: (p, n) => {
      const rand = makeRand(113);
      for (let i = 0; i < n; i += 1) {
        const u = rand() * 2 - 1;
        const phi = rand() * TAU;
        const sr = Math.sqrt(1 - u * u);
        const r = 12 + Math.cbrt(rand()) * 12;
        p[i * 3] = Math.cos(phi) * sr * r;
        p[i * 3 + 1] = u * r * 0.75;
        p[i * 3 + 2] = Math.sin(phi) * sr * r;
      }
    },
  },

  /**
   * 兩團分離：兩個部門。
   * 斜向並列而不是左右並列 —— 左右並列的話左邊那團會落在遮罩底下，
   * 看起來就只剩一團，比喻直接消失。
   */
  split: {
    accent: '#f472b6',
    motion: 'drift',
    bias: 11,
    fill: (p, n) => {
      const rand = makeRand(127);
      const centres = [
        [-7, 6, 0],
        [7, -6, -2],
      ];
      for (let i = 0; i < n; i += 1) {
        const c = centres[i % 2];
        const u = rand() * 2 - 1;
        const phi = rand() * TAU;
        const sr = Math.sqrt(1 - u * u);
        const r = Math.cbrt(rand()) * 6;
        p[i * 3] = c[0] + Math.cos(phi) * sr * r;
        p[i * 3 + 1] = c[1] + u * r;
        p[i * 3 + 2] = c[2] + Math.sin(phi) * sr * r;
      }
    },
  },

  /**
   * 分岔：判準的兩條路。豎立的 Y，不是橫躺的 V。
   *
   * 橫躺的版本試過，不行：分岔點會落在畫面中央 —— 也就是遮罩最重的地方 ——
   * 只剩兩條臂尖從右緣露出來，看起來是一道隨機斜線而不是分岔。
   * 可用的空白只有右側那一條（表格寬到螢幕 80%），而那一條的高度是不受限的，
   * 所以有方向的形狀應該用垂直空間，不要用水平空間。
   */
  fork: {
    accent: '#a3e635',
    motion: 'drift',
    bias: 17,
    fill: (p, n) => {
      const rand = makeRand(139);
      /*
       * 只留 18% 給主幹。第一版是「t < 0.35 一律貼在中線」，
       * 三分之一的點疊在同一條線上，亮到把兩條分支整個洗掉。
       */
      const TRUNK = 0.18;
      for (let i = 0; i < n; i += 1) {
        const t = rand();
        const branch = i % 2 === 0 ? 1 : -1;
        if (t < TRUNK) {
          p[i * 3] = (rand() - 0.5) * 2.4;
          p[i * 3 + 1] = -15 + (t / TRUNK) * 10;
        } else {
          const a = (t - TRUNK) / (1 - TRUNK); // 0 → 1 沿著分支往上
          p[i * 3] = branch * Math.pow(a, 1.1) * 7 + (rand() - 0.5) * 1.6;
          p[i * 3 + 1] = -5 + a * 19;
        }
        p[i * 3 + 2] = (rand() - 0.5) * 6;
      }
    },
  },

  /** 多個小群：適合的場景清單 */
  clusters: {
    bias: 10,
    accent: '#5aa9e6',
    motion: 'pulse',
    fill: (p, n) => {
      const rand = makeRand(151);
      const groups = 5;
      const centres = Array.from({ length: groups }, (_, g) => [
        Math.cos((g / groups) * TAU) * 16,
        Math.sin((g / groups) * TAU) * 8,
        (rand() - 0.5) * 12,
      ]);
      for (let i = 0; i < n; i += 1) {
        const c = centres[i % groups];
        p[i * 3] = c[0] + (rand() - 0.5) * 7;
        p[i * 3 + 1] = c[1] + (rand() - 0.5) * 7;
        p[i * 3 + 2] = c[2] + (rand() - 0.5) * 7;
      }
    },
  },

  /** 三個核：帶走的三個問題 */
  three: {
    accent: '#4fd1c5',
    motion: 'pulse',
    bias: 13,
    fill: (p, n) => {
      const rand = makeRand(163);
      // 排成三角形而不是一橫排 —— 一橫排的話左邊兩顆會被遮罩吃掉
      const centres = [
        [-6, 8, 0],
        [7, 1, -4],
        [0, -9, 3],
      ];
      for (let i = 0; i < n; i += 1) {
        const c = centres[i % 3];
        const r = Math.pow(rand(), 2.2) * 9;
        const u = rand() * 2 - 1;
        const phi = rand() * TAU;
        const sr = Math.sqrt(1 - u * u);
        p[i * 3] = c[0] + Math.cos(phi) * sr * r;
        p[i * 3 + 1] = c[1] + u * r;
        p[i * 3 + 2] = c[2] + Math.sin(phi) * sr * r;
      }
    },
  },
};

export const DEFAULT_FORMATION = 'nebula';
