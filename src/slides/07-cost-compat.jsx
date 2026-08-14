import { useEffect, useState } from 'react';
import { Kicker, Title, Lead, Table, Callout, ControlPanel, PanelRow } from '../deck/ui';
import { detectCapability } from '../lib/capability';
import { useStress } from '../deck/useDeck';
import { STRESS_STEPS, STRESS_TARGET_FPS } from '../scene/scenes/StressScene';
import { isCoarsePointer } from '../lib/renderBench';

const Compat = () => (
  <>
    <Kicker>先講壞消息</Kicker>
    <Title>客戶的電腦跑不跑得動</Title>
    <Table
      head={['技術', 'caniuse 全球', '缺口', '結論']}
      rows={[
        ['WebGL2', '95.73%', 'IE、Opera Mini', '主推 —— 現在就能上線'],
        [
          'WebGPU',
          '85.56%',
          'Firefox 預設關閉、Safari 僅部分支援',
          '觀察，不當主力',
        ],
      ]}
    />
    <Callout tone="warn">
      但全球佔比是錯的分母。我們的使用者是企業員工的公司電腦，
      不是全球網民 —— 這兩個母體差很多。
    </Callout>
    <Lead>
      我們的產品 本來就掛著 GA／GTM。導入前該做的第一件事，
      是把我們自己的瀏覽器分佈拉出來，用真實客戶的數字取代這張表。
    </Lead>
  </>
);

/**
 * 現場壓力測試。
 *
 * 原本這一頁只是印出 GPU 名稱與支援旗標，內容太薄。
 * 改成在當下這台機器上實際加壓到掉幀，回報它的實用上限 ——
 * 這同時解掉「低階機器沒實測」那個缺口：不必去借機器，
 * 簡報跑在哪台就量哪台。
 */
const LiveStress = () => {
  const [cap, setCap] = useState(null);
  const { running, fps, count, ceiling, maxedOut, start, reset } = useStress();

  useEffect(() => {
    let cancelled = false;
    detectCapability().then((c) => !cancelled && setCap(c));
    return () => {
      cancelled = true;
    };
  }, []);

  // 換頁離開時歸零，下次進來重新跑
  useEffect(() => reset, [reset]);

  const fmt = (n) => n.toLocaleString();

  return (
    <div className="flex h-full flex-col justify-between compact:h-auto compact:justify-start compact:gap-3">
      <div className="pointer-events-none">
        <Kicker>那，這台呢？</Kicker>
        <Title>現在正在投影的這台電腦</Title>
      </div>

      <PanelRow dim={running ? 'quarter' : null}>
        <ControlPanel title="本機規格">
          {!cap ? (
            <p className="text-sm text-fg-faint">偵測中…</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {[
                ['GPU', cap.gpu],
                ['WebGL2', cap.webgl2 ? '支援' : '不支援'],
                ['WebGPU', cap.webgpu ? '支援' : '不支援'],
                ['裝置像素比', cap.dpr],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-fg-faint">{k}</dt>
                  <dd className="truncate text-right text-fg" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </ControlPanel>

        <ControlPanel title="即時加壓">
          <button
            onClick={running ? reset : start}
            className={`w-full rounded border px-3 py-2 text-sm transition ${
              running
                ? 'border-ink-600 text-fg-muted hover:border-ink-500'
                : 'border-accent-dim text-accent hover:bg-accent/10'
            }`}
          >
            {running ? '停止' : ceiling !== null ? '重新量測' : '開始加壓'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-fg-faint">
            節點數逐級往上加，直到 fps 掉到 {STRESS_TARGET_FPS} 以下。
            不必借低階機器 —— 簡報跑在哪台就量哪台。
          </p>
          {isCoarsePointer() && (
            <p className="mt-3 border-t border-ink-700 pt-3 text-xs leading-relaxed text-fg-faint">
              這台是手機，最高只加到 {STRESS_STEPS[STRESS_STEPS.length - 1].toLocaleString()} 個節點。
              量到的是這支手機的上限 ——
              <span className="text-fg-muted">本研究要回答的是企業筆電，兩者不能互相代表。</span>
            </p>
          )}
        </ControlPanel>

        <ControlPanel title={ceiling === null ? '進行中' : '這台機器的上限'}>
          {ceiling === null ? (
            <>
              <div className="tabular text-4xl font-semibold text-fg">
                {fmt(count)}
              </div>
              <div className="mt-1 text-xs text-fg-faint">目前節點數</div>
              <div className="tabular mt-3 border-t border-ink-700 pt-3 text-sm text-fg-muted">
                {fps} fps
              </div>
            </>
          ) : (
            <>
              <div className="tabular text-4xl font-semibold text-accent">
                {fmt(ceiling)}
              </div>
              <div className="mt-1 text-xs text-fg-faint">
                個節點仍維持 {STRESS_TARGET_FPS}+ fps
              </div>
              <p className="mt-3 border-t border-ink-700 pt-3 text-xs leading-relaxed text-fg-faint">
                {maxedOut
                  ? '跑完最高階都沒掉幀 —— 這台機器比我們的測試範圍還強。'
                  : `再往上加就掉到 ${fps} fps。這個數字就是這台機器的實用預算。`}
              </p>
            </>
          )}
        </ControlPanel>
      </PanelRow>
    </div>
  );
};

export const compatSlides = [
  {
    id: 'compat',
    section: '成本',
    scene: 'ambient',
    ambient: 'rings',
    sec: 25,
    live: true,
    title: '相容性矩陣',
    Body: Compat,
    notes:
      '在被問之前主動攤開最尖銳的反對意見。數字取自 caniuse，2026-08-11 查詢：WebGL2 全球 95.73%；WebGPU 83.99% 完整支援加 1.57% 部分支援，合計 85.56%。這些是公開統計不是自行實測，講的時候要說明來源。WebGPU 那 85% 特別容易誤導 —— 它的組成是 Chrome 系全支援、Firefox 預設關閉、Safari 只有部分支援，而企業環境裡 Firefox 與受管控的舊版瀏覽器比例遠高於全球平均。更根本的問題是分母：我們的使用者是企業員工的公司電腦，不是全球網民。我們的產品 的 layout 已經載入 GA 與 GTM，所以我們手上就有真實的瀏覽器分佈，導入前應該用它取代這張表。結論是主推 WebGL2 / Three.js，WebGPU 列為觀察項目。',
  },
  {
    id: 'live-stress',
    section: '成本',
    scene: 'stress',
    sec: 30,
    live: true,
    interactive: true,
    title: '現場加壓',
    Body: LiveStress,
    notes:
      '這一頁取代了「借一台低階機器實測」這個一直沒補上的缺口。做法是在當下這台電腦上逐級加壓：一萬、兩萬五、五萬……最高一百萬個節點，每一階觀察 0.7 秒，掉到 55 fps 以下就停下並回報上一階的數量，那就是這台機器的實用預算。位置只在換階時寫入一次，之後只轉相機——所以量到的是渲染能力，不是 JavaScript 寫矩陣的能力，這兩件事在前面的天花板那一頁已經區分過。現場一定要在投影筆電上跑，而不是在我的開發機上：如果會議室那台撐得住，關於相容性與效能的爭論當場就結束；如果撐不住，那也是必須被看見的事實，而且它會直接變成導入時的效能預算數字。',
  },
];
