# Cogen frontend

本仓库是 [blockscout/frontend](https://github.com/blockscout/frontend) 的正式 fork。
Cogen 分支 `codex/cogen-explorer` 基于 v2.3.5 的精确提交
`95feb0ba3245c67b1ced38e71a38569951add266`。源码、接口和测试直接在本仓库维护。

## 配置与构建

```bash
docker build --platform linux/amd64 \
  --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) \
  --build-arg GIT_TAG=v2.3.5-cogen.1 \
  -t cogen-explorer-frontend:v2.3.5-1 .
```

使用 [cogenlabs/explorer](https://github.com/cogenlabs/explorer) 的 `docker-compose/cogen.yml`
启动这个镜像。该仓库的构建脚本固定本 fork 提交，不再应用额外补丁。

必要运行配置：

```dotenv
NEXT_PUBLIC_NETWORK_VERIFICATION_TYPE=mining
NEXT_PUBLIC_HAS_BEACON_CHAIN=true
NEXT_PUBLIC_VIEWS_BLOCK_HIDDEN_FIELDS=['nonce','total_reward']
COGEN_POVI_RPC_URL=http://host.docker.internal:9545
```

其余 API 地址、币种、chain ID 沿用 Explorer 的 common-frontend.env。
导航默认使用 `public/static/cogen/` 中的 Cogen logo：浅色主题使用深色字标，深色主题使用浅色字标，
折叠导航使用金色图标。仍可通过 `NEXT_PUBLIC_NETWORK_LOGO` / `NEXT_PUBLIC_NETWORK_ICON` 及其 `_DARK` 配置覆盖。
`COGEN_POVI_RPC_URL` 仅在 Next.js 服务端使用，须指向与 Explorer 执行层数据配套的 Cogen 节点；
Geth 的 8545 端口不提供 PoVI 数据。Cogen 默认绑定 127.0.0.1:9545，容器部署时须提供可达的私有入口。
不要向公网开放完整矿工 RPC。浏览器只调用 `/node-api/cogen/block?height=…&hash=…`，
该接口只支持 GET，并且只向节点发送 `povi_getBlockByNumber`。

服务端核对 number、executionNumber、executionHash、canonical；RPC 故障、节点落后或重组不匹配时
显示 Unavailable，不使用 Geth 的零难度代替。数据当前为按需读取，未持久化至索引数据库。

## 显示语义

- **Difficulty**：`floor(2^256 / (target + 1))`，与 Cogen `difficulty.Work` 完全一致，单位是参考 tickets。
  它是区块基础工作量，不是 Ethereum PoW 的相对难度，也不是某个模型层的成本归一化 target。
  所有计算使用 BigInt；通过 JSON 传递十进制字符串。
- **Total diffculty**：共识 RPC 的 `totalWork`，不能使用 Geth `totalDifficulty`。
- 区块详情隐藏 **PoVI target / hash** 和 **Included fruits**；共识接口仍保留这些数据。
- 区块详情的奖励入口显示为 **Block Rewards**。
- 原 Withdrawals 页签、地址页、导航、奖励列表改为 **Fruits**；底层 URL、API JSON 和数据库字段保持兼容。
- **Miner index**：按产品要求显示这个名称，但底层值是每个区块内的奖励代码，**不是矿工身份编号**。
  `0` = 区块奖励，`1` = 获胜 ticket 的 fruit 奖励，`2+i` = 第 i 个额外 fruit 的奖励。
  区块页有明确说明，桌面列头也提供说明。
- Fruits 奖励记录数与实际 fruit 数不同：普通区块有 `2 + fruits.length` 条奖励记录；创世块没有奖励。
  概览链接因此显示 “N reward payouts”。移动端同时展示每条奖励金额。

本次按高度读取 canonical PoVI 块；对于已经 orphan 的执行区块，不会误用同高度的新块数据。
若要展示 orphan 块的历史共识数据，需要索引 EL hash → PoVI hash 映射，再调用 `povi_getBlockByHash`。

## 其他应补充的信息（源码审查结论，尚未全部实现）

依据 Cogen 的 `core/api.go`、`core/rewards.go`、`core/chain.go`、`ticket/`、`params/config.go`
及 `docs/architecture.md`：

| 优先级 | 信息 | 数据与注意事项 |
| --- | --- | --- |
| P0 | 奖励分类与发行汇总 | `rewards[].code/address/amount`，将 block、winning-ticket fruit、included fruits 分开汇总；amount 单位是 Gwei，转 COG 除以 10^9。默认生成配置是 1 COG + 0.5 COG + 0.5 COG × N，但不能在 Explorer 硬编码。 |
| P0 | 每个 fruit 详情 | `fruits[].index/rewardCode/miner/ticket/modelId/layer/p/q/kind/proofSize`，关联奖励收款地址与实际工作记录。目前 Fruits 表只显示发奖记录，不能称作完整的 fruit 浏览器。 |
| P0 | 出块 ticket 详情 | `ticket` 中的 miner、ticket、modelId、layer、p/q、kind、commitRoot、proofSize；区分 mock 与 cogen，创世块 ticket 为 null。 |
| P1 | 共识状态与双层 hash | 共识接口已提供 PoVI hash，详情页隐藏；后续增加 PoVI parentHash、workHash、contentHash、fruitsRoot、canonical、safe/finalized 状态。safe/finalized 为配置深度规则，不是以太坊质押投票最终性。 |
| P1 | 矿工页面 | 按收款地址汇总出块数、fruit 数、三类奖励与时间分布。不能按 miner index/validator_index 聚合矿工。 |
| P1 | 网络挖矿指标 | 区块/fruit 产率、出块间隔、difficulty/totalWork 趋势、发行量与销毁量。PoVI 工作量速率不能直接标为传统 H/s；明确估算窗口、参考 ticket 单位和成本归一化含义。 |
| P2 | 模型工作分布 | 根据 modelId/layer/kind 统计已确认工作；不能把这些 PoVI 矿工计算等同于已完成的真实用户推理请求或服务收入。 |

长期建议在索引阶段持久化 PoVI 数据与 EL hash 的关联，处理重组和回填，以支持列表、图表、矿工汇总和离线可用性。
相关主动索引/周期任务应放 indexer 模式；API 内存缓存放 api 模式，遵守根目录 `AGENTS.md`。
本次轻量按需读取可以先修复区块详情，不改变现有执行层索引流程。

## 测试

数据测试使用 Node 22.23+ 的 TypeScript stripping：

```bash
node --experimental-strip-types --test tests/cogen/block.test.mjs
```

上游依赖声明精确 Node 22.11.0。使用较新的 Node 22 时设置 `YARN_IGNORE_ENGINES=1`。

```bash
corepack yarn install --frozen-lockfile
corepack yarn lint:tsc
corepack yarn test:pw ui/block/BlockDetailsCogen.pw.tsx --project=default --project=mobile
corepack yarn build
node tests/cogen/production-smoke.mjs .
```

页面测试需安装匹配的 Playwright 浏览器，默认 mobile 项目使用 WebKit。
2026-10-12 已验证 6 组数据测试、6 项 Chrome 桌面/移动视口测试、TypeScript/ESLint、Next.js 生产构建及
构建后的 HTTP 冒烟测试。Difficulty 常显和 Miner index 两条用例在未修复源码上失败、修复后通过。
WebKit、实际 PoVI 链节点及 Docker 运行镜像尚未验证；构建保留上游 es-toolkit 的 Edge Runtime 警告。
