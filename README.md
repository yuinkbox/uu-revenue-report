# UU 经营报告（营收日报 v2.0）

铜陵UU台球俱乐部内部营收日报工具 —— 基于 v1.2 全部业务逻辑，前端用
**React 19 + TypeScript + Tailwind CSS + shadcn/ui** 整体重写。

## 与 v1.2 的关系

- `src/lib/` 下的业务逻辑（计算、台客多导入识别、导出、微信文案、本地存储）
  从 v1.2 原样迁移，未做行为修改；localStorage 键名不变，旧数据直接可用
- `desktop.py` / `server.js` 桌面壳与静态服务器原样复用，仍只依赖 `dist/`
- 导入回归测试 `test-importers.mjs` 全部通过

## 界面与交互升级

- shadcn/ui 极简设计：统一卡片、表格、表单控件，zinc 中性色 + 表格数字等宽
- 侧边栏使用俱乐部真实 Logo（`public/logo-icon.png`）+ 今日营收速览
- 录入页：实时指标卡（总营收 / 环比昨日 / 台时利用率 / 对账差异）、
  底部悬浮操作条、`Ctrl+S` 快速保存
- 商品名称改为搜索式下拉（Command 面板），支持目录分组和自定义输入
- 历史日报按月分组，显示月累计、星期、“昨天/前天”徽章；删除改为确认弹窗
- 全局 sonner 通知（成功 / 警告 / 错误三态）
- 页面状态同步地址栏 hash（`#history` 等），刷新后停留在当前页
- 设置页团购口径改为卡片式单选

## 开发

```bash
npm install
npm run dev                # http://localhost:3000
npm run test:importers     # 台客多导入回归测试
npm run build              # 产出 dist/
```

## 打包桌面 exe

与 v1.2 相同：先 `npm run build`，再按原交接说明用 PyInstaller 打包
`desktop.py`（`--add-data "$src\dist;dist"`）即可。

## 视觉回归截图（可选）

```bash
npm run dev -- --port 7100 --host 127.0.0.1
# 另开终端，启动带远程调试的无头 Chrome 后：
node scripts/shots.mjs http://127.0.0.1:7100/ /tmp/shots
```
