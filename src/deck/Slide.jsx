import { useCurrentSlide } from './useDeck';

/**
 * 單頁容器。
 *
 * 互動頁的整個 DOM 層讓出 pointer events，滑鼠事件才能穿透到底下的
 * canvas（旋轉、縮放）；只有控制面板（ui.jsx 的 ControlPanel）把事件收回來。
 *
 * 手機上改成「從頂端開始 + 可垂直捲動」。
 * 桌機是 justify-center 把內容垂直居中，投影時最好看；但手機的內容高度
 * 是視窗的 1.3~1.7 倍（實測表格頁 1466 / 852），居中會把頭尾各切掉一半 ——
 * 標題直接消失。捲動比縮到看不見好。
 *
 * 但短頁面（封面只有標題）靠頂會空一大片。解法是內層用 my-auto 而不是
 * 外層用 justify-center：margin auto 在有餘裕時把內容推到中間，
 * 空間不夠時退化成靠頂，不會像 justify-center 那樣把上緣切掉。
 * 一條規則同時解決「太空曠」和「被切頭」。
 *
 * shrink-0 是必要的：main 是 flex 容器，內層是 flex item，預設會被壓縮。
 * 矮螢幕上 705px 的內容會被壓成 547px（容器的內容高），
 * 真正的內容溢出到視窗外，而 main 以為自己沒東西可捲 —— 就是被切掉又捲不動。
 * 底部留白也要讓開固定頁尾（48px）與浮動按鈕（到約 90px）。
 */
export const Slide = () => {
  const slide = useCurrentSlide();
  const { Body, interactive } = slide;

  return (
    <main
      key={slide.id}
      className={`relative z-10 flex h-full flex-col justify-center px-16 py-24 xl:px-24 compact:justify-start compact:overflow-y-auto compact:px-5 compact:pt-6 compact:pb-24 ${
        interactive ? 'pointer-events-none' : ''
      }`}
    >
      <div className={interactive
          ? 'h-full compact:h-auto compact:min-h-0 compact:shrink-0'
          : 'compact:my-auto compact:shrink-0'}>
        <Body />
      </div>
    </main>
  );
};
