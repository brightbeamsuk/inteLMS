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
   * Process Stripe webhook event with persistent idempotency protection and transaction safety
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

    // Process webhook event with retries for transient failures
    let attempts = 0;
    const maxAttempts = 3;
    const baseDelayMs = 1000;

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        let result: { success: boolean; message: string };

        switch (event.type) {
          case 'checkout.session.completed':
            result = await this.handleCheckoutSessionCompleted(event, correlationId);
            break;
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
            result = { success: true, message: `Event type ${event.type} not processed` };
        }

        // If processing succeeded, record the webhook event and return
        if (result.success) {
          try {
            await storage.recordWebhookEvent({
              stripeEventId: event.id,
              eventType: event.type,
              success: true,
              errorMessage: null,
              correlationId
            });
          } catch (recordError) {
            console.error(`Failed to record successful webhook event [${correlationId}]:`, recordError);
            // Continue anyway - processing was successful
          }
          
          // Periodic cleanup of old webhook events (older than 30 days)
          // Run cleanup on 1% of requests to avoid overhead
          if (Math.random() < 0.01) {
            try {
              const deletedCount = await storage.cleanupOldWebhookEvents(30);
              if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} old webhook events`);
              }
            } catch (cleanupError) {
              console.warn(`Webhook cleanup failed [${correlationId}]:`, cleanupError);
              // Don't fail the webhook for cleanup issues
            }
          }

          console.log(`✅ Webhook processed successfully [${correlationId}]:`, result);
          return result;
        }

        // If processing failed and this isn't the last attempt, retry
        if (attempts < maxAttempts) {
          const delayMs = baseDelayMs * Math.pow(2, attempts - 1); // Exponential backoff
          console.warn(`🔄 Webhook processing failed (attempt ${attempts}/${maxAttempts}) [${correlationId}], retrying in ${delayMs}ms:`, result.message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Final attempt failed - record the failure and return error
        console.error(`❌ Webhook processing failed after ${maxAttempts} attempts [${correlationId}]:`, result.message);
        
        try {
          await storage.recordWebhookEvent({
            stripeEventId: event.id,
            eventType: event.type,
            success: false,
            errorMessage: result.message,
            correlationId
          });
        } catch (recordError) {
          console.error(`Failed to record failed webhook event [${correlationId}]:`, recordError);
        }
        
        return result;

      } catch (error) {
        console.error(`❌ Webhook processing exception (attempt ${attempts}/${maxAttempts}) [${correlationId}]:`, error);
        
        // If this is the last attempt, record the error and fail
        if (attempts >= maxAttempts) {
          try {
            await storage.recordWebhookEvent({
              stripeEventId: event.id,
              eventType: event.type,
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              correlationId
            });
          } catch (recordError) {
            console.error(`Failed to record exception webhook event [${correlationId}]:`, recordError);
          }
          
          return {
            success: false,
            message: `Processing exception after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
        
        // Retry on exception (could be transient database issue)
        const delayMs = baseDelayMs * Math.pow(2, attempts - 1);
        console.warn(`🔄 Webhook processing exception (attempt ${attempts}/${maxAttempts}) [${correlationId}], retrying in ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Should never reach here, but just in case
    return {
      success: false,
      message: 'Unexpected processing termination'
    };
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
   * Handle checkout.session.completed webhook
   * Extract metadata and mark organization with pending verification
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const session = event.data.object as Stripe.Checkout.Session;
    
    console.log(`🛒 Checkout session completed [${correlationId}]:`, {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription,
      metadata: session.metadata,
      amount: session.amount_total,
      currency: session.currency
    });

    // Extract metadata from checkout session
    const metadata = session.metadata || {};
    const orgId = metadata.org_id;
    const intendedPlanId = metadata.plan_id;
    const intendedSeats = metadata.seats ? parseInt(metadata.seats, 10) : 1;

    if (!orgId) {
      console.warn(`No org_id in checkout session metadata [${correlationId}]`);
      return {
        success: false,
        message: 'Missing org_id in checkout session metadata'
      };
    }

    // Find organization by metadata org_id (not customer_id as that may not be set yet)
    const organisation = await storage.getOrganisation(orgId);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for org_id: ${orgId}`
      };
    }

    // Find plan if specified in metadata
    let plan = null;
    if (intendedPlanId) {
      plan = await storage.getPlan(intendedPlanId);
      if (!plan) {
        console.warn(`Plan not found for plan_id: ${intendedPlanId} [${correlationId}]`);
      }
    }

    // Prepare update data with pending verification status
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeCustomerId: session.customer as string || organisation.stripeCustomerId,
      stripeSubscriptionId: session.subscription as string || organisation.stripeSubscriptionId,
      billingStatus: 'incomplete', // Mark as pending verification
      lastBillingSync: new Date(),
    };

    // Set plan and quantity if available
    if (plan) {
      updateData.planId = plan.id;
    }
    if (intendedSeats > 0) {
      updateData.activeUserCount = intendedSeats;
    }

    // Update organization with checkout session data
    await storage.updateOrganisationBilling(organisation.id, updateData);

    console.log(`✅ Checkout session processed for org ${organisation.name} [${correlationId}]:`, {
      orgId: organisation.id,
      planId: plan?.id,
      seats: intendedSeats,
      status: 'pending_verification'
    });

    return {
      success: true,
      message: `Checkout session completed for organization ${organisation.name}, pending subscription verification`
    };
  }

  /**
   * Handle customer.subscription.created webhook
   * Mark subscription as active/trialing based on Stripe status
   */
  private async handleSubscriptionCreated(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    const { subscriptionId, subscriptionItemId, priceId, quantity, status, currentPeriodStart, currentPeriodEnd } = this.extractSubscriptionData(subscription);
    
    console.log(`🆕 Subscription created [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId,
      status,
      quantity,
      priceId,
      currentPeriodStart,
      currentPeriodEnd
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Find plan by price ID
    const plan = priceId ? await this.findPlanByPriceId(priceId) : null;
    if (!plan && priceId) {
      console.warn(`Plan not found for price ID: ${priceId}, updating subscription without plan reference [${correlationId}]`);
    }

    // Comprehensive update data based on Stripe subscription
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionItemId: subscriptionItemId,
      billingStatus: this.mapStripeToBillingStatus(status),
      activeUserCount: quantity,
      currentPeriodEnd: currentPeriodEnd,
      lastBillingSync: new Date(),
    };

    // Set plan if found
    if (plan) {
      updateData.planId = plan.id;
    }

    // Update organization with complete subscription details
    await storage.updateOrganisationBilling(organisation.id, updateData);

    // Log the state transition
    console.log(`✅ Subscription created and org updated [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      planId: plan?.id,
      planName: plan?.name,
      seats: quantity,
      status: this.mapStripeToBillingStatus(status),
      currentPeriodEnd
    });

    return {
      success: true,
      message: `Subscription created for organization ${organisation.name} (${this.mapStripeToBillingStatus(status)})`
    };
  }

  /**
   * Handle customer.subscription.updated webhook
   * Mirror all plan/quantity/status changes from Stripe subscription
   */
  private async handleSubscriptionUpdated(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    const { subscriptionId, subscriptionItemId, priceId, quantity, status, currentPeriodStart, currentPeriodEnd } = this.extractSubscriptionData(subscription);
    
    console.log(`📝 Subscription updated [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId,
      status,
      quantity,
      priceId,
      currentPeriodStart,
      currentPeriodEnd
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Find plan by updated price ID (plan may have changed)
    const plan = priceId ? await this.findPlanByPriceId(priceId) : null;
    if (!plan && priceId) {
      console.warn(`Plan not found for updated price ID: ${priceId}, updating without plan reference [${correlationId}]`);
    }

    // Log what changed
    const currentStatus = organisation.billingStatus;
    const currentSeats = organisation.activeUserCount;
    const currentPlanId = organisation.planId;
    const newStatus = this.mapStripeToBillingStatus(status);

    console.log(`🔄 Subscription changes detected [${correlationId}]:`, {
      orgId: organisation.id,
      statusChange: currentStatus !== newStatus ? `${currentStatus} → ${newStatus}` : 'no change',
      seatsChange: currentSeats !== quantity ? `${currentSeats} → ${quantity}` : 'no change', 
      planChange: currentPlanId !== plan?.id ? `${currentPlanId} → ${plan?.id}` : 'no change'
    });

    // Comprehensive update with all subscription changes
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionItemId: subscriptionItemId,
      billingStatus: newStatus,
      activeUserCount: quantity,
      currentPeriodEnd: currentPeriodEnd,
      lastBillingSync: new Date(),
    };

    // Update plan if found (or clear if changed to null)
    if (plan) {
      updateData.planId = plan.id;
    } else if (!priceId) {
      // No price ID means subscription might be cleared
      updateData.planId = undefined;
    }

    // Update organization with all changes from Stripe
    await storage.updateOrganisationBilling(organisation.id, updateData);

    console.log(`✅ Subscription updated and org synced [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      newStatus,
      newSeats: quantity,
      newPlanId: plan?.id,
      currentPeriodEnd
    });

    return {
      success: true,
      message: `Subscription updated for organization ${organisation.name} (${newStatus}, ${quantity} seats)`
    };
  }

  /**
   * Handle customer.subscription.deleted webhook
   * Mark LMS subscription cancelled (immediate or at period end)
   */
  private async handleSubscriptionDeleted(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    
    console.log(`🗑️  Subscription deleted [${correlationId}]:`, {
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      cancelAt: subscription.cancel_at,
      canceledAt: subscription.canceled_at,
      endedAt: subscription.ended_at
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Determine if this is immediate cancellation or end-of-period
    const isImmediateCancellation = subscription.ended_at !== null;
    const cancelMode = isImmediateCancellation ? 'immediate' : 'at_period_end';

    console.log(`📅 Subscription cancellation mode [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      mode: cancelMode,
      currentStatus: organisation.billingStatus,
      endedAt: subscription.ended_at,
      currentPeriodEnd: subscription.current_period_end
    });

    // Update organization - clear subscription data and mark as canceled
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeSubscriptionId: undefined,
      billingStatus: 'canceled',
      lastBillingSync: new Date(),
    };

    // For immediate cancellation, also clear plan
    if (isImmediateCancellation) {
      updateData.planId = undefined;
      updateData.activeUserCount = 0; // Reset seats to 0 for immediate cancellation
    }
    // For period-end cancellation, keep current plan/seats until period ends

    await storage.updateOrganisationBilling(organisation.id, updateData);

    console.log(`✅ Subscription cancelled and org updated [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      cancelMode,
      planCleared: isImmediateCancellation,
      seatsCleared: isImmediateCancellation
    });

    return {
      success: true,
      message: `Subscription cancelled for organization ${organisation.name} (${cancelMode})`
    };
  }

  /**
   * Handle invoice.paid webhook
   * Authoritative success signal - update DB plan/quantity/status/period from subscription
   */
  private async handleInvoicePaid(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log(`💰 Invoice paid [${correlationId}]:`, {
      customerId: invoice.customer,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      billingReason: invoice.billing_reason
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(invoice.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${invoice.customer}`
      };
    }

    // If this invoice is associated with a subscription, get the latest subscription data
    let subscriptionData = null;
    if (invoice.subscription) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription as string);
        subscriptionData = this.extractSubscriptionData(subscription);
        
        console.log(`📊 Retrieved subscription data for invoice [${correlationId}]:`, {
          subscriptionId: subscriptionData.subscriptionId,
          priceId: subscriptionData.priceId,
          quantity: subscriptionData.quantity,
          status: subscriptionData.status,
          currentPeriodEnd: subscriptionData.currentPeriodEnd
        });
      } catch (error) {
        console.warn(`Failed to retrieve subscription ${invoice.subscription} for invoice ${invoice.id} [${correlationId}]:`, error);
      }
    }

    // Prepare comprehensive update based on successful payment
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeCustomerId: invoice.customer as string,
      billingStatus: 'active', // Successful payment = active status
      lastBillingSync: new Date(),
    };

    // If we have subscription data, use it as source of truth
    if (subscriptionData) {
      updateData.stripeSubscriptionId = subscriptionData.subscriptionId;
      updateData.stripeSubscriptionItemId = subscriptionData.subscriptionItemId;
      updateData.activeUserCount = subscriptionData.quantity;
      updateData.currentPeriodEnd = subscriptionData.currentPeriodEnd;

      // Find plan by price ID
      if (subscriptionData.priceId) {
        const plan = await this.findPlanByPriceId(subscriptionData.priceId);
        if (plan) {
          updateData.planId = plan.id;
          console.log(`📋 Plan resolved from subscription [${correlationId}]:`, { planId: plan.id, planName: plan.name });
        } else {
          console.warn(`Plan not found for price ID: ${subscriptionData.priceId} [${correlationId}]`);
        }
      }
    }

    // Update organization with confirmed payment and subscription data
    await storage.updateOrganisationBilling(organisation.id, updateData);

    console.log(`✅ Invoice payment processed and org updated [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      invoiceId: invoice.id,
      amountPaid: invoice.amount_paid,
      newStatus: 'active',
      subscriptionUpdated: !!subscriptionData,
      seats: subscriptionData?.quantity,
      planId: updateData.planId
    });

    return {
      success: true,
      message: `Payment processed for organization ${organisation.name} (invoice: ${invoice.id})`
    };
  }

  /**
   * Handle invoice.payment_failed webhook
   * Mark failure, preserve current plan/seats (don't downgrade on failure)
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log(`❌ Invoice payment failed [${correlationId}]:`, {
      customerId: invoice.customer,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt,
      dueDate: invoice.due_date,
      amountDue: invoice.amount_due
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
      // Stripe will retry - mark as past due but maintain service
      billingStatus = 'past_due';
    } else {
      // No more retries - mark as unpaid but still maintain plan
      billingStatus = 'unpaid';
    }

    console.log(`💳 Payment failure analysis [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      currentStatus: organisation.billingStatus,
      newStatus: billingStatus,
      willRetry: !!invoice.next_payment_attempt,
      attemptCount: invoice.attempt_count,
      preservingPlan: true,
      preservingSeats: true
    });

    // Update billing status ONLY - preserve current plan/seats on failure
    // This follows dunning management principles: don't downgrade on payment failure
    const updateData: Parameters<typeof storage.updateOrganisationBilling>[1] = {
      stripeCustomerId: invoice.customer as string,
      billingStatus: billingStatus as any,
      lastBillingSync: new Date(),
      // Deliberately NOT updating: planId, activeUserCount, stripeSubscriptionId
      // These remain unchanged to preserve customer service during payment issues
    };

    await storage.updateOrganisationBilling(organisation.id, updateData);

    console.log(`✅ Payment failure processed and org updated [${correlationId}]:`, {
      orgId: organisation.id,
      orgName: organisation.name,
      invoiceId: invoice.id,
      newStatus: billingStatus,
      planPreserved: organisation.planId,
      seatsPreserved: organisation.activeUserCount,
      subscriptionPreserved: organisation.stripeSubscriptionId,
      retryScheduled: !!invoice.next_payment_attempt
    });

    return {
      success: true,
      message: `Payment failure processed for organization ${organisation.name} (${billingStatus}, plan preserved)`
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