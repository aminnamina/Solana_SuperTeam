use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Token, TokenAccount};

pub const RAYDIUM_CLMM_PROGRAM_ID: Pubkey =
    pubkey!("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH");

// Discriminators for Raydium CLMM instructions
pub const OPEN_POSITION_TOKEN22_DISCRIMINATOR: [u8; 8] = [77, 255, 174, 82, 125, 29, 201, 46];
pub const INCREASE_LIQUIDITY_V2_DISCRIMINATOR: [u8; 8] = [133, 29, 89, 223, 69, 238, 176, 10];
pub const DECREASE_LIQUIDITY_V2_DISCRIMINATOR: [u8; 8] = [58, 127, 188, 62, 79, 82, 196, 96];
pub const CLOSE_POSITION_DISCRIMINATOR: [u8; 8] = [123, 134, 81, 0, 49, 68, 98, 98];

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct OpenPositionParams {
    pub tick_lower_index: i32,
    pub tick_upper_index: i32,
    pub tick_array_lower_start_index: i32,
    pub tick_array_upper_start_index: i32,
    pub liquidity: u128,
    pub amount_0_max: u64,
    pub amount_1_max: u64,
    pub with_metadata: bool,
    pub base_flag: Option<bool>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ClosePositionParams {
    pub amount_0_min: u64,
    pub amount_1_min: u64,
}

#[event]
pub struct VaultPositionOpened {
    pub vault: Pubkey,
    pub pool: Pubkey,
    pub nft_mint: Pubkey,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
}

#[event]
pub struct VaultFeesHarvested {
    pub vault: Pubkey,
    pub nft_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultPositionClosed {
    pub vault: Pubkey,
    pub nft_mint: Pubkey,
    pub amount_0_min: u64,
    pub amount_1_min: u64,
}

#[derive(Accounts)]
pub struct MintVaultPosition<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, crate::Vault>,

    #[account(
        seeds = [b"swap_route", vault.key().as_ref()],
        bump = swap_route.bump,
        has_one = vault,
    )]
    pub swap_route: Account<'info, crate::raydium_swap::SwapRoute>,

    #[account(mut)]
    pub position_nft_mint: Signer<'info>,

    /// CHECK: Position NFT account owned by vault PDA
    #[account(mut)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: Pool state account
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: Protocol position PDA
    #[account(mut)]
    pub protocol_position: UncheckedAccount<'info>,

    /// CHECK: Tick array lower
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,

    /// CHECK: Tick array upper
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,

    /// CHECK: Personal position PDA
    #[account(mut)]
    pub personal_position: UncheckedAccount<'info>,

    /// CHECK: Vault token account A
    #[account(mut)]
    pub token_account_0: UncheckedAccount<'info>,

    /// CHECK: Vault token account B
    #[account(mut)]
    pub token_account_1: UncheckedAccount<'info>,

    /// CHECK: Base treasury
    pub base_treasury: Account<'info, TokenAccount>,

    /// CHECK: Quote treasury
    pub quote_treasury: Account<'info, TokenAccount>,

    /// CHECK: Pool token vault 0
    #[account(mut)]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: Pool token vault 1
    #[account(mut)]
    pub token_vault_1: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Token2022 program
    pub token_program_2022: UncheckedAccount<'info>,

    /// CHECK: Vault mint 0
    pub vault_mint_0: UncheckedAccount<'info>,

    /// CHECK: Vault mint 1
    pub vault_mint_1: UncheckedAccount<'info>,

    /// CHECK: Raydium CLMM program
    pub raydium_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct HarvestPositionFees<'info> {
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, crate::Vault>,

    #[account(
        seeds = [b"swap_route", vault.key().as_ref()],
        bump = swap_route.bump,
        has_one = vault,
    )]
    pub swap_route: Account<'info, crate::raydium_swap::SwapRoute>,

    /// CHECK: Position NFT account owned by vault PDA
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: Personal position PDA
    #[account(mut)]
    pub personal_position: UncheckedAccount<'info>,

    /// CHECK: Pool state account
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: Protocol position PDA
    #[account(mut)]
    pub protocol_position: UncheckedAccount<'info>,

    /// CHECK: Pool token vault 0
    #[account(mut)]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: Pool token vault 1
    #[account(mut)]
    pub token_vault_1: UncheckedAccount<'info>,

    /// CHECK: Tick array lower
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,

    /// CHECK: Tick array upper
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,

    /// CHECK: Vault token account 0
    #[account(mut)]
    pub token_account_0: UncheckedAccount<'info>,

    /// CHECK: Vault token account 1
    #[account(mut)]
    pub token_account_1: UncheckedAccount<'info>,

    /// CHECK: Base treasury
    pub base_treasury: Account<'info, TokenAccount>,

    /// CHECK: Quote treasury
    pub quote_treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    /// CHECK: Token2022 program
    pub token_program_2022: UncheckedAccount<'info>,
    /// CHECK: Memo program
    pub memo_program: UncheckedAccount<'info>,

    /// CHECK: Vault mint 0
    pub vault_mint_0: UncheckedAccount<'info>,

    /// CHECK: Vault mint 1
    pub vault_mint_1: UncheckedAccount<'info>,

    /// CHECK: Raydium CLMM program
    pub raydium_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawAndBurnPosition<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, crate::Vault>,

    #[account(
        seeds = [b"swap_route", vault.key().as_ref()],
        bump = swap_route.bump,
        has_one = vault,
    )]
    pub swap_route: Account<'info, crate::raydium_swap::SwapRoute>,

    /// CHECK: Position NFT mint
    #[account(mut)]
    pub position_nft_mint: UncheckedAccount<'info>,

    /// CHECK: Position NFT account owned by vault PDA
    #[account(mut)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: Personal position PDA
    #[account(mut)]
    pub personal_position: UncheckedAccount<'info>,

    /// CHECK: Pool state account
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: Protocol position PDA
    #[account(mut)]
    pub protocol_position: UncheckedAccount<'info>,

    /// CHECK: Pool token vault 0
    #[account(mut)]
    pub token_vault_0: UncheckedAccount<'info>,

    /// CHECK: Pool token vault 1
    #[account(mut)]
    pub token_vault_1: UncheckedAccount<'info>,

    /// CHECK: Tick array lower
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,

    /// CHECK: Tick array upper
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,

    /// CHECK: Vault token account 0
    #[account(mut)]
    pub token_account_0: UncheckedAccount<'info>,

    /// CHECK: Vault token account 1
    #[account(mut)]
    pub token_account_1: UncheckedAccount<'info>,

    /// CHECK: Base treasury
    pub base_treasury: Account<'info, TokenAccount>,

    /// CHECK: Quote treasury
    pub quote_treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    /// CHECK: Token2022 program
    pub token_program_2022: UncheckedAccount<'info>,
    /// CHECK: Memo program
    pub memo_program: UncheckedAccount<'info>,

    /// CHECK: Vault mint 0
    pub vault_mint_0: UncheckedAccount<'info>,

    /// CHECK: Vault mint 1
    pub vault_mint_1: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Raydium CLMM program
    pub raydium_program: UncheckedAccount<'info>,
}

