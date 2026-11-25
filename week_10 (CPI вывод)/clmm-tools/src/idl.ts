import { Idl } from "@coral-xyz/anchor";

export const SECURITY_VAULT_PROGRAM_ID = "CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP";

export const SECURITY_VAULT_IDL: Idl = {
  address: SECURITY_VAULT_PROGRAM_ID,
  metadata: {
    name: "security_vault",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Security Vault with Raydium CLMM Swap and Position Management CPI",
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
    {
      name: "mint_vault_position",
      discriminator: [150, 253, 172, 113, 165, 237, 228, 175],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "vault" },
        { name: "swap_route" },
        { name: "position_nft_mint", writable: true, signer: true },
        { name: "position_nft_account", writable: true },
        { name: "pool_state", writable: true },
        { name: "protocol_position", writable: true },
        { name: "tick_array_lower", writable: true },
        { name: "tick_array_upper", writable: true },
        { name: "personal_position", writable: true },
        { name: "token_account_0", writable: true },
        { name: "token_account_1", writable: true },
        { name: "base_treasury" },
        { name: "quote_treasury" },
        { name: "token_vault_0", writable: true },
        { name: "token_vault_1", writable: true },
        { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
        { name: "system_program", address: "11111111111111111111111111111111" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "associated_token_program", address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
        { name: "token_program_2022" },
        { name: "vault_mint_0" },
        { name: "vault_mint_1" },
        { name: "raydium_program" },
      ],
      args: [
        {
          name: "params",
          type: { defined: { name: "OpenPositionParams" } },
        },
      ],
    },
    {
      name: "harvest_position_fees",
      discriminator: [46, 84, 139, 110, 208, 120, 229, 33],
      accounts: [
        { name: "authority", signer: true },
        { name: "vault" },
        { name: "swap_route" },
        { name: "position_nft_account" },
        { name: "personal_position", writable: true },
        { name: "pool_state", writable: true },
        { name: "protocol_position", writable: true },
        { name: "token_vault_0", writable: true },
        { name: "token_vault_1", writable: true },
        { name: "tick_array_lower", writable: true },
        { name: "tick_array_upper", writable: true },
        { name: "token_account_0", writable: true },
        { name: "token_account_1", writable: true },
        { name: "base_treasury" },
        { name: "quote_treasury" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "token_program_2022" },
        { name: "memo_program" },
        { name: "vault_mint_0" },
        { name: "vault_mint_1" },
        { name: "raydium_program" },
      ],
      args: [],
    },
    {
      name: "withdraw_and_burn_position",
      discriminator: [237, 50, 190, 237, 179, 201, 139, 206],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "vault", writable: true },
        { name: "swap_route" },
        { name: "position_nft_mint", writable: true },
        { name: "position_nft_account", writable: true },
        { name: "personal_position", writable: true },
        { name: "pool_state", writable: true },
        { name: "protocol_position", writable: true },
        { name: "token_vault_0", writable: true },
        { name: "token_vault_1", writable: true },
        { name: "tick_array_lower", writable: true },
        { name: "tick_array_upper", writable: true },
        { name: "token_account_0", writable: true },
        { name: "token_account_1", writable: true },
        { name: "base_treasury" },
        { name: "quote_treasury" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "token_program_2022" },
        { name: "memo_program" },
        { name: "vault_mint_0" },
        { name: "vault_mint_1" },
        { name: "system_program", address: "11111111111111111111111111111111" },
        { name: "raydium_program" },
      ],
      args: [
        {
          name: "params",
          type: { defined: { name: "ClosePositionParams" } },
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
    {
      name: "VaultPositionOpened",
      discriminator: [66, 138, 25, 193, 57, 197, 128, 16],
    },
    {
      name: "VaultFeesHarvested",
      discriminator: [53, 1, 230, 129, 10, 76, 199, 13],
    },
    {
      name: "VaultPositionClosed",
      discriminator: [29, 144, 54, 42, 202, 25, 147, 214],
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
      name: "VaultPositionOpened",
      type: {
        kind: "struct",
        fields: [
          { name: "vault", type: "pubkey" },
          { name: "pool", type: "pubkey" },
          { name: "nft_mint", type: "pubkey" },
          { name: "tick_lower", type: "i32" },
          { name: "tick_upper", type: "i32" },
          { name: "liquidity", type: "u128" },
        ],
      },
    },
    {
      name: "VaultFeesHarvested",
      type: {
        kind: "struct",
        fields: [
          { name: "vault", type: "pubkey" },
          { name: "nft_mint", type: "pubkey" },
          { name: "timestamp", type: "i64" },
        ],
      },
    },
    {
      name: "VaultPositionClosed",
      type: {
        kind: "struct",
        fields: [
          { name: "vault", type: "pubkey" },
          { name: "nft_mint", type: "pubkey" },
          { name: "amount_0_min", "type": "u64" },
          { name: "amount_1_min", "type": "u64" },
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
    {
      name: "OpenPositionParams",
      type: {
        kind: "struct",
        fields: [
          { name: "tick_lower_index", type: "i32" },
          { name: "tick_upper_index", type: "i32" },
          { name: "tick_array_lower_start_index", type: "i32" },
          { name: "tick_array_upper_start_index", type: "i32" },
          { name: "liquidity", type: "u128" },
          { name: "amount_0_max", type: "u64" },
          { name: "amount_1_max", type: "u64" },
          { name: "with_metadata", type: "bool" },
          { name: "base_flag", type: { option: "bool" } },
        ],
      },
    },
    {
      name: "ClosePositionParams",
      type: {
        kind: "struct",
        fields: [
          { name: "amount_0_min", type: "u64" },
          { name: "amount_1_min", type: "u64" },
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
    { code: 6005, name: "InvalidTreasuryAccount", msg: "Invalid treasury account: position token accounts must belong to vault." },
    { code: 6006, name: "PoolMismatch", msg: "Pool mismatch: pool does not match configured swap route." },
    { code: 6007, name: "InvalidTickRange", msg: "Invalid tick range: tick_lower must be strictly less than tick_upper." },
    { code: 6008, name: "EmptyPosition", msg: "Empty position: personal position account is empty or uninitialized." },
  ],
};
