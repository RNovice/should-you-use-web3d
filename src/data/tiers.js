/**
 * 節點數檔位。
 *
 * 產品的硬上限是一萬張卡，而實際用量大約是上限的四分之一 ——
 * 產品裡那個擋住使用者新增的 Modal，擋的就是這個一萬。
 *
 * 關鍵在於：可用性在遠低於上限的地方就已經崩潰，
 * 所以「把上限調高」不是解法。這是選這個題目來做 PoC 的理由。
 */
export const CARD_LIMIT = 10000;
/** 實際用量約為上限的四分之一 —— 崩潰發生在遠離上限的地方 */
export const CARD_USED = Math.round(CARD_LIMIT * 0.25);

/** 本次實測使用的節點數 */
export const SNAPSHOT_COUNT = 2331;

export const TIERS = [
  { key: 'now', label: '現在', target: null, note: '基準資料，未擴增' },
  { key: 'limit', label: '現行上限', target: CARD_LIMIT, note: '產品擋人的那條線' },
  { key: 'x10', label: '10×', target: CARD_LIMIT * 10, note: '十萬' },
  { key: 'x100', label: '100×', target: CARD_LIMIT * 100, note: '一百萬' },
];

export const tierTarget = (key) =>
  (TIERS.find((t) => t.key === key) ?? TIERS[0]).target;
