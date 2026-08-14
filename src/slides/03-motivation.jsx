import { Kicker, Title, Lead, Callout, StatRow } from '../deck/ui';
import { CARD_LIMIT, CARD_USED, SNAPSHOT_COUNT } from '../data/tiers';

/**
 * 為什麼拿經營藍圖來試。
 *
 * 原本這裡有四頁痛點，現在壓成一頁 —— 因為這份報告的主體不是「解決這個痛點」，
 * 而是「驗證一個技術值不值得引入」。痛點只是挑選 PoC 題目的理由。
 */
const Motivation = () => (
  <>
    <Kicker>我們拿什麼來試</Kicker>
    <Title>挑了看起來最該用 3D 的那個題目</Title>
    {/*
      公開版說明：內部版本這裡直接引用產品原始碼（那個擋住使用者新增卡片的
      Modal），作為「這個介面已經因為渲染而受限」的證據。原始碼不能外流，
      所以改成文字敘述 —— 論點不變，證據強度會弱一些。
    */}
    <Callout tone="warn">
      這個樹狀圖元件的版號寫在資料夾名稱上（已經是第三版），
      佈局只提供「圖／列表」二選一，而當卡片數接近上限時，
      產品會用一個 Modal 直接擋住使用者新增。
    </Callout>
    <StatRow
      items={[
        { value: 'V3', label: '樹狀圖已重做三次' },
        { value: CARD_LIMIT.toLocaleString(), label: '產品的卡片數上限' },
        { value: `${Math.round((CARD_USED / CARD_LIMIT) * 100)}%`, label: '實際用量佔上限' },
        { value: SNAPSHOT_COUNT.toLocaleString(), label: '本次實測節點數' },
      ]}
    />
    <Lead>
      版號寫在資料夾名稱上、佈局只剩「圖／列表」二選一、最後用 Modal 擋住使用者。
      如果 3D 對我們有用，這裡應該最有用 —— 所以從這裡開始試。
    </Lead>
  </>
);

export const motivationSlides = [
  {
    id: 'motivation',
    section: 'PoC',
    scene: 'ambient',
    ambient: 'branches',
    sec: 30,
    live: true,
    title: '為什麼挑經營藍圖',
    Body: Motivation,
    notes:
      '選題邏輯是「挑最有利的戰場」：如果 3D 在最該用的地方都不成立，那結論就很乾淨。經營藍圖符合三個條件——它已經因為渲染而受限（元件的版號寫在資料夾名稱上，代表重做過三次；佈局切換器只提供圖與列表兩種，圖看不下去時唯一出路是退回列表，等於放棄視覺化；最後用一個紅色 Modal 擋住使用者新增卡片），它有真實資料可以量測，而且節點數足夠大。要注意的是實際用量只有上限的四分之一，可用性就已經崩潰——崩潰發生在遠離上限的地方，所以把上限調高並不能解決問題。（公開版的節點資料是依照真實結構統計生成的，不是真實內容。）',
  },
];
