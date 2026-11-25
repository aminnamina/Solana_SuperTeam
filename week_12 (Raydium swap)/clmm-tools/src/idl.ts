import { Idl } from "@coral-xyz/anchor";

export const SECURITY_VAULT_PROGRAM_ID = "CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP";

export const SECURITY_VAULT_IDL: Idl = {
  address: SECURITY_VAULT_PROGRAM_ID,
  metadata: {
    name: "security_vault",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Security Vault with Raydium CLMM Swap CPI",
  },
  instructions: [
    {
      name: "initialize_vault",
      discriminator: [48, 191, 163, 44, 71, 129, 63, 164],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "vault", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "withdraw",
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34],
      accounts: [
        { name: "vault", writable: true },
        { name: "authority", signer: true },
        { name: "recipient", writable: true },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "configure_swap_route",
      discriminator: [88, 56, 41, 241, 252, 92, 189, 31],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "vault", writable: true },
        { name: "pool_state" },
        { name: "vault_mint" },
        { name: "quote_mint" },
        { name: "swap_route", writable: true },
        { name: "quote_treasury", writable: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "execute_clmm_swap",
      discriminator: [58, 59, 57, 55, 172, 199, 168, 187],
      accounts: [
        { name: "authority", signer: true },
        { name: "vault", writable: true },
        { name: "swap_route" },
        { name: "pool_state", writable: true },
        { name: "amm_config" },
        { name: "base_treasury", writable: true },
        { name: "quote_treasury", writable: true },
        { name: "pool_vault_a", writable: true },
        { name: "pool_vault_b", writable: true },
        { name: "observation_state", writable: true },
        { name: "base_mint" },
        { name: "quote_mint" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "token_program_2022" },
        { name: "memo_program" },
        { name: "raydium_program" },
      ],
      args: [
        {
          name: "params",
          type: { defined: { name: "SwapParams" } },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "Vault",
      discriminator: [211, 8, 232, 43, 2, 152, 117, 119],
    },
    {
      name: "SwapRoute",
      discriminator: [196, 21, 176, 66, 90, 212, 230, 50],
    },
  ],
  events: [
    {
      name: "ClmmSwapExecuted",
      discriminator: [191, 22, 202, 89, 130, 164, 247, 223],
    },
  ],
  types: [
    {
      name: "Vault",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "SwapRoute",
      type: {
        kind: "struct",
        fields: [
          { name: "vault", type: "pubkey" },
          { name: "pool_state", type: "pubkey" },
          { name: "quote_mint", type: "pubkey" },
          { name: "quote_treasury", type: "pubkey" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "ClmmSwapExecuted",
      type: {
        kind: "struct",
        fields: [
          { name: "vault", type: "pubkey" },
          { name: "pool", type: "pubkey" },
          { name: "direction", type: { defined: { name: "SwapDirection" } } },
          { name: "amount_in", type: "u64" },
          { name: "min_amount_out", type: "u64" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
    {
      name: "SwapDirection",
      type: {
        kind: "enum",
        variants: [{ name: "BaseToQuote" }, { name: "QuoteToBase" }],
      },
    },
    {
      name: "SwapParams",
      type: {
        kind: "struct",
        fields: [
          { name: "direction", type: { defined: { name: "SwapDirection" } } },
          { name: "amount_in", type: "u64" },
          { name: "min_amount_out", type: "u64" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InsufficientFunds", msg: "Insufficient available lamports in vault." },
    { code: 6001, name: "InvalidPoolMints", msg: "Invalid pool mints: pool mints do not match vault and quote mints." },
    { code: 6002, name: "UnauthorizedPool", msg: "Unauthorized pool: pool does not match configured swap route." },
    { code: 6003, name: "ZeroSwapAmount", msg: "Zero swap amount: amount_in must be greater than zero." },
    { code: 6004, name: "SlippageExceeded", msg: "Slippage exceeded: output amount received is less than min_amount_out." },
  ],
};