pub fn handle_mint_vault_position<'info>(
    ctx: Context<'_, '_, '_, 'info, MintVaultPosition<'info>>,
    params: OpenPositionParams,
) -> Result<()> {
    require!(
        params.tick_lower_index < params.tick_upper_index,
        crate::VaultError::InvalidTickRange
    );
    require!(
        ctx.accounts.pool_state.key() == ctx.accounts.swap_route.pool_state,
        crate::VaultError::PoolMismatch
    );
    require!(
        ctx.accounts.raydium_program.key() == RAYDIUM_CLMM_PROGRAM_ID,
        crate::VaultError::PoolMismatch
    );

    let is_valid_treasuries = (ctx.accounts.token_account_0.key() == ctx.accounts.base_treasury.key()
        && ctx.accounts.token_account_1.key() == ctx.accounts.quote_treasury.key())
        || (ctx.accounts.token_account_0.key() == ctx.accounts.quote_treasury.key()
            && ctx.accounts.token_account_1.key() == ctx.accounts.base_treasury.key());
    require!(is_valid_treasuries, crate::VaultError::InvalidTreasuryAccount);

    // --- STEP A: open_position_with_token22_nft (empty position) ---
    // Layout: s32, s32, s32, s32, u128, u64, u64, bool, u8, bool
    let mut step_a_data = Vec::with_capacity(8 + 4 + 4 + 4 + 4 + 16 + 8 + 8 + 1 + 1 + 1);
    step_a_data.extend_from_slice(&OPEN_POSITION_TOKEN22_DISCRIMINATOR);
    step_a_data.extend_from_slice(&params.tick_lower_index.to_le_bytes());
    step_a_data.extend_from_slice(&params.tick_upper_index.to_le_bytes());
    step_a_data.extend_from_slice(&params.tick_array_lower_start_index.to_le_bytes());
    step_a_data.extend_from_slice(&params.tick_array_upper_start_index.to_le_bytes());
    step_a_data.extend_from_slice(&0u128.to_le_bytes()); // liquidity = 0
    step_a_data.extend_from_slice(&0u64.to_le_bytes());   // amount_0_max = 0
    step_a_data.extend_from_slice(&0u64.to_le_bytes());   // amount_1_max = 0
    step_a_data.push(if params.with_metadata { 1 } else { 0 });
    let (opt_base, base_val) = match params.base_flag {
        Some(b) => (1u8, if b { 1u8 } else { 0u8 }),
        None => (0u8, 0u8),
    };
    step_a_data.push(opt_base);
    step_a_data.push(base_val);

    let mut step_a_accounts = vec![
        AccountMeta::new(ctx.accounts.authority.key(), true), // payer (admin signs & pays rent)
        AccountMeta::new_readonly(ctx.accounts.vault.key(), false), // position_nft_owner (vault PDA)
        AccountMeta::new(ctx.accounts.position_nft_mint.key(), true), // position_nft_mint (signer)
        AccountMeta::new(ctx.accounts.position_nft_account.key(), false),
        AccountMeta::new(ctx.accounts.pool_state.key(), false),
        AccountMeta::new(ctx.accounts.protocol_position.key(), false),
        AccountMeta::new(ctx.accounts.tick_array_lower.key(), false),
        AccountMeta::new(ctx.accounts.tick_array_upper.key(), false),
        AccountMeta::new(ctx.accounts.personal_position.key(), false),
        AccountMeta::new(ctx.accounts.token_account_0.key(), false),
        AccountMeta::new(ctx.accounts.token_account_1.key(), false),
        AccountMeta::new(ctx.accounts.token_vault_0.key(), false),
        AccountMeta::new(ctx.accounts.token_vault_1.key(), false),
        AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
        AccountMeta::new_readonly(ctx.accounts.vault_mint_0.key(), false),
        AccountMeta::new_readonly(ctx.accounts.vault_mint_1.key(), false),
    ];

    for acc in ctx.remaining_accounts.iter() {
        step_a_accounts.push(AccountMeta {
            pubkey: acc.key(),
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        });
    }

    let step_a_ix = Instruction {
        program_id: RAYDIUM_CLMM_PROGRAM_ID,
        accounts: step_a_accounts,
        data: step_a_data,
    };

    let mut step_a_infos = vec![
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.position_nft_mint.to_account_info(),
        ctx.accounts.position_nft_account.to_account_info(),
        ctx.accounts.pool_state.to_account_info(),
        ctx.accounts.protocol_position.to_account_info(),
        ctx.accounts.tick_array_lower.to_account_info(),
        ctx.accounts.tick_array_upper.to_account_info(),
        ctx.accounts.personal_position.to_account_info(),
        ctx.accounts.token_account_0.to_account_info(),
        ctx.accounts.token_account_1.to_account_info(),
        ctx.accounts.token_vault_0.to_account_info(),
        ctx.accounts.token_vault_1.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.associated_token_program.to_account_info(),
        ctx.accounts.token_program_2022.to_account_info(),
        ctx.accounts.vault_mint_0.to_account_info(),
        ctx.accounts.vault_mint_1.to_account_info(),
    ];
    step_a_infos.extend(ctx.remaining_accounts.iter().cloned());

    invoke(&step_a_ix, &step_a_infos)?;

    // --- STEP B: increase_liquidity_v2 (funded from vault PDA) ---
    if params.liquidity > 0 {
        let mut step_b_data = Vec::with_capacity(8 + 16 + 8 + 8 + 1 + 1);
        step_b_data.extend_from_slice(&INCREASE_LIQUIDITY_V2_DISCRIMINATOR);
        step_b_data.extend_from_slice(&params.liquidity.to_le_bytes());
        step_b_data.extend_from_slice(&params.amount_0_max.to_le_bytes());
        step_b_data.extend_from_slice(&params.amount_1_max.to_le_bytes());
        step_b_data.push(opt_base);
        step_b_data.push(base_val);

        let mut step_b_accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.vault.key(), true), // position_nft_owner (signer via PDA seeds)
            AccountMeta::new_readonly(ctx.accounts.position_nft_account.key(), false),
            AccountMeta::new(ctx.accounts.pool_state.key(), false),
            AccountMeta::new(ctx.accounts.protocol_position.key(), false),
            AccountMeta::new(ctx.accounts.personal_position.key(), false),
            AccountMeta::new(ctx.accounts.tick_array_lower.key(), false),
            AccountMeta::new(ctx.accounts.tick_array_upper.key(), false),
            AccountMeta::new(ctx.accounts.token_account_0.key(), false),
            AccountMeta::new(ctx.accounts.token_account_1.key(), false),
            AccountMeta::new(ctx.accounts.token_vault_0.key(), false),
            AccountMeta::new(ctx.accounts.token_vault_1.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
            AccountMeta::new_readonly(ctx.accounts.vault_mint_0.key(), false),
            AccountMeta::new_readonly(ctx.accounts.vault_mint_1.key(), false),
        ];

        for acc in ctx.remaining_accounts.iter() {
            step_b_accounts.push(AccountMeta {
                pubkey: acc.key(),
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            });
        }

        let step_b_ix = Instruction {
            program_id: RAYDIUM_CLMM_PROGRAM_ID,
            accounts: step_b_accounts,
            data: step_b_data,
        };

        let mut step_b_infos = vec![
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.position_nft_account.to_account_info(),
            ctx.accounts.pool_state.to_account_info(),
            ctx.accounts.protocol_position.to_account_info(),
            ctx.accounts.personal_position.to_account_info(),
            ctx.accounts.tick_array_lower.to_account_info(),
            ctx.accounts.tick_array_upper.to_account_info(),
            ctx.accounts.token_account_0.to_account_info(),
            ctx.accounts.token_account_1.to_account_info(),
            ctx.accounts.token_vault_0.to_account_info(),
            ctx.accounts.token_vault_1.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.token_program_2022.to_account_info(),
            ctx.accounts.vault_mint_0.to_account_info(),
            ctx.accounts.vault_mint_1.to_account_info(),
        ];
        step_b_infos.extend(ctx.remaining_accounts.iter().cloned());

        let authority_key = ctx.accounts.authority.key();
        let vault_bump = ctx.accounts.vault.bump;
        let vault_seeds: &[&[u8]] = &[b"vault", authority_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        invoke_signed(&step_b_ix, &step_b_infos, signer_seeds)?;
    }

    emit!(VaultPositionOpened {
        vault: ctx.accounts.vault.key(),
        pool: ctx.accounts.pool_state.key(),
        nft_mint: ctx.accounts.position_nft_mint.key(),
        tick_lower: params.tick_lower_index,
        tick_upper: params.tick_upper_index,
        liquidity: params.liquidity,
    });

    Ok(())
}

