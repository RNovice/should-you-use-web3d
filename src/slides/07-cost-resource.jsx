import { Kicker, Title, Lead, Table, Callout } from '../deck/ui';

/** Q13 的決定：資源章只講「效能預算」與「設計系統整合」兩項。 */

const ResourcePerf = () => (
  <>
    <Kicker>需要投入的資源 · 一</Kicker>
    <Title>效能預算</Title>
    <Table
      head={['項目', '實測', '備註']}
      rows={[
        ['額外 bundle', '907 kB / gzip 242 kB', 'three + R3F + Drei'],
        ['佈局計算', '一百萬節點 108 ms', '單執行緒，不需要 Web Worker'],
        ['渲染上限', '靜態 100 萬 60fps／動態 100 萬 14fps', '每幀重算位置就掉到 14 fps'],
        ['Draw calls', '2–4 個', '與節點數無關'],
        ['GPU 需求', 'WebGL2 內顯即可', '不要求獨立顯卡'],
        ['這台機器的上限', '上一頁現場量', '不必借機器，簡報跑在哪台就量哪台'],
      ]}
    />
    <Callout>
      沒有 3D 美術成本。資料視覺化只需要幾何體與材質 ——
      不需要 3D 模型、不需要 Blender、不需要招 3D 設計師。
    </Callout>
    <Lead>
      242 kB 不該進首屏。用 dynamic import 綁在 3D 頁面上，沒開 3D 的使用者不必付這個代價。
    </Lead>
  </>
);

export const resourceSlides = [
  {
    id: 'resource-perf',
    section: '成本',
    scene: 'ambient',
    ambient: 'columns',
    sec: 20,
    live: true,
    title: '效能預算',
    Body: ResourcePerf,
    notes:
      '這一頁最重要的訊息是「沒有 3D 美術成本」。資料視覺化用的是程序化生成的幾何體，與遊戲或廣告素材的 3D 建模需求完全不同，因此不需要外包建模、不需要採購模型、不需要新增設計人力。這把導入門檻從「要招人」降到「現有前端可上手」。表格數字全部來自本次實測（M 系列 Mac、Chromium），但最後一列刻意留白 —— 低階內顯機器還沒實測，被問到就要照實說還沒測，不能拿高階機器的數字去背書。bundle 的 242 kB 是 gzip 後的量，必須用 dynamic import 綁在 3D 頁面上，否則會拖慢所有沒用到 3D 的頁面。',
  },
];
