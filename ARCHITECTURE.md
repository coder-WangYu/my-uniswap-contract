# MyUniswap DEX 项目架构文档

## 项目概述

这是一个基于 Uniswap V3 架构的去中心化交易所（DEX）项目，实现了集中流动性、多费率池、NFT流动性头寸等核心功能。项目采用模块化设计，通过多个智能合约协同工作，提供完整的 DEX 功能。

## 核心合约架构

### 1. Factory.sol - 工厂合约

**功能职责：**
- 创建和管理流动性池（Pool）
- 维护池子地址映射关系
- 防止重复创建相同参数的池子

**核心功能：**
```solidity
// 创建池子
function createPool(
    address tokenA,
    address tokenB,
    int24 tickLower,
    int24 tickUpper,
    uint24 fee
) external returns (address pool)

// 获取池子地址
function getPool(
    address tokenA,
    address tokenB,
    uint32 index
) external view returns (address pool)
```

**设计特点：**
- 使用 `mapping(address => mapping(address => address[]))` 存储池子地址
- 通过 `sortToken` 确保 token0 < token1 的一致性
- 使用 `CREATE2` 和 salt 确保池子地址确定性
- 通过 `Parameters` 结构体向新创建的池子传递初始化参数

### 2. Pool.sol - 流动性池合约

**功能职责：**
- 管理单个交易对的流动性
- 执行代币交换逻辑
- 处理流动性提供和移除
- 计算和分配手续费

**核心数据结构：**
```solidity
struct SwapState {
    int256 amountSpecifiedRemaining;  // 剩余交换量
    int256 amountCalculated;          // 已计算交换量
    uint160 sqrtPriceX96;             // 当前价格
    uint256 feeGrowthGlobalX128;      // 手续费增长
    uint256 amountIn;                 // 输入数量
    uint256 amountOut;                // 输出数量
    uint256 feeAmount;                // 手续费数量
}

struct Position {
    uint128 liquidity;                // 流动性数量
    uint128 tokensOwed0;              // 可提取的 token0
    uint128 tokensOwed1;              // 可提取的 token1
    uint256 feeGrowthInside0LastX128; // 上次提取手续费时的记录
    uint256 feeGrowthInside1LastX128; // 上次提取手续费时的记录
}
```

**核心功能：**
- `initialize()`: 初始化池子价格
- `mint()`: 添加流动性
- `burn()`: 移除流动性
- `collect()`: 提取代币和手续费
- `swap()`: 执行代币交换

**设计特点：**
- 使用 Q64.96 格式存储价格（`sqrtPriceX96`）
- 通过 tick 系统管理价格区间
- 实现集中流动性机制
- 使用回调模式处理代币转账

### 3. PoolManager.sol - 池子管理器

**功能职责：**
- 继承 Factory 功能
- 提供池子查询和管理接口
- 支持池子创建和初始化

**核心功能：**
```solidity
// 获取所有池子信息
function getAllPools() external view returns (PoolInfo[] memory)

// 创建并初始化池子
function createAndInitializePoolIfNecessary(
    CreateAndInitializeParams calldata params
) external payable returns (address pool)
```

**设计特点：**
- 维护 `pairs` 数组记录所有交易对
- 提供完整的池子信息查询
- 支持一键创建和初始化池子

### 4. PositionManager.sol - 头寸管理器

**功能职责：**
- 管理 NFT 流动性头寸
- 处理流动性的添加、移除和提取
- 实现 ERC721 标准的 NFT 功能

**核心数据结构：**
```solidity
struct PositionInfo {
    uint256 id;                       // NFT ID
    address owner;                    // 拥有者
    address token0;                   // 代币0
    address token1;                   // 代币1
    uint32 index;                     // 池子索引
    uint24 fee;                       // 费率
    uint128 liquidity;                // 流动性数量
    int24 tickLower;                  // 价格区间下限
    int24 tickUpper;                  // 价格区间上限
    uint128 tokensOwed0;              // 可提取的 token0
    uint128 tokensOwed1;              // 可提取的 token1
    uint256 feeGrowthInside0LastX128; // 手续费记录
    uint256 feeGrowthInside1LastX128; // 手续费记录
}
```

**核心功能：**
- `mint()`: 创建新的流动性头寸（NFT）
- `burn()`: 销毁流动性头寸
- `collect()`: 提取代币和手续费
- `mintCallback()`: 处理流动性添加时的代币转账

