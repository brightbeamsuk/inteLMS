import Stripe from 'stripe';
import type { Plan, InsertPlan, Organisation } from '../../shared/schema.js';
import { nanoid } from 'nanoid';

export class StripeService {
  private stripe: Stripe;
  
  // Application-level mutex for preventing race conditions in subscription operations
  private subscriptionLocks = new Map<string, Promise<any>>();
  
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
   * Generate idempotency key for Stripe operations
   * Format: {orgId}-{operation}-{timestamp}-{randomId}
   */
  private generateIdempotencyKey(orgId: string, operation: string): string {
    const timestamp = Date.now();
    const randomId = nanoid(8);
    return `${orgId}-${operation}-${timestamp}-${randomId}`;
  }

  /**
   * Generate deterministic idempotency key for critical operations
   * This ensures identical concurrent requests use the exact same key
   * Format: org-{orgId}-{operation}
   */
  private generateDeterministicIdempotencyKey(orgId: string, operation: string): string {
    return `org-${orgId}-${operation}`;
  }

  /**
   * Acquire a mutex lock for subscription operations to prevent race conditions
   * Returns a promise that resolves when the lock is acquired
   */
  private async acquireSubscriptionLock(orgId: string, operation: string): Promise<void> {
    const lockKey = `${orgId}-${operation}`;
    
    // If a lock already exists, wait for it to complete
    const existingLock = this.subscriptionLocks.get(lockKey);
    if (existingLock) {
      console.log(`Waiting for existing lock: ${lockKey}`);
      try {
        await existingLock;
      } catch (error) {
        // Ignore errors from previous operations, we'll try again
        console.log(`Previous lock failed, proceeding: ${lockKey}`);
      }
    }

    // Create a new lock promise (placeholder)
    let lockResolve: () => void;
    let lockReject: (error: any) => void;
    
    const lockPromise = new Promise<void>((resolve, reject) => {
      lockResolve = resolve;
      lockReject = reject;
    });

    this.subscriptionLocks.set(lockKey, lockPromise);
    
    // Store the resolve/reject functions on the promise for later use
    (lockPromise as any)._resolve = lockResolve!;
    (lockPromise as any)._reject = lockReject!;
    
    console.log(`Lock acquired: ${lockKey}`);
  }

  /**
   * Release a mutex lock for subscription operations
   */
  private releaseSubscriptionLock(orgId: string, operation: string, success: boolean = true, error?: any): void {
    const lockKey = `${orgId}-${operation}`;
    const lockPromise = this.subscriptionLocks.get(lockKey);
    
    if (lockPromise) {
      this.subscriptionLocks.delete(lockKey);
      
      if (success) {
        (lockPromise as any)._resolve();
      } else {
        (lockPromise as any)._reject(error);
      }
      
      console.log(`Lock released: ${lockKey} (success: ${success})`);
    }
  }

