import { coverSlides } from './00-cover';
import { techSlides } from './01-tech';
import { agentSlides, demoSlides } from './04-demos';
import { commonSlides } from './02-common';
import { motivationSlides } from './03-motivation';
import { semanticSlides } from './05-semantic';
import { verdictSlides } from './06-verdict';
import { compatSlides } from './07-cost-compat';
import { resourceSlides } from './07-cost-resource';
import { companySlides } from './08-company';
import { whenSlides } from './09-when';

/**
 * 現場動線。順序即敘事：
 *
 *   原理 → 業界普遍用在哪 → 我們試了什麼 → 結論不引入 → 成本
 *   → 但需求在媒體側 → 什麼時候該引入 → 帶走三個問題
 *
 * 這是研究報告不是提案，所以結論在封面就講完，中間全部是證據，
 * 收尾不要任何資源，只留判斷力。
 *
 * 每頁的 `sec` 是現場口頭預算，總和應為 600 秒（10 分鐘）。
 * `scene` 對應共用 canvas 要渲染的場景；`interactive` 的頁面會把
 * pointer events 讓給 canvas，只有控制面板吃事件。
 */
export const slides = [
  ...coverSlides,
  // 原理：它是什麼、為什麼畫得動，最後用粒子場景展示能力
  ...techSlides,
  ...agentSlides,
  ...commonSlides,
  // PoC：為什麼挑這題 → 三個互動 demo → 語意地圖
  ...motivationSlides,
  ...demoSlides,
  ...semanticSlides,
  // 結論與代價
  ...verdictSlides,
  ...compatSlides,
  ...resourceSlides,
  // 轉折：需求存在，只是不在這個部門
  ...companySlides,
  // 帶走什麼
  ...whenSlides,
];

export const TALK_BUDGET_SEC = 600;

export const totalBudgetSec = slides.reduce((sum, s) => sum + (s.sec ?? 0), 0);

/** 累積到第 i 頁（含）的時間預算，用於排練時判斷超前或落後 */
export const cumulativeBudgetSec = slides.map((_, i) =>
  slides.slice(0, i + 1).reduce((sum, s) => sum + (s.sec ?? 0), 0),
);
