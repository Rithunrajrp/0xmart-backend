declare module 'razorpay' {
  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }

  interface OrderOptions {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string>;
    payment_capture?: number;
  }

  interface Order {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string | null;
    status: string;
    attempts: number;
    notes: Record<string, string>;
    created_at: number;
  }

  class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(options: OrderOptions): Promise<Order>;
      fetch(orderId: string): Promise<Order>;
    };
    payments: {
      fetch(paymentId: string): Promise<any>;
    };
  }

  export = Razorpay;
}
