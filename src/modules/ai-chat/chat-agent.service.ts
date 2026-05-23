import { Injectable, Logger } from '@nestjs/common';
import {
  LLMGatewayService,
  LLMMessage,
  StreamedToolCall,
} from '../ai-infrastructure/llm-gateway.service';
import { SessionService } from './session.service';
import { ToolRegistryService, ToolResult } from './tool-registry.service';
import { ChatRole } from '@prisma/client';
import { OxlienSettingsService } from '../oxlien/oxlien-settings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LRUCache } from 'lru-cache';

// ─── Stream event types ───────────────────────────────────────────────────

export type ChatStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking' }
  | { type: 'tool_start'; toolName: string; toolInput: any }
  | { type: 'tool_result'; toolName: string; result: any }
  | { type: 'cart_action'; action: string; productId: string; quantity: number; name: string; price: number }
  | { type: 'confirmation_request'; toolName: string; toolInput: any; message: string }
  | { type: 'session'; sessionId: string }
  | { type: 'error'; message: string };

/** Called by the gateway when a confirmation gate is hit.  Returns true = proceed, false = deny. */
export type ConfirmationHandler = (
  toolName: string,
  toolInput: any,
  message: string,
) => Promise<boolean>;

// ─── Types ─────────────────────────────────────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ChatResponse {
  message: string;
  products?: any[];
  actions?: string[];
  sessionId: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Tools that require explicit user confirmation before execution. */
const CONFIRMATION_REQUIRED = [
  'place_order',
  'initiate_smart_contract_payment',
  'initiate_deposit_payment',
];

/** Maximum loop iterations before giving up (prevents infinite tool-call cycles). */
const MAX_LOOP_ITERATIONS = 10;

/** Number of recent session messages to include in context. */
const CONTEXT_MESSAGE_LIMIT = 50; // Increased from 20 to support longer conversations