**设计特点：**
- 每个流动性头寸对应一个 NFT
- 使用 `_nextId` 计数器生成唯一 NFT ID
- 实现权限控制，确保只有 NFT 拥有者可以操作
- 支持手续费自动计算和累积

### 5. SwapRouter.sol - 交换路由器

**功能职责：**
- 提供用户友好的交换接口
- 支持精确输入和精确输出交换
- 处理多池路径交换
- 提供价格报价功能

**核心功能：**
```solidity
// 精确输入交换
function exactInput(ExactInputParams calldata params) 
    external payable returns (uint256 amountOut)

// 精确输出交换
function exactOutput(ExactOutputParams calldata params) 
    external payable returns (uint256 amountIn)

// 价格报价
function quoteExactInput(QuoteExactInputParams calldata params) 
    external returns (uint256 amountOut)
```

**设计特点：**
- 支持多池路径交换
- 实现滑点保护机制
- 使用回调模式处理代币转账
- 提供价格查询功能

## 合约间关联关系

### 1. 继承关系
```
PoolManager extends Factory
PositionManager extends ERC721
SwapRouter implements ISwapRouter, ISwapCallback
```

### 2. 依赖关系
```
Factory → Pool (创建)
PoolManager → Factory (继承)
PositionManager → PoolManager (依赖)
SwapRouter → PoolManager (依赖)
```

### 3. 交互流程

#### 池子创建流程：
1. 用户调用 `PoolManager.createAndInitializePoolIfNecessary()`
2. `PoolManager` 调用 `Factory.createPool()`
3. `Factory` 创建新的 `Pool` 合约
4. `Pool` 通过构造函数从 `Factory` 获取参数
5. 池子初始化价格

#### 流动性添加流程：
1. 用户调用 `PositionManager.mint()`
2. `PositionManager` 计算所需流动性
3. 调用 `Pool.mint()` 添加流动性
4. `Pool` 回调 `PositionManager.mintCallback()`
5. `PositionManager` 执行代币转账
6. 铸造 NFT 给用户

#### 代币交换流程：
1. 用户调用 `SwapRouter.exactInput()`
2. `SwapRouter` 调用 `Pool.swap()`
3. `Pool` 回调 `SwapRouter.swapCallback()`
4. `SwapRouter` 执行代币转账
5. 返回交换结果

## 设计优势

### 1. 模块化设计
- 每个合约职责单一，便于维护和升级
- 通过接口定义清晰的交互规范
- 支持独立部署和升级

### 2. 集中流动性
- 相比 Uniswap V2 的全价格区间流动性，V3 允许 LP 在特定价格区间提供流动性
- 提高资本效率，LP 可以获得更高的手续费收益
- 支持多个费率等级（0.05%, 0.3%, 1%）

### 3. NFT 流动性头寸
- 每个流动性头寸对应一个 NFT
- 便于管理和交易流动性头寸
- 支持复杂的流动性策略

### 4. 回调模式
- 使用回调模式处理代币转账，提高安全性
- 避免重入攻击
- 支持复杂的交换逻辑

### 5. 价格发现机制
- 使用 Q64.96 格式存储价格，精度高
- 通过 tick 系统管理价格区间
- 支持价格限制和滑点保护

## 技术特点

### 1. 安全性
- 使用 `staticcall` 安全获取代币余额
- 实现权限控制和访问限制
- 使用 SafeMath 库防止溢出

### 2.  Gas 优化
- 使用 `immutable` 关键字减少存储读取
- 优化数据结构减少存储成本
- 使用内联汇编优化关键计算

### 3. 可扩展性
- 支持多池路径交换
- 可扩展的费率系统
- 模块化的接口设计

## 使用场景

### 1. 流动性提供
- LP 可以选择价格区间提供流动性
- 获得交易手续费收益
- 管理多个流动性头寸

### 2. 代币交换
- 支持精确输入和精确输出交换
- 多池路径优化
- 滑点保护

### 3. 价格查询
- 实时价格查询
- 交换数量预估
- 手续费计算

## 总结

这个 DEX 项目采用了 Uniswap V3 的成熟架构，通过模块化设计实现了完整的去中心化交易所功能。主要优势包括：

1. **高效资本利用**：集中流动性机制提高资本效率
2. **灵活的价格区间**：LP 可以选择最优的价格区间
3. **NFT 流动性头寸**：便于管理和交易流动性
4. **模块化架构**：便于维护和升级
5. **安全性**：多重安全机制保护用户资产

该架构为构建现代化的 DEX 提供了坚实的基础，支持复杂的 DeFi 应用场景。
