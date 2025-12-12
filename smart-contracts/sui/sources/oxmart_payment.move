/// 0xMart Payment Processing Contract for Sui
/// Handles stablecoin payments for the 0xMart e-commerce platform
///
/// Features:
/// - Process single and batch payments
/// - Support multiple stablecoin types
/// - Commission tracking for API partners
/// - Platform fee management
/// - Hot wallet integration
/// - Order deduplication
/// - Emergency pause mechanism

module oxmart::payment {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};
    use std::vector;
    use std::string::{Self, String};

    /// Error codes
    const E_ORDER_ALREADY_PROCESSED: u64 = 1;
    const E_TOKEN_NOT_SUPPORTED: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_INVALID_COMMISSION: u64 = 4;
    const E_PAUSED: u64 = 5;
    const E_NOT_ADMIN: u64 = 6;
    const E_INVALID_ADDRESS: u64 = 7;

    /// Maximum commission in basis points (100%)
    const MAX_COMMISSION_BPS: u64 = 10000;

    /// Maximum platform fee in basis points (10%)
    const MAX_PLATFORM_FEE_BPS: u64 = 1000;

    /// Payment Contract Configuration
    struct PaymentConfig has key {
        id: UID,
        /// Admin address
        admin: address,
        /// Hot wallet that receives payments
        hot_wallet: address,
        /// Platform fee in basis points (100 = 1%)
        platform_fee_bps: u64,
        /// Supported token types (coin type as string)
        supported_tokens: Table<String, bool>,
        /// Processed orders to prevent double-spending
        processed_orders: Table<vector<u8>, bool>,
        /// Is contract paused
        is_paused: bool,
    }

    /// Event emitted when payment is received
    struct PaymentReceived has copy, drop {
        order_id: vector<u8>,
        buyer: address,
        token_type: String,
        amount: u64,
        platform_fee: u64,
        api_key_owner: address,
        commission: u64,
        commission_bps: u64,
        product_id: String,
    }

    /// Event emitted when hot wallet is updated
    struct HotWalletUpdated has copy, drop {
        old_wallet: address,
        new_wallet: address,
    }

    /// Event emitted when token support is changed
    struct TokenSupportChanged has copy, drop {
        token_type: String,
        is_supported: bool,
    }

    /// Event emitted when platform fee is updated
    struct PlatformFeeUpdated has copy, drop {
        old_fee_bps: u64,
        new_fee_bps: u64,
    }

    /// Initialize the payment contract
    public entry fun initialize(
        hot_wallet: address,
        ctx: &mut TxContext
    ) {
        let config = PaymentConfig {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            hot_wallet,
            platform_fee_bps: 0, // No fee initially
            supported_tokens: table::new(ctx),
            processed_orders: table::new(ctx),
            is_paused: false,
        };

        transfer::share_object(config);
    }

    /// Process a single payment
    ///
    /// # Arguments
    /// * `config` - Payment configuration object
    /// * `order_id` - Unique order identifier
    /// * `payment` - Coin to be used for payment
    /// * `product_id` - Product identifier
    /// * `api_key_owner` - Address to credit commission (if applicable)
    /// * `commission_bps` - Commission in basis points
    public entry fun process_payment<T>(
        config: &mut PaymentConfig,
        order_id: vector<u8>,
        payment: Coin<T>,
        product_id: String,
        api_key_owner: address,
        commission_bps: u64,
        ctx: &mut TxContext
    ) {
        // Check if paused
        assert!(!config.is_paused, E_PAUSED);

        // Check if order already processed
        assert!(!table::contains(&config.processed_orders, order_id), E_ORDER_ALREADY_PROCESSED);

        // Get token type as string
        let token_type = type_to_string<T>();

        // Check if token is supported
        assert!(
            table::contains(&config.supported_tokens, token_type) &&
            *table::borrow(&config.supported_tokens, token_type),
            E_TOKEN_NOT_SUPPORTED
        );

        // Validate amount
        let amount = coin::value(&payment);
        assert!(amount > 0, E_INVALID_AMOUNT);

        // Validate commission
        assert!(commission_bps <= MAX_COMMISSION_BPS, E_INVALID_COMMISSION);

        // Mark order as processed
        table::add(&mut config.processed_orders, order_id, true);

        // Calculate fees
        let platform_fee = (amount * config.platform_fee_bps) / 10000;
        let commission = (amount * commission_bps) / 10000;

        // Transfer payment to hot wallet
        transfer::public_transfer(payment, config.hot_wallet);

        // Emit event
        event::emit(PaymentReceived {
            order_id,
            buyer: tx_context::sender(ctx),
            token_type,
            amount,
            platform_fee,
            api_key_owner,
            commission,
            commission_bps,
            product_id,
        });
    }

    /// Process batch payment for shopping cart
    public entry fun process_batch_payment<T>(
        config: &mut PaymentConfig,
        order_id: vector<u8>,
        payment: Coin<T>,
        product_ids: vector<String>,
        api_key_owner: address,
        commission_bps: u64,
        ctx: &mut TxContext
    ) {
        assert!(!config.is_paused, E_PAUSED);
        assert!(!table::contains(&config.processed_orders, order_id), E_ORDER_ALREADY_PROCESSED);

        let token_type = type_to_string<T>();
        assert!(
            table::contains(&config.supported_tokens, token_type) &&
            *table::borrow(&config.supported_tokens, token_type),
            E_TOKEN_NOT_SUPPORTED
        );

        let total_amount = coin::value(&payment);
        assert!(total_amount > 0, E_INVALID_AMOUNT);
        assert!(commission_bps <= MAX_COMMISSION_BPS, E_INVALID_COMMISSION);

        table::add(&mut config.processed_orders, order_id, true);

        let platform_fee = (total_amount * config.platform_fee_bps) / 10000;
        let commission = (total_amount * commission_bps) / 10000;

        transfer::public_transfer(payment, config.hot_wallet);

        event::emit(PaymentReceived {
            order_id,
            buyer: tx_context::sender(ctx),
            token_type,
            amount: total_amount,
            platform_fee,
            api_key_owner,
            commission,
            commission_bps,
            product_id: string::utf8(b"BATCH"), // Batch indicator
        });
    }

    /// Update hot wallet address (admin only)
    public entry fun update_hot_wallet(
        config: &mut PaymentConfig,
        new_hot_wallet: address,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);
        assert!(new_hot_wallet != @0x0, E_INVALID_ADDRESS);

        let old_wallet = config.hot_wallet;
        config.hot_wallet = new_hot_wallet;

        event::emit(HotWalletUpdated {
            old_wallet,
            new_wallet: new_hot_wallet,
        });
    }

    /// Add supported token type (admin only)
    public entry fun add_supported_token<T>(
        config: &mut PaymentConfig,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);

        let token_type = type_to_string<T>();

        if (table::contains(&config.supported_tokens, token_type)) {
            *table::borrow_mut(&mut config.supported_tokens, token_type) = true;
        } else {
            table::add(&mut config.supported_tokens, token_type, true);
        };

        event::emit(TokenSupportChanged {
            token_type,
            is_supported: true,
        });
    }

    /// Remove supported token type (admin only)
    public entry fun remove_supported_token<T>(
        config: &mut PaymentConfig,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);

        let token_type = type_to_string<T>();

        if (table::contains(&config.supported_tokens, token_type)) {
            *table::borrow_mut(&mut config.supported_tokens, token_type) = false;
        };

        event::emit(TokenSupportChanged {
            token_type,
            is_supported: false,
        });
    }

    /// Update platform fee (admin only)
    public entry fun update_platform_fee(
        config: &mut PaymentConfig,
        new_fee_bps: u64,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);
        assert!(new_fee_bps <= MAX_PLATFORM_FEE_BPS, E_INVALID_COMMISSION);

        let old_fee_bps = config.platform_fee_bps;
        config.platform_fee_bps = new_fee_bps;

        event::emit(PlatformFeeUpdated {
            old_fee_bps,
            new_fee_bps,
        });
    }

    /// Pause the contract (admin only)
    public entry fun pause(
        config: &mut PaymentConfig,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);
        config.is_paused = true;
    }

    /// Unpause the contract (admin only)
    public entry fun unpause(
        config: &mut PaymentConfig,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_ADMIN);
        config.is_paused = false;
    }

    /// Helper function to convert type to string
    fun type_to_string<T>(): String {
        let type_name = std::type_name::get<T>();
        string::utf8(std::ascii::into_bytes(type_name))
    }

    /// View functions

    public fun get_hot_wallet(config: &PaymentConfig): address {
        config.hot_wallet
    }

    public fun get_platform_fee(config: &PaymentConfig): u64 {
        config.platform_fee_bps
    }

    public fun is_paused(config: &PaymentConfig): bool {
        config.is_paused
    }

    public fun is_order_processed(config: &PaymentConfig, order_id: vector<u8>): bool {
        table::contains(&config.processed_orders, order_id)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        initialize(@0x1, ctx);
    }
}
