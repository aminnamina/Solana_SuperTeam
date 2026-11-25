use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{Mint, Token, TokenAccount};

pub const RAYDIUM_CLMM_PROGRAM_ID: Pubkey =
    pubkey!("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH");

// Anchor discriminator for global:swap_v2: [43, 4, 237, 11, 26, 201, 30, 98]
pub const SWAP_V2_DISCRIMINATOR: [u8; 8] = [43, 4, 237, 11, 26, 201, 30, 98];

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SwapDirection {
    BaseToQuote,
    QuoteToBase,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SwapParams {
    pub direction: SwapDirection,
    pub amount_in: u64,
    pub min_amount_out: u64,
}

#[event]
pub struct ClmmSwapExecuted {
    pub vault: Pubkey,
    pub pool: Pubkey,
    pub direction: SwapDirection,
    pub amount_in: u64,
    pub min_amount_out: u64,
    pub timestamp: i64,
}

#[account]
pub struct SwapRoute {
    pub vault: Pubkey,
    pub pool_state: Pubkey,
    pub quote_mint: Pubkey,
    pub quote_treasury: Pubkey,
    pub bump: u8,
}

impl SwapRoute {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 1;
}

#[derive(Accounts)]
pub struct ConfigureSwapRoute<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, crate::Vault>,

    /// CHECK: pool_state validated in instruction (owner == raydium clmm, mints match)
    pub pool_state: UncheckedAccount<'info>,

    pub vault_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = SwapRoute::LEN,
        seeds = [b"swap_route", vault.key().as_ref()],
        bump
    )]
    pub swap_route: Account<'info, SwapRoute>,

    #[account(
        init,
        payer = authority,
        seeds = [b"quote_treasury", vault.key().as_ref()],
        bump,
        token::mint = quote_mint,
        token::authority = vault
    )]
    pub quote_treasury: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteClmmSwap<'info> {
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
    pub swap_route: Account<'info, SwapRoute>,

    /// CHECK: Validated against swap_route.pool_state and raydium program owner
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// CHECK: AmmConfig of the pool
    pub amm_config: UncheckedAccount<'info>,

    /// CHECK: Token account of the vault for base token (owned by vault)
    #[account(mut)]
    pub base_treasury: Account<'info, TokenAccount>,

    /// CHECK: Token account of the vault for quote token (quote_treasury)
    #[account(
        mut,
        seeds = [b"quote_treasury", vault.key().as_ref()],
        bump,
    )]
    pub quote_treasury: Account<'info, TokenAccount>,

    /// CHECK: Pool's vault token account A
    #[account(mut)]
    pub pool_vault_a: UncheckedAccount<'info>,

    /// CHECK: Pool's vault token account B
    #[account(mut)]
    pub pool_vault_b: UncheckedAccount<'info>,

    /// CHECK: Observation state
    #[account(mut)]
    pub observation_state: UncheckedAccount<'info>,

    /// CHECK: Base mint
    pub base_mint: Account<'info, Mint>,

    /// CHECK: Quote mint
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    /// CHECK: Token2022 program
    pub token_program_2022: UncheckedAccount<'info>,
    /// CHECK: Memo program
    pub memo_program: UncheckedAccount<'info>,

    /// CHECK: Raydium CLMM program
    pub raydium_program: UncheckedAccount<'info>,
}

pub fn handle_configure_swap_route(ctx: Context<ConfigureSwapRoute>) -> Result<()> {
    require!(
        ctx.accounts.pool_state.owner == &RAYDIUM_CLMM_PROGRAM_ID,
        crate::VaultError::UnauthorizedPool
    );

    let data = ctx.accounts.pool_state.try_borrow_data()?;
    require!(data.len() >= 137, crate::VaultError::InvalidPoolMints);

    let mint_a = Pubkey::try_from(&data[73..105]).map_err(|_| crate::VaultError::InvalidPoolMints)?;
    let mint_b = Pubkey::try_from(&data[105..137]).map_err(|_| crate::VaultError::InvalidPoolMints)?;

    let vault_mint = ctx.accounts.vault_mint.key();
    let quote_mint = ctx.accounts.quote_mint.key();

    let valid_mints = (mint_a == vault_mint && mint_b == quote_mint)
        || (mint_a == quote_mint && mint_b == vault_mint);
    require!(valid_mints, crate::VaultError::InvalidPoolMints);

    let swap_route = &mut ctx.accounts.swap_route;
    swap_route.vault = ctx.accounts.vault.key();
    swap_route.pool_state = ctx.accounts.pool_state.key();
    swap_route.quote_mint = quote_mint;
    swap_route.quote_treasury = ctx.accounts.quote_treasury.key();
    swap_route.bump = ctx.bumps.swap_route;

    Ok(())
}

