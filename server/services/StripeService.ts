import Stripe from 'stripe';
import type { Plan, InsertPlan } from '../../shared/schema.js';

export class StripeService {
  private stripe: Stripe;
  
  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-09-30.acacia',
    });
  }

  /**
   * Create a Stripe Product for a plan
   */
  async createProduct(plan: Plan): Promise<string> {
    try {
      const product = await this.stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          planId: plan.id,
          billingModel: plan.billingModel,
        },
      });
      
      return product.id;
    } catch (error) {
      console.error('Error creating Stripe product:', error);
      throw new Error(`Failed to create Stripe product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a Stripe Price for a plan (following price immutability principle)
   */
  async createPrice(plan: Plan, productId: string): Promise<string> {
    try {
      const priceData: Stripe.PriceCreateParams = {
        product: productId,
        unit_amount: plan.unitAmount,
        currency: plan.currency.toLowerCase(),
        tax_behavior: plan.taxBehavior || 'exclusive',
        metadata: {
          planId: plan.id,
          billingModel: plan.billingModel,
          priceChangePolicy: plan.priceChangePolicy || 'prorate_immediately',
        },
      };

      // Configure recurring vs one-time based on billing model
      if (plan.billingModel === 'flat_subscription' || plan.billingModel === 'per_seat' || plan.billingModel === 'metered_per_active_user') {
        priceData.recurring = {
          interval: plan.cadence === 'annual' ? 'year' : 'month',
          usage_type: plan.billingModel === 'metered_per_active_user' ? 'metered' : 'licensed',
        };
        
        // For metered billing, we don't set a quantity - usage records will be sent
        if (plan.billingModel === 'metered_per_active_user') {
          priceData.billing_scheme = 'per_unit';
        }
      }

      // Add trial period if specified
      if (plan.trialDays && plan.trialDays > 0) {
        priceData.recurring = {
          ...priceData.recurring,
          trial_period_days: plan.trialDays,
        };
      }

      const price = await this.stripe.prices.create(priceData);
      
      return price.id;
    } catch (error) {
      console.error('Error creating Stripe price:', error);
      throw new Error(`Failed to create Stripe price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync a plan with Stripe (create product if needed, always create new price)
   */
  async syncPlanToStripe(plan: Plan): Promise<{ productId: string; priceId: string }> {
    try {
      let productId = plan.stripeProductId;
      
      // Create product if it doesn't exist
      if (!productId) {
        productId = await this.createProduct(plan);
      }
      
      // Always create a new price (price immutability principle)
      const priceId = await this.createPrice(plan, productId);
      
      return { productId, priceId };
    } catch (error) {
      console.error('Error syncing plan to Stripe:', error);
      throw error;
    }
  }

  /**
   * Validate a plan's Stripe configuration
   */
  async validatePlanStripeConfig(plan: Plan): Promise<{
    planId: string;
    planName: string;
    expected: {
      unit_amount: number;
      currency: string;
      cadence: string;
      usage_type: string;
    };
    stripe: {
      product_id: string | null;
      price_id: string | null;
      unit_amount: number | null;
      currency: string | null;
      interval: string | null;
      usage_type: string | null;
    };
    status: 'match' | 'mismatch' | 'missing';
    mismatches: string[];
  }> {
    const result = {
      planId: plan.id,
      planName: plan.name,
      expected: {
        unit_amount: plan.unitAmount,
        currency: plan.currency.toLowerCase(),
        cadence: plan.cadence,
        usage_type: plan.billingModel === 'metered_per_active_user' ? 'metered' : 'licensed',
      },
      stripe: {
        product_id: plan.stripeProductId,
        price_id: plan.stripePriceId,
        unit_amount: null,
        currency: null,
        interval: null,
        usage_type: null,
      },
      status: 'missing' as 'match' | 'mismatch' | 'missing',
      mismatches: [] as string[],
    };

    try {
      if (!plan.stripeProductId || !plan.stripePriceId) {
        result.status = 'missing';
        result.mismatches.push('Missing Stripe Product ID or Price ID');
        return result;
      }

      // Fetch price from Stripe
      const price = await this.stripe.prices.retrieve(plan.stripePriceId);
      
      result.stripe.product_id = typeof price.product === 'string' ? price.product : price.product.id;
      result.stripe.price_id = price.id;
      result.stripe.unit_amount = price.unit_amount;
      result.stripe.currency = price.currency;
      result.stripe.interval = price.recurring?.interval || null;
      result.stripe.usage_type = price.recurring?.usage_type || null;

      // Check for mismatches
      if (price.unit_amount !== plan.unitAmount) {
        result.mismatches.push(`Unit amount mismatch: expected ${plan.unitAmount}, got ${price.unit_amount}`);
      }
      
      if (price.currency !== plan.currency.toLowerCase()) {
        result.mismatches.push(`Currency mismatch: expected ${plan.currency.toLowerCase()}, got ${price.currency}`);
      }
      
      const expectedInterval = plan.cadence === 'annual' ? 'year' : 'month';
      if (price.recurring?.interval !== expectedInterval) {
        result.mismatches.push(`Interval mismatch: expected ${expectedInterval}, got ${price.recurring?.interval}`);
      }
      
      const expectedUsageType = plan.billingModel === 'metered_per_active_user' ? 'metered' : 'licensed';
      if (price.recurring?.usage_type !== expectedUsageType) {
        result.mismatches.push(`Usage type mismatch: expected ${expectedUsageType}, got ${price.recurring?.usage_type}`);
      }

      result.status = result.mismatches.length === 0 ? 'match' : 'mismatch';
      
    } catch (error) {
      console.error('Error validating plan Stripe config:', error);
      result.mismatches.push(`Stripe API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.status = 'mismatch';
    }

    return result;
  }

  /**
   * Create a test checkout session for a plan
   */
  async createTestCheckoutSession(plan: Plan, organisationId: string): Promise<{ url: string; sessionId: string }> {
    try {
      if (!plan.stripePriceId) {
        throw new Error('Plan must have a Stripe Price ID to create checkout session');
      }

      // Create line item - don't include quantity for metered plans
      const lineItem: any = {
        price: plan.stripePriceId,
      };
      
      // Only add quantity for non-metered plans
      if (plan.billingModel !== 'metered_per_active_user') {
        lineItem.quantity = this.getQuantityForPlan(plan);
      }

      const sessionData: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [lineItem],
        success_url: `https://stripe.com/docs/testing/`,
        cancel_url: `https://stripe.com/docs/testing/`,
        metadata: {
          organisationId,
          planId: plan.id,
          billingModel: plan.billingModel,
          cadence: plan.cadence,
          test: 'true', // Mark as test
        },
      };

      // Add trial if specified
      if (plan.trialDays && plan.trialDays > 0) {
        sessionData.subscription_data = {
          trial_period_days: plan.trialDays,
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionData);
      
      if (!session.url) {
        throw new Error('Checkout session created but no URL returned');
      }

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Error creating test checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the appropriate quantity for a plan based on its billing model
   */
  private getQuantityForPlan(plan: Plan): number {
    switch (plan.billingModel) {
      case 'metered_per_active_user':
        // No quantity needed for metered billing - usage records will be sent
        return 1;
      case 'per_seat':
        // Default to minimum seats or 1
        return plan.minSeats || 1;
      case 'flat_subscription':
        // Always 1 for flat subscription
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Create a checkout session for updating an existing subscription
   */
  async createSubscriptionUpdateCheckoutSession(
    plan: Plan, 
    organisation: any, 
    userCount: number
  ): Promise<{ url: string; sessionId: string }> {
    try {
      if (!plan.stripePriceId) {
        throw new Error('Plan must have a Stripe Price ID to create checkout session');
      }

      // Create line item based on billing model
      const lineItem: any = {
        price: plan.stripePriceId,
      };
      
      // Set quantity based on billing model
      if (plan.billingModel === 'per_seat') {
        lineItem.quantity = Math.max(userCount, plan.minSeats || 1);
      } else if (plan.billingModel === 'flat_subscription') {
        lineItem.quantity = 1;
      }
      // For metered_per_active_user, Stripe does not allow quantity to be specified
      // The quantity is determined by actual usage reporting

      const sessionData: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [lineItem],
        success_url: `${process.env.VITE_FRONTEND_URL || 'http://localhost:5000'}/admin/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.VITE_FRONTEND_URL || 'http://localhost:5000'}/admin/billing?canceled=true`,
        metadata: {
          organisationId: organisation.id,
          planId: plan.id,
          billingModel: plan.billingModel,
          cadence: plan.cadence,
          userCount: userCount.toString(),
          updateType: 'subscription_update',
        },
        customer_email: organisation.contactEmail || undefined,
      };

      // If the organisation already has a Stripe customer, use it
      if (organisation.stripeCustomerId) {
        sessionData.customer = organisation.stripeCustomerId;
      }

      // If updating an existing subscription, reference it
      if (organisation.stripeSubscriptionId) {
        sessionData.subscription_data = {
          metadata: {
            originalSubscriptionId: organisation.stripeSubscriptionId,
            updateType: 'user_count_change',
          },
        };
      }

      console.log('Creating Stripe checkout session with data:', JSON.stringify(sessionData, null, 2));
      const session = await this.stripe.checkout.sessions.create(sessionData);
      
      console.log('Stripe session created successfully:', {
        id: session.id,
        url: session.url,
        mode: session.mode,
        payment_status: session.payment_status
      });
      
      if (!session.url) {
        throw new Error('Checkout session created but no URL returned');
      }

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Error creating subscription update checkout session:', error);
      throw new Error(`Failed to create subscription update checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test Stripe connectivity and API key validity
   */
  async testConnection(): Promise<{
    success: boolean;
    timestamp: string;
    details: {
      apiKeyValid: boolean;
      accountId?: string;
      livemode?: boolean;
      error?: string;
    };
  }> {
    try {
      const account = await this.stripe.accounts.retrieve();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        details: {
          apiKeyValid: true,
          accountId: account.id,
          livemode: !account.details_submitted || account.charges_enabled,
        },
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        details: {
          apiKeyValid: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// Singleton instance
let stripeServiceInstance: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!stripeServiceInstance) {
    stripeServiceInstance = new StripeService();
  }
  return stripeServiceInstance;
}