pub fn handle_harvest_position_fees<'info>(
    ctx: Context<'_, '_, '_, 'info, HarvestPositionFees<'info>>,
) -> Result<()> {
    require!(
        ctx.accounts.pool_state.key() == ctx.accounts.swap_route.pool_state,
        crate::VaultError::PoolMismatch
    );
    require!(
        ctx.accounts.raydium_program.key() == RAYDIUM_CLMM_PROGRAM_ID,
        crate::VaultError::PoolMismatch
    );

    let is_valid_treasuries = (ctx.accounts.token_account_0.key() == ctx.accounts.base_treasury.key()
        && ctx.accounts.token_account_1.key() == ctx.accounts.quote_treasury.key())
        || (ctx.accounts.token_account_0.key() == ctx.accounts.quote_treasury.key()
            && ctx.accounts.token_account_1.key() == ctx.accounts.base_treasury.key());
    require!(is_valid_treasuries, crate::VaultError::InvalidTreasuryAccount);

    // decrease_liquidity_v2 with liquidity = 0, amountMin = 0 harvests pending fees
    let mut data = Vec::with_capacity(8 + 16 + 8 + 8);
    data.extend_from_slice(&DECREASE_LIQUIDITY_V2_DISCRIMINATOR);
    data.extend_from_slice(&0u128.to_le_bytes()); // liquidity = 0
    data.extend_from_slice(&0u64.to_le_bytes());  // amountMinA = 0
    data.extend_from_slice(&0u64.to_le_bytes());  // amountMinB = 0

    let mut accounts = vec![
        AccountMeta::new_readonly(ctx.accounts.vault.key(), true), // position_nft_owner (signed via PDA)
        AccountMeta::new_readonly(ctx.accounts.position_nft_account.key(), false),
        AccountMeta::new(ctx.accounts.personal_position.key(), false),
        AccountMeta::new(ctx.accounts.pool_state.key(), false),
        AccountMeta::new(ctx.accounts.protocol_position.key(), false),
        AccountMeta::new(ctx.accounts.token_vault_0.key(), false),
        AccountMeta::new(ctx.accounts.token_vault_1.key(), false),
        AccountMeta::new(ctx.accounts.tick_array_lower.key(), false),
        AccountMeta::new(ctx.accounts.tick_array_upper.key(), false),
        AccountMeta::new(ctx.accounts.token_account_0.key(), false),
        AccountMeta::new(ctx.accounts.token_account_1.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
        AccountMeta::new_readonly(ctx.accounts.memo_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.vault_mint_0.key(), false),
        AccountMeta::new_readonly(ctx.accounts.vault_mint_1.key(), false),
    ];

    for acc in ctx.remaining_accounts.iter() {
        accounts.push(AccountMeta {
            pubkey: acc.key(),
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        });
    }

    let ix = Instruction {
        program_id: RAYDIUM_CLMM_PROGRAM_ID,
        accounts,
        data,
    };

    let mut account_infos = vec![
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.position_nft_account.to_account_info(),
        ctx.accounts.personal_position.to_account_info(),
        ctx.accounts.pool_state.to_account_info(),
        ctx.accounts.protocol_position.to_account_info(),
        ctx.accounts.token_vault_0.to_account_info(),
        ctx.accounts.token_vault_1.to_account_info(),
        ctx.accounts.tick_array_lower.to_account_info(),
        ctx.accounts.tick_array_upper.to_account_info(),
        ctx.accounts.token_account_0.to_account_info(),
        ctx.accounts.token_account_1.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.token_program_2022.to_account_info(),
        ctx.accounts.memo_program.to_account_info(),
        ctx.accounts.vault_mint_0.to_account_info(),
        ctx.accounts.vault_mint_1.to_account_info(),
    ];
    account_infos.extend(ctx.remaining_accounts.iter().cloned());

    let authority_key = ctx.accounts.authority.key();
    let vault_bump = ctx.accounts.vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", authority_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds];

    invoke_signed(&ix, &account_infos, signer_seeds)?;

    emit!(VaultFeesHarvested {
        vault: ctx.accounts.vault.key(),
        nft_mint: ctx.accounts.position_nft_account.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

pub fn handle_withdraw_and_burn_position<'info>(
    ctx: Context<'_, '_, '_, 'info, WithdrawAndBurnPosition<'info>>,
    params: ClosePositionParams,
) -> Result<()> {
    require!(
        ctx.accounts.pool_state.key() == ctx.accounts.swap_route.pool_state,
        crate::VaultError::PoolMismatch
    );
    require!(
        ctx.accounts.raydium_program.key() == RAYDIUM_CLMM_PROGRAM_ID,
        crate::VaultError::PoolMismatch
    );

    let is_valid_treasuries = (ctx.accounts.token_account_0.key() == ctx.accounts.base_treasury.key()
        && ctx.accounts.token_account_1.key() == ctx.accounts.quote_treasury.key())
        || (ctx.accounts.token_account_0.key() == ctx.accounts.quote_treasury.key()
            && ctx.accounts.token_account_1.key() == ctx.accounts.base_treasury.key());
    require!(is_valid_treasuries, crate::VaultError::InvalidTreasuryAccount);

    // Read liquidity from personal_position (offset 81..97)
    let position_data = ctx.accounts.personal_position.try_borrow_data()?;
    require!(position_data.len() >= 97, crate::VaultError::EmptyPosition);
    let mut liq_bytes = [0u8; 16];
    liq_bytes.copy_from_slice(&position_data[81..97]);
    let current_liquidity = u128::from_le_bytes(liq_bytes);
    drop(position_data);

    let authority_key = ctx.accounts.authority.key();
    let vault_bump = ctx.accounts.vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", authority_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds];

    // 1. If liquidity > 0, decrease all liquidity
    if current_liquidity > 0 {
        let mut dec_data = Vec::with_capacity(8 + 16 + 8 + 8);
        dec_data.extend_from_slice(&DECREASE_LIQUIDITY_V2_DISCRIMINATOR);
        dec_data.extend_from_slice(&current_liquidity.to_le_bytes());
        dec_data.extend_from_slice(&params.amount_0_min.to_le_bytes());
        dec_data.extend_from_slice(&params.amount_1_min.to_le_bytes());

        let mut dec_accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.vault.key(), true),
            AccountMeta::new_readonly(ctx.accounts.position_nft_account.key(), false),
            AccountMeta::new(ctx.accounts.personal_position.key(), false),
            AccountMeta::new(ctx.accounts.pool_state.key(), false),
            AccountMeta::new(ctx.accounts.protocol_position.key(), false),
            AccountMeta::new(ctx.accounts.token_vault_0.key(), false),
            AccountMeta::new(ctx.accounts.token_vault_1.key(), false),
            AccountMeta::new(ctx.accounts.tick_array_lower.key(), false),
            AccountMeta::new(ctx.accounts.tick_array_upper.key(), false),
            AccountMeta::new(ctx.accounts.token_account_0.key(), false),
            AccountMeta::new(ctx.accounts.token_account_1.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
            AccountMeta::new_readonly(ctx.accounts.memo_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.vault_mint_0.key(), false),
            AccountMeta::new_readonly(ctx.accounts.vault_mint_1.key(), false),
        ];

        for acc in ctx.remaining_accounts.iter() {
            dec_accounts.push(AccountMeta {
                pubkey: acc.key(),
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            });
        }

        let dec_ix = Instruction {
            program_id: RAYDIUM_CLMM_PROGRAM_ID,
            accounts: dec_accounts,
            data: dec_data,
        };

        let mut dec_infos = vec![
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.position_nft_account.to_account_info(),
            ctx.accounts.personal_position.to_account_info(),
            ctx.accounts.pool_state.to_account_info(),
            ctx.accounts.protocol_position.to_account_info(),
            ctx.accounts.token_vault_0.to_account_info(),
            ctx.accounts.token_vault_1.to_account_info(),
            ctx.accounts.tick_array_lower.to_account_info(),
            ctx.accounts.tick_array_upper.to_account_info(),
            ctx.accounts.token_account_0.to_account_info(),
            ctx.accounts.token_account_1.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.token_program_2022.to_account_info(),
            ctx.accounts.memo_program.to_account_info(),
            ctx.accounts.vault_mint_0.to_account_info(),
            ctx.accounts.vault_mint_1.to_account_info(),
        ];
        dec_infos.extend(ctx.remaining_accounts.iter().cloned());

        invoke_signed(&dec_ix, &dec_infos, signer_seeds)?;
    }

    // 2. Call close_position
    let mut close_data = Vec::with_capacity(8);
    close_data.extend_from_slice(&CLOSE_POSITION_DISCRIMINATOR);

    let close_accounts = vec![
        AccountMeta::new(ctx.accounts.vault.key(), true), // position_nft_owner (signs via PDA)
        AccountMeta::new(ctx.accounts.position_nft_mint.key(), false),
        AccountMeta::new(ctx.accounts.position_nft_account.key(), false),
        AccountMeta::new(ctx.accounts.personal_position.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
    ];

    let close_ix = Instruction {
        program_id: RAYDIUM_CLMM_PROGRAM_ID,
        accounts: close_accounts,
        data: close_data,
    };

    let close_infos = vec![
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.position_nft_mint.to_account_info(),
        ctx.accounts.position_nft_account.to_account_info(),
        ctx.accounts.personal_position.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        ctx.accounts.token_program_2022.to_account_info(),
    ];

    invoke_signed(&close_ix, &close_infos, signer_seeds)?;

    emit!(VaultPositionClosed {
        vault: ctx.accounts.vault.key(),
        nft_mint: ctx.accounts.position_nft_mint.key(),
        amount_0_min: params.amount_0_min,
        amount_1_min: params.amount_1_min,
    });

    Ok(())
}
