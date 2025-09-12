import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { TickMath, encodeSqrtRatioX96 } from "@uniswap/v3-sdk";

describe("PositionManager", async function () {
  const { viem } = await network.connect();

  async function deployPositionManager() {
    // 初始化一个池子，价格上限是 40000，下限是 1，初始化价格是 10000，费率是 0.3%
    const poolManager = await viem.deployContract("PoolManager");
    const tokenA = await viem.deployContract("TestToken");
    const tokenB = await viem.deployContract("TestToken");
    const token0 = tokenA.address < tokenB.address ? tokenA : tokenB;
    const token1 = tokenA.address < tokenB.address ? tokenB : tokenA;
    const tickLower = TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 1));
    const tickUpper = TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(40000, 1));
    const fee = 3000;

    const [owner] = await viem.getWalletClients();
    const [sender] = await owner.getAddresses();

    await poolManager.write.createAndInitializePoolIfNecessary([
      {
        token0: token0.address,
        token1: token1.address,
        tickLower: tickLower,
        tickUpper: tickUpper,
        fee,
        sqrtPriceX96: BigInt(encodeSqrtRatioX96(10000, 1).toString()),
      },
    ]);

    const createEvents = await poolManager.getEvents.PoolCreated();
    const poolAddress: `0x${string}` = createEvents[0].args.pool || "0x";
    const pool = await viem.getContractAt("Pool" as string, poolAddress);

    const manager = await viem.deployContract("PositionManager", [
      poolManager.address,
    ]);

    return {
      token0,
      token1,
      manager,
      poolManager,
      sender,
      pool,
    };
  }

  it("mint && burn && collect", async function () {
    const { manager, sender, token0, token1, pool } = await deployPositionManager();

    // 先给 sender 打钱
    const initBalanceValue = 1000n * 10n ** 18n;
    await token0.write.mint([sender, initBalanceValue]);
    await token1.write.mint([sender, initBalanceValue]);

    // sennder把 token0 和 token1 代币的使用权转移给 positionManager
    await token0.write.approve([manager.address, initBalanceValue]);
    await token1.write.approve([manager.address, initBalanceValue]);

    // mint ERC721 生成头寸
    await manager.write.mint([
      {
        token0: token0.address,
        token1: token1.address,
        index: 0,
        recipient: sender,
        amount0Desired: 1000n * 10n ** 18n,
        amount1Desired: 1000n * 10n ** 18n,
        deadline: BigInt(Date.now() + 3000),
      },
    ]);

    // mint 成功，检查余额
    assert.equal(
      await token0.read.balanceOf([sender]),
      999949496579641839195n
    );
    assert.equal(
      await token0.read.balanceOf([pool.address]),
      50503420358160805n
    );
    // sender 收到了 NFT
    assert.equal(await manager.read.ownerOf([1n]), sender);

    // burn
    await manager.write.burn([1n]);
    // collet
    await manager.write.collect([1n, sender]);

    // 检查余额，因为取整的问题，所以可能会有一点损耗
    assert.equal(
      await token0.read.balanceOf([sender]),
      999999999999999999999n
    );
  });

  it("collet with fee", async function () {
    const { pool, token0, token1, manager, sender } = await deployPositionManager();
    const initBalanceValue = 100000000000n * 10n ** 18n;
    await token0.write.mint([sender, initBalanceValue]);
    await token1.write.mint([sender, initBalanceValue]);

    // sender approve manager
    await token0.write.approve([manager.address, initBalanceValue]);
    await token1.write.approve([manager.address, initBalanceValue]);

    // mint 多一些流动性，确保交易可以完全完成
    await manager.write.mint([
      {
        token0: token0.address,
        token1: token1.address,
        index: 0,
        recipient: sender,
        amount0Desired: initBalanceValue - 1000n * 10n ** 18n,
        amount1Desired: initBalanceValue - 1000n * 10n ** 18n,
        deadline: BigInt(Date.now() + 3000),
      },
    ]);

    // mint anthor 1000
    await manager.write.mint([
      {
        token0: token0.address,
        token1: token1.address,
        index: 0,
        recipient: sender,
        amount0Desired: 1000n * 10n ** 18n,
        amount1Desired: 1000n * 10n ** 18n,
        deadline: BigInt(Date.now() + 3000),
      },
    ]);

    // 通过 TestSwap 合约交易
    const testSwap = await viem.deployContract("TestSwap");
    const minPrice = 1000;
    const minSqrtPriceX96: bigint = BigInt(
      encodeSqrtRatioX96(minPrice, 1).toString()
    );

    // 给 testSwap 合约中打入 300 个 token0 用于交易
    await token0.write.mint([testSwap.address, 300n * 10n ** 18n]);
    await testSwap.write.testSwap([
      testSwap.address,
      100n * 10n ** 18n, // 卖出 100 个 token0
      minSqrtPriceX96,
      pool.address,
      token0.address,
      token1.address,
    ]);

    // 提取流动性，调用 burn 方法
    await manager.write.burn([1n]);
    await manager.write.burn([2n]);
    // 查看当前 token 数量
    assert.equal(
      await token0.read.balanceOf([sender]),
      99994949657964183919574228499n
    );

    // 提取 token
    await manager.write.collect([1n, sender]);
    // 判断 token 是否返回给 testLP，并且大于原来的数量，因为收到了手续费，并且有交易换入了 token0
    // 初始的 token0 是 const initBalanceValue = 100000000000n * 10n ** 18n;
    assert.equal(
      await token0.read.balanceOf([sender]),
      100000000099949495579641839194n
    );

    await manager.write.collect([2n, sender]);
    assert.equal(
      await token0.read.balanceOf([sender]),
      100000000099999999999999999997n
    );
  });
});
