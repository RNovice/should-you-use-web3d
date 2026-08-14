import { useEffect, useRef, useState } from 'react';
import {
  Kicker,
  Title,
  Lead,
  ControlPanel,
  PanelRow,
  MobileDock,
  DockButton,
  FloatingCard,
} from '../deck/ui';
import {
  useDeck,
  useStats,
  useSelection,
  useMobileUi,
  useDragging,
  usePressActive,
} from '../deck/useDeck';
import { TIERS } from '../data/tiers';
import {
  MODES,
  runMode,
  DOM_LIMIT,
  DOM_OFFLINE,
  RECORDED,
  RECORDED_ON,
  isCoarsePointer,
} from '../lib/renderBench';

/**
 * 選取節點的側欄。
 *
 * 重點是 ancestors 那一段 —— 「這個任務往上屬於哪個經營目標」。
 * 在 2D 樹狀圖裡要回答這個問題得一路往上捲，這裡點一下就有。
 */
const SelectionPanel = () => {
  const { node, pickable } = useSelection();

  if (!pickable) {
    return (
      <ControlPanel title="點選聚焦">
        <p className="text-xs leading-relaxed text-fg-faint">
          這個檔位用 point sprite 渲染，沒有可命中的幾何體，因此不支援點選。
          切回十萬以下的檔位即可使用。
        </p>
      </ControlPanel>
    );
  }

  if (!node) {
    return (
      <ControlPanel title="點選聚焦">
        <p className="text-xs leading-relaxed text-fg-faint">
          點任何一個節點：鏡頭會飛過去，並把它往上到經營目標的整條路徑點亮。
          {/* 收合後改成長按，說明也要跟著改，不然使用者會以為壞了 */}
          {isCoarsePointer() && '　收起設定後改成長按 —— 輕點留給轉動視角。'}
        </p>
      </ControlPanel>
    );
  }

  return (
    <ControlPanel title="點選聚焦">
      <div className="mb-3">
        <div className="text-[10px] tracking-widest text-accent uppercase">{node.kind}</div>
        {/* 真實藍圖裡有好幾百字的標籤，不夾住會把側欄撐出畫面 */}
        <div className="mt-1 line-clamp-4 text-sm leading-snug text-fg" title={node.label}>
          {node.label}
        </div>
        <div className="tabular mt-2 text-xs text-fg-faint">
          第 {node.depth} 層 · 底下 {node.subtreeSize.toLocaleString()} 個節點
        </div>
      </div>

      {node.ancestors.length > 0 && (
        <div className="border-t border-ink-700 pt-3">
          <div className="mb-2 text-[10px] tracking-widest text-fg-faint uppercase">
            往上歸屬
          </div>
          <ol className="space-y-1.5">
            {node.ancestors.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 text-fg-faint">{a.kind}</span>
                <span className="truncate text-fg-muted" title={a.label}>
                  {a.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </ControlPanel>
  );
};

/** 開場 30 秒的視覺震撼。半天硬上限，不接真實資料（Q17）。 */
const AgentWow = () => (
  <div className="max-w-2xl">
    <Kicker>先看一個東西</Kicker>
    <Title>這是 AI Agent 正在工作</Title>
    <Lead>三十秒。接下來的九分半，我們談它值不值得。</Lead>
  </div>
);

/** 主力 demo：全場唯一不可壓縮的三分鐘。 */
const BlueprintDemo = () => {
  const collapsed = useMobileUi((s) => s.panelsCollapsed);
  const togglePanels = useMobileUi((s) => s.togglePanels);
  const selected = useSelection((s) => s.node);
  const tier = useDeck((s) => s.tier);
  const setTier = useDeck((s) => s.setTier);
  const focusDepth = useDeck((s) => s.focusDepth);
  const setFocusDepth = useDeck((s) => s.setFocusDepth);
  const { fps, drawCalls, nodes, maxDepth, layoutMs, source, strategy } = useStats();

  return (
    <div className="flex h-full flex-col justify-between compact:h-auto compact:justify-start compact:gap-3">
      <div className="pointer-events-none">
        <Kicker>主力 Demo</Kicker>
        <Title>把上限拿掉會怎樣</Title>
      </div>

      {/* 左邊是「操作」，右邊是「結果」—— 現場講的時候手一直在左邊，眼睛在右邊 */}
      <PanelRow collapsed={collapsed}>
        <div className="flex items-end gap-4 compact:flex-col compact:items-stretch compact:gap-2">
          <ControlPanel title="節點數">
            <div className="flex gap-2">
              {TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                title={t.note}
                className={`flex-1 rounded border px-2 py-2 text-sm transition ${
                  tier === t.key
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-ink-600 text-fg-muted hover:border-ink-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fg-faint">
            最左邊是基準資料的節點數。請直接拉到最右邊 ——
            那是現行上限的一百倍，一百萬個節點。
          </p>
        </ControlPanel>

        {/* 深度切片：3D 的遮擋問題要靠互動解，不是靠調角度 */}
        <ControlPanel title="結構層次">
          <input
            type="range"
            min={0}
            max={Math.max(1, maxDepth)}
            step={1}
            value={Math.min(focusDepth, Math.max(1, maxDepth))}
            onChange={(e) => setFocusDepth(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="tabular mt-2 flex justify-between text-xs text-fg-faint">
            <span>實心到第 {focusDepth} 層</span>
            <span>共 {maxDepth} 層</span>
          </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-faint">
              往右拉是把外層補實，往左拉是剝開看裡面。
            </p>
          </ControlPanel>
        </div>

        <div className="flex flex-col gap-4">
          <SelectionPanel />

          <ControlPanel title="即時量測">
            <dl className="space-y-2 text-sm">
              {[
                ['FPS', fps],
                ['節點數', nodes.toLocaleString()],
                ['Draw calls', drawCalls],
                ['佈局耗時', `${layoutMs} ms`],
                ['渲染策略', strategy],
                ['資料來源', source === 'snapshot' ? '藍圖快照' : '程式生成'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-fg-faint">{k}</dt>
                  <dd className="tabular text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </ControlPanel>
        </div>
      </PanelRow>

      <MobileDock>
        <DockButton onClick={togglePanels}>{collapsed ? '設定' : '收起設定'}</DockButton>
      </MobileDock>

      {/*
        收合時節點卡片改成浮出來。
        收合的目的是看藍圖，但長按選到一顆之後還是要能讀它是什麼 ——
        少了這張卡，收合等於把「點節點」這件事整個廢掉。
      */}
      {collapsed && selected && (
        <FloatingCard>
          <SelectionPanel />
        </FloatingCard>
      )}
    </div>
  );
};

/* 一路開到一百萬 —— DOM 超過 DOM_LIMIT 會自動跳過並說明原因 */
const BENCH_COUNTS = [1000, 5000, 20000, 200000, 1000000];

/**
 * 效能對照台。
 *
 * 三種渲染方式**依序**量測 —— 並排跑會互相搶主執行緒，三個數字都會是錯的。
 * 這一頁整個是 DOM，不碰共用 canvas（該頁的 scene 設成 none，
 * 主 canvas 的 render loop 會停掉，否則它也會來搶效能）。
 */
const PerfBench = () => {
  const hostRef = useRef(null);
  const abortRef = useRef(null);
  const [count, setCount] = useState(5000);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});

  useEffect(() => () => abortRef.current?.abort(), []);

  /*
   * 觸控裝置預設不跑，直接帶入桌機實測值。
   * 但保留出口 —— 標明是桌機數字之後，想在自己機器上驗證的人按一下就能跑。
   */
  const [coarse] = useState(isCoarsePointer);
  const [forcedLive, setForcedLive] = useState(false);
  const usingRecorded = coarse && !forcedLive;
  const recorded = usingRecorded ? RECORDED[count] : null;

  const start = async () => {
    if (running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setResults({});

    for (const mode of MODES) {
      if (controller.signal.aborted) break;

      /*
       * DOM 超過現場上限就不跑：兩萬節點量得出來，但會讓瀏覽器停止回應十幾秒，
       * 現場報告不值得為一個已知的數字付這個代價。
       */
      if (mode.key === 'dom' && count > DOM_LIMIT) {
        setResults((prev) => ({
          ...prev,
          [mode.key]: { skipped: true, offline: DOM_OFFLINE[count] ?? null },
        }));
        continue;
      }

      setRunning(mode.key);
      const result = await runMode({
        mode: mode.key,
        host: hostRef.current,
        count,
        signal: controller.signal,
      });
      if (!result) break;
      setResults((prev) => ({ ...prev, [mode.key]: result }));
    }
    setRunning(null);
  };

  const best = Math.max(
    1,
    ...(recorded
      ? Object.values(recorded).map((r) => r?.fps ?? 0)
      : Object.values(results).map((r) => r.fps ?? 0)),
  );

  return (
    <div className="flex h-full flex-col gap-6 compact:h-auto">
      <div className="pointer-events-none">
        <Kicker>互動頁 · 會後自玩</Kicker>
        <Title>同一批節點，三種畫法</Title>
      </div>

      {/*
        量測用的畫布 —— 三種渲染器輪流掛進這裡，跑完就拆掉。
        用 flex-1 撐開剩餘高度，不要用絕對定位算 bottom：
        控制列的高度會隨內容變，寫死就會被壓住。
      */}
      <div
        ref={hostRef}
        className="pointer-events-none relative min-h-0 flex-1 rounded-lg border border-ink-800 compact:min-h-56"
      >
        {!running && (
          <div className="flex h-full items-center justify-center text-sm text-fg-faint">
            {Object.keys(results).length
              ? '量測結束，渲染器已拆除'
              : usingRecorded
                ? '下面是桌機實測值'
                : '按左下角「開始量測」'}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-4 compact:flex-col compact:items-stretch compact:gap-2">
        <ControlPanel title="節點數" className="w-80">
          {/* 五個檔位放一排會擠爆，改成三欄兩列 */}
          <div className="grid grid-cols-3 gap-2">
            {BENCH_COUNTS.map((n) => (
              <button
                key={n}
                disabled={!!running}
                onClick={() => setCount(n)}
                className={`rounded border px-1 py-2 text-xs transition disabled:opacity-40 ${
                  count === n
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-ink-600 text-fg-muted hover:border-ink-500'
                }`}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
          {usingRecorded ? (
            <button
              onClick={() => setForcedLive(true)}
              className="mt-3 w-full rounded border border-ink-600 px-3 py-2 text-sm text-fg-muted transition active:border-accent-dim active:text-accent"
            >
              還是要在這台跑
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!!running}
              className="mt-3 w-full rounded border border-accent-dim px-3 py-2 text-sm text-accent transition hover:bg-accent/10 disabled:opacity-40"
            >
              {running ? '量測中…' : '開始量測'}
            </button>
          )}
          {usingRecorded && (
            <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-xs leading-relaxed text-fg-muted">
              手機不跑這個量測，上面是<strong>桌機實測值</strong>（{RECORDED_ON}）。
              這份研究要回答的是「客戶的企業筆電跑不跑得動」——
              手機量到的數字對那個問題沒有意義。
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-fg-faint">
            依序各跑兩秒，不並排 —— 並排會互搶主執行緒，數字就不能信了。
            DOM 只跑到 5,000，再上去會讓瀏覽器停止回應。
          </p>
          <p className="mt-3 border-t border-ink-700 pt-3 text-xs leading-relaxed text-fg-faint">
            注意「幀」與「JS」的差距：那段是瀏覽器在你的程式碼之外做的
            style、layout、paint。DOM 的成本幾乎全在那裡 ——
            <span className="text-fg-muted">profile 自己的 JS 是看不到它的。</span>
          </p>
        </ControlPanel>

        <ControlPanel title="結果">
          <div className="space-y-3">
            {MODES.map((m) => {
              const rec = recorded?.[m.key];
              const r = recorded
                ? rec
                  ? { ...rec, recorded: true }
                  : { skipped: true, offline: null }
                : results[m.key];
              return (
                <div key={m.key}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className={running === m.key ? 'text-accent' : 'text-fg-muted'}>
                      {m.label}
                    </span>
                    <span className="tabular text-fg">
                      {running === m.key
                        ? '量測中'
                        : r?.skipped
                          ? r.offline
                            ? `${r.offline.fps} fps`
                            : '無法量測'
                          : r
                            ? `${r.fps} fps`
                            : '—'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className={`h-full transition-[width] duration-500 ${
                        r?.skipped ? (r.offline ? 'bg-warn' : 'bg-bad') : 'bg-accent'
                      }`}
                      style={{
                        width: r?.skipped
                          ? r.offline
                            ? `${Math.max(1, (r.offline.fps / best) * 100)}%`
                            : '100%'
                          : r
                            ? `${(r.fps / best) * 100}%`
                            : '0%',
                      }}
                    />
                  </div>
                  {r?.skipped && (
                    <div className="mt-1 text-[10px] leading-relaxed text-fg-faint">
                      {r.offline
                        ? `離線實測 幀 ${r.offline.frameMs} ms · 其中 JS ${r.offline.jsMs} ms。現場不跑 —— 會讓瀏覽器停止回應十幾秒`
                        : `建立 ${count.toLocaleString()} 個 DOM element 本身就會鎖住瀏覽器`}
                    </div>
                  )}
                  {r && !r.skipped && (
                    <div className="tabular mt-1 text-[10px] text-fg-faint">
                      {r.recorded && '桌機實測 · '}幀 {r.frameMs} ms · 其中 JS {r.jsMs} ms
                      {r.drawCalls !== null && ` · ${r.drawCalls} draw call`}
                      {r.bailed && ' · 超過 500ms／幀，提早中止'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ControlPanel>
      </div>
    </div>
  );
};

/** 佈局對照：同一棵樹在 2D 與 3D 之間連續變形 */
const LayoutCompare = () => {
  const dragging = useDragging();
  const [sliding, slideBind] = usePressActive();
  const morph = useDeck((s) => s.morph);
  const setMorph = useDeck((s) => s.setMorph);
  const { nodes, leafCount, width2dPx } = useStats();

  return (
    <div className="flex h-full flex-col justify-between compact:h-auto compact:justify-start compact:gap-3">
      <div className="pointer-events-none">
        <Kicker>互動頁 · 會後自玩</Kicker>
        <Title>同一棵樹，兩種擺法</Title>
      </div>

      {/* 拉 2D↔3D 的時候要看得到後面在變形，所以卡片跟著讓開 */}
      <PanelRow dim={dragging || sliding ? 'half' : null}>
        <ControlPanel title="佈局">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={morph}
            onChange={(e) => setMorph(Number(e.target.value))}
            {...slideBind}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="mt-2 flex justify-between text-xs text-fg-faint">
            <span>2D 樹狀圖</span>
            <span>3D 球面</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setMorph(0)}
              className="flex-1 rounded border border-ink-600 px-2 py-1.5 text-xs text-fg-muted transition hover:border-ink-500"
            >
              現況
            </button>
            <button
              onClick={() => setMorph(1)}
              className="flex-1 rounded border border-accent-dim px-2 py-1.5 text-xs text-accent transition hover:bg-accent/10"
            >
              提案
            </button>
          </div>
        </ControlPanel>

        <ControlPanel title="2D 佈局要多寬">
          <div className="tabular text-3xl font-semibold text-fg">
            {width2dPx.toLocaleString()}
            <span className="ml-1 text-base font-normal text-fg-faint">px</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-fg-faint">
            {nodes.toLocaleString()} 個節點裡有 {leafCount.toLocaleString()} 個葉節點。
            以產品實際卡片寬 220px、間距 40px 計算。
          </p>
          <p className="mt-3 border-t border-ink-700 pt-3 text-xs leading-relaxed text-fg-faint">
            {morph < 0.15
              ? '螢幕上那條線不是壞掉 —— 那就是這棵樹縮到一個畫面剛好放得下的樣子。要嘛看不到全貌，要嘛看不到細節。'
              : '寬度隨葉節點數線性成長，深度只影響高度 —— 這是把樹畫在平面上的先天限制，不是實作問題。'}
          </p>
        </ControlPanel>
      </PanelRow>
    </div>
  );
};

/** 能力展示，放在原理段落之後 */
export const agentSlides = [
  {
    id: 'agent-wow',
    section: '原理',
    scene: 'agent',
    sec: 25,
    live: true,
    interactive: true,
    title: 'AI Agent 視覺化',
    Body: AgentWow,
    notes:
      '這一頁只負責一件事：讓人相信我們做得到。它刻意不接真實資料，也不假裝有 —— 投入上限是半天，多出來的每一小時都該給那個能被反駁的主力 demo。技術上是六千個 point sprite 沿螺旋收束到中心，越靠近中心走得越快、顏色由冷轉暖，讓「匯聚」這件事被看見；沒有用到任何自訂 shader。視覺語言刻意延續產品既有的粒子效果，這不是空降一種新風格，而是把既有的視覺語言往前推一步 —— 被問到「這跟現在的產品有什麼關係」時，這是答案。',
  },
];

export const demoSlides = [
  {
    id: 'demo-blueprint',
    section: 'PoC',
    scene: 'blueprint',
    sec: 60,
    live: true,
    interactive: true,
    title: 'PoC 1：經營藍圖 3D',
    Body: BlueprintDemo,
    notes:
      '資料是 2,331 個節點、四層的經營藍圖快照，各檔位由它擴增而來。節點文字是生成的，但深度分佈與分支不均勻程度複製自真實資料——佈局成本取決於樹的形狀而不是節點總數，用隨機散點會低估它。現場請主管親手把節點數拉到一百萬，並觀察 draw call 是否維持在個位數。關鍵在 InstancedMesh：所有節點共用同一份幾何與材質，因此 draw call 數量與節點數無關（2 到 4 個：焦點節點、背景節點、焦點邊、背景邊）。這是 DOM（每張卡一個 element）與 Canvas 2D（每格重繪）都做不到的事。佈局是決定性的立體角錐分配加少數幾次鬆弛，一百萬個節點約 108 ms 算完，不需要等收斂也不會抖。超過十五萬個節點時渲染策略會自動從 InstancedMesh 換成 point sprite —— 因為最低面數的球體也有 20 個三角形，一百萬顆就是每幀兩千萬個三角形，實測會把分頁打掉；HUD 上的「渲染策略」顯示的就是當下用哪一種。第二個控制項解的是 3D 的遮擋問題：外層球殼半透明且不寫深度，所以內部結構一直看得見，拉滑桿可以逐層剝開。',
  },
  {
    id: 'demo-perf',
    section: 'PoC',
    scene: 'none',
    sec: 25,
    live: true,
    interactive: true,
    title: '效能對照台',
    Body: PerfBench,
    notes:
      '同一批節點分別以 DOM element、Canvas 2D 與 WebGL InstancedMesh 渲染，三者依序各量測兩秒。DOM 現場只跑到 5,000 —— 兩萬節點是量得出來的（離線實測每幀 2,979 ms、0.3 fps），但過程中瀏覽器會停止回應十幾秒，現場報告不值得為一個已知的數字付這個代價，所以超過五千就顯示離線結果或直接標明建不出來 —— 並排跑會互搶主執行緒，數字對三者都會失真。三種方式做的事完全一樣：每幀重算位置再畫出來，位置計算是共用成本，差別只在怎麼送上畫面。節點畫成方塊而非圓形，因為 Canvas 2D 的 arc() 遠慢於 fillRect()，用圓形會把結論從「Canvas 2D 慢」灌水成「arc 慢」；DOM 版也用 translate3d 走合成路徑，比的是各自最好的寫法。實測（M 系列 Mac、20,000 節點）：DOM 每幀 4,370 ms、Canvas 2D 16.8 ms、WebGL 16.7 ms。真正該指出來的是「幀」與「JS」的差距 —— DOM 那 4,370 ms 裡只有 15 ms 是我們自己的 JavaScript，其餘全在瀏覽器的 style、layout、paint。這代表 profile 自己的程式碼看不到 DOM 渲染的成本，也是它最容易被低估的原因。',
  },
  {
    id: 'demo-layout',
    section: 'PoC',
    scene: 'layoutCompare',
    sec: 20,
    live: true,
    interactive: true,
    title: '2D vs 3D 佈局',
    Body: LayoutCompare,
    notes:
      '同一棵樹（2,331 個節點的藍圖快照）在 2D 樹狀圖與 3D 球面佈局之間連續變形。刻意做成變形而不是並排：並排看到的是兩張圖，變形看到的是同一批節點被重新安排，那個瞬間才會讓人理解 3D 沒有增加任何資訊，只是換了一種擺法，而擺法決定了能不能看。2D 端的鏡頭退到剛好把整個寬度塞進畫面 —— 螢幕上那條看似壞掉的線，就是這棵樹縮到一個畫面的真實樣子。這 2,331 個節點裡有 1,408 個葉節點，以產品實際卡片寬 220px、間距 40px 計算，2D 佈局需要 366,040px 的寬度。關鍵在於寬度隨葉節點數線性成長，深度只影響高度：這是把樹畫在平面上的先天限制，換一套 2D 元件庫不會改變它。',
  },
];
