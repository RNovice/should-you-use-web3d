import { useCallback, useRef } from 'react';
import { LONG_PRESS_MS, useMobileUi } from '../deck/useDeck';
import { isCoarsePointer } from '../lib/renderBench';

/** 指標型態不會在執行期改變，算一次就好 */
const COARSE = isCoarsePointer();

/**
 * 手機收合狀態下的「長按才選取」。
 *
 * 為什麼需要：收合是為了看 3D，而看 3D 就要拖曳旋轉。
 * 手指在觸控螢幕上的一次輕點與一次小幅拖曳幾乎沒有差別，
 * 所以「點一下就選取」會在每次想轉動視角時誤選節點，選取卡片一直跳出來。
 * 改成按住 400ms 才算，轉動與選取就分得開。
 *
 * 只有「粗指標 + 已收合」時才啟用：
 * 桌機滑鼠點得準，展開狀態下卡片本來就在畫面上，都不需要這層保護。
 */
export const useLongPressPick = () => {
  const collapsed = useMobileUi((s) => s.panelsCollapsed);
  const requireHold = COARSE && collapsed;
  const downAt = useRef(0);

  const onPointerDown = useCallback(() => {
    downAt.current = performance.now();
  }, []);

  /** 這次放開算不算數 */
  const accepts = useCallback(
    () => !requireHold || performance.now() - downAt.current >= LONG_PRESS_MS,
    [requireHold],
  );

  return { onPointerDown, accepts, requireHold };
};
