# Kapture Collections Voicebot — "Maya"

An automated outbound Voice AI Collections Agent for **Kapture Finance**, built on **Vapi.ai**, using **Deepgram Nova-2** for transcription, **GPT-4o** as the orchestrator LLM, and **ElevenLabs/Cartesia** for text-to-speech. Maya authenticates customers before disclosing any debt information, negotiates a resolution, and logs a compliant call disposition.

---

## 1. Project Structure

```
kapture-collections-voicebot/
├── README.md                   # This file
├── docs/
│   ├── HLD_Document.md         # Complete High-Level Design Document
│   └── System_Architecture.png # Architecture flow diagram (rendered)
├── vapi/
│   ├── system_prompt.txt       # Production Vapi System Prompt
│   └── tool_definitions.json   # Tool schemas registered in Vapi
├── mock-server/
│   ├── package.json            # Dependencies (express)
│   ├── server.js               # Node.js Express webhook implementation
│   └── .env.example            # Environment variables placeholder
└── tests/
    └── test_cases.json         # Evaluation matrix and edge case scenarios
```

---

## 2. Architecture Summary

```
Customer <--> Telephony (SIP/PSTN) <--> Vapi Engine
                                            |-- Deepgram Nova-2 (STT)
                                            |-- GPT-4o (Orchestrator LLM, temp=0.1)
                                            |-- ElevenLabs/Cartesia (TTS)
                                            |-- Mock Webhook Server (tool calls)
```

The LLM never speaks debt-related terms until the `verify_customer` tool call returns `verified: true`. This is enforced through the system prompt's strict state machine (`INIT → AUTH_PENDING → AUTHENTICATED → NEGOTIATION → PTP_COLLECTED/ESCALATED → CALL_ENDED`) and a low LLM temperature to reduce prompt drift. Full details are in [`docs/HLD_Document.md`](docs/HLD_Document.md).

---

## 3. Setup Guide

### 3.1 Prerequisites
- Node.js v18+
- A free-tier [Vapi.ai](https://vapi.ai) account
- `ngrok` (or Render/Vercel) to expose the mock server publicly
- API keys for Deepgram, GPT-4o (OpenAI or Anthropic), and ElevenLabs/Cartesia — Vapi manages these under its own provider integrations once connected in the dashboard

### 3.2 Run the Mock Webhook Server

```bash
cd mock-server
npm install
cp .env.example .env
npm start
```

The server starts on `http://localhost:3000` by default, exposing:
- `POST /webhook` — main Vapi tool-call dispatcher
- `GET /health` — health check
- `GET /debug/dispositions` — inspect logged dispositions (dev only)
- `GET /debug/ptp-records` — inspect logged PTP records (dev only)

### 3.3 Expose the Server Publicly

```bash
ngrok http 3000
```

Copy the generated HTTPS URL (e.g. `https://your-subdomain.ngrok-free.app/webhook`) — you'll need it for Step 3.4.

### 3.4 Configure the Vapi Assistant

1. Log in to the Vapi Dashboard → **Assistants** → **Create Assistant** → **Blank Template**.
2. **Transcriber:** Deepgram, model `nova-2`, language `en-US` (or `multi` for bilingual support).
3. **Model:** OpenAI `gpt-4o` (or `gpt-4o-mini`), temperature `0.1`.
4. **Voice:** ElevenLabs or Cartesia — a professional, natural-sounding voice (e.g. "Sarah").
5. **System Prompt:** paste the contents of [`vapi/system_prompt.txt`](vapi/system_prompt.txt).
6. **First Message:** `"Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?"`
7. **Tools:** under the **Tools** tab, register each function from [`vapi/tool_definitions.json`](vapi/tool_definitions.json) and point every tool's webhook URL to your ngrok `/webhook` endpoint.
8. Save and test using **Vapi Web Call** (browser-based test call) or a real phone number.

### 3.5 Run Test Scenarios

Use [`tests/test_cases.json`](tests/test_cases.json) as a script for manual or scripted QA calls. It covers the authentication guardrail, PTP happy path, already-paid, dispute, hardship, wrong number, failed verification, abusive caller, silent user, and bilingual switch scenarios.

---

## 4. Design Choices

- **Hard authentication gate:** debt disclosure is structurally blocked behind a successful `verify_customer` tool response rather than relying on the LLM's judgment alone — this is the single most important compliance control in the system.
- **Low temperature (0.1):** chosen to minimize creative deviation from the compliance script, at a small cost to conversational variety.
- **Five narrowly-scoped tools:** the LLM has no generic database/file access — only the five defined functions — to reduce the blast radius of any prompt injection via customer speech.
- **PII masking in logs:** customer names are masked (`Rahul S****`) in server logs; raw verification codes are never persisted, only the boolean match outcome.
- **Streaming STT/TTS:** chosen over batch processing specifically to hit the <1.2s round-trip latency budget documented in the HLD.

## 5. Known Bugs / Limitations (Demo Build)

- The mock server uses in-memory storage — data resets on server restart; a production build would use a persistent store.
- Verification currently accepts two hardcoded mock codes (`1234`, `1995`) for demo purposes only.
- Language auto-switching (English ↔ Hindi) depends on Deepgram's `multi` language model accuracy; mid-sentence code-switching may occasionally require a re-prompt.
- No real SMS/WhatsApp gateway integration — `send_payment_link` returns a mocked success response only.
- No persistent scheduling logic to enforce the 08:00–19:00 calling window; this is currently a design requirement documented in the HLD rather than code-enforced in this mock server (the outbound dialer/scheduler would own this in production).

## 6. Future Enhancements

See Section 10 of [`docs/HLD_Document.md`](docs/HLD_Document.md) — multi-language expansion, real-time sentiment-based escalation, negotiation-script A/B testing, real CRM integration, and automated post-call QA scoring.

---

## 7. Demo

A 2–4 minute recorded demo (Loom/OBS) shows:
1. **Happy Path:** Greeting → Authentication → Debt Disclosure → PTP Commitment → Payment Link Sent.
2. **Edge Case:** Already Paid / Dispute / Do-Not-Call flow.

*(Attach or link the recorded video file here before submission.)*
