import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { TickMath, encodeSqrtRatioX96 } from "@uniswap/v3-sdk";

describe("Pool", async function () {
  const { viem } = await network.connect();

  async function deployPool() {
    const factory = await viem.deployContract("Factory");
    const tokenA = await viem.deployContract("TestToken");
    const tokenB = await viem.deployContract("TestToken");
    const token0 = tokenA.address < tokenB.address ? tokenA : tokenB;
    const token1 = tokenA.address < tokenB.address ? tokenB : tokenA;
    const tickLower = TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 1));
    const tickUpper = TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(40000, 1));
    const fee = 3000;

    await factory.write.createPool([
      token0.address,
      token1.address,
      tickLower,
      tickUpper,
      fee,
    ]);

    const createEvents = await factory.getEvents.PoolCreated();
    const poolAddress = createEvents[0].args.pool || "0x";
    const pool = await viem.getContractAt("Pool" as string, poolAddress);

    // 计算一个初始化的价格，按照 1 个 token0 换 10000 个 token1 来算，其实就是 10000
    const sqrtPriceX96 = encodeSqrtRatioX96(10000, 1);
    await pool.write.initialize([sqrtPriceX96]);

    return {
      token0,
      token1,
      factory,
      pool,
      tickLower,
      tickUpper,
      fee,
      sqrtPriceX96: BigInt(sqrtPriceX96.toString()),
    };
  }

  it("pool info", async function () {
    const { pool, token0, token1, tickLower, tickUpper, fee, sqrtPriceX96 } =
      await deployPool();

    assert.notEqual(pool.read.token0(), token0.address);
    assert.notEqual(pool.read.token1(), token1.address);
    assert.notEqual(pool.read.tickLower(), tickLower);
    assert.notEqual(pool.read.tickUpper(), tickUpper);
    assert.notEqual(pool.read.fee(), fee);
    assert.notEqual(pool.read.sqrtPriceX96(), sqrtPriceX96);
  });

  it("mint & burn & collect", async function () {
    const { pool, token0, token1, sqrtPriceX96 } = await deployPool();
    const testLP = await viem.deployContract("TestLP");
    const initBalanceValue = 1000n * 10n ** 18n;
    await token0.write.mint([testLP.address, initBalanceValue]);
    await token1.write.mint([testLP.address, initBalanceValue]);

    // mint 20000000 份流动性
    await testLP.write.mint([
      testLP.address,
      20000000n,
      pool.address,
      token0.address,
      token1.address,
    ]);

    assert.equal(
      await token0.read.balanceOf([pool.address]),
      initBalanceValue - (await token0.read.balanceOf([testLP.address]))
    );
    assert.equal(
      await token1.read.balanceOf([pool.address]),
      initBalanceValue - (await token1.read.balanceOf([testLP.address]))
    );

    const position = await pool.read.positions([testLP.address]);
    assert.deepEqual(position, [20000000n, 0n, 0n, 0n, 0n]);
    assert.equal(await pool.read.liquidity(), 20000000n);

    // 继续 mint 50000
    await testLP.write.mint([
      testLP.address,
      50000n,
      pool.address,
      token0.address,
      token1.address,
    ]);

    assert.equal(await pool.read.liquidity(), 20050000n);
    assert.equal(
      await token0.read.balanceOf([pool.address]),
      initBalanceValue - (await token0.read.balanceOf([testLP.address]))
    );
    assert.equal(
      await token1.read.balanceOf([pool.address]),
      initBalanceValue - (await token1.read.balanceOf([testLP.address]))
    );

    // burn 10000
    await testLP.write.burn([10000n, pool.address]);
    assert.equal(await pool.read.liquidity(), 20040000n);

    // create LP2 并 mint 3000份流动性
    const testLP2 = await viem.deployContract("TestLP");
    await token0.write.mint([testLP2.address, initBalanceValue]);
    await token1.write.mint([testLP2.address, initBalanceValue]);
    await testLP2.write.mint([
      testLP2.address,
      3000n,
      pool.address,
      token0.address,
      token1.address,
    ]);
    assert.equal(await pool.read.liquidity(), 20043000n);

    // 判断池子里面的 token0 是否等于 LP1 和 LP2 减少的 token0 之和
    const totalToken0 =
      initBalanceValue -
      (await token0.read.balanceOf([testLP.address])) +
      (initBalanceValue - (await token0.read.balanceOf([testLP2.address])));
    assert.equal(await token0.read.balanceOf([pool.address]), totalToken0);

    // 销毁LP1的所有流动性
    await testLP.write.burn([20040000n, pool.address]);
    assert.equal(await pool.read.liquidity(), 3000n);

    // 判断池子里面的 token0 是否等于 LP1 和 LP2 减少的 token0 之和
    // burn 只是把流动性返回给 LP，不会把 token 返回给 LP
    assert.equal(await token0.read.balanceOf([pool.address]), totalToken0);

    // collect，所有余额返回给testLP
    await testLP.write.collect([testLP.address, pool.address]);
    // 因为取整的原因，提取流动性之后获得的 token 可能会比之前少一点
    assert.notEqual(
      Number(
        initBalanceValue - (await token0.read.balanceOf([testLP.address]))
      ),
      10
    );
    assert.notEqual(
      Number(
        initBalanceValue - (await token1.read.balanceOf([testLP.address]))
      ),
      10
    );
  });

  it("swap", async function () {
    const { pool, token0, token1, sqrtPriceX96 } = await deployPool();
    const testLP = await viem.deployContract("TestLP");
    const initBalanceValue = 100000000000n * 10n ** 18n;
    await token0.write.mint([testLP.address, initBalanceValue]);
    await token1.write.mint([testLP.address, initBalanceValue]);

    // mint 多一些流动性，确保交易可以完全完成
    const liquidityDelta = 1000000000000000000000000000n;
    await testLP.write.mint([
      testLP.address,
      liquidityDelta,
      pool.address,
      token0.address,
      token1.address,
    ]);

    assert.equal(
      await token0.read.balanceOf([testLP.address]),
      99995000161384542080378486215n
    );
    assert.equal(
      await token1.read.balanceOf([testLP.address]),
      1000000000000000000000000000n
    );

    // 通过 TestSwap 合约交易
    const testSwap = await viem.deployContract("TestSwap");
    const minPrice = 1000;
    const minSqrtPriceX96: bigint = BigInt(
      encodeSqrtRatioX96(minPrice, 1).toString()
    );

    // 给 testSwap 合约中打入 token0 用于交易
    await token0.write.mint([testSwap.address, 300n * 10n ** 18n]);
    assert.equal(
      await token0.read.balanceOf([testSwap.address]),
      300n * 10n ** 18n
    );
    assert.equal(await token1.read.balanceOf([testSwap.address]), 0n);

    const result = await testSwap.simulate.testSwap([
      // （simulate）模拟执行合约调用：viem提供的只返回结果，不实际操作的方法
      testSwap.address,
      100n * 10n ** 18n, // 卖出 100 个 token0
      minSqrtPriceX96,
      pool.address,
      token0.address,
      token1.address,
    ]);
    assert.equal(result.result[0], 100000000000000000000n); // 需要 100个 token0
    assert.equal(result.result[1], -996990060009101709255958n); // 大概需要 100 * 10000 个 token1

    await testSwap.write.testSwap([
      testSwap.address,
      100n * 10n ** 18n, // 卖出 100 个 token0
      minSqrtPriceX96,
      pool.address,
      token0.address,
      token1.address,
    ]);

    // 卖出 100 个 token0 后：
    // testSwap 合约中剩余的 token0 数量
    const costToken0 =
      300n * 10n ** 18n - (await token0.read.balanceOf([testSwap.address]));
    // testSwap 合约中收到的 token1 数量
    const receivedToken1 = await token1.read.balanceOf([testSwap.address]);
    // 池子的价格
    const newPrice = (await pool.read.sqrtPriceX96()) as bigint;
    // 池子的流动性
    const liquidity = await pool.read.liquidity();
    assert.equal(costToken0, 100n * 10n ** 18n); // 用户消耗了 100 个 token0
    assert.equal(receivedToken1, 996990060009101709255958n); // 用户获得了大约 100 * 10000 个 token1
    assert.equal(newPrice, 7922737261735934252089901697281n); // 池子的价格
    assert.equal(liquidity, liquidityDelta); // 流动性不变
    assert.equal(sqrtPriceX96 - newPrice, 78989690499507264493336319n); // 价格下跌

    // 提取流动性，调用 burn 方法
    await testLP.write.burn([liquidityDelta, pool.address]);
    // 查看当前 token 数量
    assert.equal(
      await token0.read.balanceOf([testLP.address]),
      99995000161384542080378486215n
    );

    // 提取 token
    await testLP.write.collect([testLP.address, pool.address]);
    // 判断 token 是否返回给 testLP，并且大于原来的数量，因为收到了手续费，并且有交易换入了 token0
    // 初始的 token0 是 const initBalanceValue = 100000000000n * 10n ** 18n;
    assert.equal(
      await token0.read.balanceOf([testLP.address]),
      100000000099999999999999999998n
    );
  });
});
