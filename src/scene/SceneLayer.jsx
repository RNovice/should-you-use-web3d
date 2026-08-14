import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useCurrentSlide } from '../deck/useDeck';
import { SCENES } from './scenes';
import { StatsProbe } from './StatsProbe';

/**
 * 全場唯一的 WebGL context。
 *
 * 固定鋪滿整個視窗、疊在簡報 DOM 底下。切換投影片時只換 canvas 裡的
 * children，renderer 與 context 全程存活 —— 避免 iframe 方案的黑畫面、
 * 記憶體累積與 Safari context 上限問題。
 *
 * dpr 上限壓在 2：企業客戶的高解析筆電若用原生 DPR 會直接吃掉一半效能，
 * 而這是我們要量測的東西，不能被自己的設定汙染。
 */
export const SceneLayer = () => {
  const slide = useCurrentSlide();
  const scene = SCENES[slide.scene ?? 'none'];

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 6, 34], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        /*
         * 沒有場景的頁面完全停掉 render loop。
         *
         * 這不只是省電：效能對照台那一頁是在 DOM 裡自己跑量測的，
         * 主 canvas 若還在每幀空轉，就會跟被量測的對象搶同一個主執行緒，
         * 量到的數字全部失真。
         */
        frameloop={scene ? 'always' : 'never'}
      >
        {/* fog 由各場景自己宣告 —— 距離尺度差太多，共用一組參數會有場景整片糊掉 */}
        <StatsProbe />
        <Suspense fallback={null}>{scene ? scene(slide) : null}</Suspense>
      </Canvas>

      {/*
        文字區的遮罩。
        背景隊形換來換去，密度不可能每一種都剛好不壓到字 ——
        與其逐個隊形調參數，不如加一層保證對比的漸層。

        內容是左對齊、最寬到螢幕 80%，所以遮罩重心壓在左側，
        並且在 68% 就完全放開 —— 右側那一條是留給隊形的，
        壓到那裡的話有方向的形狀（Y 字、兩團、長條圖）就只剩邊緣露出來，
        看起來像雜訊而不是刻意的圖形。

        只有裝飾頁鋪這一層。互動頁的 3D 就是內容本身（藍圖、語意地圖、
        現場加壓的粒子球），蓋上去會把左半邊吃掉 —— 粒子球會變成偏一邊的半顆。
      */}
      {slide.scene === 'ambient' && (
        <div className="text-scrim pointer-events-none absolute inset-0" />
      )}
    </div>
  );
};
