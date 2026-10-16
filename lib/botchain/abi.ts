/**
 * SplitterFactory's ABI, and the Splitter it deploys.
 *
 * Hand-written and `as const` rather than imported from `contracts/out`. The const assertion is
 * what gives viem and wagmi their argument and return types; a generated JSON artifact loses that
 * unless it is cast, and a mistyped argument would then only surface as a revert.
 */
export const splitterFactoryAbi = [
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payees", type: "address[]" },
      { name: "shares", type: "uint256[]" },
    ],
    outputs: [{ name: "splitter", type: "address" }],
  },
  {
    type: "event",
    name: "SplitterCreated",
    inputs: [
      { name: "splitter", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "payees", type: "address[]", indexed: false },
      { name: "shares", type: "uint256[]", indexed: false },
    ],
  },
] as const;

/** The deployed splitter. Validation errors surface from `create`, so they live here too. */
export const splitterAbi = [
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [],
  },
  { type: "function", name: "releaseAll", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "releasable",
    stateMutability: "view",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "payees",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "sharesOf",
    stateMutability: "view",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "releasedTo",
    stateMutability: "view",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "totalShares", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReleased", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReceived", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Released",
    inputs: [
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "NoPayees", inputs: [] },
  {
    type: "error",
    name: "LengthMismatch",
    inputs: [{ name: "payees", type: "uint256" }, { name: "shares", type: "uint256" }],
  },
  {
    type: "error",
    name: "TooManyPayees",
    inputs: [{ name: "count", type: "uint256" }, { name: "max", type: "uint256" }],
  },
  { type: "error", name: "ZeroPayee", inputs: [{ name: "index", type: "uint256" }] },
  { type: "error", name: "ZeroShares", inputs: [{ name: "index", type: "uint256" }] },
  { type: "error", name: "DuplicatePayee", inputs: [{ name: "payee", type: "address" }] },
  { type: "error", name: "NotAPayee", inputs: [{ name: "account", type: "address" }] },
  { type: "error", name: "NothingDue", inputs: [{ name: "payee", type: "address" }] },
  {
    type: "error",
    name: "PaymentFailed",
    inputs: [{ name: "payee", type: "address" }, { name: "amount", type: "uint256" }],
  },
] as const;
