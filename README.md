<p align="center">
  <img src="https://raw.githubusercontent.com/nikukaushik001/airline-resolution-agent/main/public/logo.jpg" width="120" alt="AIONOS Logo" />
</p>

# Airline Disruption Resolution Agent

A full‑stack AI agent that handles airline disruption customer support **with a premium, glassmorphic UI** and **strict policy‑driven reasoning**. The agent:

- Uses a deterministic TypeScript **rules engine** to decide whether a request is approved, denied, or must be escalated.
- Grounds the LLM response in the engine's decision **but re‑phrases the internal reason** into natural, first‑person language (no verbatim policy strings, no third‑person references).
- Provides a **glowing empty‑state hero**, a **mobile‑first overlay audit log**, and a **responsive header** that never collapses on narrow screens.
- Is deployed at **https://airline-resolution-agent-vxpt.vercel.app/**.

---

## Tech Stack
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes (Node.js)
- **LLM**: Groq API (Llama 3.3 70B Versatile) for intent extraction \u0026 response generation
- **Rules Engine**: Deterministic TypeScript functions enforcing airline policies

---

## Setup \u0026 Local Run
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file and add your Groq API key:
   ```
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open <http://localhost:3000>.

---

## Testing the Agent (The 3 Scenarios)
The UI includes a dropdown to select a mock scenario:

1. **Scenario 1 – Priya Nair (Cancellation)**
   - Ask for a refund or re‑book.
   - Demand an upgrade “for the trouble” → the engine denies \u0026 escalates, the LLM politely explains the decision.
2. **Scenario 2 – Arvind Kulkarni (4‑hour Delay)**
   - Request a hotel stay → denied (threshold \u003e 5 h) and offered a meal voucher + lounge access.
3. **Scenario 3 – Meher Kaur (6‑hour Delay)**
   - Request a full‑night hotel → escalated, offers delayed‑hours‑only stay.
   - Request an upgrade with a ₹2,000 fare difference → escalated (exceeds ₹1,500 limit).

---

## Testing the Rules Engine
Run the comprehensive test suite:
```bash
npm run test
```

---

## Deployment
Deploy to Vercel in a few clicks:
1. Push to GitHub.
2. Import the repo in Vercel.
3. Add `GROQ_API_KEY` to Vercel environment variables.
4. Deploy! The live app is accessible at **https://airline-resolution-agent-vxpt.vercel.app/**.

---

## Notable Enhancements
- **Glowing “Ready to resolve” empty state** with gradient text and animated orb.
- **Mobile‑first audit‑log drawer** that overlays the screen on small devices.
- **Header layout** now stacks gracefully on very narrow screens.
- **LLM prompt update**: the internal `reason` is used only as grounding; the model must re‑phrase it in conversational, first‑person language, eliminating third‑person policy text.

Enjoy a polished, premium experience while staying 100 % policy‑compliant!
