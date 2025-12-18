use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
    clock::Clock,
};
use spl_token::state::Account as TokenAccount;

use crate::{error::PaymentError, instruction::PaymentInstruction, state::*};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = PaymentInstruction::try_from_slice(instruction_data)
            .map_err(|_| PaymentError::InvalidInstruction)?;

        match instruction {
            PaymentInstruction::Initialize { hot_wallet } => {
                msg!("Instruction: Initialize");
                Self::process_initialize(program_id, accounts, hot_wallet)
            }
            PaymentInstruction::ProcessPayment {
                order_id,
                amount,
                product_id,
                commission_bps,
            } => {
                msg!("Instruction: ProcessPayment");
                Self::process_payment(
                    program_id,
                    accounts,
                    order_id,
                    amount,
                    product_id,
                    commission_bps,
                )
            }
            PaymentInstruction::AddSupportedToken { token_mint } => {
                msg!("Instruction: AddSupportedToken");
                Self::process_add_supported_token(program_id, accounts, token_mint)
            }
            PaymentInstruction::RemoveSupportedToken => {
                msg!("Instruction: RemoveSupportedToken");
                Self::process_remove_supported_token(program_id, accounts)
            }
            PaymentInstruction::UpdateHotWallet { new_hot_wallet } => {
                msg!("Instruction: UpdateHotWallet");
                Self::process_update_hot_wallet(program_id, accounts, new_hot_wallet)
            }
            PaymentInstruction::UpdatePlatformFee { new_fee_bps } => {
                msg!("Instruction: UpdatePlatformFee");
                Self::process_update_platform_fee(program_id, accounts, new_fee_bps)
            }
            PaymentInstruction::Pause => {
                msg!("Instruction: Pause");
                Self::process_pause(program_id, accounts)
            }
            PaymentInstruction::Unpause => {
                msg!("Instruction: Unpause");
                Self::process_unpause(program_id, accounts)
            }
        }
    }

    fn process_initialize(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        hot_wallet: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Verify signer
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Derive PDA
        let (config_pda, bump) = Pubkey::find_program_address(&[b"config"], program_id);

        if config_pda != *config_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        // Check if already initialized
        if config_info.data_len() > 0 {
            return Err(PaymentError::AlreadyInitialized.into());
        }

        // Create config account
        let rent = Rent::get()?;
        let space = PaymentConfig::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                authority_info.key,
                config_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[authority_info.clone(), config_info.clone(), system_program_info.clone()],
            &[&[b"config", &[bump]]],
        )?;

        // Initialize config
        let config = PaymentConfig {
            authority: *authority_info.key,
            hot_wallet,
            platform_fee_bps: 0,
            max_platform_fee_bps: PaymentConfig::MAX_PLATFORM_FEE_BPS,
            max_commission_bps: PaymentConfig::MAX_COMMISSION_BPS,
            is_paused: false,
            bump,
        };

        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Payment config initialized");
        msg!("Authority: {}", authority_info.key);
        msg!("Hot Wallet: {}", hot_wallet);

        Ok(())
    }

    fn process_payment(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        order_id: String,
        amount: u64,
        _product_id: String,
        commission_bps: u16,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let buyer_info = next_account_info(account_info_iter)?;
        let buyer_token_info = next_account_info(account_info_iter)?;
        let hot_wallet_token_info = next_account_info(account_info_iter)?;
        let token_mint_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let supported_token_info = next_account_info(account_info_iter)?;
        let processed_order_info = next_account_info(account_info_iter)?;
        let api_key_owner_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Verify buyer signature
        if !buyer_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Load and verify config
        let config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;

        if config.is_paused {
            return Err(PaymentError::ContractPaused.into());
        }

        // Verify PDA
        let (config_pda, _) = Pubkey::find_program_address(&[b"config"], program_id);
        if config_pda != *config_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        // Check if token is supported
        let supported_token = SupportedToken::try_from_slice(&supported_token_info.data.borrow())?;
        if !supported_token.is_supported || supported_token.mint != *token_mint_info.key {
            return Err(PaymentError::TokenNotSupported.into());
        }

        // Validate amount
        if amount == 0 {
            return Err(PaymentError::InvalidAmount.into());
        }

        // Validate commission
        if commission_bps > config.max_commission_bps {
            return Err(PaymentError::InvalidCommissionRate.into());
        }

        // Check if order already processed
        let order_id_hash = solana_program::hash::hash(order_id.as_bytes()).to_bytes();
        let (order_pda, order_bump) =
            Pubkey::find_program_address(&[b"order", &order_id_hash], program_id);

        if order_pda != *processed_order_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        if processed_order_info.data_len() > 0 {
            return Err(PaymentError::OrderAlreadyProcessed.into());
        }

        // Calculate fees
        let platform_fee = amount
            .checked_mul(config.platform_fee_bps as u64)
            .ok_or(PaymentError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(PaymentError::ArithmeticOverflow)?;

        let commission = amount
            .checked_mul(commission_bps as u64)
            .ok_or(PaymentError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(PaymentError::ArithmeticOverflow)?;

        // Transfer tokens to hot wallet
        let transfer_ix = spl_token::instruction::transfer(
            token_program_info.key,
            buyer_token_info.key,
            hot_wallet_token_info.key,
            buyer_info.key,
            &[],
            amount,
        )?;

        invoke(
            &transfer_ix,
            &[
                buyer_token_info.clone(),
                hot_wallet_token_info.clone(),
                buyer_info.clone(),
                token_program_info.clone(),
            ],
        )?;

        // Create processed order record
        let rent = Rent::get()?;
        let space = ProcessedOrder::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                buyer_info.key,
                processed_order_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                buyer_info.clone(),
                processed_order_info.clone(),
                system_program_info.clone(),
            ],
            &[&[b"order", &order_id_hash, &[order_bump]]],
        )?;

        // Save order details
        let clock = Clock::get()?;
        let processed_order = ProcessedOrder {
            order_id_hash,
            buyer: *buyer_info.key,
            token_mint: *token_mint_info.key,
            amount,
            platform_fee,
            api_key_owner: *api_key_owner_info.key,
            commission,
            commission_bps,
            timestamp: clock.unix_timestamp,
            bump: order_bump,
        };

        processed_order.serialize(&mut *processed_order_info.data.borrow_mut())?;

        msg!("Payment processed");
        msg!("Order ID Hash: {:?}", order_id_hash);
        msg!("Amount: {}", amount);
        msg!("Platform Fee: {}", platform_fee);
        msg!("Commission: {}", commission);

        Ok(())
    }

    fn process_add_supported_token(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        token_mint: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let supported_token_info = next_account_info(account_info_iter)?;
        let mint_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        // Derive PDA for supported token
        let (token_pda, bump) =
            Pubkey::find_program_address(&[b"token", mint_info.key.as_ref()], program_id);

        if token_pda != *supported_token_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        // Create or update supported token account
        let rent = Rent::get()?;
        let space = SupportedToken::LEN;
        let lamports = rent.minimum_balance(space);

        if supported_token_info.data_len() == 0 {
            invoke_signed(
                &system_instruction::create_account(
                    authority_info.key,
                    supported_token_info.key,
                    lamports,
                    space as u64,
                    program_id,
                ),
                &[
                    authority_info.clone(),
                    supported_token_info.clone(),
                    system_program_info.clone(),
                ],
                &[&[b"token", mint_info.key.as_ref(), &[bump]]],
            )?;
        }

        let supported_token = SupportedToken {
            mint: token_mint,
            is_supported: true,
            bump,
        };

        supported_token.serialize(&mut *supported_token_info.data.borrow_mut())?;

        msg!("Token added: {}", token_mint);

        Ok(())
    }

    fn process_remove_supported_token(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;
        let supported_token_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        // Update supported token
        let mut supported_token =
            SupportedToken::try_from_slice(&supported_token_info.data.borrow())?;
        supported_token.is_supported = false;

        supported_token.serialize(&mut *supported_token_info.data.borrow_mut())?;

        msg!("Token removed");

        Ok(())
    }

    fn process_update_hot_wallet(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        new_hot_wallet: Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        config.hot_wallet = new_hot_wallet;
        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Hot wallet updated to: {}", new_hot_wallet);

        Ok(())
    }

    fn process_update_platform_fee(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        new_fee_bps: u16,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        if new_fee_bps > config.max_platform_fee_bps {
            return Err(PaymentError::InvalidPlatformFee.into());
        }

        config.platform_fee_bps = new_fee_bps;
        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Platform fee updated to: {} bps", new_fee_bps);

        Ok(())
    }

    fn process_pause(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        config.is_paused = true;
        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Contract paused");

        Ok(())
    }

    fn process_unpause(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority_info = next_account_info(account_info_iter)?;
        let config_info = next_account_info(account_info_iter)?;

        // Verify authority
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut config = PaymentConfig::try_from_slice(&config_info.data.borrow())?;
        if config.authority != *authority_info.key {
            return Err(PaymentError::NotAuthorized.into());
        }

        config.is_paused = false;
        config.serialize(&mut *config_info.data.borrow_mut())?;

        msg!("Contract unpaused");

        Ok(())
    }
}
