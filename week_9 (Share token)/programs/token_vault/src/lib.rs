use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("7REqUSGJk9NFp9gpnqieQmku3PKwWtfsE8Cj3AYk623s");

#[program]
pub mod token_vault {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let config = &mut ctx.accounts.vault_config;
        config.authority = ctx.accounts.authority.key();
        config.asset_mint = ctx.accounts.asset_mint.key();
        config.share_mint = ctx.accounts.share_mint.key();
        config.treasury = ctx.accounts.treasury.key();
        config.total_assets = 0;
        config.total_shares = 0;
        config.is_paused = false;
        config.created_at = Clock::get()?.unix_timestamp;
        config.bump = ctx.bumps.vault_config;

        msg!(
            "Token Vault initialized: authority={}, asset_mint={}, treasury={}",
            config.authority,
            config.asset_mint,
            config.treasury
        );
        Ok(())
    }

    pub fn toggle_pause(ctx: Context<TogglePause>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.vault_config;
        config.is_paused = paused;
        msg!("Vault pause state updated: is_paused={}", paused);
        Ok(())
    }

    pub fn register_member(ctx: Context<RegisterMember>) -> Result<()> {
        let member = &mut ctx.accounts.member;
        member.owner = ctx.accounts.owner.key();
        member.vault = ctx.accounts.vault_config.key();
        member.deposited_assets = 0;
        member.shares_held = 0;
        member.opened_at = Clock::get()?.unix_timestamp;
        member.bump = ctx.bumps.member;

        msg!(
            "Member registered: owner={}, vault={}",
            member.owner,
            member.vault
        );
        Ok(())
    }

    pub fn close_member(ctx: Context<CloseMember>) -> Result<()> {
        require!(
            ctx.accounts.member.shares_held == 0,
            VaultError::NonZeroSharesBalance
        );
        msg!(
            "Member account closed with rent refund: owner={}",
            ctx.accounts.owner.key()
        );
        Ok(())
    }

    pub fn deposit_assets(ctx: Context<DepositAssets>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.vault_config;
        require!(!config.is_paused, VaultError::VaultPaused);
        require!(amount > 0, VaultError::InvalidAmount);

        // Share calculation in u128
        let shares = if config.total_shares == 0 || config.total_assets == 0 {
            amount
        } else {
            let numerator = (amount as u128)
                .checked_mul(config.total_shares as u128)
                .ok_or(VaultError::MathOverflow)?;
            let denominator = config.total_assets as u128;
            let calculated = numerator
                .checked_div(denominator)
                .ok_or(VaultError::MathOverflow)?;
            u64::try_from(calculated).map_err(|_| VaultError::MathOverflow)?
        };
        require!(shares > 0, VaultError::InvalidAmount);

        // 1. Transfer asset tokens from user to treasury
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_asset_account.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        // 2. Mint share tokens to user signed by vault_config PDA
        let asset_key = ctx.accounts.vault_config.asset_mint;
        let bump = ctx.accounts.vault_config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault_config", asset_key.as_ref(), &[bump]]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.user_share_account.to_account_info(),
                    authority: ctx.accounts.vault_config.to_account_info(),
                },
                signer_seeds,
            ),
            shares,
        )?;

        // 3. Update state
        let config_mut = &mut ctx.accounts.vault_config;
        config_mut.total_assets = config_mut
            .total_assets
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        config_mut.total_shares = config_mut
            .total_shares
            .checked_add(shares)
            .ok_or(VaultError::MathOverflow)?;

        let member_mut = &mut ctx.accounts.member;
        member_mut.deposited_assets = member_mut
            .deposited_assets
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        member_mut.shares_held = member_mut
            .shares_held
            .checked_add(shares)
            .ok_or(VaultError::MathOverflow)?;

        msg!(
            "Deposit confirmed: amount={}, shares_minted={}, new_tvl={}, new_shares={}",
            amount,
            shares,
            config_mut.total_assets,
            config_mut.total_shares
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"vault_config", asset_mint.key().as_ref()],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub asset_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [b"treasury", vault_config.key().as_ref()],
        bump,
        token::mint = asset_mint,
        token::authority = vault_config
    )]
    pub treasury: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        seeds = [b"share_mint", vault_config.key().as_ref()],
        bump,
        mint::decimals = asset_mint.decimals,
        mint::authority = vault_config
    )]
    pub share_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    #[account(
        mut,
        seeds = [b"vault_config", vault_config.asset_mint.as_ref()],
        bump = vault_config.bump,
        has_one = authority @ VaultError::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterMember<'info> {
    #[account(
        seeds = [b"vault_config", vault_config.asset_mint.as_ref()],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"member", vault_config.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub member: Account<'info, MemberAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMember<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"member", vault_config.key().as_ref(), owner.key().as_ref()],
        bump = member.bump,
        has_one = owner @ VaultError::Unauthorized,
        constraint = member.vault == vault_config.key() @ VaultError::Unauthorized
    )]
    pub member: Account<'info, MemberAccount>,
    #[account(
        seeds = [b"vault_config", vault_config.asset_mint.as_ref()],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositAssets<'info> {
    #[account(
        mut,
        seeds = [b"vault_config", vault_config.asset_mint.as_ref()],
        bump = vault_config.bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        seeds = [b"treasury", vault_config.key().as_ref()],
        bump,
        token::mint = vault_config.asset_mint,
        token::authority = vault_config
    )]
    pub treasury: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"share_mint", vault_config.key().as_ref()],
        bump,
        mint::authority = vault_config
    )]
    pub share_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"member", vault_config.key().as_ref(), owner.key().as_ref()],
        bump = member.bump,
        has_one = owner @ VaultError::Unauthorized
    )]
    pub member: Account<'info, MemberAccount>,
    #[account(
        mut,
        token::mint = vault_config.asset_mint,
        token::authority = owner
    )]
    pub user_asset_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = share_mint,
        token::authority = owner
    )]
    pub user_share_account: Account<'info, TokenAccount>,
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub asset_mint: Pubkey,
    pub share_mint: Pubkey,
    pub treasury: Pubkey,
    pub total_assets: u64,
    pub total_shares: u64,
    pub is_paused: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct MemberAccount {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub deposited_assets: u64,
    pub shares_held: u64,
    pub opened_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum VaultError {
    #[msg("Vault operations are currently paused by the authority.")]
    VaultPaused,
    #[msg("Provided asset or share amount must be strictly greater than zero.")]
    InvalidAmount,
    #[msg("Caller is not authorized to execute this operation.")]
    Unauthorized,
    #[msg("Cannot close member account with non-zero shares held.")]
    NonZeroSharesBalance,
    #[msg("Insufficient member shares balance for requested withdrawal.")]
    InsufficientShares,
    #[msg("Mathematical calculation overflow occurred.")]
    MathOverflow,
}
