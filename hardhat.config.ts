import { configVariable } from "hardhat/config";
import type { HardhatUserConfig } from "hardhat/config";
import hardhatIgnitionViemPlugin from "@nomicfoundation/hardhat-ignition-viem";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";

const config: HardhatUserConfig = {
  // 插件配置
  plugins: [
    hardhatIgnitionViemPlugin,
    hardhatKeystore,
  ],
  
  // Solidity 配置
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  // 网络配置
  networks: {
    // 本地网络
    hardhat: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    
    // 测试网（使用 hardhat-keystore）
    sepolia: {
      type: "http",
      url: configVariable("SEPOLIA_RPC_URL") || "",
      accounts: configVariable("SEPOLIA_PRIVATE_KEY") ? [configVariable("SEPOLIA_PRIVATE_KEY")] : [],
      chainId: 11155111,
    },
  },

  // 验证配置（使用 hardhat-keystore）
  etherscan: {
    apiKey: configVariable("ETHERSCAN_API_KEY") || "",
  },
};

export default config;
