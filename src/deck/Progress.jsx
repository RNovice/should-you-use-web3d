import { useEffect, useState } from 'react';
import { useDeck } from './useDeck';
import { slides, cumulativeBudgetSec, TALK_BUDGET_SEC } from '../slides';

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * 底部狀態列 + 排練計時器（D8 用）。
 *
 * 計時器顯示的是「相對於配速的超前／落後」，不是單純的經過時間 ——
 * 排練時真正需要知道的是「講到這一頁該花掉多少時間」。
 */
export const Progress = () => {
  const { index, count, go, next, prev, presenterOn, togglePresenter } = useDeck();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!presenterOn) {
      setElapsed(0);
      return;
    }
    const started = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - started) / 1000), 500);
    return () => clearInterval(id);
  }, [presenterOn]);

  const slide = slides[index];
  const target = cumulativeBudgetSec[index];
  const drift = elapsed - target;
  const driftTone =
    !presenterOn ? 'text-fg-faint' : drift > 30 ? 'text-bad' : drift > 10 ? 'text-warn' : 'text-accent';

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 h-12 border-t border-ink-800 bg-ink-950/85 backdrop-blur">
      {/* 進度條 */}
      <div className="absolute inset-x-0 top-0 h-px bg-ink-800">
        <div
          className="h-px bg-accent-dim transition-[width] duration-300"
          style={{ width: `${((index + 1) / count) * 100}%` }}
        />
      </div>

      <div className="flex h-full items-center justify-between px-6 text-xs compact:px-2">
        <div className="flex items-center gap-4 compact:gap-2">
          {/*
            手機的上一頁／下一頁。
            滑動翻頁已經移除（會跟表格的橫向捲動打架），
            所以這兩顆是手機上唯一的翻頁方式 —— 觸控目標要夠大。
          */}
          <div className="hidden items-center gap-1 compact:flex">
            <button
              onClick={prev}
              aria-label="上一頁"
              className="flex h-11 w-11 items-center justify-center rounded border border-ink-600 text-base text-fg-muted active:border-accent-dim active:text-fg"
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="下一頁"
              className="flex h-11 w-11 items-center justify-center rounded border border-ink-600 text-base text-fg-muted active:border-accent-dim active:text-fg"
            >
              ›
            </button>
          </div>
          <span className="tabular text-fg-muted">
            {String(index + 1).padStart(2, '0')} / {count}
          </span>
          <span className="text-fg-faint compact:hidden">{slide.section}</span>
          <span className="text-fg-muted compact:hidden">{slide.title}</span>
        </div>

        {/* 頁碼點：現場動線一眼可見，也可直接點跳 */}
        <div className="hidden items-center gap-1 md:flex">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(i)}
              title={`${i + 1}. ${s.title}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? 'w-6 bg-accent'
                  : s.interactive
                    ? 'w-1.5 bg-ink-600 hover:bg-fg-faint'
                    : 'w-1.5 bg-ink-700 hover:bg-fg-faint'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span className="tabular text-fg-faint compact:hidden">
            配速 {mmss(target)} / {mmss(TALK_BUDGET_SEC)}
          </span>
          <button
            onClick={togglePresenter}
            className={`tabular rounded border px-2 py-1 transition compact:hidden ${
              presenterOn
                ? 'border-accent-dim text-accent'
                : 'border-ink-600 text-fg-faint hover:text-fg-muted'
            }`}
            title="排練計時（T）"
          >
            {presenterOn ? `${mmss(elapsed)} ` : '排練計時'}
            {presenterOn && (
              <span className={driftTone}>
                {drift >= 0 ? '+' : '−'}
                {mmss(Math.abs(drift))}
              </span>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
};
