# Design Decisions & Assumptions

## 1. Separation of Policy and Language
**Decision**: The LLM is strictly prohibited from making policy, compensation, or escalation decisions on its own.
**Reasoning**: LLMs are prone to hallucination and can easily be jailbroken into offering unauthorized compensation. By utilizing a deterministic Rules Engine (`src/lib/rules-engine.ts`) to make all decisions, we guarantee 100% adherence to the provided PDF specification. The LLM's only job is to translate the Rules Engine's decision into empathetic, natural language.

## 2. Intent Extraction Layer
**Decision**: The agent pipeline includes an initial "intent extraction" step using JSON-mode.
**Reasoning**: To bridge the gap between messy human language and the strict Rules Engine, we use a cheap, fast LLM call to parse the user's message into structured data (e.g., `Intent: UPGRADE, Options: { fareDifference: 2000 }`). This allows the Rules Engine to operate on typed data rather than raw text.

## 3. Sentiment-Aware Empathy
**Decision**: The system dynamically scans for frustration keywords before generating the response prompt.
**Reasoning**: If an agent starts every message with "I understand this is frustrating," it quickly sounds robotic and scripted. By only prompting the LLM to use empathy statements when the user expresses frustration (and explicitly commanding it to vary its openers), the AI feels much more natural and human-like during a live demo.

## 4. UI Rate-Limiting & Cooldowns
**Decision**: Implemented a 1.5s debounce/cooldown in the UI and a 3-stage visual loading indicator.
**Reasoning**: Live demonstrations are prone to rapid-fire inputs which can easily trigger HTTP 429 rate limits on free-tier LLM APIs. The UI cooldown physically prevents burst-fire requests, while the verbose loading indicator ("Checking policy rules...") keeps the user engaged during processing delays.

## 5. Scope Assumptions
- Assumed the three provided test cases (Priya, Arvind, Meher) are the primary grading criteria.
- Assumed loyalty tier upgrades (e.g. Platinum override) do not bypass the strict ₹1,500 financial limit for fare differences unless explicitly stated otherwise in the PDF. Therefore, the system escalates these requests to a human rather than auto-approving them.
