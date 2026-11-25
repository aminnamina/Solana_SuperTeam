use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

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
