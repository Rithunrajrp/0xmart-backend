use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// Payment configuration account
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct PaymentConfig {
    /// Program authority (admin)
    pub authority: Pubkey,

    /// Hot wallet address to receive payments
    pub hot_wallet: Pubkey,

    /// Platform fee in basis points (1 bp = 0.01%)
    pub platform_fee_bps: u16,

    /// Maximum platform fee (1000 = 10%)
    pub max_platform_fee_bps: u16,

    /// Maximum commission rate (10000 = 100%)
    pub max_commission_bps: u16,

    /// Whether the contract is paused
    pub is_paused: bool,

    /// Bump seed for PDA
    pub bump: u8,
}

impl PaymentConfig {
    pub const LEN: usize = 32 + 32 + 2 + 2 + 2 + 1 + 1; // 72 bytes

    pub const MAX_PLATFORM_FEE_BPS: u16 = 1000; // 10%
    pub const MAX_COMMISSION_BPS: u16 = 10000; // 100%
}

/// Supported token account
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SupportedToken {
    /// Token mint address
    pub mint: Pubkey,

    /// Whether this token is supported
    pub is_supported: bool,

    /// Bump seed for PDA
    pub bump: u8,
}

impl SupportedToken {
    pub const LEN: usize = 32 + 1 + 1; // 34 bytes
}

/// Processed order tracking
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ProcessedOrder {
    /// Order ID hash
    pub order_id_hash: [u8; 32],

    /// Buyer's public key
    pub buyer: Pubkey,

    /// Token mint used
    pub token_mint: Pubkey,

    /// Amount paid
    pub amount: u64,

    /// Platform fee collected
    pub platform_fee: u64,

    /// API key owner (for commission tracking)
    pub api_key_owner: Pubkey,

    /// Commission amount
    pub commission: u64,

    /// Commission rate in basis points
    pub commission_bps: u16,

    /// Timestamp
    pub timestamp: i64,

    /// Bump seed for PDA
    pub bump: u8,
}

impl ProcessedOrder {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 32 + 8 + 2 + 8 + 1; // 163 bytes
}
