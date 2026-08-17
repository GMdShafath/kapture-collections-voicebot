/**
 * Kapture Finance - Mock Collections Webhook Server
 * Handles Vapi tool-call webhooks for the "Maya" voice agent.
 *
 * Endpoints:
 *   POST /webhook  -> Vapi tool-call and event dispatcher
 *   GET  /health   -> simple health check
 */

const express = require('express');
const app = express();
app.use(express.json());

// In-memory mock "database" for demo purposes only.
const dispositions = [];
const ptpRecords = [];

// Basic PII masking helper (mask all but first char of first name segment)
function maskName(name) {
  if (!name) return name;
  return name
    .split(' ')
    .map((part, idx) => (idx === 0 ? `${part[0]}${'*'.repeat(Math.max(part.length - 1, 1))}` : `${part[0]}****`))
    .join(' ');
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'kapture-mock-webhook' });
});

// Main Webhook Endpoint for Vapi
app.post('/webhook', (req, res) => {
  const { message } = req.body || {};

  // Handle Tool Calls from Vapi
  if (message && message.type === 'tool-calls') {
    const toolCall = message.toolCalls[0];
    const { name, arguments: args } = toolCall.function;
    const callId = toolCall.id;

    console.log(`[Tool Call Received]: ${name}`, args);

    let result = {};

    switch (name) {
      case 'verify_customer': {
        // Mock verification check (e.g., last 4 digits = '1234' or '1995')
        const isValid = args.verification_code === '1234' || args.verification_code === '1995';
        result = isValid
          ? { verified: true, message: 'Identity verified successfully.' }
          : { verified: false, message: 'Verification failed. Incorrect code.' };
        // Never log the raw verification_code in plaintext - only the boolean outcome.
        console.log(`[Auth Result]: account=${args.account_id} verified=${isValid}`);
        break;
      }

      case 'log_promise_to_pay': {
        const ptpId = `PTP-${Math.floor(1000 + Math.random() * 9000)}`;
        ptpRecords.push({
          ptp_id: ptpId,
          account_id: args.account_id,
          ptp_date: args.ptp_date,
          amount: args.amount,
          logged_at: new Date().toISOString(),
        });
        result = {
          success: true,
          ptp_id: ptpId,
          confirmed_date: args.ptp_date,
          amount: args.amount,
        };
        break;
      }

      case 'send_payment_link': {
        result = {
          success: true,
          message: `Payment link sent successfully via ${args.channel} to registered mobile number.`,
        };
        break;
      }

      case 'escalate_to_agent': {
        const escalationId = `ESC-${Math.floor(1000 + Math.random() * 9000)}`;
        result = {
          success: true,
          escalation_id: escalationId,
          reason: args.reason,
          queued: true,
        };
        break;
      }

      case 'mark_disposition': {
        const record = {
          account_id: args.account_id,
          status: args.status,
          notes: args.notes || '',
          timestamp: new Date().toISOString(),
        };
        dispositions.push(record);
        console.log(`[Disposition Logged]: ${JSON.stringify({ ...record, account_id: maskName(record.account_id) })}`);
        result = {
          success: true,
          disposition_logged: args.status,
          timestamp: record.timestamp,
        };
        break;
      }

      default:
        result = { success: false, message: 'Unknown function call' };
    }

    // Return format required by Vapi Tool Call response
    return res.status(200).json({
      results: [
        {
          toolCallId: callId,
          result: JSON.stringify(result),
        },
      ],
    });
  }

  // Fallback response for other Vapi event notifications (status-update, transcript, etc.)
  return res.status(200).json({ status: 'acknowledged' });
});

// Simple endpoints to inspect mock data during testing/demo
app.get('/debug/dispositions', (req, res) => res.json(dispositions));
app.get('/debug/ptp-records', (req, res) => res.json(ptpRecords));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kapture Mock Collections Webhook Server running on port ${PORT}`);
});