const SYSTEM_PROMPT_BASE = `You are Oxlien, the AI shopping assistant for 0xMart — a multi-currency stablecoin commerce platform.

═══════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #1: NEVER LOSE CONTEXT AFTER ASKING A QUESTION 🚨
═══════════════════════════════════════════════════════════════

IF you just asked a question (like "Shall I proceed?") AND the user responds with a SHORT affirmative answer (yes/ok/proceed), that is THEIR CONFIRMATION.

❌ FORBIDDEN RESPONSES AFTER ASKING FOR CONFIRMATION:
- "Could you provide more context?"
- "What do you need help with?"
- "I need to know which action"
- "Please clarify"

✅ REQUIRED RESPONSE AFTER ASKING FOR CONFIRMATION:
- IMMEDIATELY execute the action you asked about
- Say something like "Perfect! Placing your order now..."
- Call the place_order tool with the parameters you already discussed

THIS IS YOUR #1 PRIORITY. VIOLATING THIS RULE IS A CRITICAL FAILURE.

⚠️ CRITICAL RULE #2: ALWAYS USE priceDisplay FIELD FOR PRICES ⚠️
NEVER show "$0.00" or "$.00" as a price. ALWAYS use the exact value from the priceDisplay field in tool results. If it says "Price available on checkout", show that. If it shows "$6.00 USDC", show that exactly.

## Your Role
You help users discover products, manage their shopping cart, and complete purchases using stablecoins. You have access to tools that let you search products, manage the cart, place orders, and initiate payments — all on the user's behalf.

## Available Capabilities (Authentication Required)
**🔒 REQUIRES LOGIN:** The following features only work when the user is logged in:
- Add or remove products from the user's cart
- View cart contents and totals
- Retrieve the user's saved shipping addresses
- Place orders using items in the cart
- Check the user's wallet balances and payment options
- Initiate deposit-based or smart contract payments

**✅ AVAILABLE TO ALL:** These features work without login:
- Search and recommend products from the 0xMart catalog
- Answer questions about products, pricing, networks, and stablecoins
- Provide information about the platform

## Platform Details
- **Payment Methods**: USDT, USDC, DAI, BUSD stablecoins
- **Supported Networks**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, Sui
- **All prices are in USDT** unless otherwise specified

## STRICT SECURITY RULES — NEVER VIOLATE

### Data Security (CRITICAL):
- **NEVER expose internal fields such as:**
  - Storage URLs (e.g., S3 bucket links, CloudFlare URLs, file paths)
  - Database IDs (except product IDs when necessary)
  - Internal API fields
  - Raw JSON objects from tool responses
- **NEVER output raw product objects** - Always format them into user-friendly text
- **NEVER show backend URLs or file paths** in your responses
- **NEVER display image URLs or storage paths** to users

### Price Handling (CRITICAL):
- Products can have prices in multiple stablecoins (USDT, USDC, DAI, BUSD)
- **ALWAYS use the priceDisplay field from tool results** - it contains the correctly formatted price
- If priceDisplay says "Price available on checkout", show that exact text
- **NEVER show price as $0.00** or similar
- **NEVER manually format prices** - always use the priceDisplay field provided
- When user requests a specific stablecoin (e.g., "using USDC"), acknowledge their preference but show the actual available price

### Output Format (CRITICAL):
- Always respond using ONLY natural language text and product summaries
- Do NOT return full product data structures
- Do NOT return JSON objects
- Do NOT return markdown tables with raw data
- Format product information like this:

**Product Name**
Short description here.
Key Features:
• Feature 1
• Feature 2
• Feature 3
Price: [USE THE priceDisplay FIELD EXACTLY AS PROVIDED]

**Example of correct price display:**
✅ CORRECT: "Price: $6.00 USDC" (from priceDisplay field)
✅ CORRECT: "Price available on checkout" (when priceDisplay says this)
❌ WRONG: "Price: $0.00 USDT" (never show $0.00)
❌ WRONG: "Price: $.00 USDT" (never show missing digits)

### If Internal Fields Detected:
If you accidentally include URLs, IDs, or raw product objects in your response, immediately regenerate your answer without them. Think of product information as something to summarize and present naturally, not data to dump.

## Critical Rules — MUST FOLLOW EXACTLY

1. **Always search before adding to cart.** Never guess a product ID. Call search_products first, then use the returned ID with add_to_cart.

2. **YOU MUST PROVIDE TEXT WITH EVERY RESPONSE — NO EXCEPTIONS:**
   - After search_products → Explain what you found: "I found [X] products for you:" (then products display)
   - After add_to_cart → Confirm: "✓ Added [Product Name] ($XX.XX) to your cart."
   - After get_cart → Summarize: "Your cart has [X] items totaling $XX.XX"
   - **NEVER send only tool calls without text.** Users see blank messages if you don't provide text.
   - **When calling multiple tools**, provide text after EACH tool result explaining what happened.

3. **Check authentication before cart/payment actions.** {{AUTH_STATUS}} If user tries to add to cart, place order, or make payment, politely inform them: "To add items to your cart and checkout, please sign in to your 0xMart account first. You can browse products without logging in!"

4. **Be efficient - minimize tool calls.** Don't call get_cart unnecessarily. After add_to_cart, you already know what's in the cart - just present it to the user.

5. **Never call place_order or payment tools without user confirmation.** These tools have server-side confirmation gates. Wait for the user to say yes.

6. **If a product is not found, tell the user and suggest alternatives.**

7. **Be concise but informative.** Give actionable responses — avoid over-explaining, but always explain tool results.

8. **Never fabricate product information.** Only use data returned from tool calls.

## Typical Conversation Flow (Logged In Users)

### Standard Flow (Step-by-Step):
- User says what they want → search_products → present results → ask if they want to add any
- User confirms → add_to_cart → confirm addition → ask if they want more or want to check out
- Checkout → get_cart → summarize → get_user_addresses → user picks address → place_order (confirmation gate) → get_payment_options → user picks method → initiate payment (confirmation gate)

### Express Flow (Natural Language Commands):
When users give purchase instructions with payment details, be efficient and streamlined:

**Example**: "buy me a lip balm using USDC on Sui network"

**Efficient Flow (IMPORTANT: Provide text after EVERY step):**

1. **Call** search_products with query "lip balm"
   **Then immediately say**: "I found [X] lip balm products for you:" (products will display below)

2. If 1 result: Add it immediately. If multiple: Pick most relevant OR ask user which one

3. **Call** add_to_cart with the selected product
   **Then immediately say**: "✓ Added [Product Name] ($XX.XX) to your cart."

4. **Check payment method**:
   - If user said "smart contract" / "wallet" / "wallet popup" → Smart contract (no need to ask)
   - If user said "deposit" / "deposit address" / "manual transfer" → Deposit address (no need to ask)
   - **If ONLY network mentioned**: **Ask**: "Would you like to pay via Smart Contract (wallet popup) or Deposit Address (manual transfer)?"

5. **Get shipping address**: Call get_user_addresses to get their default address

6. **Summarize and ask for final confirmation**:
   "I'll place your order for [Product Name] ($XX.XX USDC on Sui network) shipping to [Address]. Shall I proceed?"

7. **Final Confirmation and Order Placement**:

   **ASK FOR CONFIRMATION:**
   Say: "I'll place your order for [Product] ($XX.XX USDC on SUI network) shipping to [Address]. Shall I proceed?"

   **WHEN USER RESPONDS WITH "yes" (or any affirmative):**
   - ⚠️ **DO NOT ASK ANYTHING ELSE**
   - ⚠️ **DO NOT SAY "Could you provide more context?"**
   - ⚠️ **IMMEDIATELY call place_order** with parameters from the original request
     (stablecoin: "USDC", networkId: "SUI", addressId from get_user_addresses)
   - Then say: "Perfect! Placing your order now..."
   - After place_order succeeds, call initiate_smart_contract_payment or initiate_deposit_payment

8. **⚠️ CRITICAL ANTI-PATTERN - NEVER DO THIS:**

   WRONG: After asking "Shall I proceed?" and user says "yes", responding with "Could you please provide more context?"

   CORRECT: After asking "Shall I proceed?" and user says "yes", IMMEDIATELY call place_order tool and say "Perfect! Placing your order..."

**CRITICAL**: Every time you call a tool, you MUST provide explanatory text in the same response. Never end a turn with just tool calls - always include text explaining what you're doing or what happened.

**Natural Language Parsing**:
- **Network**: "on Sui" = SUI, "on Polygon" = POLYGON, "ethereum" = ETHEREUM, "BSC" = BSC, etc.
- **Stablecoin**: "using USDC" = USDC, "with USDT" = USDT, "DAI" = DAI, "BUSD" = BUSD
- **Payment Method** (IMPORTANT - check user's exact words):
  - "smart contract" / "wallet" / "wallet popup" / "from my wallet" = Smart contract (don't ask again!)
  - "deposit" / "deposit address" / "transfer" / "send manually" = Deposit address (don't ask again!)
  - ONLY network/coin mentioned = Ask which method

**Supported networks**: ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM, AVALANCHE, BASE, SUI, TON, SOLANA
**Supported stablecoins**: USDT, USDC, DAI, BUSD

**Performance Tips**:
- Don't call get_cart after add_to_cart - you already know what's in the cart
- Present products immediately after search_products tool result
- Be direct and efficient - fewer messages = happier users

## Context and Memory Rules — CRITICAL FOR EVERY RESPONSE ⚠️

**⚠️ ABSOLUTE PRIORITY: NEVER LOSE CONTEXT AFTER ASKING A QUESTION ⚠️**

If you just asked the user a question (like "Shall I proceed?") and they respond with a short answer (like "yes" or "proceed"), that is ALWAYS an answer to YOUR question, not a random new request.

### Pattern 1: Order Confirmation Response ⚠️ CRITICAL ⚠️
**IF your last message contained ANY of these phrases:**
- "Shall I proceed?"
- "Shall I go ahead?"
- "Should I place the order?"
- "Ready to proceed?"
- "May I proceed?"

**AND user's current message is ANY affirmative:**
- "yes", "yep", "yeah", "y", "yup", "sure", "ok", "okay", "go ahead", "proceed", "do it", "confirm", "approved"

**THEN you MUST:**
1. ⚠️ IMMEDIATELY call place_order tool with the parameters you mentioned (stablecoin, networkId, addressId from previous messages)
2. ⚠️ DO NOT ask "What do you need help with?"
3. ⚠️ DO NOT say "Could you please provide more context?"
4. ⚠️ DO NOT forget the order details you just presented
5. ⚠️ The user is confirming - PROCEED WITH THE ACTION

**Example conversation:**
- Assistant asks: "I'll place your order for Manjistha Lip Balm ($6.00 USDC on SUI Network). Shall I proceed?"
- User responds: "yes"
- ✅ CORRECT: Assistant IMMEDIATELY calls place_order tool and says: "Perfect! Placing your order now..."
- ❌ WRONG: "Could you please provide more context?" (THIS IS A CRITICAL ERROR)

### Pattern 2: Product Selection Response
**IF your last message showed products and asked "Which one?" or "Would you like me to add this?"**
**AND user responds with selection or confirmation**
**THEN proceed with adding that product to cart**

### Pattern 3: General Follow-up
**ALWAYS read at least the last 3 messages in conversation history**
- If user is responding to YOUR question, treat it as an answer to that question
- NEVER respond with "Could you please provide more context?" if YOU just asked them a question

**VIOLATIONS OF THESE RULES ARE CRITICAL ERRORS:**
- Losing context after asking for confirmation = FAILURE
- Asking "What do you need help with?" after presenting order summary = FAILURE
- Not recognizing "yes" as confirmation = FAILURE

## Communication Style
- Friendly, helpful, and professional
- Clear and concise
- Remember recent conversation context - don't ask users to repeat themselves
- Always mention prices in USDT
- Guide the user step by step through the shopping flow
- When users aren't logged in, encourage them to browse products and guide them to sign in when they're ready to purchase
- Support both conversational (step-by-step) and command-style (express) purchase flows`;

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class ChatAgentService {
  private readonly logger = new Logger(ChatAgentService.name);

  /**
   * Session-scoped cart state.  Ephemeral — lives as long as the service
   * instance.  Keyed by session ID.  Cleared after a successful order.
   * Uses LRU cache with 24h TTL to prevent memory leaks.
   */
  private sessionCarts = new LRUCache<string, CartItem[]>({
    max: 1000, // Maximum 1000 sessions in memory
    ttl: 1000 * 60 * 60 * 24, // 24 hours TTL
  });
  /** Set when auto-pay passes for place_order; cleared after payment initiation. */
  private sessionAutoPayApproved = new LRUCache<string, boolean>({
    max: 1000,
    ttl: 1000 * 60 * 60 * 24, // 24 hours TTL
  });

  constructor(
    private llmGateway: LLMGatewayService,
    private sessionService: SessionService,
    private toolRegistry: ToolRegistryService,
    private oxlienSettingsService: OxlienSettingsService,
    private prisma: PrismaService,
  ) {}

  // ─── Non-streaming chat (HTTP fallback) ─────────────────────────────────

  async chat(
    message: string,
    sessionId?: string,
    userId?: string,
    context?: any,
  ): Promise<ChatResponse> {
    try {
      let session;
      if (sessionId) {
        session = await this.sessionService.getSession(sessionId);
        if (!session) throw new Error('Session not found');
      } else {
        const guestId = userId ? undefined : this.generateGuestId();
        session = await this.sessionService.createSession(userId, guestId, context);
      }

      // Auto-generate session title from first user message (if not already set)
      // Check BEFORE adding the message to ensure this is truly the first message
      if (session.messages.length === 0) {
        await this.sessionService.generateSessionTitle(session.id, message);
      }

      await this.sessionService.addMessage(session.id, ChatRole.USER, message);

      const messages = this.buildMessages(session.messages, message, userId);
      const tools = this.toolRegistry.getTools();

      const response = await this.llmGateway.chatWithTools(messages, tools, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      let finalResponse = response.content;
      let suggestedProducts: any[] = [];

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(response.toolCalls, userId);
        const toolMessages = this.buildToolMessages(response.toolCalls, toolResults);

        finalResponse = await this.llmGateway.chat([
          ...messages,
          { role: 'assistant', content: response.content || '', tool_calls: response.toolCalls },
          ...toolMessages,
        ]);

        suggestedProducts = this.extractProducts(toolResults);
      }

      await this.sessionService.addMessage(
        session.id,
        ChatRole.ASSISTANT,
        finalResponse,
        { products: suggestedProducts },
      );

      return {
        message: finalResponse,
        products: suggestedProducts.length > 0 ? suggestedProducts : undefined,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ─── Streaming agentic loop ─────────────────────────────────────────────

  /**
   * Multi-turn streaming agentic loop.
   *
   * - Streams GPT-4 text chunks to the client in real time.
   * - When GPT-4 emits tool calls, accumulates them, executes them
   *   (with confirmation gates for destructive actions), feeds results
   *   back into the conversation, and loops.
   * - Terminates when GPT-4 produces a text-only response or after
   *   MAX_LOOP_ITERATIONS.
   *
   * Cart operations (add/remove/get) are handled locally using an
   * in-memory session cart so the agent can reason about cart state
   * without a backend cart service.  A `cart_action` event is emitted
   * for each cart mutation so the frontend Zustand store stays in sync.
   */
  async *chatStreamAgentic(
    message: string,
    sessionId: string | undefined,
    userId: string | undefined,
    onConfirmation: ConfirmationHandler,
  ): AsyncIterableIterator<ChatStreamEvent> {
    let session;

    try {
      // ── session ──
      if (sessionId) {
        session = await this.sessionService.getSession(sessionId);
        if (!session) throw new Error('Session not found');
      } else {
        const guestId = userId ? undefined : this.generateGuestId();
        session = await this.sessionService.createSession(userId, guestId);
      }

      // Auto-generate session title from first user message (if not already set)
      // Check BEFORE adding the message to ensure this is truly the first message
      if (session.messages.length === 0) {
        // Fire and forget - don't await to avoid blocking the chat stream
        this.sessionService.generateSessionTitle(session.id, message).catch(err => {
          this.logger.warn(`Failed to auto-generate session title: ${err.message}`);
        });
      }

      await this.sessionService.addMessage(session.id, ChatRole.USER, message);

      // ── context ──
      const messages: LLMMessage[] = this.buildMessages(session.messages, message, userId);
      const tools = this.toolRegistry.getTools();

      // ── loop ──
      let finalResponseSaved = false;

      for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration++) {
        // Emit "thinking" for every iteration after the first (i.e. after
        // tool results have been fed back and we are re-prompting GPT-4).
        if (iteration > 0) {
          yield { type: 'thinking' };
        }

        // ── stream from GPT-4 ──
        let textResponse = '';
        let toolCalls: StreamedToolCall[] = [];

        for await (const event of this.llmGateway.chatStreamWithTools(
          messages,
          tools,
          { temperature: 0.7, maxTokens: 2000 },
        )) {
          switch (event.type) {
            case 'text':
              textResponse += event.content;
              // Sanitize output before streaming to client
              const sanitizedContent = this.sanitizeOutput(event.content);
              yield { type: 'text', content: sanitizedContent };
              break;
            case 'tool_calls':
              toolCalls = event.toolCalls;
              break;
            // 'done' — nothing to act on
          }
        }

        // ── no tool calls → final response ──
        if (toolCalls.length === 0) {
          if (textResponse) {
            // Sanitize before saving to session history
            const sanitizedResponse = this.sanitizeOutput(textResponse);
            await this.sessionService.addMessage(
              session.id,
              ChatRole.ASSISTANT,
              sanitizedResponse,
            );
            finalResponseSaved = true;
          }
          break;
        }

        // ── push assistant message (with any streamed text + tool_calls) ──
        messages.push({
          role: 'assistant',
          content: textResponse || '',
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // ── track if any text was provided with tools ──
        const hadTextWithTools = textResponse.length > 0;

        // ── execute each tool call ──
        for (const tc of toolCalls) {
          let args: any;
          try {
            args = JSON.parse(tc.arguments);
          } catch {
            args = {};
          }

          yield { type: 'tool_start', toolName: tc.name, toolInput: args };

          // ── auto-pay bypass ──
          let skipConfirmation = false;
          if (tc.name === 'place_order' && userId) {
            const cart = this.getSessionCart(session.id);
            const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
            const autoPayResult = await this.oxlienSettingsService.checkAutoPayLimits(
              userId,
              cartTotal,
              args.stablecoin || 'USDT',
              args.networkId || 'ETHEREUM',
            );
            if (autoPayResult.allowed) {
              skipConfirmation = true;
              this.sessionAutoPayApproved.set(session.id, true);
            }
          } else if (
            CONFIRMATION_REQUIRED.includes(tc.name) &&
            this.sessionAutoPayApproved.get(session.id)
          ) {
            // Payment tools inherit the session-level auto-pay approval
            skipConfirmation = true;
          }

          // ── confirmation gate ──
          if (CONFIRMATION_REQUIRED.includes(tc.name) && !skipConfirmation) {
            const confirmMsg = this.getConfirmationMessage(tc.name, args, session.id);
            yield { type: 'confirmation_request', toolName: tc.name, toolInput: args, message: confirmMsg };

            const confirmed = await onConfirmation(tc.name, args, confirmMsg);
            if (!confirmed) {
              const denyResult: ToolResult = { success: false, error: 'User declined this action.' };
              messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(denyResult) });
              yield { type: 'tool_result', toolName: tc.name, result: denyResult };
              continue;
            }
          }

          // ── execute ──
          const { result, cartAction } = await this.executeToolCall(
            tc.name,
            args,
            userId,
            session.id,
          );

          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });

          if (cartAction) {
            yield { type: 'cart_action', ...cartAction };
          }

          yield { type: 'tool_result', toolName: tc.name, result };

          // Clear auto-pay session flag after payment is initiated
          if (
            tc.name === 'initiate_smart_contract_payment' ||
            tc.name === 'initiate_deposit_payment'
          ) {
            this.sessionAutoPayApproved.delete(session.id);
          }
        }

        // ── force explanation if no text was provided with tool calls ──
        if (!hadTextWithTools) {
          messages.push({
            role: 'system',
            content: 'You just called tools but provided no explanatory text. Users cannot see tool calls - they only see your text responses. You MUST now explain what the tools did and what the results mean. Provide a clear, helpful text response explaining the action you just took.',
          });
        }

        // ── loop continues — GPT-4 sees the tool results ──
      }

      if (!finalResponseSaved) {
        yield {
          type: 'error',
          message: 'Reached maximum processing steps. Please try simplifying your request.',
        };
      }

      yield { type: 'session', sessionId: session.id };
    } catch (error) {
      this.logger.error(`Agentic stream error: ${error.message}`, error.stack);
      yield { type: 'error', message: error.message };
      if (session) yield { type: 'session', sessionId: session.id };
    }
  }

  // ─── Tool execution ──────────────────────────────────────────────────────

  /**
   * Route a single tool call.  Cart tools are handled locally; everything
   * else is delegated to ToolRegistryService.
   */
  private async executeToolCall(
    toolName: string,
    args: any,
    userId: string | undefined,
    sessionId: string,
  ): Promise<{ result: ToolResult; cartAction?: { action: string; productId: string; quantity: number; name: string; price: number } }> {
    switch (toolName) {
      case 'add_to_cart': {
        if (!userId) return { result: { success: false, error: 'Authentication required to modify cart' } };

        const product = await this.toolRegistry.getProductById(args.productId);
        if (!product) return { result: { success: false, error: 'Product not found' } };

        // Extract first non-zero price and add 20% markup (same logic as search_products)
        let merchantPrice = 0;
        if (product.prices && Array.isArray(product.prices) && product.prices.length > 0) {
          const validPrice = product.prices.find((price: any) => {
            const val = parseFloat(price.price?.toString() || '0');
            return val > 0;
          });
          if (validPrice) {
            merchantPrice = parseFloat(validPrice.price.toString());
          }
        }
        // Apply 20% markup for customer-facing price
        const productPrice = merchantPrice > 0 ? merchantPrice * 1.20 : 0;

        const cart = this.getSessionCart(sessionId);
        const qty = args.quantity || 1;
        const existing = cart.find((i) => i.productId === args.productId);

        if (existing) {
          existing.quantity += qty;
        } else {
          cart.push({
            productId: args.productId,
            name: product.name,
            price: productPrice,
            quantity: qty,
          });
        }

        return {
          result: {
            success: true,
            data: { productId: args.productId, name: product.name, quantity: qty, price: productPrice },
          },
          cartAction: { action: 'add', productId: args.productId, quantity: qty, name: product.name, price: productPrice },
        };
      }

      case 'remove_from_cart': {
        const cart = this.getSessionCart(sessionId);
        const idx = cart.findIndex((i) => i.productId === args.productId);

        if (idx < 0) {
          return { result: { success: false, error: 'Item not in cart' } };
        }

        const removed = cart[idx];
        cart.splice(idx, 1);

        return {
          result: { success: true, data: { removed: args.productId } },
          cartAction: { action: 'remove', productId: args.productId, quantity: 0, name: removed.name, price: removed.price },
        };
      }

      case 'get_cart': {
        const cart = this.getSessionCart(sessionId);
        const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

        return {
          result: {
            success: true,
            data: { items: cart, total: total.toFixed(2), currency: 'USDT', itemCount: cart.length },
          },
        };
      }

      case 'place_order': {
        if (!userId) return { result: { success: false, error: 'Authentication required' } };

        const cart = this.getSessionCart(sessionId);
        if (cart.length === 0) return { result: { success: false, error: 'Cart is empty. Add products first.' } };

        // Inject cart items into args for the registry
        const result = await this.toolRegistry.executeTool(
          'place_order',
          { ...args, items: cart },
          userId,
        );

        // Clear session cart on successful order
        if (result.success) {
          this.sessionCarts.delete(sessionId);

          // Perform database operations in a transaction for atomicity
          if (result.data?.orderId) {
            await this.prisma.$transaction(async (tx) => {
              // Flag order for auto-pay audit trail
              if (this.sessionAutoPayApproved.get(sessionId)) {
                await tx.order.update({
                  where: { id: result.data.orderId },
                  data: { autoPayUsed: true },
                });
              }

              // Link session to order for expiry tracking (10 days after delivery)
              await tx.chatSession.update({
                where: { id: sessionId },
                data: { relatedOrderId: result.data.orderId },
              });
            });
          }
        }

        return { result };
      }

      default:
        return { result: await this.toolRegistry.executeTool(toolName, args, userId) };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Validates and sanitizes AI output to prevent sensitive data leaks.
   * Filters out S3 URLs, storage paths, and other internal fields.
   */
  private sanitizeOutput(text: string): string {
    if (!text) return text;

    // Patterns that indicate sensitive data leaks
    const sensitivePatterns = [
      /https?:\/\/[^\s]*s3[^\s]*/gi,                    // S3 URLs
      /https?:\/\/[^\s]*cloudflare[^\s]*/gi,            // CloudFlare URLs
      /https?:\/\/[^\s]*amazonaws[^\s]*/gi,             // AWS URLs
      /https?:\/\/[^\s]*blob[^\s]*/gi,                  // Blob storage URLs
      /https?:\/\/[^\s]*storage[^\s]*/gi,               // Generic storage URLs
      /"image":\s*"https?:\/\/[^"]*"/gi,                // JSON image fields
      /"imageUrl":\s*"https?:\/\/[^"]*"/gi,             // JSON imageUrl fields
      /"url":\s*"https?:\/\/[^"]*"/gi,                  // JSON url fields
      /\{[^}]*"id":\s*"[^"]*"[^}]*\}/gi,                // Raw JSON objects with IDs
    ];

    let sanitized = text;
    let hasLeaks = false;

    for (const pattern of sensitivePatterns) {
      if (pattern.test(sanitized)) {
        hasLeaks = true;
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      }
    }

    // Log warning if leaks were detected
    if (hasLeaks) {
      this.logger.warn('Sensitive data detected in AI output - sanitized before sending to client');
    }

    return sanitized;
  }

  private getSessionCart(sessionId: string): CartItem[] {
    if (!this.sessionCarts.has(sessionId)) {
      this.sessionCarts.set(sessionId, []);
    }
    return this.sessionCarts.get(sessionId)!;
  }

  private getConfirmationMessage(toolName: string, args: any, sessionId: string): string {
    switch (toolName) {
      case 'place_order': {
        const cart = this.getSessionCart(sessionId);
        const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
        return `Place order for ${cart.length} item(s) totaling $${total.toFixed(2)} USDT using ${args.stablecoin}?`;
      }
      case 'initiate_smart_contract_payment':
        return `Initiate smart contract payment on ${args.networkId} using ${args.stablecoin} for order ${args.orderId}?`;
      case 'initiate_deposit_payment':
        return `Generate deposit address on ${args.networkId} for ${args.stablecoin} payment of order ${args.orderId}?`;
      default:
        return `Confirm action: ${toolName}?`;
    }
  }

  private buildSystemPrompt(isAuthenticated: boolean): string {
    const authStatus = isAuthenticated
      ? 'The user is currently logged in and can use all features.'
      : 'The user is NOT logged in. They can browse products but cannot add to cart, place orders, or make payments.';

    return SYSTEM_PROMPT_BASE.replace('{{AUTH_STATUS}}', authStatus);
  }

  private buildMessages(sessionMessages: any[], newMessage?: string, userId?: string): LLMMessage[] {
    const systemPrompt = this.buildSystemPrompt(!!userId);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Sliding window: keep last N messages
    const recentMessages = sessionMessages.slice(-CONTEXT_MESSAGE_LIMIT);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role.toLowerCase() as any,
        content: msg.content,
      });
    }

    if (newMessage) {
      // ULTRA-AGGRESSIVE context preservation for confirmations
      if (recentMessages.length > 0 && this.isConfirmationResponse(newMessage)) {
        const lastAssistantMsg = [...recentMessages].reverse().find(m => m.role === 'ASSISTANT');
        if (lastAssistantMsg) {
          const lastContent = lastAssistantMsg.content.toLowerCase();

          // Check if last message was asking for confirmation
          const askedForConfirmation = lastContent.includes('shall i proceed') ||
              lastContent.includes('should i') ||
              lastContent.includes('ready to proceed') ||
              lastContent.includes('may i proceed') ||
              lastContent.includes('can i proceed') ||
              lastContent.includes('shall i go ahead');

          if (askedForConfirmation) {
            // Extract order details from previous messages
            let orderContext = '';
            for (let i = recentMessages.length - 1; i >= 0 && i >= recentMessages.length - 5; i--) {
              const msg = recentMessages[i];
              if (msg.role === 'ASSISTANT' && (
                msg.content.toLowerCase().includes('lip balm') ||
                msg.content.toLowerCase().includes('order') ||
                msg.content.toLowerCase().includes('usdc') ||
                msg.content.toLowerCase().includes('sui')
              )) {
                orderContext = msg.content;
                break;
              }
            }

            // CRITICAL: Replace the user's message with an expanded version that includes context
            newMessage = `YES, proceed with the order I just confirmed. [CONTEXT: I said "${newMessage}" in response to your question about proceeding with the order. You asked me to confirm placing an order, and I am confirming YES. DO NOT ask me for more details - I have already confirmed I want to proceed with the exact order you presented to me.]`;

            this.logger.debug(`Context injection triggered for confirmation: "${newMessage}"`);
          }
        }
      }

      messages.push({ role: 'user', content: newMessage });
    }

    return messages;
  }

  /**
   * Check if a message is a confirmation response
   */
  private isConfirmationResponse(message: string): boolean {
    const msg = message.toLowerCase().trim();
    const confirmations = [
      'yes', 'yep', 'yeah', 'y', 'yup', 'sure', 'ok', 'okay', 'go ahead',
      'proceed', 'do it', 'confirm', 'approved', 'correct', 'right',
      'that\'s right', 'sounds good', 'looks good', 'perfect'
    ];
    return confirmations.includes(msg) || msg.startsWith('yes ') || msg.startsWith('proceed ');
  }

  /** Execute tool calls for the non-streaming chat() path. */
  private async executeToolCalls(toolCalls: any[], userId?: string): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function?.name;
      const functionArgs = JSON.parse(toolCall.function?.arguments || '{}');

      const result = await this.toolRegistry.executeTool(
        functionName,
        functionArgs,
        userId,
      );

      results.push({ toolCallId: toolCall.id, functionName, result });
    }

    return results;
  }

  private buildToolMessages(toolCalls: any[], toolResults: any[]): LLMMessage[] {
    return toolResults.map((result, i) => ({
      role: 'tool',
      content: JSON.stringify(result.result),
      tool_call_id: toolCalls[i].id,
    }));
  }

  private extractProducts(toolResults: any[]): any[] {
    const products: any[] = [];

    for (const result of toolResults) {
      if (result.functionName === 'search_products' && result.result.success) {
        products.push(...result.result.data.products);
      } else if (result.functionName === 'get_product_details' && result.result.success) {
        products.push(result.result.data);
      }
    }

    return products;
  }

  private generateGuestId(): string {
    return `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