  /**
   * Normalize Stripe ID - remove JSON parsing and ensure plain string
   */
  private normalizeStripeId(stripeId: string | null | undefined): string | null {
    if (!stripeId) return null;
    
    if (typeof stripeId === 'string' && stripeId.startsWith('{')) {
      try {
        const parsed = JSON.parse(stripeId);
        return parsed.id || null;
      } catch (e) {
        console.error('Failed to parse Stripe ID:', e);
        return null;
      }
    }
    
    return stripeId;
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
   * Create a test checkout session for a plan (DEVELOPMENT/TESTING ONLY)
   * 
   * CRITICAL: This method is ONLY for development and testing purposes.
   * It creates NEW subscriptions and could cause double-charging in production.
   */
  async createTestCheckoutSession(plan: Plan, organisationId: string): Promise<{ url: string; sessionId: string }> {
    // PRODUCTION SAFETY: Block this method in production environment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('createTestCheckoutSession is blocked in production to prevent double-charging. Use createSingleSubscription for production subscription creation.');
    }
    
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
          org_id: organisationId,
          plan_id: plan.id,
          billing_model: plan.billingModel,
          cadence: plan.cadence,
          initiator: 'lms',
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
   * REMOVED: Dangerous createSubscriptionUpdateCheckoutSession method
   * 
   * This method was REMOVED because it created severe double-charge risk by using 
   * mode: 'subscription' which creates NEW subscriptions instead of updating existing ones.
   * 
   * SAFE REPLACEMENT: Use updateExistingSubscription() method instead, which directly 
   * modifies existing subscriptions without creating new billing relationships.
   * 
   * For new subscriptions, use createSingleSubscription() which has atomic prevention 
   * of duplicate subscriptions.
   */
  private removedDangerousCheckoutMethod(): never {
    throw new Error('createSubscriptionUpdateCheckoutSession has been REMOVED due to double-charge risk. Use updateExistingSubscription() for safe subscription updates or createSingleSubscription() for new subscriptions.');
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

  /**
   * Retrieve a checkout session from Stripe
   */
  async getCheckoutSession(sessionId: string, options?: Stripe.Checkout.SessionRetrieveParams): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, options);
    } catch (error) {
      console.error('Error retrieving checkout session:', error);
      throw new Error(`Failed to retrieve checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a single subscription for an organization - prevents double-charging
   * This is the ONLY method that should create new subscriptions
   * NOW WITH: Race condition protection via deterministic idempotency + application-level locking
   */
  async createSingleSubscription(
    plan: Plan,
    organisation: Organisation,
    userCount: number
  ): Promise<{
    subscription: Stripe.Subscription;
    subscriptionItem: Stripe.SubscriptionItem;
    customer: Stripe.Customer;
  }> {
    // CRITICAL: Use deterministic idempotency key for race condition prevention
    // All concurrent requests for the same org will use the EXACT same key
    const deterministicKey = this.generateDeterministicIdempotencyKey(organisation.id, 'create-subscription');
    
    // Acquire application-level lock to prevent race conditions
    await this.acquireSubscriptionLock(organisation.id, 'create-subscription');
    
    try {
      console.log(`[LOCKED] Creating single subscription for org ${organisation.id} with plan ${plan.id} and ${userCount} users`);
      
      // CRITICAL: Re-validate billing state INSIDE the lock after acquiring it
      // This catches race conditions where another process created a subscription while we were waiting
      const billingValidation = await this.validateOrganizationBillingState(organisation);
      
      if (!billingValidation.canCreateSubscription) {
        throw new Error(`Cannot create subscription for organization ${organisation.id}: ${billingValidation.issues.join(', ')}`);
      }
      
      if (billingValidation.hasActiveSubscription) {
        throw new Error(`Organization ${organisation.id} already has an active subscription. Use updateExistingSubscription instead.`);
      }
      
      if (!plan.stripePriceId) {
        throw new Error(`Plan ${plan.id} must have a Stripe Price ID to create subscription`);
      }
      
      // Create or retrieve customer
      let customerId = this.normalizeStripeId(organisation.stripeCustomerId);
      let customer: Stripe.Customer;
      
      if (customerId) {
        try {
          customer = await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log(`Customer ${customerId} not found in Stripe, creating new one`);
            customer = await this.createCustomer(organisation);
            customerId = customer.id;
          } else {
            throw error;
          }
        }
      } else {
        customer = await this.createCustomer(organisation);
        customerId = customer.id;
      }
      
      // Calculate quantity based on billing model
      let quantity: number;
      switch (plan.billingModel) {
        case 'per_seat':
          quantity = Math.max(userCount, plan.minSeats || 1);
          break;
        case 'flat_subscription':
          quantity = 1;
          break;
        case 'metered_per_active_user':
          quantity = 1; // Metered billing uses usage records
          break;
        default:
          quantity = 1;
      }
      
      // Create subscription with atomic operation using deterministic idempotency key
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{
          price: plan.stripePriceId,
          quantity,
        }],
        metadata: {
          org_id: organisation.id,
          plan_id: plan.id,
          billing_model: plan.billingModel,
          cadence: plan.cadence,
          user_count: userCount.toString(),
          created_by: 'lms',
          create_timestamp: new Date().toISOString(),
          // Add deterministic key to metadata for debugging
          idempotency_key: deterministicKey,
        },
        collection_method: 'charge_automatically',
        proration_behavior: 'none', // First subscription, no proration needed
      };
      
      // Add trial if specified
      if (plan.trialDays && plan.trialDays > 0) {
        subscriptionData.trial_period_days = plan.trialDays;
      }
      
      const requestOptions: Stripe.RequestOptions = {
        idempotencyKey: deterministicKey,
      };
      
      const subscription = await this.stripe.subscriptions.create(subscriptionData, requestOptions);
      
      console.log(`[LOCKED] Subscription created successfully:`, {
        id: subscription.id,
        status: subscription.status,
        items: subscription.items.data.length,
        idempotencyKey: deterministicKey
      });
      
      if (subscription.items.data.length !== 1) {
        throw new Error(`Subscription created with ${subscription.items.data.length} items, expected exactly 1`);
      }
      
      const subscriptionItem = subscription.items.data[0];
      
      // Release lock with success
      this.releaseSubscriptionLock(organisation.id, 'create-subscription', true);
      
      return {
        subscription,
        subscriptionItem,
        customer,
      };
    } catch (error) {
      console.error('Error creating single subscription:', error);
      
      // Release lock with failure
      this.releaseSubscriptionLock(organisation.id, 'create-subscription', false, error);
      
      throw new Error(`Failed to create single subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a Stripe customer with proper metadata
   * Uses deterministic idempotency keys to prevent duplicate customer creation
   */
  async createCustomer(organisation: Organisation): Promise<Stripe.Customer> {
    // Use deterministic key for customer creation (customers should only be created once per org)
    const deterministicKey = this.generateDeterministicIdempotencyKey(organisation.id, 'create-customer');
    
    try {
      const customer = await this.stripe.customers.create({
        name: organisation.displayName || organisation.name,
        email: organisation.contactEmail,
        phone: organisation.contactPhone,
        metadata: {
          org_id: organisation.id,
          org_name: organisation.name,
          initiator: 'lms',
          idempotency_key: deterministicKey,
        },
      }, {
        idempotencyKey: deterministicKey,
      });
      
      console.log(`Customer created with deterministic key: ${deterministicKey}`);
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update subscription item quantity with mandatory idempotency
   * Uses timestamp-based keys since multiple quantity updates are allowed
   */
  async updateSubscriptionItemQuantity(
    subscriptionItemId: string,
    quantity: number,
    orgId: string,
    idempotencyKey?: string
  ): Promise<Stripe.SubscriptionItem> {
    try {
      // For quantity updates, use timestamp-based keys since multiple updates are allowed
      const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(orgId, 'update-quantity');
      
      const options: Stripe.SubscriptionItemUpdateParams = {
        quantity,
        proration_behavior: 'create_prorations',
        metadata: {
          org_id: orgId,
          updated_by: 'lms',
          update_type: 'quantity_change',
          update_timestamp: new Date().toISOString(),
          idempotency_key: finalIdempotencyKey,
        },
      };

      const result = await this.stripe.subscriptionItems.update(subscriptionItemId, options, {
        idempotencyKey: finalIdempotencyKey,
      });
      
      console.log(`Subscription item quantity updated with key: ${finalIdempotencyKey}`);
      return result;
    } catch (error) {
      console.error('Error updating subscription item quantity:', error);
      throw new Error(`Failed to update subscription item quantity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create usage record for metered billing with mandatory idempotency
   * Uses timestamp-based keys since multiple usage records are allowed per timeframe
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    orgId: string,
    timestamp?: number,
    idempotencyKey?: string
  ): Promise<Stripe.UsageRecord> {
    try {
      // For usage records, use timestamp-based keys since multiple records are allowed
      const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(orgId, 'usage-record');
      
      const usageTimestamp = timestamp || Math.floor(Date.now() / 1000);
      const options: Stripe.UsageRecordCreateParams = {
        action: 'set',
        quantity,
        timestamp: usageTimestamp,
      };

      const result = await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, options, {
        idempotencyKey: finalIdempotencyKey,
      });
      
      console.log(`Usage record created:`, {
        quantity,
        timestamp: usageTimestamp,
        idempotencyKey: finalIdempotencyKey
      });
      
      return result;
    } catch (error) {
      console.error('Error creating usage record:', error);
      throw new Error(`Failed to create usage record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update subscription item price (plan change) with mandatory idempotency
   * Uses timestamp-based keys since multiple plan changes are allowed
   */
  async updateSubscriptionItemPrice(
    subscriptionItemId: string,
    newPriceId: string,
    orgId: string,
    planId: string,
    idempotencyKey?: string
  ): Promise<Stripe.SubscriptionItem> {
    try {
      // For price changes, use timestamp-based keys since multiple plan changes are allowed
      const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(orgId, 'price-change');
      
      const options: Stripe.SubscriptionItemUpdateParams = {
        price: newPriceId,
        proration_behavior: 'create_prorations',
        metadata: {
          org_id: orgId,
          plan_id: planId,
          updated_by: 'lms',
          update_type: 'plan_change',
          update_timestamp: new Date().toISOString(),
          idempotency_key: finalIdempotencyKey,
        },
      };

      const result = await this.stripe.subscriptionItems.update(subscriptionItemId, options, {
        idempotencyKey: finalIdempotencyKey,
      });
      
      console.log(`Subscription item price updated:`, {
        newPriceId,
        planId,
        idempotencyKey: finalIdempotencyKey
      });
      
      return result;
    } catch (error) {
      console.error('Error updating subscription item price:', error);
      throw new Error(`Failed to update subscription item price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing subscription - prevents double charging by modifying current subscription
   * This is the main method for plan/seat changes with full validation and proration calculation
   * NOW WITH: Application-level locking for consistency with createSingleSubscription
   */
  async updateExistingSubscription(
    plan: Plan,
    organisation: Organisation,
    userCount: number,
    idempotencyKey?: string
  ): Promise<{
    subscription: Stripe.Subscription;
    subscriptionItem: Stripe.SubscriptionItem;
    prorationAmount: number;
    preview: any;
  }> {
    // Use timestamp-based keys for updates since multiple updates are allowed
    const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(organisation.id, 'update-subscription');
    
    // Acquire application-level lock for consistency with create operations
    await this.acquireSubscriptionLock(organisation.id, 'update-subscription');
    
    try {
      console.log(`[LOCKED] Starting subscription update for org ${organisation.id} to plan ${plan.id} with ${userCount} users`);

      // CRITICAL: Validate organization billing state inside the lock
      const billingValidation = await this.validateOrganizationBillingState(organisation);
      
      if (!billingValidation.canUpdateSubscription) {
        throw new Error(`Cannot update subscription for organization ${organisation.id}: ${billingValidation.issues.join(', ')}`);
      }
      
      if (!billingValidation.hasActiveSubscription) {
        throw new Error(`Organization ${organisation.id} has no active subscription to update. Use createSingleSubscription instead.`);
      }

      if (!plan.stripePriceId) {
        throw new Error(`Plan ${plan.id} must have a Stripe Price ID`);
      }

      // Normalize subscription IDs
      const subscriptionId = this.normalizeStripeId(organisation.stripeSubscriptionId);
      const subscriptionItemId = this.normalizeStripeId(organisation.stripeSubscriptionItemId);
      
      if (!subscriptionId) {
        throw new Error('Organization subscription ID is missing or invalid');
      }
      
      if (!subscriptionItemId) {
        throw new Error('Organization subscription item ID is missing or invalid');
      }

      // Retrieve and validate current subscription
      const currentSubscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });

      if (currentSubscription.status !== 'active' && currentSubscription.status !== 'trialing') {
        throw new Error(`Cannot update subscription in status: ${currentSubscription.status}`);
      }

      // CRITICAL: Validate subscription has exactly one item
      if (currentSubscription.items.data.length === 0) {
        throw new Error('Subscription has no items - cannot update');
      }
      
      if (currentSubscription.items.data.length > 1) {
        throw new Error(`Subscription has ${currentSubscription.items.data.length} items - must have exactly 1 for safe updates`);
      }

      const currentItem = currentSubscription.items.data[0];
      if (currentItem.id !== subscriptionItemId) {
        throw new Error(`Subscription item ID mismatch: expected ${subscriptionItemId}, found ${currentItem.id}`);
      }

      // Calculate quantity based on billing model
      let quantity: number;
      switch (plan.billingModel) {
        case 'per_seat':
          quantity = Math.max(userCount, plan.minSeats || 1);
          break;
        case 'flat_subscription':
          quantity = 1;
          break;
        case 'metered_per_active_user':
          quantity = 1; // Metered billing uses usage records, not quantity
          break;
        default:
          quantity = 1;
      }

      // Get proration preview BEFORE making changes
      const preview = await this.previewSubscriptionChange(plan, organisation, userCount);
      console.log(`Proration preview:`, {
        immediate: preview.immediate_total,
        next_invoice: preview.next_invoice_total,
        currency: preview.currency
      });

      // Prepare update parameters
      const updateParams: Stripe.SubscriptionItemUpdateParams = {
        price: plan.stripePriceId,
        quantity,
        proration_behavior: plan.priceChangePolicy === 'at_period_end' ? 'none' : 'create_prorations',
        metadata: {
          org_id: organisation.id,
          plan_id: plan.id,
          billing_model: plan.billingModel,
          user_count: userCount.toString(),
          updated_by: 'lms',
          update_type: 'subscription_update',
          update_timestamp: new Date().toISOString(),
          preview_immediate_total: preview.immediate_total?.toString() || '0',
        },
      };

      // Set proration date if not at period end
      if (plan.priceChangePolicy !== 'at_period_end') {
        updateParams.proration_date = Math.floor(Date.now() / 1000);
      }

      // Perform the update with idempotency protection
      const updatedItem = await this.stripe.subscriptionItems.update(subscriptionItemId, updateParams, {
        idempotencyKey: finalIdempotencyKey,
      });

      // Retrieve updated subscription to return full data
      const updatedSubscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });

      console.log(`[LOCKED] Subscription updated successfully:`, {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        itemPrice: updatedItem.price.id,
        quantity: updatedItem.quantity,
        idempotencyKey: finalIdempotencyKey
      });

      // Release lock with success
      this.releaseSubscriptionLock(organisation.id, 'update-subscription', true);

      return {
        subscription: updatedSubscription,
        subscriptionItem: updatedItem,
        prorationAmount: preview.immediate_total || 0,
        preview,
      };
    } catch (error) {
      console.error('Error updating existing subscription:', error);
      
      // Release lock with failure
      this.releaseSubscriptionLock(organisation.id, 'update-subscription', false, error);
      
      throw new Error(`Failed to update existing subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preview subscription changes without applying them using stripe.invoices.upcoming
   * Shows accurate proration amounts and next billing totals
   */
  async previewSubscriptionChange(
    plan: Plan,
    organisation: Organisation,
    userCount: number
  ): Promise<{
    immediate_total: number;
    next_invoice_total: number;
    proration_details: Array<{
      description: string;
      amount: number;
      period_start: number;
      period_end: number;
    }>;
    currency: string;
    current_plan: {
      name: string;
      quantity: number;
      unit_amount: number;
    } | null;
    new_plan: {
      name: string;
      quantity: number;
      unit_amount: number;
    };
  }> {
    try {
      console.log(`Previewing subscription change for org ${organisation.id} to plan ${plan.id} with ${userCount} users`);

      // Use normalized ID instead of JSON parsing
      const subscriptionId = this.normalizeStripeId(organisation.stripeSubscriptionId);
      
      if (!subscriptionId) {
        // If no existing subscription, show what a new subscription would cost
        const quantity = plan.billingModel === 'per_seat' ? Math.max(userCount, plan.minSeats || 1) : 1;
        const total = plan.billingModel === 'metered_per_active_user' ? 0 : quantity * plan.unitAmount;

        return {
          immediate_total: 0, // No immediate charge for new subscription
          next_invoice_total: total,
          proration_details: [],
          currency: plan.currency.toLowerCase(),
          current_plan: null,
          new_plan: {
            name: plan.name,
            quantity,
            unit_amount: plan.unitAmount
          }
        };
      }

      // Get current subscription details
      const currentSubscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });

      const currentItem = currentSubscription.items.data[0];
      const currentPlan = {
        name: currentItem.price.nickname || 'Current Plan',
        quantity: currentItem.quantity || 0,
        unit_amount: currentItem.price.unit_amount || 0
      };

      // Calculate new quantity
      let newQuantity: number;
      switch (plan.billingModel) {
        case 'per_seat':
          newQuantity = Math.max(userCount, plan.minSeats || 1);
          break;
        case 'flat_subscription':
          newQuantity = 1;
          break;
        case 'metered_per_active_user':
          newQuantity = 1;
          break;
        default:
          newQuantity = 1;
      }

      // Preview the changes using upcoming invoice
      let upcomingInvoice: Stripe.UpcomingInvoice;
      
      try {
        upcomingInvoice = await this.stripe.invoices.retrieveUpcoming({
          customer: currentSubscription.customer as string,
          subscription: subscriptionId,
          subscription_items: [
            {
              id: currentItem.id,
              price: plan.stripePriceId,
              ...(plan.billingModel !== 'metered_per_active_user' && { quantity: newQuantity })
            }
          ],
          subscription_proration_behavior: plan.priceChangePolicy === 'at_period_end' ? 'none' : 'create_prorations',
          subscription_proration_date: plan.priceChangePolicy === 'at_period_end' ? undefined : Math.floor(Date.now() / 1000),
        });
      } catch (error) {
        console.warn('Could not retrieve upcoming invoice preview, calculating manually:', error);
        
        // Fallback: calculate manually
        const total = plan.billingModel === 'metered_per_active_user' ? 0 : newQuantity * plan.unitAmount;
        
        return {
          immediate_total: 0,
          next_invoice_total: total,
          proration_details: [{
            description: `Change to ${plan.name}`,
            amount: total - (currentPlan.quantity * currentPlan.unit_amount),
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // Estimate 30 days
          }],
          currency: plan.currency.toLowerCase(),
          current_plan: currentPlan,
          new_plan: {
            name: plan.name,
            quantity: newQuantity,
            unit_amount: plan.unitAmount
          }
        };
      }

      // Parse proration details from invoice line items
      const prorationDetails = upcomingInvoice.lines.data.map(line => ({
        description: line.description || 'Subscription change',
        amount: line.amount,
        period_start: line.period?.start || Math.floor(Date.now() / 1000),
        period_end: line.period?.end || Math.floor(Date.now() / 1000)
      }));

      console.log(`Preview calculated:`, {
        immediate_total: upcomingInvoice.amount_due,
        next_invoice_total: upcomingInvoice.total,
        prorations: prorationDetails.length
      });

      return {
        immediate_total: upcomingInvoice.amount_due,
        next_invoice_total: upcomingInvoice.total,
        proration_details: prorationDetails,
        currency: upcomingInvoice.currency,
        current_plan: currentPlan,
        new_plan: {
          name: plan.name,
          quantity: newQuantity,
          unit_amount: plan.unitAmount
        }
      };
    } catch (error) {
      console.error('Error previewing subscription change:', error);
      throw new Error(`Failed to preview subscription change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate organization billing state for subscription operations with race condition prevention
   * Prevents creating multiple subscriptions and validates billing status
   */
  async validateOrganizationBillingState(organisation: Organisation): Promise<{
    canCreateSubscription: boolean;
    canUpdateSubscription: boolean;
    hasActiveSubscription: boolean;
    billingStatus: string | null;
    issues: string[];
    stripeData: {
      customerId: string | null;
      subscriptionId: string | null;
      subscriptionStatus: string | null;
      subscriptionItemId: string | null;
    };
  }> {
    const result = {
      canCreateSubscription: false,
      canUpdateSubscription: false,
      hasActiveSubscription: false,
      billingStatus: organisation.billingStatus || null,
      issues: [] as string[],
      stripeData: {
        customerId: null as string | null,
        subscriptionId: null as string | null,
        subscriptionStatus: null as string | null,
        subscriptionItemId: null as string | null,
      }
    };

    try {
      // Use normalized Stripe IDs instead of JSON parsing
      const customerId = this.normalizeStripeId(organisation.stripeCustomerId);
      const subscriptionId = this.normalizeStripeId(organisation.stripeSubscriptionId);
      const subscriptionItemId = this.normalizeStripeId(organisation.stripeSubscriptionItemId);

      result.stripeData.customerId = customerId;
      result.stripeData.subscriptionId = subscriptionId;
      result.stripeData.subscriptionItemId = subscriptionItemId;

      // Check if organization has blocked billing status
      const blockedStatuses = ['canceled', 'unpaid', 'incomplete_expired'];
      if (organisation.billingStatus && blockedStatuses.includes(organisation.billingStatus)) {
        result.issues.push(`Billing status '${organisation.billingStatus}' blocks subscription operations`);
      }

      // Validate subscription state in Stripe if subscription ID exists
      if (subscriptionId) {
        try {
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data']
          });

          result.stripeData.subscriptionStatus = subscription.status;

          if (['active', 'trialing', 'past_due'].includes(subscription.status)) {
            result.hasActiveSubscription = true;
          }

          // Check subscription item consistency
          if (subscription.items.data.length === 0) {
            result.issues.push('Subscription exists but has no items');
          } else if (subscription.items.data.length > 1) {
            result.issues.push(`Subscription has ${subscription.items.data.length} items - should have exactly 1`);
          } else {
            const actualItemId = subscription.items.data[0].id;
            if (subscriptionItemId && subscriptionItemId !== actualItemId) {
              result.issues.push('Subscription item ID mismatch between database and Stripe');
            }
          }
        } catch (stripeError: any) {
          if (stripeError.code === 'resource_missing') {
            result.issues.push('Subscription ID in database but not found in Stripe');
          } else {
            result.issues.push(`Error checking subscription in Stripe: ${stripeError.message}`);
          }
        }
      }

      // Validate customer in Stripe if customer ID exists
      if (customerId) {
        try {
          await this.stripe.customers.retrieve(customerId);
        } catch (stripeError: any) {
          if (stripeError.code === 'resource_missing') {
            result.issues.push('Customer ID in database but not found in Stripe');
          } else {
            result.issues.push(`Error checking customer in Stripe: ${stripeError.message}`);
          }
        }
      }

      // Determine what operations are allowed
      result.canCreateSubscription = !result.hasActiveSubscription && 
                                   !blockedStatuses.includes(organisation.billingStatus) &&
                                   result.issues.filter(issue => issue.includes('blocks')).length === 0;

      result.canUpdateSubscription = result.hasActiveSubscription && 
                                   !blockedStatuses.includes(organisation.billingStatus) &&
                                   subscriptionItemId !== null &&
                                   result.issues.filter(issue => issue.includes('blocks') || issue.includes('mismatch')).length === 0;

      console.log(`Billing validation for org ${organisation.id}:`, {
        canCreate: result.canCreateSubscription,
        canUpdate: result.canUpdateSubscription,
        hasActive: result.hasActiveSubscription,
        issues: result.issues.length
      });

      return result;
    } catch (error) {
      console.error('Error validating organization billing state:', error);
      result.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
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