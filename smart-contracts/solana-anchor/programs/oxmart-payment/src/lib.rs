use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("HwjrPzXD2LiotV6uFwMEzRYPKWw9FcVbnMk2vCW4mBPu");

#[program]
pub mod oxmart_payment {
    use super::*;

    /// Initialize the payment program
    pub fn initialize(
        ctx: Context<Initialize>,
        hot_wallet: Pubkey,
        platform_fee_bps: u16,
    ) -> Result<()> {
        require!(platform_fee_bps <= 1000, ErrorCode::FeeTooHigh);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.hot_wallet = hot_wallet;
        config.platform_fee_bps = platform_fee_bps;
        config.paused = false;
        config.bump = ctx.bumps.config;

        msg!("Payment program initialized");
        msg!("Hot wallet: {}", hot_wallet);
        msg!("Platform fee: {} bps", platform_fee_bps);

        Ok(())
    }

    /// Process a single payment
    pub fn process_payment(
        ctx: Context<ProcessPayment>,
        order_id: [u8; 32],
        amount: u64,
        product_id: String,
        api_key_owner: Pubkey,
        commission_bps: u16,
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        // Validate not paused
        require!(!config.paused, ErrorCode::ProgramPaused);

        // Validate commission
        require!(commission_bps <= 10000, ErrorCode::InvalidCommission);

        // Validate amount
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Check if order already processed
        let order_record = &ctx.accounts.order_record;
        require!(!order_record.processed, ErrorCode::OrderAlreadyProcessed);

        // Calculate fees
        let platform_fee = (amount as u128)
            .checked_mul(config.platform_fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let commission = (amount as u128)
            .checked_mul(commission_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let net_amount = amount.checked_sub(platform_fee).unwrap();

        // Transfer tokens from buyer to hot wallet
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.hot_wallet_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, net_amount)?;

        // Mark order as processed
        let order_record = &mut ctx.accounts.order_record;
        order_record.order_id = order_id;
        order_record.buyer = ctx.accounts.buyer.key();
        order_record.amount = amount;
        order_record.platform_fee = platform_fee;
        order_record.commission = commission;
        order_record.api_key_owner = api_key_owner;
        order_record.product_id = product_id.clone();
        order_record.processed = true;
        order_record.timestamp = Clock::get()?.unix_timestamp;
        order_record.bump = ctx.bumps.order_record;

        // Emit event
        emit!(PaymentProcessed {
            order_id,
            buyer: ctx.accounts.buyer.key(),
            token_mint: ctx.accounts.buyer_token_account.mint,
            amount,
            platform_fee,
            api_key_owner,
            commission,
            product_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Payment processed successfully");
        msg!("Order ID: {:?}", order_id);
        msg!("Amount: {}", amount);
        msg!("Platform fee: {}", platform_fee);
        msg!("Commission: {}", commission);

        Ok(())
    }

    /// Process batch payment (shopping cart)
    pub fn process_batch_payment(
        ctx: Context<ProcessPayment>,
        order_id: [u8; 32],
        total_amount: u64,
        product_ids: Vec<String>,
        api_key_owner: Pubkey,
        commission_bps: u16,
    ) -> Result<()> {
        let config = &ctx.accounts.config;

        require!(!config.paused, ErrorCode::ProgramPaused);
        require!(commission_bps <= 10000, ErrorCode::InvalidCommission);
        require!(total_amount > 0, ErrorCode::InvalidAmount);
        require!(!product_ids.is_empty(), ErrorCode::NoProducts);

        let order_record = &ctx.accounts.order_record;
        require!(!order_record.processed, ErrorCode::OrderAlreadyProcessed);

        let platform_fee = (total_amount as u128)
            .checked_mul(config.platform_fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let commission = (total_amount as u128)
            .checked_mul(commission_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let net_amount = total_amount.checked_sub(platform_fee).unwrap();

        // Transfer tokens
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.hot_wallet_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, net_amount)?;

        // Mark order as processed
        let order_record = &mut ctx.accounts.order_record;
        order_record.order_id = order_id;
        order_record.buyer = ctx.accounts.buyer.key();
        order_record.amount = total_amount;
        order_record.platform_fee = platform_fee;
        order_record.commission = commission;
        order_record.api_key_owner = api_key_owner;
        order_record.product_id = String::from("BATCH");
        order_record.processed = true;
        order_record.timestamp = Clock::get()?.unix_timestamp;
        order_record.bump = ctx.bumps.order_record;

        emit!(BatchPaymentProcessed {
            order_id,
            buyer: ctx.accounts.buyer.key(),
            token_mint: ctx.accounts.buyer_token_account.mint,
            total_amount,
            platform_fee,
            api_key_owner,
            commission,
            product_count: product_ids.len() as u8,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Batch payment processed successfully");
        msg!("Order ID: {:?}", order_id);
        msg!("Total amount: {}", total_amount);
        msg!("Products: {}", product_ids.len());

        Ok(())
    }

    /// Update hot wallet address (admin only)
    pub fn update_hot_wallet(
        ctx: Context<UpdateConfig>,
        new_hot_wallet: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let old_hot_wallet = config.hot_wallet;
        config.hot_wallet = new_hot_wallet;

        emit!(HotWalletUpdated {
            old_hot_wallet,
            new_hot_wallet,
            authority: ctx.accounts.authority.key(),
        });

        msg!("Hot wallet updated");
        msg!("Old: {}", old_hot_wallet);
        msg!("New: {}", new_hot_wallet);

        Ok(())
    }

    /// Update platform fee (admin only)
    pub fn update_platform_fee(
        ctx: Context<UpdateConfig>,
        new_fee_bps: u16,
    ) -> Result<()> {
        require!(new_fee_bps <= 1000, ErrorCode::FeeTooHigh);

        let config = &mut ctx.accounts.config;
        config.platform_fee_bps = new_fee_bps;

        msg!("Platform fee updated to {} bps", new_fee_bps);

        Ok(())
    }

    /// Pause the program (admin only)
    pub fn pause(ctx: Context<UpdateConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = true;

        msg!("Program paused");

        Ok(())
    }

    /// Unpause the program (admin only)
    pub fn unpause(ctx: Context<UpdateConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = false;

        msg!("Program unpaused");

        Ok(())
    }

    /// Emergency withdrawal (admin only)
    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdraw>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let config = &ctx.accounts.config;

        // Transfer tokens from program token account to authority
        let seeds = &[b"config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.program_token_account.to_account_info(),
            to: ctx.accounts.authority_token_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        msg!("Emergency withdrawal: {} tokens", amount);

        Ok(())
    }
}

// Account structures

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 32])]
pub struct ProcessPayment<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = buyer,
        space = 8 + OrderRecord::INIT_SPACE,
        seeds = [b"order", order_id.as_ref()],
        bump
    )]
    pub order_record: Account<'info, OrderRecord>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = buyer_token_account.owner == buyer.key() @ ErrorCode::InvalidTokenAccount
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = hot_wallet_token_account.owner == config.hot_wallet @ ErrorCode::InvalidHotWallet
    )]
    pub hot_wallet_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub program_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// Data structures

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,          // 32
    pub hot_wallet: Pubkey,          // 32
    pub platform_fee_bps: u16,       // 2
    pub paused: bool,                // 1
    pub bump: u8,                    // 1
}

