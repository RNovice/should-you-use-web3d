import { useEffect, useState } from 'react';
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
import { useMapState, useMobileUi, useDragging, usePressActive } from '../deck/useDeck';
import { isCoarsePointer } from '../lib/renderBench';
import { loadSemanticMap } from '../data/semanticMap';

/**
 * PoC 頁。
 *
 * 版面刻意把「找」與「讀」分開：3D 在畫面上負責找，
 * 右側永遠有一份可讀的文字清單。這是對上一版 UX 失敗的直接回應。
 */
/** 選取內容卡。展開時排在面板列裡，收合時由 FloatingCard 浮出來 */
const CardPanel = ({ map, focus, selected, neighbours, setSelected }) => (
  <ControlPanel title={selected !== null ? '這張卡與最相似的八張' : '尚未選取'}>
    {map && focus !== null ? (
      <>
        <div className="line-clamp-3 text-sm leading-snug text-fg" title={map.labels[focus]}>
          {map.labels[focus]}
        </div>
        {selected !== null && (
          <ol className="mt-3 space-y-1.5 border-t border-ink-700 pt-3">
            {neighbours.map((i) => (
              <li key={i}>
                <button
                  onClick={() => setSelected(i)}
                  className="w-full truncate text-left text-xs text-fg-muted transition hover:text-accent"
                  title={map.labels[i]}
                >
                  {map.labels[i]}
                </button>
              </li>
            ))}
          </ol>
        )}
      </>
    ) : (
      <p className="text-xs leading-relaxed text-fg-faint">
        把游標移到任一顆節點上會顯示它的內容；點下去會連出最相似的八張，
        並在這裡列成可以讀的清單。
      </p>
    )}
  </ControlPanel>
);

const SemanticMap = () => {
  const { query, setQuery, morph, setMapMorph, selected, hovered, setSelected } = useMapState();
  const collapsed = useMobileUi((s) => s.panelsCollapsed);
  const togglePanels = useMobileUi((s) => s.togglePanels);
  const nudgeMapZoom = useMobileUi((s) => s.nudgeMapZoom);
  const dragging = useDragging();
  const [sliding, slideBind] = usePressActive();
  const [map, setMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadSemanticMap().then((m) => !cancelled && setMap(m));
    return () => {
      cancelled = true;
    };
  }, []);

  const focus = selected ?? hovered;
  const neighbours =
    map && selected !== null
      ? (map.neighbours[selected] ?? [])
          .map((src) => map.srcToIndex.get(src))
          .filter((i) => i !== undefined)
      : [];

  return (
    <div className="flex h-full flex-col justify-between compact:h-auto compact:justify-start compact:gap-3">
      <div className="pointer-events-none">
        <Kicker>正例 · PoC</Kicker>
        <Title>這 2,331 張卡裡，哪些其實在講同一件事</Title>
      </div>

      <PanelRow collapsed={collapsed} dim={dragging || sliding ? 'half' : null}>
        <div className="flex items-end gap-4 compact:flex-col compact:items-stretch compact:gap-2">
          <ControlPanel title="搜尋">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="輸入關鍵字，例如：滿意度"
              className="w-full rounded border border-ink-600 bg-ink-950 px-2 py-1.5 text-sm text-fg outline-none placeholder:text-fg-faint focus:border-accent-dim"
            />
            <p className="mt-3 text-xs leading-relaxed text-fg-faint">
              命中的留亮，其餘壓暗。點任一顆看它與最相似的八張。
            </p>
          </ControlPanel>

          <ControlPanel title="維度">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={morph}
              onChange={(e) => setMapMorph(Number(e.target.value))}
              {...slideBind}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="mt-2 flex justify-between text-xs text-fg-faint">
              <span>2D</span>
              <span>3D</span>
            </div>
            {map && (
              <dl className="tabular mt-3 space-y-1 border-t border-ink-700 pt-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-fg-faint">2D 鄰域保留</dt>
                  <dd className="text-fg-muted">
                    {(map.preservation.twoD * 100).toFixed(1)}%
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-faint">3D 鄰域保留</dt>
                  <dd className="text-accent">
                    {(map.preservation.threeD * 100).toFixed(1)}%
                  </dd>
                </div>
              </dl>
            )}
          </ControlPanel>
        </div>

        {/* 讀字永遠在這裡，不在 3D 裡 */}
        <CardPanel map={map} focus={focus} selected={selected} neighbours={neighbours} setSelected={setSelected} />
      </PanelRow>

      <MobileDock>
        <DockButton onClick={togglePanels}>{collapsed ? '設定' : '收起設定'}</DockButton>
        <DockButton onClick={() => nudgeMapZoom(-1)} aria-label="拉遠">−</DockButton>
        <DockButton onClick={() => nudgeMapZoom(1)} aria-label="拉近">＋</DockButton>
      </MobileDock>

      {/* 收合時長按選到的卡片浮出來，不然收合等於廢掉選取 */}
      {collapsed && selected !== null && (
        <FloatingCard>
          <CardPanel map={map} focus={focus} selected={selected} neighbours={neighbours} setSelected={setSelected} />
        </FloatingCard>
      )}
    </div>
  );
};

export const semanticSlides = [
  {
    id: 'poc-semantic-map',
    section: 'PoC',
    scene: 'semanticMap',
    sec: 30,
    live: true,
    interactive: true,
    title: 'PoC 2：語意地圖',
    Body: SemanticMap,
    notes:
      '第二個 PoC：數學上 3D 明顯勝出，但使用者看不到那個勝出。做法：2,331 張卡片的中文 bigram TF-IDF，先用 LSA 壓到 40 維去掉稀疏造成的退化，再用 SMACOF 分別降到 2D 與 3D —— 同一批向量、同一個演算法、同一組初始值，只有目標維度不同。收斂後 3D 的 kNN@10 鄰域保留率是 43.1%，2D 是 30.8%，3D 高出 40.1%，超過事前訂下的 10% 及格線；距離失真（stress）也從 0.3893 降到 0.2969。要誠實補一句：43.1% 代表還有將近六成的真實鄰居在地圖上不是鄰居，所以這是導覽工具不是真相，找到之後仍然要讀字。介面設計刻意與經營藍圖那版相反：3D 只負責找，讀字一律在右側清單；只標十二個群的代表詞而不是 2,331 個標籤；關聯用明線連出來而不要求肉眼判斷 3D 遠近；預設不自轉、節點放大，讓它點得到。但最後仍然判定不引入，理由是：右側那份相似清單是在 40 維的 LSA 空間算出來的，跟 3D 座標無關——把地圖整個拿掉，清單一字不差。也就是說 3D 在這裡對真正有用的功能沒有貢獻，而且它的三個軸是降維演算法湊出來的、不對應任何東西，旋轉它學不到任何事。這是「量得到的優勢不等於使用者感受得到的優勢」的實例。',
  },
];
