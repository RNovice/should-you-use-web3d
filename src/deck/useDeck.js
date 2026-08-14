import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { slides } from '../slides';

/**
 * 簡報殼的狀態。
 *
 * 注意：demo 參數（tier）刻意放在這裡而不是 demo 元件內部 ——
 * 這樣簡報頁上的控制項可以直接驅動共用 canvas 裡的場景，
 * 這是「簡報與 demo 同一個 React tree」才做得到的事。
 */
const clampIndex = (i) => Math.max(0, Math.min(slides.length - 1, i));

/**
 * 開站頁碼直接從 hash 算出來，而不是掛在 effect 裡。
 *
 * 用 effect 讀 hash 會和「換頁時寫回 hash」的 effect 打架 ——
 * StrictMode 下 effect 會跑兩次，第二次讀到的已經是被寫回的值，
 * 深連結因此永遠跳回第一頁。
 */
const indexFromHash = () => {
  const n = Number.parseInt(window.location.hash.replace('#/', ''), 10);
  return Number.isInteger(n) ? clampIndex(n - 1) : 0;
};

export const useDeck = create((set, get) => ({
  index: indexFromHash(),
  count: slides.length,

  go: (i) => set({ index: clampIndex(i), notesOpen: false }),
  next: () => get().go(get().index + 1),
  prev: () => get().go(get().index - 1),

  // Q19：每頁 100 字的展開層，現場摺疊、自讀時展開
  notesOpen: false,
  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),

  // D8 排練用的計時器
  presenterOn: false,
  togglePresenter: () => set((s) => ({ presenterOn: !s.presenterOn })),

  // 主力 demo 的節點數檔位，對應 data/tiers.js 的 TIERS
  tier: 'now',
  setTier: (tier) => set({ tier }),

  /**
   * 深度切片：depth <= focusDepth 的節點為焦點（實心），其餘為背景（半透明）。
   *
   * 這是 3D 遮擋問題的解 —— 節點多的時候最外層球殼會完全遮住內部結構，
   * 而那正是我們在「不適合」那頁警告的問題，自己也得解。
   * 預設值刻意不是「全部實心」：一進來就要看得見裡面。
   */
  focusDepth: 3,
  setFocusDepth: (focusDepth) => set({ focusDepth }),

  /** 佈局對照頁：0 = 2D 樹狀圖，1 = 3D 球面。中間值是變形過程。 */
  morph: 0,
  setMorph: (morph) => set({ morph }),
}));

export const useCurrentSlide = () => useDeck((s) => slides[s.index]);

/**
 * 渲染統計。
 *
 * 獨立於 useDeck，因為它每秒更新數次 —— 混在一起會讓整份簡報跟著重繪。
 * 由 canvas 內的 <StatsProbe /> 節流回報。
 */
export const useStats = create(() => ({
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  nodes: 0,
  maxDepth: 0,
  layoutMs: 0,
  iterations: 0,
  source: '',
  strategy: '',
  leafCount: 0,
  width2dPx: 0,
}));

export const reportStats = (patch) => useStats.setState(patch);

/**
 * 點選聚焦的結果。
 *
 * 同樣獨立於 useDeck —— 選取只影響 demo 頁的側欄，不該讓整份簡報重繪。
 * node 為 null 表示沒有選取。
 */
export const useSelection = create(() => ({ node: null, pickable: true }));

export const setSelection = (node) => useSelection.setState({ node });
export const setPickable = (pickable) => useSelection.setState({ pickable });

/**
 * 現場 GPU 壓力測試的狀態。
 *
 * 目的是取代「借一台低階機器實測」—— 簡報跑在誰的機器上就量誰的，
 * 現場在投影筆電上跑出來的數字，比任何公開統計都有說服力。
 */
