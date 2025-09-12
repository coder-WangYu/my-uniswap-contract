import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { TickMath, encodeSqrtRatioX96 } from "@uniswap/v3-sdk";

describe("PoolManager", async function () {
  const { viem } = await network.connect();

  async function deployPoolManager() {
    const manager = await viem.deployContract("PoolManager");

    return manager;
  }

  it("getPairs & getAllPools", async function () {
    const manager = await deployPoolManager();
    const tokenA: `0x${string}` = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    const tokenB: `0x${string}` = "0xEcd0D12E21805803f70de03B72B1C162dB0898d9";
    const tokenC: `0x${string}` = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const tokenD: `0x${string}` = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

    // 创建 tokenA-tokenB
    await manager.write.createAndInitializePoolIfNecessary([
      {
        token0: tokenA,
        token1: tokenB,
        fee: 3000,
        tickLower: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 1)),
        tickUpper: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(10000, 1)),
        sqrtPriceX96: BigInt(encodeSqrtRatioX96(100, 1).toString()),
      },
    ]);

    // 由于和前一个参数一样，会被合并
    await manager.write.createAndInitializePoolIfNecessary([
      {
        token0: tokenA,
        token1: tokenB,
        fee: 3000,
        tickLower: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 1)),
        tickUpper: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(10000, 1)),
        sqrtPriceX96: BigInt(encodeSqrtRatioX96(100, 1).toString()),
      },
    ]);

    // 创建 tokenC-tokenD
    await manager.write.createAndInitializePoolIfNecessary([
      {
        token0: tokenC,
        token1: tokenD,
        fee: 2000,
        tickLower: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(100, 1)),
        tickUpper: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(5000, 1)),
        sqrtPriceX96: BigInt(encodeSqrtRatioX96(200, 1).toString()),
      },
    ]);

    // 判断返回的 pairs 的数量是否正确
    const pairs = await manager.read.getPairs();
    assert.equal(pairs.length, 2);

    // 判断返回的 pools 的数量、参数是否正确
    // pools: tokenA => tokenB => [p1, p2, p3, ...]
    const pools = await manager.read.getAllPools();
    assert.equal(pools.length, 2);
    assert.equal(pools[0].token0, tokenA);
    assert.equal(pools[0].token1, tokenB);
    assert.equal(
      pools[0].sqrtPriceX96,
      BigInt(encodeSqrtRatioX96(100, 1).toString())
    );
    assert.equal(pools[1].token0, tokenC);
    assert.equal(pools[1].token1, tokenD);
    assert.equal(
      pools[1].sqrtPriceX96,
      BigInt(encodeSqrtRatioX96(200, 1).toString())
    );
  });

  it("require token0 < token1", async function () {
    const manager = await deployPoolManager();
    const tokenA: `0x${string}` = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    const tokenB: `0x${string}` = "0xEcd0D12E21805803f70de03B72B1C162dB0898d9";

    await assert.rejects(
      manager.write.createAndInitializePoolIfNecessary([
        {
          token0: tokenB,
          token1: tokenA,
          fee: 3000,
          tickLower: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 1)),
          tickUpper: TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(10000, 1)),
          sqrtPriceX96: BigInt(encodeSqrtRatioX96(100, 1).toString()),
        },
      ])
    )
  });
});
