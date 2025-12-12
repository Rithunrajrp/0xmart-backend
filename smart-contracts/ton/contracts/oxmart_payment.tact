// 0xMart Payment Processing Contract for TON
// Handles stablecoin payments for the 0xMart e-commerce platform
//
// Features:
// - Process single and batch payments
// - Support multiple jetton (token) types
// - Commission tracking for API partners
// - Platform fee management
// - Hot wallet integration
// - Order deduplication
// - Emergency pause mechanism

import "@stdlib/deploy";

// Payment received message
message PaymentReceived {
    orderId: String;
    buyer: Address;
    tokenAddress: Address;
    amount: Int as coins;
    platformFee: Int as coins;
    apiKeyOwner: Address;
    commission: Int as coins;
    commissionBps: Int as uint16;
    productId: String;
}

// Process single payment message
message ProcessPayment {
    orderId: String;
    tokenAddress: Address;
    amount: Int as coins;
    productId: String;
    apiKeyOwner: Address;
    commissionBps: Int as uint16;
}

// Process batch payment message
message ProcessBatchPayment {
    orderId: String;
    tokenAddress: Address;
    totalAmount: Int as coins;
    productIds: String; // Comma-separated product IDs
    apiKeyOwner: Address;
    commissionBps: Int as uint16;
}

// Admin messages
message UpdateHotWallet {
    newHotWallet: Address;
}

message UpdatePlatformFee {
    newFeeBps: Int as uint16;
}

message AddSupportedToken {
    tokenAddress: Address;
}

message RemoveSupportedToken {
    tokenAddress: Address;
}

message PauseContract {}
message UnpauseContract {}

// Emergency withdrawal
message EmergencyWithdraw {
    tokenAddress: Address;
}