pub fn handle_execute_clmm_swap<'info>(
    ctx: Context<'_, '_, '_, 'info, ExecuteClmmSwap<'info>>,
    params: SwapParams,
) -> Result<()> {
    require!(params.amount_in > 0, crate::VaultError::ZeroSwapAmount);
    require!(
        ctx.accounts.pool_state.key() == ctx.accounts.swap_route.pool_state,
        crate::VaultError::UnauthorizedPool
    );
    require!(
        ctx.accounts.raydium_program.key() == RAYDIUM_CLMM_PROGRAM_ID,
        crate::VaultError::UnauthorizedPool
    );

    let pool_data = ctx.accounts.pool_state.try_borrow_data()?;
    require!(pool_data.len() >= 201, crate::VaultError::InvalidPoolMints);

    let mint_a = Pubkey::try_from(&pool_data[73..105]).map_err(|_| crate::VaultError::InvalidPoolMints)?;
    let mint_b = Pubkey::try_from(&pool_data[105..137]).map_err(|_| crate::VaultError::InvalidPoolMints)?;
    let vault_a = Pubkey::try_from(&pool_data[137..169]).map_err(|_| crate::VaultError::InvalidPoolMints)?;
    let vault_b = Pubkey::try_from(&pool_data[169..201]).map_err(|_| crate::VaultError::InvalidPoolMints)?;
    drop(pool_data);

    require!(
        ctx.accounts.pool_vault_a.key() == vault_a && ctx.accounts.pool_vault_b.key() == vault_b,
        crate::VaultError::InvalidPoolMints
    );

    let (
        input_token_account,
        output_token_account,
        input_vault,
        output_vault,
        input_vault_mint,
        output_vault_mint,
    ) = match params.direction {
        SwapDirection::BaseToQuote => {
            let (in_vault, out_vault) = if ctx.accounts.base_mint.key() == mint_a {
                (ctx.accounts.pool_vault_a.to_account_info(), ctx.accounts.pool_vault_b.to_account_info())
            } else {
                (ctx.accounts.pool_vault_b.to_account_info(), ctx.accounts.pool_vault_a.to_account_info())
            };
            (
                ctx.accounts.base_treasury.to_account_info(),
                ctx.accounts.quote_treasury.to_account_info(),
                in_vault,
                out_vault,
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
            )
        }
        SwapDirection::QuoteToBase => {
            let (in_vault, out_vault) = if ctx.accounts.quote_mint.key() == mint_a {
                (ctx.accounts.pool_vault_a.to_account_info(), ctx.accounts.pool_vault_b.to_account_info())
            } else {
                (ctx.accounts.pool_vault_b.to_account_info(), ctx.accounts.pool_vault_a.to_account_info())
            };
            (
                ctx.accounts.quote_treasury.to_account_info(),
                ctx.accounts.base_treasury.to_account_info(),
                in_vault,
                out_vault,
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
            )
        }
    };

    let mut ix_data = Vec::with_capacity(41);
    ix_data.extend_from_slice(&SWAP_V2_DISCRIMINATOR);
    ix_data.extend_from_slice(&params.amount_in.to_le_bytes());
    ix_data.extend_from_slice(&params.min_amount_out.to_le_bytes());
    ix_data.extend_from_slice(&0u128.to_le_bytes()); // sqrt_price_limit_x64 = 0
    ix_data.push(1u8); // is_base_input = true

    let mut account_metas = vec![
        AccountMeta::new_readonly(ctx.accounts.vault.key(), true), // payer / signer
        AccountMeta::new_readonly(ctx.accounts.amm_config.key(), false),
        AccountMeta::new(ctx.accounts.pool_state.key(), false),
        AccountMeta::new(input_token_account.key(), false),
        AccountMeta::new(output_token_account.key(), false),
        AccountMeta::new(input_vault.key(), false),
        AccountMeta::new(output_vault.key(), false),
        AccountMeta::new(ctx.accounts.observation_state.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_program_2022.key(), false),
        AccountMeta::new_readonly(ctx.accounts.memo_program.key(), false),
        AccountMeta::new_readonly(input_vault_mint.key(), false),
        AccountMeta::new_readonly(output_vault_mint.key(), false),
    ];

    for acc in ctx.remaining_accounts.iter() {
        account_metas.push(AccountMeta {
            pubkey: acc.key(),
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        });
    }

    let ix = Instruction {
        program_id: RAYDIUM_CLMM_PROGRAM_ID,
        accounts: account_metas,
        data: ix_data,
    };

    let mut account_infos = vec![
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.amm_config.to_account_info(),
        ctx.accounts.pool_state.to_account_info(),
        input_token_account,
        output_token_account,
        input_vault,
        output_vault,
        ctx.accounts.observation_state.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.token_program_2022.to_account_info(),
        ctx.accounts.memo_program.to_account_info(),
        input_vault_mint,
        output_vault_mint,
    ];
    account_infos.extend(ctx.remaining_accounts.iter().cloned());

    let authority_key = ctx.accounts.authority.key();
    let vault_bump = ctx.accounts.vault.bump;
    let vault_seeds: &[&[u8]] = &[b"vault", authority_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds];

    invoke_signed(&ix, &account_infos, signer_seeds)?;

    emit!(ClmmSwapExecuted {
        vault: ctx.accounts.vault.key(),
        pool: ctx.accounts.pool_state.key(),
        direction: params.direction,
        amount_in: params.amount_in,
        min_amount_out: params.min_amount_out,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
