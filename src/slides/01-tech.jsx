import { Kicker, Title, Lead, Table, Callout } from '../deck/ui';

/**
 * 技術原理。
 *
 * 聽眾混了開發、UIUX、PM、主管，所以只講兩件事：
 * 「它是什麼」與「它為什麼畫得動」。其餘細節留給展開層。
 */

const WhatIsIt = () => (
  <>
    <Kicker>技術原理</Kicker>
    <Title>瀏覽器直接指揮顯示卡</Title>
    <Lead>
      不是外掛、不是影片、不是把 3D 算好變成圖片再送過來。
      是網頁裡的一段程式，直接把幾何與材質交給 GPU 畫。
    </Lead>
    <Table
      head={['層', '是什麼', '誰在用它']}
      rows={[
        ['WebGL2 / WebGPU', '瀏覽器提供的硬體 API', '幾乎沒有人直接寫'],
        ['Three.js', '把 API 包成「場景、相機、光源」', '絕大多數專案'],
        ['React Three Fiber', '把 Three.js 變成 React 元件', 'React 專案'],
      ]}
    />
    <Callout>
      本次研究用的是 <strong>WebGL2 + Three.js + React Three Fiber</strong>，
      跟我們產線的 React 19 相容。這份簡報本身就是用這一套做的。
    </Callout>
  </>
);

const WhyFast = () => (
  <>
    <Kicker>技術原理</Kicker>
    <Title>三種畫法，三種天花板</Title>
    <Table
      head={['方式', '成本結構', '天花板在哪', '兩萬', '一百萬']}
      rows={[
        [
          'DOM element',
          '每個節點一個元素，逐個算版面、繪製、合成',
          '元素數量',
          '0.3 fps',
          '建不出來',
        ],
        [
          'Canvas 2D（像素畫布）',
          '每個節點一次繪圖指令，CPU 逐個發',
          '每幀的指令數',
          '60 fps',
          '2.1 fps',
        ],
        [
          'WebGL Instanced',
          '一份幾何 + 一批位置，一次 draw call',
          '三角形／填充率',
          '60 fps',
          '14 fps',
        ],
      ]}
    />
    <Lead>
      Canvas 2D 沒有三角形也沒有深度，它是純像素畫布 ——
      所以「三角形預算」對它不適用，它卡在「一百萬次 fillRect」的 CPU 成本上（381 ms／幀）。
    </Lead>
    <Callout tone="warn">
      關鍵不是「電腦變快」，是「一次送多少東西給顯示卡」。
      但天花板沒有消失，只是換了位置。
    </Callout>
  </>
);

export const techSlides = [
  {
    id: 'tech-what',
    section: '原理',
    scene: 'ambient',
    ambient: 'layers',
    sec: 30,
    live: true,
    title: 'Web 3D 是什麼',
    Body: WhatIsIt,
    notes:
      'Web 3D 指的是在瀏覽器裡直接呼叫 GPU 進行即時渲染，而不是把 3D 內容預先算成圖片或影片再傳送。技術堆疊分三層：最底層是瀏覽器提供的硬體 API（WebGL2 與較新的 WebGPU），中間是 Three.js 這類封裝函式庫，把底層 API 包裝成場景、相機、光源這些直覺概念，最上層是 React Three Fiber，把 Three.js 的物件對應成 React 元件，讓 3D 內容可以用寫 UI 的方式維護。實務上幾乎沒有人直接寫 WebGL。本次研究採用 WebGL2 + Three.js + R3F，與產線的 React 19 相容；這份簡報本身就是這一套做的，所以「能不能在我們的技術棧上跑」這個問題已經被它自己回答了。',
  },
  {
    id: 'tech-why',
    section: '原理',
    scene: 'ambient',
    ambient: 'lattice',
    sec: 35,
    live: true,
    title: '三種畫法三種天花板',
    Body: WhyFast,
    notes:
      '三種畫法的成本結構完全不同，所以天花板也不在同一個地方。DOM 的每個節點是一個獨立元素，瀏覽器必須逐個計算版面、繪製、合成，天花板是元素數量本身；兩萬個節點時每幀 2,979 ms，一百萬個節點連建立元素都會鎖住瀏覽器，我們的量測直接標成「無法量測」。Canvas 2D 是純像素畫布，沒有三角形、沒有深度緩衝、也沒有透視，所以「三角形預算」這個概念對它不適用；它的成本是每個節點一次繪圖指令，由 CPU 逐個發出，一百萬次 fillRect 就是每幀 466 ms，其中 381 ms 是 JavaScript。WebGL 的 InstancedMesh 共用一份幾何與材質，只送一批位置，draw call 數量與物件數量無關，天花板落在三角形數與填充率。需要誠實補充一個區別：這一頁一百萬節點的 14 fps 是「每幀重算所有位置」的動態場景，瓶頸在 CPU 寫入一百萬個矩陣；後面主力 demo 的一百萬節點能維持 60 fps，是因為位置只算一次、之後只轉相機，而且改用 point sprite。同一個技術，動態與靜態差了四倍。最後，兩萬節點時 Canvas 2D 與 WebGL 表現相同——這代表「畫不動」不需要動到 3D 就能解決，結論會再回來談。',
  },
];
