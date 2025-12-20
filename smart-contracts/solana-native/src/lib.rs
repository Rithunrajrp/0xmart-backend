// 0xMart Payment Processing Program for Solana
// Handles stablecoin payments with commission tracking and platform fees

pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

// Export for external use
pub use solana_program;

solana_program::declare_id!("11111111111111111111111111111111"); // Placeholder, will be updated after deployment
