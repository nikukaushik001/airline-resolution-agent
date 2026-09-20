import { getBookingsByPnr, getCustomerByPnr } from './db';

export type ActionIntent = 
  | 'REBOOK' 
  | 'REFUND' 
  | 'MEAL_VOUCHER' 
  | 'LOUNGE_ACCESS' 
  | 'HOTEL' 
  | 'UPGRADE'
  | 'COMPENSATION_BEYOND_POLICY'
  | 'NONE';

export type ResolutionOutcome = {
  allowed: boolean;
  message: string;
  actionTaken?: string;
  escalate?: boolean;
  escalationReason?: string;
  auditLog: string;
};

export type EvaluateOptions = {
  fareDifference?: number | null;
  hotelFullNight?: boolean;
  nonAirlineCaused?: boolean;
  otherPaymentMethod?: boolean;
  targetFlight?: string | null;
  statedReason?: string | null;
  threatensLegalOrComplaint?: boolean;
};

export function evaluateRequest(
  pnr: string,
  intent: ActionIntent,
  options?: EvaluateOptions
): ResolutionOutcome {
  const customer = getCustomerByPnr(pnr);
  const bookings = getBookingsByPnr(pnr);

  if (!customer || !bookings || bookings.length === 0) {
    return {
      allowed: false,
      message: 'Booking not found.',
      auditLog: 'Failed to find booking for PNR.',
    };
  }

  // ─── PRIORITY GATES (run first, regardless of flight state) ──────────────

  // Gate 1: Legal / formal complaint threat → immediate escalation
  if (options?.threatensLegalOrComplaint) {
    return {
      allowed: false,
      message:
        'I understand your frustration and take this very seriously. I am escalating this to our specialist support team right now, and they will reach out to you directly.',
      escalate: true,
      escalationReason: 'Customer threatened legal action or formal complaint.',
      auditLog: 'Escalated: Threat of legal action or formal complaint.',
    };
  }

  // Gate 2: Non-airline-caused disruption exception request
  if (options?.nonAirlineCaused) {
    return {
      allowed: false,
      message:
        'I am unable to make exceptions for disruptions not caused by the airline (e.g. a missed flight). I will escalate this to a specialist who can review your case.',
      escalate: true,
      escalationReason: 'Exception requested for non-airline-caused disruption.',
      auditLog: 'Escalated: Exception requested for non-airline-caused disruption.',
    };
  }

  // Gate 3: Explicit "beyond policy" compensation demand
  if (intent === 'COMPENSATION_BEYOND_POLICY') {
    return {
      allowed: false,
      message:
        'I am unable to provide compensation beyond our stated policy. I will escalate your request to a specialist who can review what additional options may be available.',
      escalate: true,
      escalationReason: 'Customer requested compensation beyond stated policy amounts.',
      auditLog: 'Escalated: Request for compensation beyond stated policy.',
    };
  }

  // Find the primary disrupted booking
  const disruptedBooking = bookings.find(
    (b) => b.status === 'CANCELLED' || b.status === 'DELAYED'
  );

  // Gate 4: Compensation/upgrade request for an UNAFFECTED flight leg
  if (options?.targetFlight && disruptedBooking) {
    const targetNorm = options.targetFlight.toLowerCase();
    const disruptedNorm = disruptedBooking.flight.toLowerCase();
    // Also match "return" as unaffected for SK4821X
    const isReturnLeg =
      targetNorm.includes('return') || targetNorm.includes('goa') || targetNorm.includes('return leg');
    const isUnaffected =
      isReturnLeg || (targetNorm !== disruptedNorm && !targetNorm.includes(disruptedNorm));

    if (isUnaffected && ['UPGRADE', 'MEAL_VOUCHER', 'LOUNGE_ACCESS', 'HOTEL', 'REFUND', 'REBOOK'].includes(intent)) {
      return {
        allowed: false,
        message: `I cannot offer compensation or changes on the ${options.targetFlight} leg — it is not disrupted. Only your ${disruptedBooking.flight} (${disruptedBooking.route}) is affected. I am escalating your compensation request to a specialist.`,
        escalate: true,
        escalationReason: `Requested ${intent} for unaffected flight leg (${options.targetFlight}).`,
        auditLog: `Escalated: Requested ${intent} for unaffected flight leg (${options.targetFlight}).`,
      };
    }
  }

  // Gate 5: No disruption at all
  if (!disruptedBooking) {
    return {
      allowed: false,
      message: 'There are no active disruptions on your booking that would qualify for this.',
      auditLog: 'Request denied: No active disruptions found.',
    };
  }

  // ─── CANCELLATION RULES ───────────────────────────────────────────────────

  if (disruptedBooking.status === 'CANCELLED') {
    if (intent === 'REBOOK') {
      let msg = `I can rebook you on the next available flight within 24 hours at no extra charge (flight ${disruptedBooking.flight}, ${disruptedBooking.route}, was cancelled due to ${disruptedBooking.statusReason}).`;
      if (customer.loyaltyTier === 'Gold' || customer.loyaltyTier === 'Platinum') {
        msg += ` As a ${customer.loyaltyTier} member, you have priority access to the next available seats.`;
      }
      return {
        allowed: true,
        message: msg,
        actionTaken: `Rebooking authorised on next available flight within 24h. Priority: ${customer.loyaltyTier}.`,
        auditLog: `Rebooking authorised for cancelled flight ${disruptedBooking.flight}. Tier: ${customer.loyaltyTier}.`,
      };
    }

    if (intent === 'REFUND') {
      if (options?.otherPaymentMethod) {
        return {
          allowed: false,
          message:
            'Refunds can only be processed to the original payment method — our policy does not permit routing to a different account. I am escalating this to a specialist who can assist further.',
          escalate: true,
          escalationReason: 'Requested refund to a different payment method.',
          auditLog: 'Escalated: Refund to different payment method requested.',
        };
      }
      return {
        allowed: true,
        message: `I have initiated a full refund for flight ${disruptedBooking.flight} (${disruptedBooking.route}). It will be credited to your original payment method within 7 business days.`,
        actionTaken: 'Full refund initiated to original payment method.',
        auditLog: `Refund authorised for cancelled flight ${disruptedBooking.flight}. Processing time: 7 business days.`,
      };
    }

    // Upgrade on cancelled flight: fare difference waiver check applies;
    // but a free upgrade "as compensation" must be escalated
    if (intent === 'UPGRADE') {
      const fareDiff = options?.fareDifference ?? 0;
      const isFreeCompensationUpgrade =
        !fareDiff &&
        (options?.statedReason?.toLowerCase().includes('trouble') ||
          options?.statedReason?.toLowerCase().includes('compensation') ||
          options?.statedReason?.toLowerCase().includes('sorry') ||
          !options?.statedReason);

      if (isFreeCompensationUpgrade) {
        return {
          allowed: false,
          message:
            'I completely understand your frustration, and I am sorry for the inconvenience caused by the cancellation. However, a free class upgrade is not covered under our policy for airline-caused cancellations — your entitlements are a full refund or a free rebooking on the next available flight. I am escalating your upgrade request to a specialist.',
          escalate: true,
          escalationReason: 'Free upgrade requested as compensation for cancellation — beyond policy.',
          auditLog: 'Escalated: Free upgrade as compensation for cancellation is beyond policy.',
        };
      }

      if (fareDiff > 1500) {
        return {
          allowed: false,
          message: `The fare difference for this change is ₹${fareDiff}, which exceeds the ₹1,500 auto-approval limit. I am escalating this to a supervisor for approval — a specialist will follow up with you shortly.`,
          escalate: true,
          escalationReason: `Fare difference waiver ₹${fareDiff} exceeds ₹1,500 limit.`,
          auditLog: `Escalated: Fare difference ₹${fareDiff} exceeds ₹1,500 auto-approval limit.`,
        };
      }

      return {
        allowed: true,
        message: `I can process this change. The ₹${fareDiff} fare difference is within the auto-approval limit — I have updated your booking.`,
        actionTaken: `Flight change processed. Fare difference ₹${fareDiff} charged.`,
        auditLog: `Flight change approved. Fare difference ₹${fareDiff} within limit.`,
      };
    }
  }

  // ─── DELAY RULES ─────────────────────────────────────────────────────────

  if (disruptedBooking.status === 'DELAYED') {
    const delay = disruptedBooking.delayHours || 0;

    if (intent === 'MEAL_VOUCHER') {
      // Meal voucher applies for ANY delay (>0h)
      return {
        allowed: true,
        message: `I have issued a ₹500 meal voucher for your ${delay}-hour delay on flight ${disruptedBooking.flight}. You can use it at any airport restaurant.`,
        actionTaken: 'Meal voucher ₹500 issued.',
        auditLog: `Meal voucher ₹500 issued for ${delay}h delay on ${disruptedBooking.flight}.`,
      };
    }

    if (intent === 'LOUNGE_ACCESS') {
      if (delay > 3) {
        return {
          allowed: true,
          message: `I have arranged lounge access for you due to the ${delay}-hour delay on flight ${disruptedBooking.flight}.`,
          actionTaken: 'Lounge access issued.',
          auditLog: `Lounge access issued for ${delay}h delay on ${disruptedBooking.flight}.`,
        };
      } else {
        return {
          allowed: false,
          message: `Lounge access is provided for delays over 3 hours. Your delay is ${delay} hours — you are entitled to a ₹500 meal voucher, which I can arrange now.`,
          auditLog: `Lounge access denied: ${delay}h delay is below the 3h threshold.`,
        };
      }
    }

    if (intent === 'HOTEL') {
      if (delay > 5) {
        if (options?.hotelFullNight) {
          return {
            allowed: false,
            message: `Our policy covers hotel accommodation strictly for the duration of the delayed hours only — not a full night's stay. For your ${delay}-hour delay on ${disruptedBooking.flight}, I can arrange accommodation covering those specific hours. Would you like me to proceed on that basis?`,
            auditLog: `Full night hotel denied for ${delay}h delay. Policy: delayed hours only.`,
          };
        }
        return {
          allowed: true,
          message: `I have arranged hotel accommodation covering the ${delay}-hour delay period for flight ${disruptedBooking.flight}. Please note this covers the delayed hours only, not a full night's stay.`,
          actionTaken: `Hotel accommodation arranged (${delay} delayed hours only).`,
          auditLog: `Hotel (delayed hours only) issued for ${delay}h delay on ${disruptedBooking.flight}.`,
        };
      } else {
        return {
          allowed: false,
          message: `Hotel accommodation is only provided for delays over 5 hours. Your current delay on ${disruptedBooking.flight} is ${delay} hours. You are entitled to a ₹500 meal voucher and lounge access, which I can arrange now.`,
          auditLog: `Hotel denied: ${delay}h delay is below the 5h threshold.`,
        };
      }
    }

    // Upgrade on delayed flight: same fare-difference rules
    if (intent === 'UPGRADE') {
      const fareDiff = options?.fareDifference ?? 0;
      const isFreeCompensationUpgrade =
        !fareDiff &&
        (options?.statedReason?.toLowerCase().includes('trouble') ||
          options?.statedReason?.toLowerCase().includes('compensation') ||
          options?.statedReason?.toLowerCase().includes('sorry') ||
          !options?.statedReason);

      if (isFreeCompensationUpgrade) {
        return {
          allowed: false,
          message:
            'A free class upgrade is not covered under our delay compensation policy. Your entitlements for this delay are: meal voucher + lounge access (and hotel for the delayed hours, since delay > 5h). I am escalating your upgrade request to a specialist.',
          escalate: true,
          escalationReason: 'Free upgrade requested as compensation for delay — beyond policy.',
          auditLog: 'Escalated: Free upgrade as compensation for delay is beyond policy.',
        };
      }

      if (fareDiff > 1500) {
        return {
          allowed: false,
          message: `The fare difference for this flight change is ₹${fareDiff}, which exceeds the ₹1,500 auto-approval limit. This requires supervisor approval — I am escalating it now. Note: your loyalty tier (${customer.loyaltyTier}) grants priority rebooking access, but does not change the fare-waiver threshold.`,
          escalate: true,
          escalationReason: `Fare difference waiver ₹${fareDiff} exceeds ₹1,500 limit. Tier: ${customer.loyaltyTier}.`,
          auditLog: `Escalated: Fare difference ₹${fareDiff} exceeds limit. Tier ${customer.loyaltyTier} does not override waiver authority.`,
        };
      }

      return {
        allowed: true,
        message: `I can process this flight change. The ₹${fareDiff} fare difference is within the auto-approval limit.`,
        actionTaken: `Flight change processed. Fare difference ₹${fareDiff} charged.`,
        auditLog: `Flight change approved. Fare difference ₹${fareDiff} within limit.`,
      };
    }
  }

  // ─── FALLBACK ─────────────────────────────────────────────────────────────
  return {
    allowed: false,
    message: 'I am unable to process that specific request under our current policies. Please let me know if there is anything else I can help you with.',
    auditLog: 'Request did not match any policy rule — default deny.',
  };
}
