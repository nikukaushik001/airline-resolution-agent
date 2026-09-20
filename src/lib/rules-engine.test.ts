import { evaluateRequest } from './rules-engine';

describe('Rules Engine — PDF Compliance Tests', () => {

  // ─── SCENARIO 1: Priya Nair (Gold, SK4821X, Flight CANCELLED) ────────────

  describe('Scenario 1 — Priya Nair (SK4821X, Cancellation)', () => {
    const pnr = 'SK4821X';

    it('allows rebooking on next available flight (Gold → priority message)', () => {
      const r = evaluateRequest(pnr, 'REBOOK');
      expect(r.allowed).toBe(true);
      expect(r.message).toContain('Gold');
      expect(r.message).toContain('24 hours');
    });

    it('allows full refund to original payment method', () => {
      const r = evaluateRequest(pnr, 'REFUND');
      expect(r.allowed).toBe(true);
      expect(r.message).toContain('7 business days');
      expect(r.escalate).toBeFalsy();
    });

    it('escalates refund to different payment method', () => {
      const r = evaluateRequest(pnr, 'REFUND', { otherPaymentMethod: true });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      expect(r.escalationReason).toContain('different payment method');
    });

    it('escalates free upgrade demanded "for the trouble" (no fare diff stated)', () => {
      const r = evaluateRequest(pnr, 'UPGRADE', { statedReason: 'for the trouble' });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      expect(r.auditLog).toContain('beyond policy');
    });

    it('escalates upgrade on return (unaffected) leg', () => {
      const r = evaluateRequest(pnr, 'UPGRADE', { targetFlight: 'return leg' });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      expect(r.escalationReason).toContain('unaffected flight leg');
    });

    it('escalates legal/complaint threats immediately', () => {
      const r = evaluateRequest(pnr, 'NONE', { threatensLegalOrComplaint: true });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      expect(r.escalationReason).toContain('legal');
    });

    it('escalates beyond-policy compensation demand', () => {
      const r = evaluateRequest(pnr, 'COMPENSATION_BEYOND_POLICY');
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
    });
  });

  // ─── SCENARIO 2: Arvind Kulkarni (Silver, TR1190B, 4h DELAY) ─────────────

  describe('Scenario 2 — Arvind Kulkarni (TR1190B, 4h Delay)', () => {
    const pnr = 'TR1190B';

    it('allows meal voucher for any delay', () => {
      const r = evaluateRequest(pnr, 'MEAL_VOUCHER');
      expect(r.allowed).toBe(true);
      expect(r.message).toContain('₹500');
    });

    it('allows lounge access for >3h delay', () => {
      const r = evaluateRequest(pnr, 'LOUNGE_ACCESS');
      expect(r.allowed).toBe(true);
    });

    it('denies hotel for 4h delay (threshold >5h)', () => {
      const r = evaluateRequest(pnr, 'HOTEL');
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBeFalsy();
      expect(r.message).toContain('5 hours');
    });

    it('does not grant hotel even when customer insists', () => {
      const r = evaluateRequest(pnr, 'HOTEL', { statedReason: 'it is a very long delay' });
      expect(r.allowed).toBe(false);
    });
  });

  // ─── SCENARIO 3: Meher Kaur (Platinum, WL7742, 6h DELAY) ────────────────

  describe('Scenario 3 — Meher Kaur (WL7742, 6h Delay)', () => {
    const pnr = 'WL7742';

    it('allows hotel accommodation for >5h delay (delayed hours only)', () => {
      const r = evaluateRequest(pnr, 'HOTEL');
      expect(r.allowed).toBe(true);
      expect(r.message).toContain('delayed hours only');
    });

    it('denies full night hotel stay, offers delayed hours only', () => {
      const r = evaluateRequest(pnr, 'HOTEL', { hotelFullNight: true });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBeFalsy();
      expect(r.message).toContain('delayed hours only');
    });

    it('escalates ₹2000 fare difference waiver (exceeds ₹1500 limit)', () => {
      const r = evaluateRequest(pnr, 'UPGRADE', { fareDifference: 2000 });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      expect(r.escalationReason).toContain('₹1,500');
    });

    it('escalates ₹2000 waiver even for Platinum — tier does not override authority', () => {
      const r = evaluateRequest(pnr, 'UPGRADE', { fareDifference: 2000, statedReason: 'I am Platinum' });
      expect(r.allowed).toBe(false);
      expect(r.escalate).toBe(true);
      // Audit log should mention tier does not override
      expect(r.auditLog).toContain('Tier');
    });

    it('allows upgrade with fare difference ≤₹1500 (within limit)', () => {
      const r = evaluateRequest(pnr, 'UPGRADE', { fareDifference: 1000 });
      expect(r.allowed).toBe(true);
    });

    it('allows lounge access for >3h delay', () => {
      const r = evaluateRequest(pnr, 'LOUNGE_ACCESS');
      expect(r.allowed).toBe(true);
    });

    it('allows meal voucher', () => {
      const r = evaluateRequest(pnr, 'MEAL_VOUCHER');
      expect(r.allowed).toBe(true);
    });
  });
});
