import { useEffect } from 'react';
import { SceneLayer } from '../scene/SceneLayer';
import { Slide } from './Slide';
import { Progress } from './Progress';
import { Notes } from './Notes';
import { useDeck, useMobileUi } from './useDeck';

/**
 * 簡報殼：鍵盤導航 + URL hash 同步 + 底部狀態列。
 *
 * hash 同步的用途是「把某一頁的連結貼給人」，
 * 這對會後自讀的版本很重要（Q21 的分層）。
 */
export const DeckRoot = () => {
  const { index, go, next, prev, count, toggleNotes, togglePresenter } = useDeck();

  // 換頁時把手機的收合狀態歸零 —— 每一頁的說明都該先被看到一次
  const resetPanels = useMobileUi((s) => s.resetPanels);
  useEffect(() => {
    resetPanels();
  }, [index, resetPanels]);

  // 換頁時寫回 hash（用 replace，不要塞爆上一頁按鈕）
  // 開站頁碼在 store 初始化時就從 hash 算好了，這裡只負責寫。
  useEffect(() => {
    window.history.replaceState(null, '', `#/${index + 1}`);
  }, [index]);

  // 手動改 hash 也要能跳頁（replaceState 不會觸發 hashchange，不會自己打自己）
  useEffect(() => {
    const onHash = () => {
      const n = Number.parseInt(window.location.hash.replace('#/', ''), 10);
      if (Number.isInteger(n)) go(n - 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [go]);

  useEffect(() => {
    const onKey = (e) => {
      // 讓輸入框內的按鍵正常運作（之後可能會有參數輸入）
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(count - 1);
          break;
        case 'n':
        case 'N':
          toggleNotes();
          break;
        case 't':
        case 'T':
          togglePresenter();
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go, count, toggleNotes, togglePresenter]);

  /*
   * 這裡曾經有滑動翻頁，已經移除。
   *
   * 原因是它跟橫向捲動打架：手機上表格是靠橫捲讀的（欄寬壓縮會變成
   * 每個字一行），而橫捲跟「左右滑動翻頁」是同一個手勢 ——
   * 想看表格右邊幾欄，結果跳到下一頁。
   * 手機翻頁一律走頁尾的 ‹ › 兩顆按鈕，那個不會誤觸。
   */

  return (
    <div className="relative h-full w-full">
      <SceneLayer />
      <Slide />
      <Notes />
      <Progress />
    </div>
  );
};
