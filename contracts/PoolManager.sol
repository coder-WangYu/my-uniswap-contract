// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8;

import "./Factory.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolManager.sol";

contract PoolManager is Factory, IPoolManager {
    Pair[] public pairs; // 存储币对，默认提供的getter方法需要传入index，仅能获取某个成员，所以需要getPairs方法返回整个数组
    function getPairs() external view override returns (Pair[] memory) {
        return pairs;
    }

    function getAllPools()
        external
        view
        override
        returns (PoolInfo[] memory poolsInfo)
    {
        // 获得所有流动池pool的数量
        uint32 length = 0;
        for (uint i = 0; i < pairs.length; i++) {
            length += uint32(pools[pairs[i].token0][pairs[i].token1].length); // pools继承于Factory合约
        }

        // 填充每个流动池pool的数据
        poolsInfo = new PoolInfo[](length); // 创建长度为length的PoolInfop[]
        uint index = 0; // 记录当前插入的位置

        for (uint i = 0; i < pairs.length; i++) {
            address[] memory poolsAddress = pools[pairs[i].token0][
                pairs[i].token1
            ]; // [pool1, pool2, pool3, ...]

            for (uint j = 0; j < poolsAddress.length; j++) {
                IPool pool = IPool(poolsAddress[j]);

                poolsInfo[index] = PoolInfo({
                    pool: poolsAddress[j],
                    token0: pool.token0(),
                    token1: pool.token1(),
                    index: uint32(j),
                    fee: pool.fee(),
                    feeProtocol: 0,
                    tickLower: pool.tickLower(),
                    tickUpper: pool.tickUpper(),
                    tick: pool.tick(),
                    sqrtPriceX96: pool.sqrtPriceX96(),
                    liquidity: pool.liquidity()
                });

                index++;
            }
        }

        return poolsInfo;
    }

	// 调试和初始化参数
    function createAndInitializePoolIfNecessary(
        CreateAndInitializeParams calldata params
    ) external payable override returns (address poolAddress) {
        require(params.token0 < params.token1, "token0 must be less than token1");

        poolAddress = this.createPool(
            params.token0,
            params.token1,
            params.tickLower,
            params.tickUpper,
            params.fee
        );

        IPool pool = IPool(poolAddress);

        uint256 index = pools[pool.token0()][pool.token1()].length;

        // 新创建的池子，没有初始化价格，需要初始化价格
        if (pool.sqrtPriceX96() == 0) {
            pool.initialize(params.sqrtPriceX96);

            if (index == 1) {
                // 如果是第一次添加该交易对，需要记录
                pairs.push(
                    Pair({token0: pool.token0(), token1: pool.token1()})
                );
            }
        }
    }
}
