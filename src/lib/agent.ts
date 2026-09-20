import Groq from 'groq-sdk';
import { evaluateRequest, ActionIntent } from './rules-engine';
import { getCustomerByPnr, getBookingsByPnr } from './db';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export type AgentResponse = {
  text: string;
  auditLogs: { log: string; timestamp: string; isEscalation?: boolean }[];
};

export async function handleCustomerMessage(
  pnr: string,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<AgentResponse> {
  const auditLogs: AgentResponse['auditLogs'] = [];
  const logEvent = (log: string, isEscalation = false) => {
    auditLogs.push({ log, timestamp: new Date().toISOString(), isEscalation });
  };

  logEvent(`Received message for PNR ${pnr}: "${message.substring(0, 50)}..."`);

  // Load real booking data — always injected into LLM context so it NEVER hallucinates
  const customer = getCustomerByPnr(pnr);
  const bookings = getBookingsByPnr(pnr);
  const bookingSummary = bookings?.map(b =>
    `Flight ${b.flight} | Route: ${b.route} | Date: ${b.date} | Scheduled: ${b.scheduledDeparture} | STATUS: ${b.status}` +
    (b.status === 'DELAYED' ? ` (${b.delayHours}h delay, new departure: ${b.newDeparture})` : '') +
    (b.status === 'CANCELLED' ? ` (Reason: ${b.statusReason})` : '')
  ).join('\n') || 'No bookings found.';

  const customerSummary = customer
    ? `Customer: ${customer.name} | Loyalty: ${customer.loyaltyTier} | PNR: ${customer.pnr}`
    : `Unknown customer for PNR: ${pnr}`;

  // Step 1: LLM extracts intent and entities ONLY — no decisions
  const intentPrompt = `
You are an intent extraction assistant for an airline disruption resolution system.
Analyze the user's message and extract their intent into strict JSON format.
Do NOT make any decisions — only classify what the user is asking for.

Allowed intents:
- "REBOOK": User wants to rebook on a different flight or next available.
- "REFUND": User wants a refund.
- "HOTEL": User is asking for hotel accommodation.
- "MEAL_VOUCHER": User is asking for a meal voucher or food.
- "LOUNGE_ACCESS": User is asking for lounge access.
- "UPGRADE": User is asking to be put on a higher-fare flight or business/first class.
- "COMPENSATION_BEYOND_POLICY": User is demanding extra cash, points, or compensation "for the trouble" outside of delay/cancellation rules.
- "NONE": General conversation or status inquiry.

Extract these flags:
- "hotelFullNight": true if user asks for a full night hotel stay.
- "fareDifference": integer if user mentions a specific fare difference amount.
- "nonAirlineCaused": true if disruption is clearly the user's own fault.
- "otherPaymentMethod": true if user wants refund to a different payment method than original.
- "targetFlight": flight number or leg the user mentions (e.g. "return leg", "SK-204"). null if not mentioned.
- "statedReason": why the user says they want it (e.g. "for the trouble"). null if not stated.
- "threatensLegalOrComplaint": true if user explicitly mentions legal action or formal complaint.

Output ONLY valid JSON:
{
  "intent": "REBOOK" | "REFUND" | "HOTEL" | "MEAL_VOUCHER" | "LOUNGE_ACCESS" | "UPGRADE" | "COMPENSATION_BEYOND_POLICY" | "NONE",
  "options": {
    "hotelFullNight": boolean,
    "fareDifference": number | null,
    "nonAirlineCaused": boolean,
    "otherPaymentMethod": boolean,
    "targetFlight": string | null,
    "statedReason": string | null,
    "threatensLegalOrComplaint": boolean
  }
}

User Message: "${message}"
`;

  /**
   * Calls Groq with retry and exponential backoff.
   * Specifically handles 429 (rate limit) with longer waits.
   * Other errors get standard backoff. Throws on final failure.
   */
  const callGroqWithRetry = async (
    params: Parameters<typeof groq.chat.completions.create>[0],
    retries = 3
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await groq.chat.completions.create(params);
      } catch (err: unknown) {
        const isLast = i === retries - 1;
        if (isLast) throw err;

        // 429 rate limit: use longer backoff (2s, 4s, 8s)
        // Other errors: standard backoff (1s, 2s, 4s)
        const isRateLimit = typeof err === 'object' && err !== null &&
          ('status' in err ? (err as { status: number }).status === 429 : false);
        const baseMs = isRateLimit ? 2000 : 1000;
        const waitMs = baseMs * Math.pow(2, i);

        console.warn(`Groq API attempt ${i + 1} failed${isRateLimit ? ' (rate limited)' : ''}. Retrying in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  };

  let parsedIntent: { intent: ActionIntent | 'NONE'; options: Record<string, unknown> };
  try {
    const extraction = await callGroqWithRetry({
      messages: [{ role: 'system', content: intentPrompt }],
      model: 'openai/gpt-oss-120b',
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = extraction?.choices[0]?.message?.content || '{}';
    parsedIntent = JSON.parse(content);
    logEvent(`LLM identified intent: ${parsedIntent.intent}`);
  } catch (err) {
    console.error('Intent extraction failed after retries:', err);
    parsedIntent = { intent: 'NONE', options: {} };
    logEvent('Failed to parse intent, defaulting to NONE.');
  }

  // Step 2: Deterministic Rules Engine — ONLY source of policy decisions
  let rulesOutcome;
  if (parsedIntent.intent !== 'NONE' || parsedIntent.options?.threatensLegalOrComplaint) {
    rulesOutcome = evaluateRequest(
      pnr,
      parsedIntent.intent as ActionIntent,
      parsedIntent.options as Parameters<typeof evaluateRequest>[2]
    );
    logEvent(rulesOutcome.auditLog, rulesOutcome.escalate);
  } else {
    // General inquiry — instruct LLM to use real data only
    rulesOutcome = {
      allowed: true,
      message: 'Answer using ONLY the real booking data provided. Do not invent any details.',
      auditLog: 'General inquiry — returning booking data.',
    };
    logEvent('General inquiry processed.');
  }

  // Detect customer sentiment to guide tone
  const frustrationWords = ['furious', 'angry', 'upset', 'frustrated', 'terrible', 'unacceptable', 'disgusted', 'outraged', 'horrible', 'worst', 'ridiculous', 'complaint', 'lawyer', 'sue'];
  const customerIsFrustrated = frustrationWords.some(w => message.toLowerCase().includes(w));

  // Step 3: LLM drafts natural-language response — grounded in real data + rules engine outcome
  const responsePrompt = `
You are a customer support agent for an airline helping the customer with their booking.

=== AUTHORITATIVE BOOKING DATA (never contradict this) ===
${customerSummary}
${bookingSummary}
Today's date: Wed 23 Sep 2026.

=== RULES ENGINE DECISION (follow this exactly — you have NO authority to override it) ===
Outcome: ${rulesOutcome.allowed ? 'APPROVED' : 'DENIED'}
Directive: "${rulesOutcome.message}"
Escalate to Human Agent: ${rulesOutcome.escalate ? 'YES' : 'NO'}

=== TONE RULES (read carefully) ===
Customer sentiment: ${customerIsFrustrated ? 'FRUSTRATED — customer has expressed anger or frustration. Open with ONE brief, genuine empathy statement that fits this specific message, then move to the resolution.' : 'NEUTRAL — customer is calm or asking a factual question. Do NOT use stock empathy openers like "I understand this is frustrating" — just answer directly and professionally.'}
Do NOT repeat the same opening phrase across multiple messages. Vary your language naturally — think of how a real agent speaks.
Never start consecutive responses with the same sentence.

=== RESPONSE RULES ===
- Ground ALL facts (flight status, times, routes) in the booking data above. NEVER invent or assume.
- Follow the Rules Engine Decision exactly. Cannot approve what was denied, cannot deny what was approved.
- If Escalate = YES: clearly state you are routing to a human specialist right now.
- If DENIED: be warm but firm, explain why (cite policy), offer what IS available.
- Be specific: cite flight numbers, delay hours, exact entitlements. No vague filler.
- IMPORTANT: Keep your response to 3 sentences maximum. Never leave a sentence unfinished.
`;


  let finalResponseText = '';
  try {
    const generation = await callGroqWithRetry({
      messages: [
        { role: 'system', content: responsePrompt },
        ...history,
        { role: 'user', content: message }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.4,
      max_tokens: 512,
    });
    finalResponseText = generation?.choices[0]?.message?.content?.trim() ||
      'I am having trouble connecting right now. Please resend your message.';
  } catch (err: unknown) {
    console.error('Response generation failed after retries:', err);
    const isRateLimit = typeof err === 'object' && err !== null &&
      ('status' in err ? (err as { status: number }).status === 429 : false);
    finalResponseText = isRateLimit
      ? 'Give me just a moment — I\'m handling high traffic right now. Please resend your message in a few seconds and I\'ll pick up right where we left off.'
      : 'I apologize — our systems are experiencing a brief delay. Your case details are saved; please try again in a moment.';
  }

  // Audit logs are appended ONLY here, after the full LLM response is confirmed.
  // This guarantees ordering: audit entries always match the visible chat response above them.
  return {
    text: finalResponseText,
    auditLogs
  };
}
