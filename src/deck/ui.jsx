import { createPortal } from 'react-dom';

/**
 * 簡報頁面的排版原件。
 *
 * 刻意保持稀疏：現場投影時每頁只承載一個論點，
 * 完整論述放進 Notes 展開層（見 Q3 / Q19 的決定）。
 *
 * 手機支援集中在這個檔案：Table 有 10 處使用、ControlPanel 有 16 處，
 * 但它們都是共用元件，所以那 26 處只需要在這裡改一次。
 * 所有手機規則都用 compact / phone / short 變體 —— 那是 max-width 與
 * max-height 的 media query，在投影機尺寸上不可能命中，
 * 所以現場那條路是「規則沒有機會套用」而不是「我很小心」。
 */

export const Kicker = ({ children }) => (
  <div className="mb-4 text-sm font-medium tracking-[0.2em] text-accent uppercase compact:mb-2 compact:text-xs compact:tracking-[0.15em]">
    {children}
  </div>
);

export const Title = ({ children }) => (
  <h1 className="max-w-5xl text-5xl leading-[1.15] font-semibold text-balance text-fg xl:text-6xl compact:text-2xl compact:leading-tight phone:text-[1.6rem]">
    {children}
  </h1>
);

export const Lead = ({ children }) => (
  <p className="mt-6 max-w-3xl text-xl leading-relaxed text-fg-muted compact:mt-3 compact:text-sm compact:leading-relaxed">
    {children}
  </p>
);

