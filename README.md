# Airline Disruption Resolution Agent

A full-stack AI agent handling airline disruption customer support strictly adhering to defined policies. 

## Tech Stack
- Frontend: Next.js (App Router), React, Tailwind CSS, Lucide React
- Backend: Next.js API Routes (Node.js)
- LLM: Groq API (Llama 3.3 70B Versatile) for intent extraction and natural language generation
- Rules Engine: Deterministic TypeScript functions strictly enforcing policies (rebooking, refunds, compensation, escalation)

## Setup and Local Run Instructions

1.  Clone this repository or navigate to the directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables. Create a `.env.local` file in the root directory and add your Groq API key:
    ```
    GROQ_API_KEY=your_actual_groq_api_key_here
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing the Agent (The 3 Scenarios)
The UI provides a dropdown at the top to select the mock scenario.

1.  **Scenario 1: Priya Nair** (Cancellation) - Try asking for a refund and rebook. Then try demanding an upgrade "for the trouble" and watch the deterministic engine deny and escalate it, with the LLM communicating this politely.
2.  **Scenario 2: Arvind Kulkarni** (4h Delay) - Try asking for hotel accommodation. Watch the rules engine deny it (threshold > 5h) and offer the meal voucher + lounge access instead.
3.  **Scenario 3: Meher Kaur** (6h Delay) - Ask for a full night's stay (denied/escalated, offers delayed hours only). Ask to upgrade to a flight with a ₹2,000 difference (escalated, exceeds ₹1,500 limit).

## Testing the Rules Engine
The rules engine is thoroughly unit-tested. To run tests:
```bash
npm run test
```

## Deployment
This Next.js app is designed to be easily deployed to Vercel. 
1. Push to a GitHub repository.
2. Import project into Vercel.
3. Add `GROQ_API_KEY` to Environment Variables in Vercel.
4. Deploy!
