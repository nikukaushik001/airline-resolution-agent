# System Architecture: Airline Resolution Agent

## Core Components

The application is built on a modern Next.js stack, emphasizing a clear separation of concerns between presentation, policy enforcement, and LLM orchestration.

### 1. Frontend (Next.js / React)
- **`src/app/page.tsx`**: The main chat interface. Uses React state to manage messages and the audit log.
- **Styling**: Built with Tailwind CSS and custom glassmorphism utilities (`globals.css`) for a premium, responsive dark-mode UI.
- **Client-Side State**: Maintains conversation history locally and passes it to the backend via POST requests to ensure the LLM has context.

### 2. Backend API (Next.js API Routes)
- **`src/app/api/chat/route.ts`**: The sole endpoint serving the client. It handles incoming requests, fetches the relevant customer data, and orchestrates the AI agent pipeline.

### 3. Agent Orchestration (`src/lib/agent.ts`)
The AI agent operates in a strict, multi-step pipeline to prevent hallucination and enforce policy:
1. **Context Hydration**: Injects real-time customer and flight data from the database.
2. **Intent Extraction**: Uses the LLM in JSON-mode to extract the customer's core intent (e.g., REBOOK, REFUND, UPGRADE) and any associated options (e.g., fare difference, stated reasons).
3. **Policy Evaluation**: Passes the extracted intent directly to the deterministic Rules Engine.
4. **Response Generation**: The LLM drafts a natural language response strictly bound by the Rules Engine's output and the true booking data.

### 4. Deterministic Rules Engine (`src/lib/rules-engine.ts`)
The sole authority on policy. The LLM cannot make compensation or rebooking decisions.
- Evaluates scenarios based on customer tier, disruption type, and specific PDF-mandated limits (e.g., ₹1500 fare difference limits).
- Triggers forced escalations for out-of-policy requests or legal threats.
- Produces deterministic, auditable logs for every decision.

### 5. Mock Database (`src/lib/db.ts`)
In-memory mock data store containing predefined scenarios (Priya Nair, Arvind Kulkarni, Meher Kaur) to satisfy the assignment requirements.