export const Bullets = ({ items }) => (
  <ul className="mt-8 space-y-3 compact:mt-4 compact:space-y-2">
    {items.map((it, i) => (
      <li key={i} className="flex gap-3 text-lg text-fg-muted compact:gap-2 compact:text-sm">
        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-dim compact:mt-1.5" />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

/** 引用你們自己的原始碼 —— 這是全場最有力的證據，值得一個專屬樣式 */
export const CodeEvidence = ({ path, children }) => (
  <figure className="mt-8 max-w-3xl overflow-hidden rounded-lg border border-ink-700 bg-ink-900/80 compact:mt-4">
    <figcaption className="border-b border-ink-700 px-4 py-2 font-mono text-xs text-fg-faint compact:px-3 compact:py-1.5 compact:text-[10px]">
      {path}
    </figcaption>
    <pre className="scroll-thin overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed text-fg compact:px-3 compact:py-3 compact:text-[11px]">
      {children}
    </pre>
  </figure>
);

export const Callout = ({ tone = 'accent', children }) => {
  const tones = {
    accent: 'border-accent-dim/60 bg-accent-dim/10 text-fg',
    warn: 'border-warn/50 bg-warn/10 text-fg',
    bad: 'border-bad/50 bg-bad/10 text-fg',
  };
  return (
    <div
      className={`mt-8 max-w-3xl rounded-lg border px-5 py-4 text-lg compact:mt-4 compact:px-3 compact:py-3 compact:text-sm ${tones[tone]}`}
    >
      {children}
    </div>
  );
};

export const StatRow = ({ items }) => (
  <div className="mt-10 flex flex-wrap gap-10 compact:mt-5 compact:gap-x-6 compact:gap-y-3">
    {items.map((it, i) => (
      <div key={i}>
        <div className="tabular text-4xl font-semibold text-fg compact:text-2xl">{it.value}</div>
        <div className="mt-1 text-sm text-fg-faint compact:text-xs">{it.label}</div>
      </div>
    ))}
  </div>
);

/**
 * 互動頁的控制面板：DOM 疊在 canvas 上，只有這裡吃 pointer events。
 *
 * 手機上放掉固定寬度改成滿寬 —— 桌機的 w-72 / w-80 在 393px 的螢幕上
 * 會讓多欄按鈕互相疊住（實測效能對照台的節點數按鈕就是這樣壞的）。
 */
export const ControlPanel = ({ title, children, className = 'w-72' }) => (
  <div
    className={`pointer-events-auto rounded-lg border border-ink-700 bg-ink-900/90 p-4 backdrop-blur compact:w-full compact:p-3 ${className}`}
  >
    {title && (
      <div className="mb-3 text-xs font-medium tracking-widest text-fg-faint uppercase compact:mb-2">
        {title}
      </div>
    )}
    {children}
  </div>
);

/**
 * 表格。
 *
 * 手機上讓它橫向捲動，而不是壓縮欄寬。
 * 沒有 min-w 的話 w-full 會把五欄硬塞進 393px，每個字一行 ——
 * 實測「三種畫法三種天花板」那頁會變成 1466px 高的一條字串，完全不能讀。
 * 捲動至少保住每一列的可讀性，而且欄位對齊還在。
 */
export const Table = ({ head, rows }) => (
  <div className="relative mt-8 max-w-4xl compact:mt-4">
    {/* 柔邊暗底。絕對定位，所以完全不影響表格排版 —— 文字一個像素都不會移 */}
    <div aria-hidden className="table-scrim pointer-events-none absolute -inset-x-8 -inset-y-6" />

    <div className="scroll-thin relative overflow-x-auto compact:-mx-1 compact:px-1">
      <table className="w-full border-collapse text-left text-base compact:min-w-[560px] compact:text-xs">
        <thead>
          <tr className="border-b border-ink-600">
            {head.map((h, i) => (
              <th
                key={i}
                className="py-2 pr-6 text-sm font-medium text-fg-faint compact:pr-3 compact:text-[11px]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-800">
              {r.map((c, j) => (
                <td key={j} className="py-3 pr-6 align-top text-fg-muted compact:py-2 compact:pr-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** 尚未實作的區塊 —— 明確標記，避免排練時誤以為做完了（Fail loud） */
export const Todo = ({ day, children }) => (
  <div className="mt-8 max-w-3xl rounded-lg border border-dashed border-ink-600 px-5 py-4 text-fg-faint compact:mt-4 compact:px-3 compact:py-3 compact:text-sm">
    <span className="mr-2 rounded bg-ink-700 px-2 py-0.5 font-mono text-xs text-fg-muted">
      {day}
    </span>
    {children}
  </div>
);

/**
 * 互動頁底部的面板列。
 *
 * 桌機：左邊操作、右邊結果，一橫排。
 * 手機：直排，而且可以整列收起 —— 不收的話卡片會蓋掉大半個 demo，
 *       而這幾頁的重點就是那個 demo。
 *
 * dim 是「讓出視線」用的：拖曳中或加壓中把卡片調淡，但不擋操作
 * （opacity 不影響 pointer events，停止鈕照樣按得到）。
 * 只在手機生效 —— 桌機投影時畫面夠大，不需要退讓。
 *
 * 注意 dim 必須對應到字面量 class：Tailwind 是掃原始碼的，
 * `compact:opacity-${n}` 這種拼接掃不到，產出的 CSS 裡不會有那條規則。
 */
export const PanelRow = ({ collapsed = false, dim = null, className = '', children }) => {
  const dimClass =
    dim === 'half' ? 'compact:opacity-50' : dim === 'quarter' ? 'compact:opacity-30' : '';
  return (
    <div
      className={`flex items-end justify-between gap-4 transition-opacity duration-200 compact:flex-col compact:items-stretch compact:gap-2 ${
        collapsed ? 'compact:hidden' : ''
      } ${dimClass} ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * 手機專屬的浮動控制列（收合開關、縮放…）。桌機完全不出現。
 *
 * 一定要 portal 到 body，不能留在投影片裡。
 * 原因是換頁動畫：`main > div > *` 掛的 slide-rise 用 animation-fill-mode: both，
 * 而 both 會讓動畫永久保持在生效狀態 —— 一個帶有作用中 transform 動畫的元素
 * 會成為 position: fixed 子孫的「包含塊」。
 * 於是這顆按鈕會變成相對於投影片根元素定位：跟著 main 一起捲動，
 * 換頁時還會跟著位移。實測就是這個症狀。
 */
export const MobileDock = ({ children }) =>
  createPortal(
    <div className="pointer-events-auto fixed bottom-14 left-3 z-30 hidden items-center gap-2 compact:flex">
      {children}
    </div>,
    document.body,
  );

export const DockButton = ({ children, ...props }) => (
  <button
    {...props}
    className="min-w-11 rounded-full border border-ink-600 bg-ink-900/90 px-3 py-2 text-xs text-fg-muted backdrop-blur active:border-accent-dim active:text-fg"
  >
    {children}
  </button>
);

/**
 * 收合狀態下浮出來的那張卡。
 *
 * 收合是為了看 demo，但長按選到節點之後還是要能讀內容 ——
 * 所以節點卡片不跟著收，改成浮在底部。
 */
export const FloatingCard = ({ children }) =>
  createPortal(
    <div className="pointer-events-auto fixed inset-x-3 bottom-26 z-20 hidden compact:block">
      {children}
    </div>,
    document.body,
  );
