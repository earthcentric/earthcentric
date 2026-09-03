import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getCredential } from "./credentials";

let cashfreeClient: Cashfree | null = null;

export async function isCashfreeConfigured(): Promise<boolean> {
  const appId = await getCredential("CASHFREE_APP_ID");
  const secretKey = await getCredential("CASHFREE_SECRET_KEY");
  return !!appId && !!secretKey;
}

export async function getCashfreeClient(): Promise<Cashfree | null> {
  if (cashfreeClient) return cashfreeClient;

  const appId = await getCredential("CASHFREE_APP_ID") || process.env.CASHFREE_APP_ID;
  const secretKey = await getCredential("CASHFREE_SECRET_KEY") || process.env.CASHFREE_SECRET_KEY;
  const env = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";
  
  if (!appId || !secretKey) {
    console.warn("Cashfree keys missing, falling back to mock");
    return null;
  }
  
  const environment = env === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  cashfreeClient = new Cashfree(environment, appId, secretKey);
  return cashfreeClient;
}

export async function createCashfreeOrder(options: { amount: number; orderId: string; customer: { id: string, name: string, email: string, phone: string } }) {
  const client = await getCashfreeClient();
  const isMock = !client || process.env.DATABASE_URL?.includes("mock");

  if (isMock) {
    return {
      payment_session_id: `mock_session_${Math.random().toString(36).substring(2, 9)}`,
      order_id: `order_mock_${options.orderId}`,
    };
  }

  try {
    const request = {
      order_amount: options.amount,
      order_currency: "INR",
      order_id: options.orderId,
      customer_details: {
        customer_id: options.customer.id.substring(0, 50),
        customer_name: options.customer.name.substring(0, 100),
        customer_email: options.customer.email,
        customer_phone: options.customer.phone || "9999999999",
      },
      order_meta: {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/checkout?order_id={order_id}`
      }
    };
    
    // According to v6 SDK, we call instance methods without API version param first
    const response = await client!.PGCreateOrder(request);
    return response.data;
  } catch (error: any) {
    console.error("Cashfree order creation failed:", error?.response?.data || error);
    throw new Error("Failed to create Cashfree order");
  }
}

export async function verifyPaymentSignature(orderId: string): Promise<boolean> {
  const client = await getCashfreeClient();
  
  const isMock = !client || process.env.DATABASE_URL?.includes("mock");
  if (isMock || orderId.startsWith("order_mock_")) return true;

  try {
    const response = await client!.PGOrderFetchPayments(orderId);
    
    // Check if any payment is successful
    const payments = response.data;
    if (Array.isArray(payments)) {
       return payments.some((payment: any) => payment.payment_status === "SUCCESS");
    }
    return false;
  } catch (error: any) {
    console.error("Failed to verify Cashfree payment:", error?.response?.data || error);
    return false;
  }
}