export const useStress = create((set, get) => ({
  running: false,
  step: 0,
  fps: 0,
  count: 0,
  /** 量到的上限；null 表示還沒跑完 */
  ceiling: null,
  /** 跑到最高階都沒掉 fps —— 代表這台機器比我們的測試範圍還強 */
  maxedOut: false,

  start: () => set({ running: true, step: 0, ceiling: null, maxedOut: false }),
  reset: () => set({ running: false, step: 0, fps: 0, count: 0, ceiling: null, maxedOut: false }),
  nextStep: () => set({ step: get().step + 1 }),
  report: (fps, count) => set({ fps, count }),
  finish: (ceiling, maxedOut) => set({ running: false, ceiling, maxedOut }),
}));

/**
 * 語意地圖的互動狀態。
 *
 * 這一頁的設計刻意跟經營藍圖那頁不同：3D 只負責「找」，
 * 找到之後一律用可讀的文字清單呈現。所以 selected 是給側欄用的，
 * 不是給 3D 用的 —— 3D 只把它放大而已。
 */
export const useMapState = create((set) => ({
  hovered: null,
  selected: null,
  query: '',
  morph: 1, // 1 = 3D，0 = 2D
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setQuery: (query) => set({ query }),
  setMapMorph: (morph) => set({ morph }),
}));

/**
 * 手機版的互動狀態。
 *
 * 手機上設定卡片會把 demo 蓋掉大半 —— 收合開關讓使用者把版面讓給 3D。
 * 這份狀態要放在 store 而不是頁面裡，因為場景（SceneLayer 那棵樹）也要讀：
 * 收合時節點改成長按才選，而判斷「有沒有收合」的人在另一棵樹裡。
 */
export const useMobileUi = create((set, get) => ({
  /** 設定／說明卡片是否收起。只有手機能切換（開關本身是 compact 專屬） */
  panelsCollapsed: false,
  togglePanels: () => set({ panelsCollapsed: !get().panelsCollapsed }),
  /** 換頁時回到展開 —— 每一頁的說明都該先被看到 */
  resetPanels: () => set({ panelsCollapsed: false, mapZoom: 0 }),

  /** 語意地圖的 +／− 縮放，累加值，場景負責換算成相機距離 */
  mapZoom: 0,
  nudgeMapZoom: (d) => set({ mapZoom: get().mapZoom + d }),
}));

/** 收合狀態下，要按住這麼久才算選取（毫秒） */
export const LONG_PRESS_MS = 400;

/**
 * 使用者正在拖曳 3D 畫面嗎？（旋轉視角）
 *
 * 從面板上起手的不算，那由 usePressActive 各自處理 ——
 * 分開的原因是手機上「捲動頁面」也會產生 pointermove，
 * 全部算成拖曳的話卡片會在捲動時亂閃。
 */
export const useDragging = () => {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const from = { x: 0, y: 0, armed: false, moved: false };

    const down = (e) => {
      if (e.target?.closest?.('.pointer-events-auto')) return;
      from.x = e.clientX;
      from.y = e.clientY;
      from.armed = true;
      from.moved = false;
    };
    const move = (e) => {
      if (!from.armed || from.moved) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 6) {
        from.moved = true;
        setDragging(true);
      }
    };
    const up = () => {
      from.armed = false;
      if (from.moved) setDragging(false);
    };

    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return dragging;
};

/**
 * 這個控制項正在被按住嗎？
 *
 * 給 range slider 用的。第 9 頁的 2D↔3D 滑桿就是那頁唯一的互動，
 * 拉的時候最需要看到後面的變形 —— 卡片必須讓開。
 * （第一版把「從面板起手的拖曳」整個排除掉，等於把最該生效的情況擋掉了。）
 *
 * 放開時可能已經滑出元件外，所以收尾綁在 window 上而不是元件上。
 */
export const usePressActive = () => {
  const [active, setActive] = useState(false);

  const bind = {
    onPointerDown: () => {
      setActive(true);
      const end = () => {
        setActive(false);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
  };

  return [active, bind];
};
