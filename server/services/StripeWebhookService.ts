import Stripe from 'stripe';
import { storage } from '../storage';
import type { Organisation, Plan, InsertWebhookEvent } from '../../shared/schema';
import { nanoid } from 'nanoid';

export class StripeWebhookService {
  private stripe: Stripe;
  private webhookSecret: string;
  
  // Note: Persistent idempotency tracking is now handled via database storage
  // No longer using in-memory Set to prevent loss on server restart
  
  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    // Enforce webhook secret requirement in production for security
    if (!this.webhookSecret) {
      if (isProduction) {
        throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required in production for webhook signature verification');
      } else {
        console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set - webhook signature verification disabled (development mode only)');
      }
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Verify webhook signature and construct Stripe event
   */
  constructEvent(body: Buffer, signature: string): Stripe.Event {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!this.webhookSecret) {
      if (isProduction) {
        throw new Error('Webhook signature verification failed: STRIPE_WEBHOOK_SECRET not configured in production');
      } else {
        console.warn('⚠️  Webhook signature verification skipped - no webhook secret configured (development mode only)');
        return JSON.parse(body.toString());
      }
    }

    if (!signature) {
      throw new Error('Webhook signature verification failed: Missing stripe-signature header');
    }

    try {
      return this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process Stripe webhook event with persistent idempotency protection
   */
  async processWebhookEvent(event: Stripe.Event): Promise<{ success: boolean; message: string }> {
    const correlationId = `webhook-${event.id}-${nanoid(8)}`;
    console.log(`📨 Processing webhook event [${correlationId}]:`, {
      type: event.type,
      id: event.id,
      created: new Date(event.created * 1000).toISOString()
    });

    // Persistent idempotency check using database storage
    const isAlreadyProcessed = await storage.isWebhookEventProcessed(event.id);
    if (isAlreadyProcessed) {
      console.log(`⚠️  Event ${event.id} already processed (found in database), skipping`);
      return { success: true, message: 'Event already processed' };
    }

    try {
      let result: { success: boolean; message: string };

      switch (event.type) {
        case 'customer.subscription.created':
          result = await this.handleSubscriptionCreated(event, correlationId);
          break;
        case 'customer.subscription.updated':
          result = await this.handleSubscriptionUpdated(event, correlationId);
          break;
        case 'customer.subscription.deleted':
          result = await this.handleSubscriptionDeleted(event, correlationId);
          break;
        case 'invoice.paid':
          result = await this.handleInvoicePaid(event, correlationId);
          break;
        case 'invoice.payment_failed':
          result = await this.handleInvoicePaymentFailed(event, correlationId);
          break;
        default:
          console.log(`🤷 Unhandled webhook event type: ${event.type}`);
          return { success: true, message: `Event type ${event.type} not processed` };
      }

      // Record webhook event in database with result
      await storage.recordWebhookEvent({
        stripeEventId: event.id,
        eventType: event.type,
        success: result.success,
        errorMessage: result.success ? null : result.message,
        correlationId
      });
      
      // Periodic cleanup of old webhook events (older than 30 days)
      // Run cleanup on 1% of requests to avoid overhead
      if (Math.random() < 0.01) {
        const deletedCount = await storage.cleanupOldWebhookEvents(30);
        if (deletedCount > 0) {
          console.log(`🧹 Cleaned up ${deletedCount} old webhook events`);
        }
      }

      console.log(`✅ Webhook processed [${correlationId}]:`, result);
      return result;

    } catch (error) {
      console.error(`❌ Webhook processing failed [${correlationId}]:`, error);
      
      // Record failed webhook event in database for debugging
      try {
        await storage.recordWebhookEvent({
          stripeEventId: event.id,
          eventType: event.type,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          correlationId
        });
      } catch (recordError) {
        console.error(`Failed to record failed webhook event:`, recordError);
      }
      
      return {
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find organization by Stripe customer ID
   */
  private async findOrganizationByCustomerId(customerId: string): Promise<Organisation | null> {
    try {
      const orgs = await storage.getAllOrganisations();
      return orgs.find(org => org.stripeCustomerId === customerId) || null;
    } catch (error) {
      console.error('Error finding organization by customer ID:', error);
      return null;
    }
  }

  /**
   * Find plan by Stripe price ID
   */
  private async findPlanByPriceId(priceId: string): Promise<Plan | null> {
    try {
      const plans = await storage.getAllPlans();
      return plans.find(plan => plan.stripePriceId === priceId) || null;
    } catch (error) {
      console.error('Error finding plan by price ID:', error);
      return null;
    }
  }

  /**
   * Extract relevant data from subscription object
   */
  private extractSubscriptionData(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];
    return {
      subscriptionId: subscription.id,
      subscriptionItemId: item?.id || null,
      priceId: item?.price.id || null,
      quantity: item?.quantity || 1,
      status: subscription.status,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
    };
  }

  /**
   * Handle customer.subscription.created webhook
   */
  private async handleSubscriptionCreated(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    const { subscriptionId, subscriptionItemId, priceId, quantity, status } = this.extractSubscriptionData(subscription);
    
    console.log(`🆕 Subscription created [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId,
      status,
      quantity
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Find plan
    const plan = priceId ? await this.findPlanByPriceId(priceId) : null;
    if (!plan && priceId) {
      console.warn(`Plan not found for price ID: ${priceId}, updating subscription without plan reference`);
    }

    // Update organization with subscription details
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeSubscriptionId: subscriptionId,
      billingStatus: this.mapStripeToBillingStatus(status),
      activeUserCount: quantity,
      lastBillingSync: new Date(),
    };

    if (plan) {
      updateData.planId = plan.id;
    }

    await storage.updateOrganisationBilling(organisation.id, updateData);

    return {
      success: true,
      message: `Subscription created for organization ${organisation.name}`
    };
  }

  /**
   * Handle customer.subscription.updated webhook
   */
  private async handleSubscriptionUpdated(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    const { subscriptionId, subscriptionItemId, priceId, quantity, status } = this.extractSubscriptionData(subscription);
    
    console.log(`📝 Subscription updated [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId,
      status,
      quantity
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Find plan (may have changed)
    const plan = priceId ? await this.findPlanByPriceId(priceId) : null;

    // Update organization with new subscription details
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeSubscriptionId: subscriptionId,
      billingStatus: this.mapStripeToBillingStatus(status),
      activeUserCount: quantity,
      lastBillingSync: new Date(),
    };

    if (plan) {
      updateData.planId = plan.id;
    }

    await storage.updateOrganisationBilling(organisation.id, updateData);

    return {
      success: true,
      message: `Subscription updated for organization ${organisation.name}`
    };
  }

  /**
   * Handle customer.subscription.deleted webhook
   */
  private async handleSubscriptionDeleted(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    
    console.log(`🗑️  Subscription deleted [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId: subscription.id
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Update organization - clear subscription data and mark as canceled
    await storage.updateOrganisationBilling(organisation.id, {
      stripeSubscriptionId: undefined,
      billingStatus: 'canceled',
      planId: undefined, // Remove plan association
      lastBillingSync: new Date(),
    });

    return {
      success: true,
      message: `Subscription canceled for organization ${organisation.name}`
    };
  }

  /**
   * Handle invoice.paid webhook
   */
  private async handleInvoicePaid(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log(`💰 Invoice paid [${correlationId}]:`, {
      customerId: invoice.customer,
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(invoice.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${invoice.customer}`
      };
    }

    // Update billing status to active (good standing)
    await storage.updateOrganisationBilling(organisation.id, {
      billingStatus: 'active',
      lastBillingSync: new Date(),
    });

    return {
      success: true,
      message: `Payment processed for organization ${organisation.name}`
    };
  }

  /**
   * Handle invoice.payment_failed webhook
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log(`❌ Invoice payment failed [${correlationId}]:`, {
      customerId: invoice.customer,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(invoice.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${invoice.customer}`
      };
    }

    // Determine billing status based on attempt count and next attempt
    let billingStatus: string;
    if (invoice.next_payment_attempt) {
      // Stripe will retry - mark as past due
      billingStatus = 'past_due';
    } else {
      // No more retries - mark as unpaid
      billingStatus = 'unpaid';
    }

    // Update billing status
    await storage.updateOrganisationBilling(organisation.id, {
      billingStatus: billingStatus as any,
      lastBillingSync: new Date(),
    });

    return {
      success: true,
      message: `Payment failure processed for organization ${organisation.name} (status: ${billingStatus})`
    };
  }

  /**
   * Map Stripe subscription status to our billing status enum
   */
  private mapStripeToBillingStatus(stripeStatus: string): 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused' {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'cancelled': // Handle both spellings
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
}

// Create singleton instance
export const stripeWebhookService = new StripeWebhookService();