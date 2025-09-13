import Stripe from 'stripe';
import type { Plan, Organisation } from '../../shared/schema.js';
import { nanoid } from 'nanoid';

/**
 * Enhanced proration calculation service with comprehensive billing period handling
 * Implements accurate mid-cycle billing calculations and seat change proration logic
 */
export class EnhancedProrationService {
  private stripe: Stripe;

  constructor(stripe: Stripe) {
    this.stripe = stripe;
  }

  /**
   * Calculate enhanced proration with Stripe previewInvoice integration
   * Provides accurate proration amounts for plan changes and seat adjustments
   */
  async calculateEnhancedProration(
    organisation: Organisation,
    currentPlan: Plan,
    newPlan: Plan,
    newSeatCount: number,
    options: {
      effectiveDate?: Date;
      billingBehavior?: 'create_prorations' | 'none' | 'always_invoice';
      prorationDate?: number;
    } = {}
  ): Promise<{
    immediate_total: number;
    subtotal: number;
    tax: number;
    proration_details: Array<{
      type: 'credit' | 'debit' | 'seat_adjustment' | 'plan_change';
      description: string;
      amount: number;
      quantity_change?: number;
      period_start: number;
      period_end: number;
      unit_amount: number;
    }>;
    next_invoice_preview: {
      amount_due: number;
      period_start: number;
      period_end: number;
      line_items: Array<{
        description: string;
        amount: number;
        quantity: number;
      }>;
    };
    warnings: string[];
    recommendations: string[];
  }> {
    const correlationId = `proration-${organisation.id}-${Date.now()}-${nanoid(8)}`;
    const currentSeatCount = organisation.activeUserCount || 1;
    const effectiveDate = options.effectiveDate || new Date();
    const prorationDate = options.prorationDate || Math.floor(effectiveDate.getTime() / 1000);

    console.log(`📊 Calculating enhanced proration [${correlationId}]:`, {
      orgId: organisation.id,
      currentPlan: currentPlan.name,
      newPlan: newPlan.name,
      currentSeats: currentSeatCount,
      newSeats: newSeatCount,
      effectiveDate,
      prorationDate
    });

    try {
      if (!organisation.stripeSubscriptionId) {
        throw new Error('Organization has no active Stripe subscription');
      }

      // Get current subscription details
      const subscription = await this.stripe.subscriptions.retrieve(organisation.stripeSubscriptionId, {
        expand: ['items.data.price.product', 'latest_invoice']
      });

      if (!subscription) {
        throw new Error(`Subscription ${organisation.stripeSubscriptionId} not found`);
      }

      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Check for billing model changes
      if (currentPlan.billingModel !== newPlan.billingModel) {
        warnings.push('Changing billing models - proration calculations may not be exact');
        recommendations.push('Consider scheduling change at next billing cycle for cleaner transition');
      }

      // Get proration preview using Stripe's upcoming invoice
      const invoicePreview = await this.stripe.invoices.retrieveUpcoming({
        customer: organisation.stripeCustomerId!,
        subscription: organisation.stripeSubscriptionId,
        subscription_items: [
          {
            id: organisation.stripeSubscriptionItemId!,
            price: newPlan.stripePriceId!,
            quantity: newPlan.billingModel === 'flat_subscription' ? 1 : newSeatCount,
          }
        ],
        subscription_proration_behavior: options.billingBehavior || 'create_prorations',
        subscription_proration_date: options.billingBehavior !== 'none' ? prorationDate : undefined,
      });

      // Calculate detailed proration breakdown
      const prorationDetails: Array<{
        type: 'credit' | 'debit' | 'seat_adjustment' | 'plan_change';
        description: string;
        amount: number;
        quantity_change?: number;
        period_start: number;
        period_end: number;
        unit_amount: number;
      }> = [];

      let immediateTotal = 0;
      let subtotal = 0;
      let tax = 0;

      // Process invoice line items to extract proration details
      for (const lineItem of invoicePreview.lines.data) {
        const amount = lineItem.amount || 0;
        const description = lineItem.description || 'Unknown charge';
        
        immediateTotal += amount;
        
        if (lineItem.proration) {
          // This is a proration line item
          const isCredit = amount < 0;
          const type = isCredit ? 'credit' : 'debit';
          
          prorationDetails.push({
            type,
            description,
            amount,
            period_start: lineItem.period?.start || prorationDate,
            period_end: lineItem.period?.end || subscription.current_period_end,
            unit_amount: lineItem.price?.unit_amount || 0,
            quantity_change: lineItem.quantity ? lineItem.quantity - currentSeatCount : undefined
          });
        } else if (lineItem.type === 'subscription') {
          // Regular subscription charge
          subtotal += amount;
        } else if (lineItem.type === 'tax') {
          // Tax line item
          tax += amount;
        }
      }

      // Handle seat-only changes (same plan, different quantity)
      if (currentPlan.id === newPlan.id && currentSeatCount !== newSeatCount) {
        const seatDifference = newSeatCount - currentSeatCount;
        const dailyRate = this.calculateDailyRate(currentPlan, subscription);
        const remainingDays = this.calculateRemainingDays(subscription);
        const seatAdjustmentAmount = Math.round(seatDifference * dailyRate * remainingDays);

        if (seatAdjustmentAmount !== 0) {
          prorationDetails.push({
            type: 'seat_adjustment',
            description: `Seat ${seatDifference > 0 ? 'increase' : 'decrease'} (${Math.abs(seatDifference)} seats) for remaining ${remainingDays} days`,
            amount: seatAdjustmentAmount,
            quantity_change: seatDifference,
            period_start: prorationDate,
            period_end: subscription.current_period_end,
            unit_amount: currentPlan.unitAmount
          });
        }
      }

      // Generate next invoice preview
      const nextInvoicePreview = await this.stripe.invoices.retrieveUpcoming({
        customer: organisation.stripeCustomerId!,
        subscription: organisation.stripeSubscriptionId,
        subscription_items: [
          {
            id: organisation.stripeSubscriptionItemId!,
            price: newPlan.stripePriceId!,
            quantity: newPlan.billingModel === 'flat_subscription' ? 1 : newSeatCount,
          }
        ],
        subscription_proration_behavior: 'none', // No proration for next period
      });

      const nextInvoiceLineItems = nextInvoicePreview.lines.data.map(lineItem => ({
        description: lineItem.description || 'Subscription charge',
        amount: lineItem.amount || 0,
        quantity: lineItem.quantity || 1
      }));

      // Add recommendations based on proration amount
      if (immediateTotal > 0) {
        const percentOfNewPlan = (immediateTotal / newPlan.unitAmount) * 100;
        if (percentOfNewPlan > 50) {
          recommendations.push('Large proration charge - consider timing change closer to billing cycle');
        }
      } else if (immediateTotal < 0) {
        recommendations.push('You will receive a credit for the unused portion of your current plan');
      }

      // Add warnings for complex changes
      if (prorationDetails.length > 2) {
        warnings.push('Complex billing change with multiple proration components');
      }

      const result = {
        immediate_total: immediateTotal,
        subtotal,
        tax,
        proration_details: prorationDetails,
        next_invoice_preview: {
          amount_due: nextInvoicePreview.amount_due || 0,
          period_start: nextInvoicePreview.period_start || subscription.current_period_end,
          period_end: nextInvoicePreview.period_end || (subscription.current_period_end + (subscription.current_period_end - subscription.current_period_start)),
          line_items: nextInvoiceLineItems
        },
        warnings,
        recommendations
      };

      console.log(`✅ Enhanced proration calculated [${correlationId}]:`, {
        immediateTotal,
        prorationItems: prorationDetails.length,
        warnings: warnings.length,
        recommendations: recommendations.length
      });

      return result;

    } catch (error) {
      console.error(`💥 Enhanced proration calculation failed [${correlationId}]:`, error);
      throw new Error(`Failed to calculate enhanced proration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate daily rate for proration calculations
   */
  private calculateDailyRate(plan: Plan, subscription: Stripe.Subscription): number {
    const periodLength = subscription.current_period_end - subscription.current_period_start;
    const periodDays = periodLength / (24 * 60 * 60); // Convert seconds to days
    return plan.unitAmount / periodDays;
  }

  /**
   * Calculate remaining days in current billing period
   */
  private calculateRemainingDays(subscription: Stripe.Subscription): number {
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = subscription.current_period_end - now;
    return Math.max(0, Math.ceil(remainingSeconds / (24 * 60 * 60)));
  }

  /**
   * Validate proration calculation accuracy against Stripe preview
   */
  async validateProrationAccuracy(
    organisation: Organisation,
    calculatedProration: number,
    stripePreviewTotal: number,
    tolerancePercent: number = 1
  ): Promise<{
    accurate: boolean;
    difference: number;
    difference_percent: number;
    within_tolerance: boolean;
    explanation?: string;
  }> {
    const difference = Math.abs(calculatedProration - stripePreviewTotal);
    const differencePercent = stripePreviewTotal !== 0 ? (difference / Math.abs(stripePreviewTotal)) * 100 : 0;
    const withinTolerance = differencePercent <= tolerancePercent;

    let explanation: string | undefined;
    if (!withinTolerance) {
      if (differencePercent > 10) {
        explanation = 'Significant discrepancy - may indicate billing model change or complex proration scenario';
      } else if (differencePercent > 5) {
        explanation = 'Moderate discrepancy - likely due to tax calculations or rounding differences';
      } else {
        explanation = 'Minor discrepancy - typically due to rounding differences in daily rate calculations';
      }
    }

    return {
      accurate: withinTolerance,
      difference,
      difference_percent: differencePercent,
      within_tolerance: withinTolerance,
      explanation
    };
  }

  /**
   * Generate proration summary for customer-facing display
   */
  generateProrationSummary(prorationResult: any): {
    summary: string;
    breakdown: Array<{
      label: string;
      amount: string;
      type: 'credit' | 'charge' | 'info';
    }>;
    total_change: string;
  } {
    const { immediate_total, proration_details } = prorationResult;
    
    const breakdown: Array<{
      label: string;
      amount: string;
      type: 'credit' | 'charge' | 'info';
    }> = [];

    // Group proration details by type
    const credits = proration_details.filter((detail: any) => detail.amount < 0);
    const charges = proration_details.filter((detail: any) => detail.amount > 0);

    // Add credits
    for (const credit of credits) {
      breakdown.push({
        label: credit.description,
        amount: `$${Math.abs(credit.amount / 100).toFixed(2)}`,
        type: 'credit'
      });
    }

    // Add charges
    for (const charge of charges) {
      breakdown.push({
        label: charge.description,
        amount: `$${(charge.amount / 100).toFixed(2)}`,
        type: 'charge'
      });
    }

    // Generate summary text
    let summary: string;
    if (immediate_total === 0) {
      summary = 'No immediate charges or credits. Changes will take effect at your next billing cycle.';
    } else if (immediate_total > 0) {
      summary = `You will be charged $${(immediate_total / 100).toFixed(2)} today for the plan change.`;
    } else {
      summary = `You will receive a credit of $${Math.abs(immediate_total / 100).toFixed(2)} for unused time on your current plan.`;
    }

    return {
      summary,
      breakdown,
      total_change: immediate_total >= 0 ? `+$${(immediate_total / 100).toFixed(2)}` : `-$${Math.abs(immediate_total / 100).toFixed(2)}`
    };
  }
}

// Export factory function to create service with Stripe instance
export function createEnhancedProrationService(stripe: Stripe): EnhancedProrationService {
  return new EnhancedProrationService(stripe);
}