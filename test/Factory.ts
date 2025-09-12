import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Factory", async function () {
  const { viem } = await network.connect();
  
  it("Deploy Factory", async function () {
    const factory = await viem.deployContract("Factory");
    const address = factory.address;

    assert.notEqual(address, "0x0000000000000000000000000000000000000000");
  });

  it("Create Pool", async function () {
    const factory = await viem.deployContract("Factory");
    
    // 部署两个测试代币（TestToken 构造函数不需要参数）
    const tokenA = await viem.deployContract("TestToken");
    const tokenB = await viem.deployContract("TestToken");
    
    // 池子参数
    const tickLower = 1;
    const tickUpper = 1000000;
    const fee = 3000; // 0.3%
    
    // 创建池子
    const poolAddress = await factory.write.createPool([
      tokenA.address,
      tokenB.address,
      tickLower,
      tickUpper,
      fee
    ]);
    
    // 验证池子地址不为零地址
    assert.notEqual(poolAddress, "0x0000000000000000000000000000000000000000");
  });

  it("Create Pool With Same Token", async function () {
    const factory = await viem.deployContract("Factory");
    const tokenA = await viem.deployContract("TestToken");
    
    const tickLower = 1;
    const tickUpper = 1000000;
    const fee = 3000;
    
    // 尝试用相同的代币创建池子，应该失败
    try {
      await factory.write.createPool([
        tokenA.address,
        tokenA.address,
        tickLower,
        tickUpper,
        fee
      ]);
      assert.fail("应该抛出错误");
    } catch (error: any) {
      assert.ok(error.message.includes("TokenA and TokenB cannot be the same"));
    }
  });
});