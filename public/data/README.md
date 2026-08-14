# 資料快照

`blueprint.json` 是**生成的**經營藍圖快照，由 `tools/generate-blueprint.mjs` 產出。

檔案不存在時，simulator 會自動回退到程式內建的生成資料 —— 骨架不會壞。

## 為什麼不是隨機散點

節點的**文字**是生成的，但**結構**複製自一份真實的企業經營藍圖：
節點數、深度分佈、type 分佈、分支不均勻程度。

這件事決定了效能量測有沒有意義。佈局成本取決於樹的形狀而不是節點總數 ——
少數節點分支特別多（中位 2、最大 31）才是 2D 佈局爆版的主因。
隨機散點會低估真實成本。

## 支援的格式

`src/data/blueprint.js` 的 `normalize()` 接受兩種形狀：

**扁平陣列**
```json
[
  { "id": "1", "parentId": null, "label": "三年營收目標", "depth": 0, "kind": "objective" },
  { "id": "2", "parentId": "1", "label": "通路重組", "depth": 1, "kind": "strategy" }
]
```

**嵌套 children**
```json
{ "id": "1", "label": "三年營收目標", "children": [{ "id": "2", "label": "通路重組" }] }
```
