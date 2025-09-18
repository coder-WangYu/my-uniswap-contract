import { network } from "hardhat";
import { parseEther } from "viem";

async function main() {
  const { viem } = await network.connect("sepolia");
  const publicClient = await viem.getPublicClient();

  const tokenAddresses = [
    "0xc5C45CAe44dA4eD5F767d38ADBa00C7B56125fDa",
    "0x8F8d4529C06b9f8A8EA2049de9fcE5FBE99453CC",
    "0x330BdEE0cD752C73Df7B6EeE46fE9b5aCd4956F3",
    "0x28382072E60e84dfc208687Ebc4b5C1127A1652A",
    "0xF95395dCC008E5f9958D3482706F5fD83CF5e5Ea",
    "0xa627E7092412D7CFe284B4c09F09eD1547eB639C",
    "0x5fC1d5b191aF9C0b9f46037fb9A98b84caec26A8",
    "0xCCeFC1495e7454558ee8F018bC7A87b7b8a68B6e",
    "0x821c270Fa1AAd2f4594DDE747Ab6C5e2EabCF9af",
    "0x8c30Bb23D47AD913CFe0fa38fDF68a325C459714",
  ];

  const clients = [
    "0x2c583CE39EDd48F0a2BAf2Affbab1B50437b13ce",
    "0xcbCf19c8eBF586Cec0b5136Df5BE62096a20BE70",
    "0x632A9BBd66c375624e40254324038dE119Ed505e",
  ];

  const recipient = "0x1b4692Bd0EB88cB0a0C5F0E4f6950FA30F6db94a";

  const approveAmount = parseEther("10000");

  for (let i = 0; i < tokenAddresses.length; i++) {
    const tokenAddress = tokenAddresses[i] as `0x${string}`;

    try {
      const curToken = await viem.getContractAt("WYToken", tokenAddress);

      // 获取代币信息
      const name = await curToken.read.name();
      const symbol = await curToken.read.symbol();
      console.log(`\n✅ 处理代币: ${name} (${symbol})`);

      // 每个客户端（钱包用户）调用 approve
      for (let j = 0; j < clients.length; j++) {
        const clientAddress = clients[j];

        // 使用客户端地址作为交易发送者
        const txHash = await curToken.write.approve(
          [recipient, approveAmount],
          { from: clientAddress } // 指定交易发送者
        );

        console.log(txHash)
      }
    } catch (error: any) {
      console.log(`❌ 处理地址 ${tokenAddress} 时出错:`, error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
