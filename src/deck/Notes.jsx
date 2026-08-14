import { useCurrentSlide, useDeck } from './useDeck';

/**
 * Q19 的展開層：現場摺疊、自讀時展開。
 *
 * 只有「有爭議或有數據」的頁面會有 notes —— 純視覺頁面本來就自明，
 * 硬加補充只是稀釋。沒有 notes 的頁面不顯示這個抽屜。
 */
export const Notes = () => {
  const slide = useCurrentSlide();
  const open = useDeck((s) => s.notesOpen);
  const toggle = useDeck((s) => s.toggleNotes);

  if (!slide.notes) return null;

  return (
    <>
      <button
        onClick={toggle}
        className="fixed right-6 bottom-16 z-30 rounded-full border border-ink-600 bg-ink-900/90 px-4 py-2 text-xs text-fg-muted backdrop-blur transition hover:border-accent-dim hover:text-fg compact:right-3 compact:bottom-14 compact:px-3 compact:py-2"
      >
        {open ? '收起說明' : '完整說明'}
        <kbd className="ml-2 font-mono text-fg-faint compact:hidden">N</kbd>
      </button>

      {open && (
        <aside className="fixed inset-x-0 bottom-12 z-20 border-t border-ink-700 bg-ink-900/95 backdrop-blur">
          <div className="scroll-thin max-h-[42vh] overflow-y-auto px-16 py-8 xl:px-24 compact:max-h-[58vh] compact:px-4 compact:py-4">
            <div className="mb-3 text-xs font-medium tracking-widest text-fg-faint uppercase">
              完整說明
            </div>
            <p className="max-w-4xl text-lg leading-relaxed text-fg-muted compact:text-sm">
              {slide.notes}
            </p>
          </div>
        </aside>
      )}
    </>
  );
};