// Contract state
contract OxMartPayment with Deployable {
    // Constants
    const MAX_COMMISSION_BPS: Int = 10000; // 100%
    const MAX_PLATFORM_FEE_BPS: Int = 1000; // 10%

    // State variables
    owner: Address;
    hotWallet: Address;
    platformFeeBps: Int as uint16 = 0; // No fee initially
    isPaused: Bool = false;

    // Mappings
    supportedTokens: map<Address, Bool>;
    processedOrders: map<Int, Bool>; // Store hash of order ID

    // Initialize contract
    init(hotWallet: Address) {
        self.owner = sender();
        self.hotWallet = hotWallet;
    }

    // Process single payment
    receive(msg: ProcessPayment) {
        // Check if paused
        require(!self.isPaused, "Contract is paused");

        // Hash order ID to use as map key
        let orderHash: Int = msg.orderId.asSlice().hash();

        // Check if order already processed
        require(self.processedOrders.get(orderHash) == null, "Order already processed");

        // Check if token is supported
        let isSupported: Bool? = self.supportedTokens.get(msg.tokenAddress);
        require(isSupported != null && isSupported!!, "Token not supported");

        // Validate amount
        require(msg.amount > 0, "Invalid amount");

        // Validate commission
        require(msg.commissionBps <= self.MAX_COMMISSION_BPS, "Invalid commission");

        // Mark order as processed
        self.processedOrders.set(orderHash, true);

        // Calculate fees
        let platformFee: Int = (msg.amount * self.platformFeeBps) / 10000;
        let commission: Int = (msg.amount * msg.commissionBps) / 10000;
        let netAmount: Int = msg.amount - platformFee;

        // Transfer to hot wallet would happen via jetton transfer
        // In TON, jettons are transferred via separate jetton wallet contracts
        // This is handled by the frontend/backend integration

        // Emit payment received event
        emit(PaymentReceived{
            orderId: msg.orderId,
            buyer: sender(),
            tokenAddress: msg.tokenAddress,
            amount: msg.amount,
            platformFee: platformFee,
            apiKeyOwner: msg.apiKeyOwner,
            commission: commission,
            commissionBps: msg.commissionBps,
            productId: msg.productId
        }.toCell());
    }

    // Process batch payment
    receive(msg: ProcessBatchPayment) {
        require(!self.isPaused, "Contract is paused");

        // Hash order ID to use as map key
        let orderHash: Int = msg.orderId.asSlice().hash();
        require(self.processedOrders.get(orderHash) == null, "Order already processed");

        let isSupported: Bool? = self.supportedTokens.get(msg.tokenAddress);
        require(isSupported != null && isSupported!!, "Token not supported");

        require(msg.totalAmount > 0, "Invalid amount");
        require(msg.commissionBps <= self.MAX_COMMISSION_BPS, "Invalid commission");

        self.processedOrders.set(orderHash, true);

        let platformFee: Int = (msg.totalAmount * self.platformFeeBps) / 10000;
        let commission: Int = (msg.totalAmount * msg.commissionBps) / 10000;

        emit(PaymentReceived{
            orderId: msg.orderId,
            buyer: sender(),
            tokenAddress: msg.tokenAddress,
            amount: msg.totalAmount,
            platformFee: platformFee,
            apiKeyOwner: msg.apiKeyOwner,
            commission: commission,
            commissionBps: msg.commissionBps,
            productId: "BATCH"
        }.toCell());
    }

    // Update hot wallet (admin only)
    receive(msg: UpdateHotWallet) {
        require(sender() == self.owner, "Only owner");
        let oldWallet: Address = self.hotWallet;
        self.hotWallet = msg.newHotWallet;

        // Emit event
        self.reply("HotWalletUpdated".asComment());
    }

    // Add supported token (admin only)
    receive(msg: AddSupportedToken) {
        require(sender() == self.owner, "Only owner");
        self.supportedTokens.set(msg.tokenAddress, true);
        self.reply("TokenAdded".asComment());
    }

    // Remove supported token (admin only)
    receive(msg: RemoveSupportedToken) {
        require(sender() == self.owner, "Only owner");
        self.supportedTokens.set(msg.tokenAddress, false);
        self.reply("TokenRemoved".asComment());
    }

    // Update platform fee (admin only)
    receive(msg: UpdatePlatformFee) {
        require(sender() == self.owner, "Only owner");
        require(msg.newFeeBps <= self.MAX_PLATFORM_FEE_BPS, "Fee too high");
        self.platformFeeBps = msg.newFeeBps;
        self.reply("PlatformFeeUpdated".asComment());
    }

    // Pause contract (admin only)
    receive(msg: PauseContract) {
        require(sender() == self.owner, "Only owner");
        self.isPaused = true;
        self.reply("ContractPaused".asComment());
    }

    // Unpause contract (admin only)
    receive(msg: UnpauseContract) {
        require(sender() == self.owner, "Only owner");
        self.isPaused = false;
        self.reply("ContractUnpaused".asComment());
    }

    // Emergency withdraw (admin only)
    receive(msg: EmergencyWithdraw) {
        require(sender() == self.owner, "Only owner");
        // Emergency withdrawal logic
        // In TON, this would involve jetton transfers
        self.reply("EmergencyWithdrawInitiated".asComment());
    }

    // Getter functions
    get fun hotWallet(): Address {
        return self.hotWallet;
    }

    get fun platformFeeBps(): Int {
        return self.platformFeeBps;
    }

    get fun isPaused(): Bool {
        return self.isPaused;
    }

    get fun isTokenSupported(tokenAddress: Address): Bool {
        let isSupported: Bool? = self.supportedTokens.get(tokenAddress);
        if (isSupported == null) {
            return false;
        }
        return isSupported!!;
    }

    get fun isOrderProcessed(orderId: String): Bool {
        let orderHash: Int = orderId.asSlice().hash();
        let processed: Bool? = self.processedOrders.get(orderHash);
        if (processed == null) {
            return false;
        }
        return processed!!;
    }
}
