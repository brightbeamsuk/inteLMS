import Stripe from 'stripe';
import { storage } from '../storage';
import type { Organisation, Plan, InsertWebhookEvent } from '../../shared/schema';
import { nanoid } from 'nanoid';
import { billingLockService } from './BillingLockService.js';
import { emailNotificationService } from './EmailNotificationService';

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
   * Includes webhook event ordering validation and stale event detection
   */
  async processWebhookEvent(event: Stripe.Event): Promise<{ success: boolean; message: string }> {
    const correlationId = `webhook-${event.id}-${nanoid(8)}`;
    const eventTimestamp = new Date(event.created * 1000);
    
    console.log(`📨 Processing webhook event [${correlationId}]:`, {
      type: event.type,
      id: event.id,
      created: eventTimestamp.toISOString(),
      age_seconds: Math.floor((Date.now() - eventTimestamp.getTime()) / 1000)
    });

    // Persistent idempotency check using database storage
    const isAlreadyProcessed = await storage.isWebhookEventProcessed(event.id);
    if (isAlreadyProcessed) {
      console.log(`⚠️  Event ${event.id} already processed (found in database), skipping`);
      return { success: true, message: 'Event already processed' };
    }

    // Webhook event ordering validation and stale event detection
    const orderingResult = await this.validateEventOrdering(event, correlationId);
    if (!orderingResult.shouldProcess) {
      console.warn(`⚠️  Event ${event.id} rejected due to ordering validation [${correlationId}]:`, orderingResult.reason);
      
      // Record the rejected event for monitoring
      await storage.recordWebhookEvent({
        stripeEventId: event.id,
        eventType: event.type,
        success: false,
        errorMessage: `Event ordering validation failed: ${orderingResult.reason}`,
        correlationId
      });
      
      return { success: true, message: `Event rejected: ${orderingResult.reason}` };
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
          case 'payment_intent.requires_action':
            result = await this.handlePaymentIntentRequiresAction(event, correlationId);
            break;
          case 'payment_intent.succeeded':
            result = await this.handlePaymentIntentSucceeded(event, correlationId);
            break;
          case 'payment_intent.payment_failed':
            result = await this.handlePaymentIntentFailed(event, correlationId);
            break;
          case 'setup_intent.succeeded':
            result = await this.handleSetupIntentSucceeded(event, correlationId);
            break;
          case 'checkout.session.expired':
            result = await this.handleCheckoutSessionExpired(event, correlationId);
            break;
          case 'customer.subscription.trial_will_end':
            result = await this.handleTrialWillEnd(event, correlationId);
            break;
          default:
            console.log(`🤷 Unhandled webhook event type: ${event.type}`);
            result = { success: true, message: `Event type ${event.type} not processed` };
        }

        // If processing succeeded, record the webhook event and update timestamp
        if (result.success) {
          try {
            await storage.recordWebhookEvent({
              stripeEventId: event.id,
              eventType: event.type,
              success: true,
              errorMessage: null,
              correlationId
            });
            
            // Update last processed timestamp for event ordering
            await this.updateLastProcessedTimestamp(event, correlationId);
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

    // Capture previous plan before update for notification
    const previousPlanId = organisation.planId;

    // Update organization with checkout session data
    await storage.updateOrganisationBilling(organisation.id, updateData);

    // Send plan updated notification to organization admins (checkout session completed)
    if (plan && plan.id !== previousPlanId) {
      try {
        await emailNotificationService.notifyPlanUpdated(
          organisation.id,
          previousPlanId,
          plan.id,
          undefined // No specific user for webhook updates (system update)
        );
        console.log(`📧 Plan update notification sent for org ${organisation.name} [${correlationId}]: ${previousPlanId} → ${plan.id} (checkout session)`);
      } catch (error) {
        console.error(`[Checkout Session Webhook] Failed to send plan update notification [${correlationId}]:`, error);
        // Don't break the webhook processing for notification failures
      }
    }

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

    // Capture previous plan before update for notification
    const previousPlanId = organisation.planId;

    // Update organization with complete subscription details
    await storage.updateOrganisationBilling(organisation.id, updateData);

    // Send plan updated notification to organization admins (subscription created)
    if (plan && plan.id !== previousPlanId) {
      try {
        await emailNotificationService.notifyPlanUpdated(
          organisation.id,
          previousPlanId,
          plan.id,
          undefined // No specific user for webhook updates (system update)
        );
        console.log(`📧 Plan update notification sent for org ${organisation.name} [${correlationId}]: ${previousPlanId} → ${plan.id} (subscription created)`);
      } catch (error) {
        console.error(`[Subscription Created Webhook] Failed to send plan update notification [${correlationId}]:`, error);
        // Don't break the webhook processing for notification failures
      }
    }

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

    // Send plan updated notification to organization admins (Stripe webhook)
    if (currentPlanId !== plan?.id) {
      try {
        await emailNotificationService.notifyPlanUpdated(
          organisation.id,
          currentPlanId,
          plan?.id,
          undefined // No specific user for webhook updates (system update)
        );
        console.log(`📧 Plan update notification sent for org ${organisation.name} [${correlationId}]: ${currentPlanId} → ${plan?.id}`);
      } catch (error) {
        console.error(`[Stripe Webhook] Failed to send plan update notification [${correlationId}]:`, error);
        // Don't break the webhook processing for notification failures
      }
    }

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
   * Handle payment_intent.requires_action webhook (3DS authentication required)
   */
  private async handlePaymentIntentRequiresAction(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log(`🔐 Payment intent requires action (3DS) [${correlationId}]:`, {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      status: paymentIntent.status,
      nextAction: paymentIntent.next_action?.type,
      metadata: paymentIntent.metadata
    });

    // Find organization from payment intent metadata
    const orgId = paymentIntent.metadata?.org_id;
    if (!orgId) {
      return {
        success: false,
        message: 'No org_id in payment intent metadata for 3DS authentication'
      };
    }

    const organisation = await storage.getOrganisation(orgId);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for org_id: ${orgId}`
      };
    }

    // Update organization status to pending 3DS
    await storage.updateOrganisationBilling(organisation.id, {
      billingStatus: 'pending_3ds',
      lastBillingSync: new Date(),
    });

    console.log(`✅ 3DS authentication pending for org ${organisation.name} [${correlationId}]`);

    return {
      success: true,
      message: `3DS authentication required for organization ${organisation.name}`
    };
  }

  /**
   * Handle payment_intent.succeeded webhook (3DS authentication completed)
   */
  private async handlePaymentIntentSucceeded(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log(`✅ Payment intent succeeded [${correlationId}]:`, {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    });

    // Check if this payment is associated with a subscription setup
    if (paymentIntent.invoice) {
      console.log(`Payment for invoice ${paymentIntent.invoice}, subscription billing will handle this [${correlationId}]`);
      return {
        success: true,
        message: 'Payment succeeded - will be handled by invoice.paid webhook'
      };
    }

    // Handle standalone payment intent (like setup fees or one-time charges)
    const orgId = paymentIntent.metadata?.org_id;
    if (orgId) {
      const organisation = await storage.getOrganisation(orgId);
      if (organisation) {
        // Update billing status if currently pending 3DS
        if (organisation.billingStatus === 'pending_3ds') {
          await storage.updateOrganisationBilling(organisation.id, {
            billingStatus: 'active',
            lastBillingSync: new Date(),
          });
          
          console.log(`✅ Organization ${organisation.name} activated after 3DS completion [${correlationId}]`);
        }
      }
    }

    return {
      success: true,
      message: `Payment succeeded for amount ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`
    };
  }

  /**
   * Handle payment_intent.payment_failed webhook
   */
  private async handlePaymentIntentFailed(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log(`❌ Payment intent failed [${correlationId}]:`, {
      paymentIntentId: paymentIntent.id,
      customerId: paymentIntent.customer,
      lastPaymentError: paymentIntent.last_payment_error?.message,
      metadata: paymentIntent.metadata
    });

    const orgId = paymentIntent.metadata?.org_id;
    if (orgId) {
      const organisation = await storage.getOrganisation(orgId);
      if (organisation) {
        // Update billing status to reflect payment failure
        await storage.updateOrganisationBilling(organisation.id, {
          billingStatus: 'payment_failed',
          lastBillingSync: new Date(),
        });
        
        console.log(`❌ Organization ${organisation.name} marked as payment failed [${correlationId}]`);
      }
    }

    return {
      success: true,
      message: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
    };
  }

  /**
   * Handle setup_intent.succeeded webhook (payment method setup completed)
   */
  private async handleSetupIntentSucceeded(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const setupIntent = event.data.object as Stripe.SetupIntent;
    
    console.log(`🔧 Setup intent succeeded [${correlationId}]:`, {
      setupIntentId: setupIntent.id,
      customerId: setupIntent.customer,
      paymentMethodId: setupIntent.payment_method,
      metadata: setupIntent.metadata
    });

    // If this setup intent has subscription update metadata, process the subscription change
    const metadata = setupIntent.metadata || {};
    if (metadata.action === 'update_existing_subscription' && metadata.target_subscription_id) {
      try {
        // Now that payment method is set up, update the subscription
        const subscriptionId = metadata.target_subscription_id;
        const newPriceId = metadata.new_price_id;
        const newQuantity = metadata.new_quantity;

        if (newPriceId) {
          const updateParams: any = {
            items: [{
              id: (await this.stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
              price: newPriceId,
            }],
            proration_behavior: 'create_prorations',
          };

          if (newQuantity) {
            updateParams.items[0].quantity = parseInt(newQuantity);
          }

          await this.stripe.subscriptions.update(subscriptionId, updateParams);
          
          console.log(`✅ Subscription ${subscriptionId} updated after setup intent completion [${correlationId}]`);
        }
      } catch (error) {
        console.error(`Failed to update subscription after setup intent [${correlationId}]:`, error);
      }
    }

    return {
      success: true,
      message: 'Setup intent completed successfully'
    };
  }

  /**
   * Handle checkout.session.expired webhook
   */
  private async handleCheckoutSessionExpired(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const session = event.data.object as Stripe.Checkout.Session;
    
    console.log(`⏰ Checkout session expired [${correlationId}]:`, {
      sessionId: session.id,
      customerId: session.customer,
      metadata: session.metadata,
      created: new Date(session.created * 1000),
      expiresAt: new Date(session.expires_at * 1000)
    });

    const metadata = session.metadata || {};
    const orgId = metadata.org_id;

    if (orgId) {
      const organisation = await storage.getOrganisation(orgId);
      if (organisation && organisation.billingStatus === 'incomplete') {
        // Reset billing status if it was left in incomplete state
        await storage.updateOrganisationBilling(organisation.id, {
          billingStatus: 'setup_required',
          lastBillingSync: new Date(),
        });
        
        console.log(`🔄 Organization ${organisation.name} reset from incomplete to setup_required after session expiry [${correlationId}]`);
      }
    }

    return {
      success: true,
      message: `Checkout session ${session.id} expired - organization status updated if needed`
    };
  }

  /**
   * Handle customer.subscription.trial_will_end webhook
   */
  private async handleTrialWillEnd(event: Stripe.Event, correlationId: string): Promise<{ success: boolean; message: string }> {
    const subscription = event.data.object as Stripe.Subscription;
    
    console.log(`⚠️  Trial will end soon [${correlationId}]:`, {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      trialEnd: new Date((subscription as any).trial_end * 1000),
      status: subscription.status
    });

    // Find organization
    const organisation = await this.findOrganizationByCustomerId(subscription.customer as string);
    if (!organisation) {
      return {
        success: false,
        message: `Organization not found for customer ID: ${subscription.customer}`
      };
    }

    // Update organization to reflect trial ending soon
    await storage.updateOrganisationBilling(organisation.id, {
      billingStatus: 'trial_ending',
      lastBillingSync: new Date(),
    });

    console.log(`⚠️  Trial ending notification processed for org ${organisation.name} [${correlationId}]`);

    return {
      success: true,
      message: `Trial ending notification processed for organization ${organisation.name}`
    };
  }

  /**
   * Enhanced subscription data extraction with better error handling
   */
  private extractSubscriptionData(subscription: Stripe.Subscription) {
    try {
      const item = subscription.items.data[0];
      if (!item) {
        console.warn(`Subscription ${subscription.id} has no items`);
        return {
          subscriptionId: subscription.id,
          subscriptionItemId: null,
          priceId: null,
          quantity: 0,
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
        };
      }

      return {
        subscriptionId: subscription.id,
        subscriptionItemId: item.id || null,
        priceId: item.price?.id || null,
        quantity: item.quantity || 1,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
      };
    } catch (error) {
      console.error(`Error extracting subscription data for ${subscription.id}:`, error);
      throw new Error(`Failed to extract subscription data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate webhook event timestamp to prevent stale updates
   */
  private validateEventTimestamp(event: Stripe.Event, maxAgeMinutes: number = 60): boolean {
    const eventTime = new Date(event.created * 1000);
    const now = new Date();
    const ageMinutes = (now.getTime() - eventTime.getTime()) / (1000 * 60);
    
    if (ageMinutes > maxAgeMinutes) {
      console.warn(`⚠️  Webhook event ${event.id} is ${ageMinutes.toFixed(1)} minutes old (max: ${maxAgeMinutes})`);
      return false;
    }
    
    return true;
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

  /**
   * Validate webhook event ordering and detect stale events
   * Implements event ordering validation using event.created timestamps
   * Drops stale/out-of-order events to prevent data inconsistencies
   */
  private async validateEventOrdering(
    event: Stripe.Event,
    correlationId: string
  ): Promise<{
    shouldProcess: boolean;
    reason?: string;
    lastProcessedTimestamp?: number;
  }> {
    try {
      const eventTimestamp = event.created;
      const maxStaleAgeHours = 24; // Reject events older than 24 hours
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const eventAgeHours = (currentTimestamp - eventTimestamp) / 3600;

      // Check if event is too old (stale)
      if (eventAgeHours > maxStaleAgeHours) {
        return {
          shouldProcess: false,
          reason: `Event is too old (${eventAgeHours.toFixed(1)} hours old, max ${maxStaleAgeHours} hours)`
        };
      }

      // Extract resource ID for ordering validation
      const resourceId = this.extractResourceId(event);
      if (!resourceId) {
        // No resource ID means we can't validate ordering - process it
        console.log(`⚠️  No resource ID found for event ordering validation [${correlationId}], processing anyway`);
        return { shouldProcess: true };
      }

      // Get last processed timestamp for this resource
      const lastProcessedTimestamp = await storage.getLastWebhookTimestamp(event.type, resourceId);
      
      if (lastProcessedTimestamp) {
        // Check if this event is older than the last processed event (out of order)
        if (eventTimestamp <= lastProcessedTimestamp) {
          return {
            shouldProcess: false,
            reason: `Out-of-order event (timestamp: ${eventTimestamp}, last processed: ${lastProcessedTimestamp})`,
            lastProcessedTimestamp
          };
        }
        
        // Check for gaps in event sequence (potential missing events)
        const timeDifference = eventTimestamp - lastProcessedTimestamp;
        if (timeDifference > 3600) { // More than 1 hour gap
          console.warn(`⚠️  Large time gap detected between events [${correlationId}]:`, {
            resourceId,
            eventType: event.type,
            timeDifference: `${Math.floor(timeDifference / 60)} minutes`,
            lastTimestamp: lastProcessedTimestamp,
            currentTimestamp: eventTimestamp
          });
        }
      }

      // Event passes ordering validation
      return { shouldProcess: true, lastProcessedTimestamp };

    } catch (error) {
      console.error(`💥 Event ordering validation failed [${correlationId}]:`, error);
      // On validation error, allow processing to continue (fail-open)
      return { shouldProcess: true, reason: 'Validation error - processing anyway' };
    }
  }

  /**
   * Extract resource ID from webhook event for ordering validation
   * Returns subscription ID, customer ID, or other relevant resource identifier
   */
  private extractResourceId(event: Stripe.Event): string | null {
    const data = event.data.object as any;
    
    // Priority order: subscription > customer > payment_intent > setup_intent
    if (data.subscription) {
      return typeof data.subscription === 'string' ? data.subscription : data.subscription.id;
    }
    
    if (data.customer) {
      return typeof data.customer === 'string' ? data.customer : data.customer.id;
    }
    
    if (data.id && (data.object === 'subscription' || data.object === 'customer' || 
                   data.object === 'payment_intent' || data.object === 'setup_intent')) {
      return data.id;
    }
    
    // For checkout sessions, use the session ID
    if (event.type.startsWith('checkout.session.') && data.id) {
      return data.id;
    }
    
    return null;
  }

  /**
   * Update last processed timestamp for webhook event ordering
   * Called after successful event processing
   */
  private async updateLastProcessedTimestamp(
    event: Stripe.Event,
    correlationId: string
  ): Promise<void> {
    try {
      const resourceId = this.extractResourceId(event);
      if (resourceId) {
        await storage.updateLastWebhookTimestamp(event.type, resourceId, event.created);
        console.log(`📝 Updated last processed timestamp [${correlationId}]:`, {
          eventType: event.type,
          resourceId,
          timestamp: event.created
        });
      }
    } catch (error) {
      console.error(`💥 Failed to update last processed timestamp [${correlationId}]:`, error);
      // Don't fail the webhook for timestamp update issues
    }
  }
}

// Create singleton instance
export const stripeWebhookService = new StripeWebhookService();