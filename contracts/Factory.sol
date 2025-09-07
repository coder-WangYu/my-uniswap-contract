// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "./interfaces/IFactory.sol";
import "./Pool.sol";

contract Factory is IFactory {
	// tokenA => tokenB => [pool1, pool2, pool3, ...]
    mapping(address => mapping(address => address[])) public pools;

	Parameters public override parameters;

    modifier differentTokens(address tokenA, address tokenB) {
        require(tokenA != tokenB, "TokenA and TokenB cannot be the same");
        _;
    }

    function sortToken(
        address tokenA,
        address tokenB
    ) private pure returns (address, address) {
        return (tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA));
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint32 index
    ) external view override differentTokens(tokenA, tokenB) returns (address) {
		require(tokenA != address(0) && tokenB != address(0), "TokenA and TokenB cannot be the zero address");

        address token0;
        address token1;
        (token0, token1) = sortToken(tokenA, tokenB);

        return pools[token0][token1][index];
    }

	function createPool(
		address tokenA,
		address tokenB,
		int24 tickLower,
		int24 tickUpper,
		uint24 fee
	) external override differentTokens(tokenA, tokenB) returns (address pool) {
		address token0;
		address token1;

		(token0, token1) = sortToken(tokenA, tokenB);

		address[] memory existingPools = pools[token0][token1];

		for (uint i = 0; i < existingPools.length; i++) {
			IPool currentPool = IPool(existingPools[i]);
			
			if (currentPool.tickLower() == tickLower && 
				currentPool.tickUpper() == tickUpper && 
				currentPool.fee() == fee
			) {
				return existingPools[i];
			}
		}

		parameters = Parameters(
			address(this),
			token0,
			token1,
			tickLower,
			tickUpper,
			fee
		);

		bytes32 salt = keccak256(
			abi.encode(token0, token1, tickLower, tickUpper, fee)
		);

		pool = address(new Pool{salt: salt}());

		pools[token0][token1].push(pool);

		delete parameters; // 删除parameters，释放内存

		emit PoolCreated(
            token0,
            token1,
            uint32(existingPools.length),
            tickLower,
            tickUpper,
            fee,
            pool
        );
	}
}
