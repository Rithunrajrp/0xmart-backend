use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum PaymentInstruction {
    /// Initialize the payment configuration
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[writable]` Payment config account (PDA)
    /// 2. `[]` System program
    Initialize {
        hot_wallet: Pubkey,
    },

    /// Process a single payment
    ///
    /// Accounts expected:
    /// 0. `[signer]` Buyer account
    /// 1. `[writable]` Buyer's token account
    /// 2. `[writable]` Hot wallet's token account
    /// 3. `[]` Token mint
    /// 4. `[]` Payment config account (PDA)
    /// 5. `[writable]` Supported token account (PDA)
    /// 6. `[writable]` Processed order account (PDA)
    /// 7. `[]` API key owner account
    /// 8. `[]` Token program
    /// 9. `[]` System program
    ProcessPayment {
        order_id: String,
        amount: u64,
        product_id: String,
        commission_bps: u16,
    },

    /// Add a supported token
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[]` Payment config account (PDA)
    /// 2. `[writable]` Supported token account (PDA)
    /// 3. `[]` Token mint
    /// 4. `[]` System program
    AddSupportedToken {
        token_mint: Pubkey,
    },

    /// Remove a supported token
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[]` Payment config account (PDA)
    /// 2. `[writable]` Supported token account (PDA)
    RemoveSupportedToken,

    /// Update hot wallet
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[writable]` Payment config account (PDA)
    UpdateHotWallet {
        new_hot_wallet: Pubkey,
    },

    /// Update platform fee
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[writable]` Payment config account (PDA)
    UpdatePlatformFee {
        new_fee_bps: u16,
    },

    /// Pause the contract
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[writable]` Payment config account (PDA)
    Pause,

    /// Unpause the contract
    ///
    /// Accounts expected:
    /// 0. `[signer]` Authority account
    /// 1. `[writable]` Payment config account (PDA)
    Unpause,
}
