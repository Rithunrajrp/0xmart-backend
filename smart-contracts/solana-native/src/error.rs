use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum PaymentError {
    #[error("Invalid Instruction")]
    InvalidInstruction,

    #[error("Not Authorized")]
    NotAuthorized,

    #[error("Already Initialized")]
    AlreadyInitialized,

    #[error("Uninitialized Account")]
    UninitializedAccount,

    #[error("Order Already Processed")]
    OrderAlreadyProcessed,

    #[error("Token Not Supported")]
    TokenNotSupported,

    #[error("Invalid Amount")]
    InvalidAmount,

    #[error("Invalid Commission Rate")]
    InvalidCommissionRate,

    #[error("Contract Paused")]
    ContractPaused,

    #[error("Arithmetic Overflow")]
    ArithmeticOverflow,

    #[error("Invalid Platform Fee")]
    InvalidPlatformFee,
}

impl From<PaymentError> for ProgramError {
    fn from(e: PaymentError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
