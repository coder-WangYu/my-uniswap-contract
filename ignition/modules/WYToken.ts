import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const WYTokenModule = buildModule("WYToken", (m) => {
  const WYTokenA = m.contract("WYToken", ["WYToken A", "AWY"], {
    id: "WYTokenA",
  });
  const WYTokenB = m.contract("WYToken", ["WYToken B", "BWY"], {
    id: "WYTokenB",
  });
  const WYTokenC = m.contract("WYToken", ["WYToken C", "CWY"], {
    id: "WYTokenC",
  });
  const WYTokenD = m.contract("WYToken", ["WYToken D", "DWY"], {
    id: "WYTokenD",
  });
  const WYTokenE = m.contract("WYToken", ["WYToken E", "EWY"], {
    id: "WYTokenE",
  });
  const WYTokenF = m.contract("WYToken", ["WYToken F", "FWY"], {
    id: "WYTokenF",
  });
  const WYTokenG = m.contract("WYToken", ["WYToken G", "GWY"], {
    id: "WYTokenG",
  });
  const WYTokenH = m.contract("WYToken", ["WYToken H", "HWY"], {
    id: "WYTokenH",
  });
  const WYTokenI = m.contract("WYToken", ["WYToken I", "IWY"], {
    id: "WYTokenI",
  });
  const WYTokenJ = m.contract("WYToken", ["WYToken J", "JWY"], {
    id: "WYTokenJ",
  });

  return {
    WYTokenA,
    WYTokenB,
    WYTokenC,
    WYTokenD,
    WYTokenE,
    WYTokenF,
    WYTokenG,
    WYTokenH,
    WYTokenI,
    WYTokenJ,
  };
});

export default WYTokenModule;