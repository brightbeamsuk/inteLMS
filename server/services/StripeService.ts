import Stripe from 'stripe';
import type { Plan, InsertPlan, Organisation } from '../../shared/schema.js';
import { nanoid } from 'nanoid';
import { billingLockService } from './BillingLockService.js';

export class StripeService {
  private stripe: Stripe;
  
  // DEPRECATED: Replaced with database-backed distributed locking via BillingLockService
  // private subscriptionLocks = new Map<string, Promise<any>>();
  
  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey);
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
   * DEPRECATED: Replaced with distributed locking via BillingLockService
   * Use billingLockService.withLock() or billingLockService.acquireLock() instead
   */
  private async acquireSubscriptionLock(orgId: string, operation: string): Promise<void> {
    console.warn(`DEPRECATED: acquireSubscriptionLock called for ${orgId}-${operation}. Use BillingLockService instead.`);
    
    // For backward compatibility, use distributed lock
    const lockResult = await billingLockService.acquireLock('subscription_modify', orgId, {
      lockReason: operation,
      timeoutMs: 300000, // 5 minutes
      correlationId: `legacy-${orgId}-${operation}-${Date.now()}`
    });
    
    if (!lockResult.success) {
      throw new Error(`Failed to acquire lock for ${orgId}-${operation} after ${lockResult.waitTime}ms`);
    }
    
    // Store lock ID for release
    (this as any)._currentLockId = lockResult.lock?.id;
  }

  /**
   * DEPRECATED: Replaced with distributed locking via BillingLockService
   * Use billingLockService.releaseLock() instead
   */
  private releaseSubscriptionLock(orgId: string, operation: string, success: boolean = true, error?: any): void {
    console.warn(`DEPRECATED: releaseSubscriptionLock called for ${orgId}-${operation}. Use BillingLockService instead.`);
    
    // Release the current lock
    const lockId = (this as any)._currentLockId;
    if (lockId) {
      billingLockService.releaseLock(lockId).catch(err => {
        console.error(`Failed to release lock ${lockId}:`, err);
      });
      delete (this as any)._currentLockId;
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
        if (priceData.recurring) {
          priceData.recurring.trial_period_days = plan.trialDays;
        } else {
          priceData.recurring = {
            interval: plan.cadence === 'annual' ? 'year' : 'month',
            trial_period_days: plan.trialDays,
          };
        }
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
   * Handle 3D Secure payment authentication flow
   * Called when a payment_intent.requires_action webhook is received
   */
  async handle3DSAuthentication(paymentIntentId: string, organisationId: string): Promise<{
    requiresAction: boolean;
    clientSecret?: string;
    nextAction?: any;
    status: string;
  }> {
    try {
      console.log(`Handling 3DS authentication for payment intent ${paymentIntentId}, org ${organisationId}`);

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      const result = {
        requiresAction: paymentIntent.status === 'requires_action',
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret || undefined,
        nextAction: paymentIntent.next_action || undefined,
      };

      // Update organization status to reflect pending 3DS
      if (paymentIntent.status === 'requires_action') {
        await this.updateOrganizationFor3DS(organisationId, paymentIntentId, 'pending_3ds');
      }

      console.log(`3DS authentication status for org ${organisationId}:`, result);
      return result;

    } catch (error) {
      console.error(`Error handling 3DS authentication for ${paymentIntentId}:`, error);
      throw new Error(`3DS authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update organization status for 3DS processing
   */
  private async updateOrganizationFor3DS(organisationId: string, paymentIntentId: string, status: string): Promise<void> {
    try {
      const { storage } = await import('../storage');
      
      await storage.updateOrganisationBilling(organisationId, {
        billingStatus: status,
        lastBillingSync: new Date(),
      });

      console.log(`Updated org ${organisationId} billing status to ${status} for payment intent ${paymentIntentId}`);
    } catch (error) {
      console.error(`Failed to update org billing status for 3DS:`, error);
      // Don't throw here - this is a best-effort status update
    }
  }

  /**
   * Handle subscription reactivation scenarios
   * Manages transitions from canceled/past_due to active status
   */
  async reactivateSubscription(
    subscriptionId: string, 
    organisationId: string,
    reason: string = 'payment_succeeded'
  ): Promise<{ success: boolean; message: string; subscription?: Stripe.Subscription }> {
    await this.acquireSubscriptionLock(organisationId, 'reactivation');

    try {
      console.log(`Reactivating subscription ${subscriptionId} for org ${organisationId}, reason: ${reason}`);

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      });

      const validReactivationStatuses = ['canceled', 'past_due', 'unpaid', 'incomplete'];
      if (!validReactivationStatuses.includes(subscription.status)) {
        this.releaseSubscriptionLock(organisationId, 'reactivation', false);
        return {
          success: false,
          message: `Cannot reactivate subscription in status: ${subscription.status}`
        };
      }

      // For canceled subscriptions, we may need to create a new subscription instead
      if (subscription.status === 'canceled') {
        console.log(`Subscription ${subscriptionId} is canceled - may need new subscription instead`);
        this.releaseSubscriptionLock(organisationId, 'reactivation', false);
        return {
          success: false,
          message: `Subscription is canceled - create new subscription instead of reactivating`
        };
      }

      // Update organization billing status
      const { storage } = await import('../storage');
      const subscriptionData = this.extractSubscriptionData(subscription);

      await storage.updateOrganisationBilling(organisationId, {
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: subscriptionData.subscriptionItemId,
        billingStatus: 'active',
        activeUserCount: subscriptionData.quantity,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        lastBillingSync: new Date(),
      });

      console.log(`Successfully reactivated subscription ${subscriptionId} for org ${organisationId}`);
      this.releaseSubscriptionLock(organisationId, 'reactivation', true);

      return {
        success: true,
        message: `Subscription reactivated successfully`,
        subscription
      };

    } catch (error) {
      console.error(`Error reactivating subscription ${subscriptionId}:`, error);
      this.releaseSubscriptionLock(organisationId, 'reactivation', false, error);
      
      return {
        success: false,
        message: `Reactivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Enhanced checkout session creation with 3DS support and robust error handling
   * Automatically handles both new subscriptions and subscription updates
   */
  async createCheckoutSession(
    plan: Plan, 
    organisation: Organisation, 
    userCount: number = 1,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ url: string; sessionId: string }> {
    console.log(`Creating checkout session for org ${organisation.id}, plan ${plan.id}, userCount ${userCount}`);

    // Acquire lock to prevent concurrent subscription operations
    await this.acquireSubscriptionLock(organisation.id, 'checkout');
    
    try {
      if (!plan.stripePriceId) {
        throw new Error('Plan must have a Stripe Price ID to create checkout session');
      }

      // Step 1: Find existing active subscriptions (both Stripe API and database)
      const subscriptionInfo = await this.findActiveSubscriptionsForOrganization(organisation);
      
      console.log(`Subscription check for org ${organisation.id}:`, {
        hasActiveSubscription: subscriptionInfo.hasActiveSubscription,
        stripeSubscriptionCount: subscriptionInfo.stripeSubscriptions.length,
        databaseSubscriptionId: subscriptionInfo.databaseSubscriptionId,
      });

      // Step 2: Handle multiple active subscriptions edge case
      let existingSubscription: Stripe.Subscription | null = null;
      if (subscriptionInfo.stripeSubscriptions.length > 1) {
        console.warn(`Found ${subscriptionInfo.stripeSubscriptions.length} active subscriptions for org ${organisation.id}. Resolving conflicts...`);
        existingSubscription = await this.handleMultipleActiveSubscriptions(
          subscriptionInfo.stripeSubscriptions,
          organisation.id
        );
      } else if (subscriptionInfo.activeSubscription) {
        existingSubscription = subscriptionInfo.activeSubscription;
      }

      // Step 3: Generate comprehensive metadata
      const timestamp = new Date().toISOString();
      const baseMetadata = {
        org_id: organisation.id,
        plan_id: plan.id,
        intended_plan_id: plan.id,
        intended_seats: userCount.toString(),
        billing_model: plan.billingModel,
        cadence: plan.cadence,
        userCount: userCount.toString(),
        initiator: 'lms',
        checkout_type: existingSubscription ? 'subscription_update' : 'new_subscription',
        existing_subscription_id: existingSubscription?.id || 'none',
        client_reference_id: `${organisation.id}-${plan.id}-${timestamp}`,
        created_at: timestamp,
      };

      // Use environment-appropriate URLs
      const baseUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'http://localhost:5000';
      
      // Step 4: Create line item - don't include quantity for metered plans
      const lineItem: any = {
        price: plan.stripePriceId,
      };
      
      // Only add quantity for non-metered plans
      if (plan.billingModel !== 'metered_per_active_user') {
        lineItem.quantity = userCount || this.getQuantityForPlan(plan);
      }

      let sessionData: Stripe.Checkout.SessionCreateParams;

      // Step 5: Branch logic based on whether existing subscription exists
      if (existingSubscription) {
        console.log(`Updating existing subscription ${existingSubscription.id} for org ${organisation.id}`);
        
        // For existing subscriptions, use setup mode to collect payment method
        // and then update the subscription directly via API
        sessionData = {
          mode: 'setup',
          payment_method_types: ['card'],
          success_url: successUrl || `${baseUrl}/admin/billing?status=success&csid={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl || `${baseUrl}/admin/billing?status=cancelled`,
          metadata: {
            ...baseMetadata,
            action: 'update_existing_subscription',
            target_subscription_id: existingSubscription.id,
          },
        };

        // CRITICAL: Add customer binding to prevent new customer creation
        if (organisation.stripeCustomerId) {
          const normalizedCustomerId = this.normalizeStripeId(organisation.stripeCustomerId);
          if (normalizedCustomerId) {
            sessionData.customer = normalizedCustomerId;
          }
        }

        // Store the intended changes in metadata for the webhook to process
        sessionData.metadata!.new_price_id = plan.stripePriceId;
        if (plan.billingModel !== 'metered_per_active_user') {
          sessionData.metadata!.new_quantity = lineItem.quantity.toString();
        }

      } else {
        console.log(`Creating new subscription for org ${organisation.id}`);
        
        // For new subscriptions, use standard subscription mode
        sessionData = {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [lineItem],
          success_url: successUrl || `${baseUrl}/admin/billing?status=success&csid={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl || `${baseUrl}/admin/billing?status=cancelled`,
          metadata: {
            ...baseMetadata,
            action: 'create_new_subscription',
          },
        };

        // Add customer reference if we have one
        if (organisation.stripeCustomerId) {
          const normalizedCustomerId = this.normalizeStripeId(organisation.stripeCustomerId);
          if (normalizedCustomerId) {
            sessionData.customer = normalizedCustomerId;
          }
        }

        // Add trial if specified and this is a new subscription
        if (plan.trialDays && plan.trialDays > 0) {
          sessionData.subscription_data = {
            trial_period_days: plan.trialDays,
            metadata: baseMetadata,
          };
        }
      }

      // Step 6: Create the checkout session with idempotency protection
      const idempotencyKey = this.generateDeterministicIdempotencyKey(organisation.id, `checkout-${baseMetadata.checkout_type}`);
      
      const session = await this.stripe.checkout.sessions.create(sessionData, {
        idempotencyKey,
      });
      
      if (!session.url) {
        throw new Error('Checkout session created but no URL returned');
      }

      console.log(`Successfully created checkout session ${session.id} for org ${organisation.id} (${baseMetadata.checkout_type})`);

      // Release lock on success
      this.releaseSubscriptionLock(organisation.id, 'checkout', true);

      return {
        url: session.url,
        sessionId: session.id,
      };

    } catch (error) {
      console.error('Error creating checkout session:', error);
      
      // Release lock on failure
      this.releaseSubscriptionLock(organisation.id, 'checkout', false, error);
      
      throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      throw new Error('createTestCheckoutSession is blocked in production to prevent double-charging. Use createCheckoutSession for production subscription creation.');
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

      const idempotencyKey = this.generateIdempotencyKey(organisationId, 'test-checkout');
      
      const session = await this.stripe.checkout.sessions.create(sessionData, {
        idempotencyKey,
      });
      
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
   * Find existing active subscriptions for an organization
   * Checks both Stripe API and our database for active subscriptions
   */
  async findActiveSubscriptionsForOrganization(organisation: Organisation): Promise<{
    stripeSubscriptions: Stripe.Subscription[];
    databaseSubscriptionId: string | null;
    hasActiveSubscription: boolean;
    activeSubscription: Stripe.Subscription | null;
  }> {
    const result = {
      stripeSubscriptions: [] as Stripe.Subscription[],
      databaseSubscriptionId: organisation.stripeSubscriptionId || null,
      hasActiveSubscription: false,
      activeSubscription: null as Stripe.Subscription | null,
    };

    try {
      // If organization has a stripe customer ID, check for subscriptions
      if (organisation.stripeCustomerId) {
        const normalizedCustomerId = this.normalizeStripeId(organisation.stripeCustomerId);
        
        if (normalizedCustomerId) {
          // Query Stripe for all subscriptions for this customer
          const subscriptions = await this.stripe.subscriptions.list({
            customer: normalizedCustomerId,
            status: 'all', // Get all to filter ourselves
            limit: 100, // Should be more than enough for any customer
          });

          // Filter for active-like statuses
          const activeStatuses = ['trialing', 'active', 'past_due', 'unpaid', 'incomplete'];
          result.stripeSubscriptions = subscriptions.data.filter(sub => 
            activeStatuses.includes(sub.status)
          );

          console.log(`Found ${result.stripeSubscriptions.length} active subscriptions for customer ${normalizedCustomerId}`);
          
          // If we have active subscriptions, mark as having active subscription
          if (result.stripeSubscriptions.length > 0) {
            result.hasActiveSubscription = true;
            // Choose the most recent active subscription as the primary one
            result.activeSubscription = result.stripeSubscriptions
              .sort((a, b) => b.created - a.created)[0];
          }
        }
      }

      // Cross-check with database subscription ID
      if (result.databaseSubscriptionId && !result.activeSubscription) {
        try {
          const dbSubscription = await this.stripe.subscriptions.retrieve(result.databaseSubscriptionId);
          const activeStatuses = ['trialing', 'active', 'past_due', 'unpaid', 'incomplete'];
          
          if (activeStatuses.includes(dbSubscription.status)) {
            result.hasActiveSubscription = true;
            result.activeSubscription = dbSubscription;
            // Add to list if not already there
            const existsInList = result.stripeSubscriptions.some(sub => sub.id === dbSubscription.id);
            if (!existsInList) {
              result.stripeSubscriptions.push(dbSubscription);
            }
          }
        } catch (error) {
          console.warn(`Database subscription ID ${result.databaseSubscriptionId} not found in Stripe:`, error);
        }
      }

    } catch (error) {
      console.error('Error finding active subscriptions for organization:', error);
      // Don't throw - we'll proceed with assumption of no active subscriptions
    }

    return result;
  }

  /**
   * Handle multiple active subscriptions edge case
   * Cancel all but the newest paid subscription to prevent billing conflicts
   */
  async handleMultipleActiveSubscriptions(
    subscriptions: Stripe.Subscription[],
    organisationId: string
  ): Promise<Stripe.Subscription> {
    if (subscriptions.length <= 1) {
      return subscriptions[0];
    }

    console.warn(`Found ${subscriptions.length} active subscriptions for org ${organisationId}. Resolving conflicts...`);

    // Sort by creation date (newest first) and prefer paid subscriptions
    const sortedSubscriptions = subscriptions.sort((a, b) => {
      // First, prefer paid over unpaid/trialing
      const aIsPaid = ['active', 'past_due'].includes(a.status);
      const bIsPaid = ['active', 'past_due'].includes(b.status);
      
      if (aIsPaid && !bIsPaid) return -1;
      if (!aIsPaid && bIsPaid) return 1;
      
      // Then sort by creation date (newest first)
      return b.created - a.created;
    });

    const keepSubscription = sortedSubscriptions[0];
    const cancelSubscriptions = sortedSubscriptions.slice(1);

    console.log(`Keeping subscription ${keepSubscription.id}, canceling ${cancelSubscriptions.length} others`);

    // Cancel the duplicate subscriptions
    for (const subscription of cancelSubscriptions) {
      try {
        await this.stripe.subscriptions.cancel(subscription.id, {
          prorate: false, // Don't charge for partial period
        });
        console.log(`Cancelled duplicate subscription ${subscription.id}`);
      } catch (error) {
        console.error(`Failed to cancel duplicate subscription ${subscription.id}:`, error);
        // Continue with other cancellations
      }
    }

    return keepSubscription;
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
  ): Promise<any> {
    try {
      // For usage records, use timestamp-based keys since multiple records are allowed
      const finalIdempotencyKey = idempotencyKey || this.generateIdempotencyKey(orgId, 'usage-record');
      
      const usageTimestamp = timestamp || Math.floor(Date.now() / 1000);
      const options = {
        action: 'set',
        quantity,
        timestamp: usageTimestamp,
      };

      // Use generic API call to avoid type issues
      const result = await (this.stripe as any).subscriptionItems.createUsageRecord(subscriptionItemId, options, {
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
        if (!billingValidation.hasActiveSubscription) {
          throw new Error(`No active subscription found for this organization. Please create a subscription first before trying to update it.`);
        } else if (billingValidation.issues && billingValidation.issues.length > 0) {
          throw new Error(`Cannot update subscription: ${billingValidation.issues.join(', ')}`);
        } else {
          throw new Error(`Cannot update subscription: billing validation failed`);
        }
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
   * Enhanced proration calculator with comprehensive billing period handling
   * Handles mid-cycle changes, seat adjustments, and complex billing scenarios
   */
  async calculateEnhancedProration(
    currentPlan: Plan | null,
    newPlan: Plan,
    organisation: Organisation,
    newUserCount: number,
    effectiveDate?: Date
  ): Promise<{
    immediate_charge: number;
    credit_amount: number;
    net_amount: number;
    proration_details: Array<{
      type: 'credit' | 'charge';
      description: string;
      amount: number;
      period_start: Date;
      period_end: Date;
      daily_rate: number;
      days_used: number;
    }>;
    billing_period: {
      current_period_start: Date;
      current_period_end: Date;
      days_remaining: number;
      total_days: number;
    };
    warning?: string;
  }> {
    try {
      const subscriptionId = this.normalizeStripeId(organisation.stripeSubscriptionId);
      const effectiveDateTime = effectiveDate || new Date();
      
      console.log(`Calculating enhanced proration for org ${organisation.id}:`, {
        currentPlan: currentPlan?.id || 'none',
        newPlan: newPlan.id,
        newUserCount,
        effectiveDate: effectiveDateTime,
        subscriptionId
      });

      // Get current subscription details if exists
      let currentSubscription: Stripe.Subscription | null = null;
      let billingPeriod = {
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        days_remaining: 30,
        total_days: 30
      };

      if (subscriptionId) {
        try {
          currentSubscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price']
          });

          billingPeriod = {
            current_period_start: new Date((currentSubscription as any).current_period_start * 1000),
            current_period_end: new Date((currentSubscription as any).current_period_end * 1000),
            days_remaining: Math.ceil(((currentSubscription as any).current_period_end * 1000 - effectiveDateTime.getTime()) / (1000 * 60 * 60 * 24)),
            total_days: Math.ceil(((currentSubscription as any).current_period_end * 1000 - (currentSubscription as any).current_period_start * 1000) / (1000 * 60 * 60 * 24))
          };
        } catch (error) {
          console.warn(`Could not retrieve subscription ${subscriptionId} for proration:`, error);
        }
      }

      const prorationDetails: Array<{
        type: 'credit' | 'charge';
        description: string;
        amount: number;
        period_start: Date;
        period_end: Date;
        daily_rate: number;
        days_used: number;
      }> = [];

      let totalCredit = 0;
      let totalCharge = 0;

      // Calculate credit for unused portion of current plan
      if (currentPlan && currentSubscription && billingPeriod.days_remaining > 0) {
        const currentItem = currentSubscription.items.data[0];
        const currentQuantity = currentItem?.quantity || organisation.activeUserCount || 1;
        const currentUnitAmount = currentItem?.price?.unit_amount || currentPlan.unitAmount;
        
        const dailyRate = currentUnitAmount / billingPeriod.total_days;
        const creditAmount = Math.round(dailyRate * billingPeriod.days_remaining * currentQuantity);

        if (creditAmount > 0) {
          prorationDetails.push({
            type: 'credit',
            description: `Credit for unused ${currentPlan.name} (${currentQuantity} seats)`,
            amount: creditAmount,
            period_start: effectiveDateTime,
            period_end: billingPeriod.current_period_end,
            daily_rate: dailyRate,
            days_used: billingPeriod.days_remaining
          });
          totalCredit += creditAmount;
        }
      }

      // Calculate charge for new plan
      const newQuantity = newPlan.billingModel === 'per_seat' ? 
        Math.max(newUserCount, newPlan.minSeats || 1) : 1;
      
      if (billingPeriod.days_remaining > 0) {
        const dailyRate = newPlan.unitAmount / billingPeriod.total_days;
        const chargeAmount = Math.round(dailyRate * billingPeriod.days_remaining * newQuantity);

        if (chargeAmount > 0) {
          prorationDetails.push({
            type: 'charge',
            description: `Charge for new ${newPlan.name} (${newQuantity} seats)`,
            amount: chargeAmount,
            period_start: effectiveDateTime,
            period_end: billingPeriod.current_period_end,
            daily_rate: dailyRate,
            days_used: billingPeriod.days_remaining
          });
          totalCharge += chargeAmount;
        }
      }

      const netAmount = totalCharge - totalCredit;
      let warning: string | undefined;

      // Add warnings for complex scenarios
      if (billingPeriod.days_remaining < 1) {
        warning = 'Change will take effect at the next billing cycle';
      } else if (netAmount < 0 && Math.abs(netAmount) > totalCharge * 0.5) {
        warning = 'Large credit will be applied - verify this is expected';
      } else if (currentPlan && newPlan.billingModel !== currentPlan.billingModel) {
        warning = 'Changing billing models - proration may not be exact';
      }

      console.log(`Enhanced proration calculated:`, {
        totalCredit,
        totalCharge,
        netAmount,
        daysRemaining: billingPeriod.days_remaining,
        prorationDetails: prorationDetails.length
      });

      return {
        immediate_charge: Math.max(netAmount, 0),
        credit_amount: totalCredit,
        net_amount: netAmount,
        proration_details: prorationDetails,
        billing_period: billingPeriod,
        warning
      };

    } catch (error) {
      console.error('Error calculating enhanced proration:', error);
      throw new Error(`Failed to calculate proration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Database consistency validator - ensures Stripe and database are synchronized
   * Detects and reports inconsistencies that need manual intervention
   */
  async validateDatabaseConsistency(organisationId: string): Promise<{
    consistent: boolean;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      type: 'subscription' | 'customer' | 'billing_status' | 'seats' | 'plan';
      message: string;
      database_value: any;
      stripe_value: any;
      recommended_action: string;
    }>;
    last_sync: Date | null;
    stripe_data: {
      customer_exists: boolean;
      subscription_exists: boolean;
      subscription_status: string | null;
      subscription_items_count: number;
      current_period_end: Date | null;
    };
  }> {
    const issues: Array<{
      severity: 'error' | 'warning' | 'info';
      type: 'subscription' | 'customer' | 'billing_status' | 'seats' | 'plan';
      message: string;
      database_value: any;
      stripe_value: any;
      recommended_action: string;
    }> = [];

    try {
      console.log(`Validating database consistency for org ${organisationId}`);

      const { storage } = await import('../storage');
      const organisation = await storage.getOrganisation(organisationId);
      
      if (!organisation) {
        return {
          consistent: false,
          issues: [{
            severity: 'error',
            type: 'subscription',
            message: 'Organization not found in database',
            database_value: null,
            stripe_value: null,
            recommended_action: 'Check organization ID and database connection'
          }],
          last_sync: null,
          stripe_data: {
            customer_exists: false,
            subscription_exists: false,
            subscription_status: null,
            subscription_items_count: 0,
            current_period_end: null
          }
        };
      }

      const stripeData = {
        customer_exists: false,
        subscription_exists: false,
        subscription_status: null as string | null,
        subscription_items_count: 0,
        current_period_end: null as Date | null
      };

      // Validate Stripe customer
      const customerId = this.normalizeStripeId(organisation.stripeCustomerId);
      if (customerId) {
        try {
          const customer = await this.stripe.customers.retrieve(customerId);
          stripeData.customer_exists = !customer.deleted;
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            issues.push({
              severity: 'error',
              type: 'customer',
              message: 'Customer ID exists in database but not found in Stripe',
              database_value: customerId,
              stripe_value: null,
              recommended_action: 'Remove customer ID from database or recreate customer in Stripe'
            });
          }
        }
      } else if (organisation.billingStatus !== 'setup_required') {
        issues.push({
          severity: 'warning',
          type: 'customer',
          message: 'No Stripe customer ID but billing is configured',
          database_value: null,
          stripe_value: null,
          recommended_action: 'Create Stripe customer or reset billing status'
        });
      }

      // Validate Stripe subscription
      const subscriptionId = this.normalizeStripeId(organisation.stripeSubscriptionId);
      if (subscriptionId) {
        try {
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price']
          });

          stripeData.subscription_exists = true;
          stripeData.subscription_status = subscription.status;
          stripeData.subscription_items_count = subscription.items.data.length;
          stripeData.current_period_end = new Date((subscription as any).current_period_end * 1000);

          // Check subscription status consistency
          const mappedStatus = this.mapStripeToBillingStatus(subscription.status);
          if (organisation.billingStatus !== mappedStatus) {
            issues.push({
              severity: 'warning',
              type: 'billing_status',
              message: 'Billing status mismatch between database and Stripe',
              database_value: organisation.billingStatus,
              stripe_value: mappedStatus,
              recommended_action: 'Update database billing status to match Stripe'
            });
          }

          // Check subscription items
          if (subscription.items.data.length === 0) {
            issues.push({
              severity: 'error',
              type: 'subscription',
              message: 'Subscription exists but has no items',
              database_value: 'subscription exists',
              stripe_value: 'no items',
              recommended_action: 'Add subscription item or cancel subscription'
            });
          } else if (subscription.items.data.length > 1) {
            issues.push({
              severity: 'warning',
              type: 'subscription',
              message: 'Subscription has multiple items - may cause issues',
              database_value: 1,
              stripe_value: subscription.items.data.length,
              recommended_action: 'Consolidate to single subscription item'
            });
          } else {
            const item = subscription.items.data[0];
            
            // Check subscription item ID consistency
            const dbItemId = this.normalizeStripeId(organisation.stripeSubscriptionItemId);
            if (dbItemId && dbItemId !== item.id) {
              issues.push({
                severity: 'error',
                type: 'subscription',
                message: 'Subscription item ID mismatch',
                database_value: dbItemId,
                stripe_value: item.id,
                recommended_action: 'Update database with correct subscription item ID'
              });
            }

            // Check seat count consistency
            if (item.quantity !== organisation.activeUserCount) {
              issues.push({
                severity: 'warning',
                type: 'seats',
                message: 'Seat count mismatch between database and Stripe',
                database_value: organisation.activeUserCount,
                stripe_value: item.quantity,
                recommended_action: 'Sync seat counts between systems'
              });
            }
          }

        } catch (error: any) {
          if (error.code === 'resource_missing') {
            issues.push({
              severity: 'error',
              type: 'subscription',
              message: 'Subscription ID exists in database but not found in Stripe',
              database_value: subscriptionId,
              stripe_value: null,
              recommended_action: 'Remove subscription data from database or recreate subscription'
            });
          }
        }
      } else if (['active', 'trialing', 'past_due'].includes(organisation.billingStatus)) {
        issues.push({
          severity: 'error',
          type: 'subscription',
          message: 'Organization marked as having active subscription but no subscription ID',
          database_value: organisation.billingStatus,
          stripe_value: null,
          recommended_action: 'Update billing status or create subscription'
        });
      }

      // Check plan consistency
      if (organisation.planId) {
        const plans = await storage.getPlans();
        const plan = plans.find(p => p.id === organisation.planId);
        if (!plan) {
          issues.push({
            severity: 'warning',
            type: 'plan',
            message: 'Organization references non-existent plan',
            database_value: organisation.planId,
            stripe_value: null,
            recommended_action: 'Update to valid plan ID or recreate plan'
          });
        }
      }

      const consistent = issues.filter(issue => issue.severity === 'error').length === 0;

      console.log(`Database consistency check complete for org ${organisationId}:`, {
        consistent,
        errorCount: issues.filter(i => i.severity === 'error').length,
        warningCount: issues.filter(i => i.severity === 'warning').length,
        infoCount: issues.filter(i => i.severity === 'info').length
      });

      return {
        consistent,
        issues,
        last_sync: organisation.lastBillingSync,
        stripe_data: stripeData
      };

    } catch (error) {
      console.error(`Error validating database consistency for org ${organisationId}:`, error);
      
      return {
        consistent: false,
        issues: [{
          severity: 'error',
          type: 'subscription',
          message: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          database_value: null,
          stripe_value: null,
          recommended_action: 'Check system logs and retry validation'
        }],
        last_sync: null,
        stripe_data: {
          customer_exists: false,
          subscription_exists: false,
          subscription_status: null,
          subscription_items_count: 0,
          current_period_end: null
        }
      };
    }
  }

  /**
   * Map Stripe subscription status to billing status with enhanced error handling
   */
  private mapStripeToBillingStatus(stripeStatus: string): 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused' {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'cancelled':
        return 'canceled';
      case 'unpaid':
        return 'unpaid';
      case 'incomplete':
        return 'incomplete';
      case 'incomplete_expired':
        return 'incomplete_expired';
      case 'trialing':
        return 'trialing';
      case 'paused':
        return 'paused';
      default:
        console.warn(`Unknown Stripe status: ${stripeStatus}, defaulting to 'unpaid'`);
        return 'unpaid';
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
      let upcomingInvoice: any;
      
      try {
        // Use generic stripe API call for upcoming invoice preview
        upcomingInvoice = await (this.stripe as any).invoices.upcoming({
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
      const prorationDetails = upcomingInvoice.lines.data.map((line: any) => ({
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
   * Enhanced plan limits validator - ensures compliance with plan restrictions
   * Validates user counts, feature access, and usage limits
   */
  async validatePlanLimits(
    plan: Plan,
    organisation: Organisation,
    requestedUserCount: number,
    operation: 'create' | 'update' | 'validate'
  ): Promise<{
    valid: boolean;
    violations: Array<{
      type: 'seat_limit' | 'feature_limit' | 'usage_limit' | 'billing_limit';
      message: string;
      current_value: number;
      limit_value: number;
      severity: 'error' | 'warning';
    }>;
    recommendations: string[];
    adjusted_user_count: number;
  }> {
    const violations: Array<{
      type: 'seat_limit' | 'feature_limit' | 'usage_limit' | 'billing_limit';
      message: string;
      current_value: number;
      limit_value: number;
      severity: 'error' | 'warning';
    }> = [];
    const recommendations: string[] = [];

    try {
      console.log(`Validating plan limits for org ${organisation.id}:`, {
        planId: plan.id,
        requestedUserCount,
        operation,
        currentSeats: organisation.activeUserCount
      });

      // Validate minimum seat requirements
      const minSeats = plan.minSeats || 1;
      let adjustedUserCount = requestedUserCount;

      if (requestedUserCount < minSeats) {
        violations.push({
          type: 'seat_limit',
          message: `Plan ${plan.name} requires minimum ${minSeats} seats`,
          current_value: requestedUserCount,
          limit_value: minSeats,
          severity: 'error'
        });
        adjustedUserCount = minSeats;
        recommendations.push(`Increase seat count to ${minSeats} to meet plan requirements`);
      }

      // Validate maximum seat restrictions (if plan has limits)
      const maxSeats = plan.maxSeats;
      if (maxSeats && requestedUserCount > maxSeats) {
        violations.push({
          type: 'seat_limit',
          message: `Plan ${plan.name} allows maximum ${maxSeats} seats`,
          current_value: requestedUserCount,
          limit_value: maxSeats,
          severity: 'error'
        });
        adjustedUserCount = maxSeats;
        recommendations.push(`Reduce seat count to ${maxSeats} or upgrade to higher tier plan`);
      }

      // Validate billing model constraints
      if (plan.billingModel === 'flat_subscription' && requestedUserCount > 1) {
        violations.push({
          type: 'billing_limit',
          message: `Flat subscription plans don't support multiple seats`,
          current_value: requestedUserCount,
          limit_value: 1,
          severity: 'warning'
        });
        recommendations.push('Consider upgrading to per-seat billing model for multiple users');
      }

      // Check for downgrade restrictions during active period
      if (operation === 'update' && organisation.activeUserCount > requestedUserCount) {
        const currentPeriodEnd = organisation.currentPeriodEnd;
        if (currentPeriodEnd && currentPeriodEnd > new Date()) {
          const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 14) { // More than 2 weeks remaining
            violations.push({
              type: 'usage_limit',
              message: `Seat reduction during active billing period (${daysRemaining} days remaining)`,
              current_value: requestedUserCount,
              limit_value: organisation.activeUserCount,
              severity: 'warning'
            });
            recommendations.push('Consider waiting until next billing cycle to avoid proration charges');
          }
        }
      }

      // Validate feature compatibility
      const { storage } = await import('../storage');
      const planFeatures = await storage.getPlanFeaturesByPlanId(plan.id);
      
      // Check if organization is already using features that would be restricted
      if (operation === 'update') {
        for (const feature of planFeatures) {
          if (feature.limit !== null && feature.limit < (organisation as any)[`${feature.featureKey}Usage`]) {
            violations.push({
              type: 'feature_limit',
              message: `Current ${feature.featureName} usage exceeds plan limit`,
              current_value: (organisation as any)[`${feature.featureKey}Usage`] || 0,
              limit_value: feature.limit,
              severity: 'warning'
            });
            recommendations.push(`Reduce ${feature.featureName} usage or choose plan with higher limits`);
          }
        }
      }

      const hasErrors = violations.some(v => v.severity === 'error');
      const valid = !hasErrors;

      console.log(`Plan limit validation complete:`, {
        valid,
        errorCount: violations.filter(v => v.severity === 'error').length,
        warningCount: violations.filter(v => v.severity === 'warning').length,
        adjustedUserCount
      });

      return {
        valid,
        violations,
        recommendations,
        adjusted_user_count: adjustedUserCount
      };

    } catch (error) {
      console.error(`Error validating plan limits for org ${organisation.id}:`, error);
      
      return {
        valid: false,
        violations: [{
          type: 'usage_limit',
          message: `Plan validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          current_value: requestedUserCount,
          limit_value: 0,
          severity: 'error'
        }],
        recommendations: ['Contact support for assistance with plan validation'],
        adjusted_user_count: requestedUserCount
      };
    }
  }

  /**
   * Enhanced error recovery system with comprehensive retry and logging
   * Handles transient failures and provides detailed recovery guidance
   */
  async executeWithErrorRecovery<T>(
    operation: string,
    organisationId: string,
    operationFn: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelayMs?: number;
      criticalOperation?: boolean;
      fallbackFn?: () => Promise<T | null>;
    } = {}
  ): Promise<{
    success: boolean;
    result?: T;
    error?: string;
    recovery_attempts: number;
    recovery_log: Array<{
      attempt: number;
      timestamp: Date;
      error: string;
      action_taken: string;
    }>;
  }> {
    const {
      maxRetries = 3,
      retryDelayMs = 1000,
      criticalOperation = false,
      fallbackFn
    } = options;

    const recoveryLog: Array<{
      attempt: number;
      timestamp: Date;
      error: string;
      action_taken: string;
    }> = [];

    console.log(`🔄 Starting error recovery operation: ${operation} for org ${organisationId}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operationFn();
        
        if (recoveryLog.length > 0) {
          console.log(`✅ Operation ${operation} succeeded after ${attempt - 1} recovery attempts`);
        }

        return {
          success: true,
          result,
          recovery_attempts: recoveryLog.length,
          recovery_log: recoveryLog
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const timestamp = new Date();
        
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${operation}:`, errorMessage);

        // Categorize error types for specific recovery strategies
        let actionTaken = 'Will retry with exponential backoff';
        let shouldRetry = attempt < maxRetries;

        if (errorMessage.includes('rate_limit')) {
          actionTaken = 'Rate limit hit - increasing retry delay';
          await this.delay(retryDelayMs * Math.pow(2, attempt));
        } else if (errorMessage.includes('resource_missing')) {
          actionTaken = 'Resource not found - no retry needed';
          shouldRetry = false;
        } else if (errorMessage.includes('idempotency_key')) {
          actionTaken = 'Idempotency conflict - operation may have succeeded';
          shouldRetry = false;
        } else if (errorMessage.includes('card_declined') || errorMessage.includes('payment_failed')) {
          actionTaken = 'Payment failure - no retry needed';
          shouldRetry = false;
        } else {
          // Generic network/API error - retry with backoff
          await this.delay(retryDelayMs * attempt);
        }

        recoveryLog.push({
          attempt,
          timestamp,
          error: errorMessage,
          action_taken: actionTaken
        });

        // If critical operation and we've failed all retries, try fallback
        if (!shouldRetry && criticalOperation && fallbackFn && attempt === maxRetries) {
          try {
            console.log(`🚨 Critical operation failed - attempting fallback for ${operation}`);
            const fallbackResult = await fallbackFn();
            
            if (fallbackResult !== null) {
              recoveryLog.push({
                attempt: attempt + 1,
                timestamp: new Date(),
                error: 'Fallback succeeded',
                action_taken: 'Used fallback mechanism'
              });

              return {
                success: true,
                result: fallbackResult,
                recovery_attempts: recoveryLog.length,
                recovery_log: recoveryLog
              };
            }
          } catch (fallbackError) {
            recoveryLog.push({
              attempt: attempt + 1,
              timestamp: new Date(),
              error: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
              action_taken: 'Fallback mechanism failed'
            });
          }
        }

        if (!shouldRetry) {
          break;
        }
      }
    }

    // All attempts failed
    console.error(`💥 Operation ${operation} failed after ${maxRetries} attempts`);

    return {
      success: false,
      error: recoveryLog[recoveryLog.length - 1]?.error || 'Operation failed',
      recovery_attempts: recoveryLog.length,
      recovery_log: recoveryLog
    };
  }

  /**
   * Utility method for implementing delays with jitter
   */
  private async delay(ms: number): Promise<void> {
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3; // Up to 30% jitter
    const delayMs = ms * (1 + jitter);
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Enhanced subscription lock management with deadlock prevention
   * Provides more granular locking with timeout and health checking
   */
  async acquireEnhancedSubscriptionLock(
    organisationId: string, 
    operation: string,
    timeoutMs: number = 30000
  ): Promise<{
    acquired: boolean;
    lockId: string;
    expiresAt: Date;
    queuePosition?: number;
  }> {
    const lockId = `${organisationId}-${operation}-${Date.now()}-${Math.random()}`;
    const expiresAt = new Date(Date.now() + timeoutMs);
    
    try {
      console.log(`🔐 Acquiring enhanced lock for org ${organisationId}, operation: ${operation}`);

      // Check if lock already exists
      const existingLock = this.subscriptionLocks.get(organisationId);
      if (existingLock) {
        const waitTime = existingLock.expiresAt.getTime() - Date.now();
        
        if (waitTime > 0) {
          console.log(`⏳ Lock exists for org ${organisationId}, waiting up to ${waitTime}ms`);
          
          // Wait for existing lock to expire or be released
          const waitPromise = new Promise<boolean>((resolve) => {
            const checkInterval = setInterval(() => {
              const currentLock = this.subscriptionLocks.get(organisationId);
              if (!currentLock || currentLock.expiresAt < new Date()) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (Date.now() >= expiresAt.getTime()) {
                clearInterval(checkInterval);
                resolve(false); // Timeout
              }
            }, 100); // Check every 100ms
          });

          const acquired = await waitPromise;
          if (!acquired) {
            return {
              acquired: false,
              lockId,
              expiresAt,
              queuePosition: 1
            };
          }
        }
      }

      // Acquire new lock
      this.subscriptionLocks.set(organisationId, {
        lockId,
        operation,
        acquiredAt: new Date(),
        expiresAt,
        threadId: `thread-${Date.now()}`
      });

      console.log(`✅ Enhanced lock acquired for org ${organisationId}, lockId: ${lockId}`);

      return {
        acquired: true,
        lockId,
        expiresAt
      };

    } catch (error) {
      console.error(`❌ Failed to acquire enhanced lock for org ${organisationId}:`, error);
      
      return {
        acquired: false,
        lockId,
        expiresAt
      };
    }
  }

  /**
   * Release enhanced subscription lock with validation
   */
  async releaseEnhancedSubscriptionLock(
    organisationId: string,
    lockId: string,
    success: boolean,
    error?: any
  ): Promise<boolean> {
    try {
      const existingLock = this.subscriptionLocks.get(organisationId);
      
      if (!existingLock) {
        console.warn(`⚠️  Attempting to release non-existent lock for org ${organisationId}`);
        return false;
      }

      if (existingLock.lockId !== lockId) {
        console.warn(`⚠️  Lock ID mismatch for org ${organisationId}: expected ${lockId}, found ${existingLock.lockId}`);
        return false;
      }

      this.subscriptionLocks.delete(organisationId);
      
      console.log(`🔓 Enhanced lock released for org ${organisationId}:`, {
        lockId,
        success,
        duration: Date.now() - existingLock.acquiredAt.getTime(),
        operation: existingLock.operation
      });

      return true;

    } catch (error) {
      console.error(`❌ Failed to release enhanced lock for org ${organisationId}:`, error);
      return false;
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