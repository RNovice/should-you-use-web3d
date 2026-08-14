import { AmbientScene } from './AmbientScene';
import { BlueprintScene } from './BlueprintScene';
import { LayoutCompareScene } from './LayoutCompareScene';
import { AgentScene } from './AgentScene';
import { SemanticMapScene } from './SemanticMapScene';
import { StressScene } from './StressScene';

/**
 * 場景註冊表。
 *
 * 投影片的 `scene` 欄位對到這裡的 key。所有場景共用同一個 WebGL context
 * （見 SceneLayer）—— 切頁只是換 children，不重建 renderer。
 * 這是不用 iframe 的理由：現場翻頁翻到一半 demo 黑掉是這種報告最經典的死法。
 */
export const SCENES = {
  none: null,

  /* 吃 slide 才能把每頁指定的隊形傳下去；同一個元件型別會保留實例，變形才做得到 */
  ambient: (slide) => <AmbientScene formation={slide?.ambient} />,

  agent: () => <AgentScene />,

  blueprint: () => <BlueprintScene />,

  layoutCompare: () => <LayoutCompareScene />,

  semanticMap: () => <SemanticMapScene />,

  stress: () => <StressScene />,
};
