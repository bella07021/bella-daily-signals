# Bella 日线信号台

公开静态网页，用 OpenMarket 共享图表 `bmhOD7gr` 的 Favorite 标的日线读数计算推荐进场指数。当前只做 1D，4H 暂不启用。

## 每日更新

1. 北京时间 08:05 后打开 `https://openmarket.xyz/chart/bmhOD7gr?__a100skip=1`，切到 `1d`。
2. 逐个读取名为 `favorite` 的自选列表中的全部标的（包括所有分区，不按行内星标筛选）：
   - 信号 1：Oscillator Toolkit 主线相对 20 / 80 虚线的位置。
   - 信号 2：最近 3 根日线内的向上 / 向下背离箭头。
   - 信号 3：Liquidity Imbalance Oscillator 数值，正数买方、负数卖方；没有订单簿时填 `null`。
3. 新增 `data/readings/YYYY-MM-DD.json`。
4. 运行 `npm test && npm run build`。
5. 提交并部署到 Vercel。

截图只用于人工核对，不提交、不公开。

## 本地预览

```bash
npm run dev
```

打开 `http://localhost:4173`。