#[account]
#[derive(InitSpace)]
pub struct OrderRecord {
    pub order_id: [u8; 32],          // 32
    pub buyer: Pubkey,                // 32
    pub amount: u64,                  // 8
    pub platform_fee: u64,            // 8
    pub commission: u64,              // 8
    pub api_key_owner: Pubkey,        // 32
    #[max_len(50)]
    pub product_id: String,           // 4 + 50
    pub processed: bool,              // 1
    pub timestamp: i64,               // 8
    pub bump: u8,                     // 1
}

// Events

#[event]
pub struct PaymentProcessed {
    pub order_id: [u8; 32],
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub api_key_owner: Pubkey,
    pub commission: u64,
    #[index]
    pub product_id: String,
    pub timestamp: i64,
}

#[event]
pub struct BatchPaymentProcessed {
    pub order_id: [u8; 32],
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub total_amount: u64,
    pub platform_fee: u64,
    pub api_key_owner: Pubkey,
    pub commission: u64,
    pub product_count: u8,
    pub timestamp: i64,
}

#[event]
pub struct HotWalletUpdated {
    pub old_hot_wallet: Pubkey,
    pub new_hot_wallet: Pubkey,
    pub authority: Pubkey,
}

// Error codes

#[error_code]
pub enum ErrorCode {
    #[msg("Platform fee too high (max 10%)")]
    FeeTooHigh,

    #[msg("Program is paused")]
    ProgramPaused,

    #[msg("Invalid commission (max 100%)")]
    InvalidCommission,

    #[msg("Invalid amount (must be > 0)")]
    InvalidAmount,

    #[msg("Order already processed")]
    OrderAlreadyProcessed,

    #[msg("No products provided")]
    NoProducts,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Invalid hot wallet")]
    InvalidHotWallet,

    #[msg("Unauthorized")]
    Unauthorized,
}
