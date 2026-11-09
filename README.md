# Bella 日线信号台

公开静态网页，用 OpenMarket 共享图表 `bmhOD7gr` 的 Favorite 标的日线读数计算推荐进场指数。当前只做 1D，4H 暂不启用。

## 每日更新

1. 北京时间 08:05 后打开 `https://openmarket.xyz/chart/bmhOD7gr?__a100skip=1`，切到 `1d`。
2. 逐个读取名为 `favorite` 的自选列表中的全部标的（包括所有分区，不按行内星标筛选）：
   - 信号 1：Oscillator Toolkit 主线相对 20 / 80 虚线的位置。
   - 信号 2：只记录最新一根日线上的向上 / 向下背离箭头；历史箭头不写入当日数据。
   - 信号 3：Liquidity Imbalance Oscillator 数值，正数买方、负数卖方；没有订单簿时填 `null`。
3. 新增 `data/readings/YYYY-MM-DD.json`。
4. 运行 `npm test && npm run build`。
5. 提交并部署到 Vercel。

截图只用于人工核对，不提交、不公开。

## 近一周信号复盘

网页回看今天之前 7 个自然日。某标的指数严格超过 60 时，以首次触发日价格建立记录，并用最新读数计算截至今天的价格涨跌和按做多/做空方向折算的收益。连续多天同方向超过 60 只记录首次触发；没有符合条件的记录时隐藏整个板块。

## 本地预览

```bash
npm run dev
```

打开 `http://localhost:4173`。
