/**
 * GT2FX killzone phone-call reminders.
 *
 * Zero dependencies — run by the scheduled `killzone-call` GitHub Actions
 * workflow (cron every 15 min). The script checks the *actual* current time
 * in America/New_York (DST-correct) and places a Twilio call when it matches
 * one of the four killzone reminder slots:
 *
 *   06:00 ET  London killzone open
 *   08:00 ET  NY AM killzone open
 *   10:00 ET  NY AM killzone closing
 *   14:00 ET  London-close killzone
 *
 * Required env vars (GitHub Secrets — never commit these):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER
 *
 * Flags:
 *   --test     place the call now, ignoring the killzone window
 *   --dry-run  print the computed time, chosen message and TwiML; make no call
 */

const REMINDERS = [
  {
    at: [6, 0],
    label: 'London killzone open',
    say:
      'Good morning. The London killzone is opening now. Review your plan, ' +
      'mark your levels, and trade only what fits your checklist.',
  },
  {
    at: [8, 0],
    label: 'NY AM killzone open',
    say:
      'The New York morning killzone is open. Trade your plan, keep risk ' +
      'within limits, and journal the setup before you enter.',
  },
  {
    at: [10, 0],
    label: 'NY AM killzone closing',
    say:
      'The New York morning killzone closes soon. Final window — stick to ' +
      'your checklist and do not chase.',
  },
  {
    at: [14, 0],
    label: 'London-close killzone',
    say:
      'The London close killzone is here. Take your planned setups only, ' +
      'and journal the session before the day ends.',
  },
];

// Fire if we're within this many minutes of the target (cron can run late).
const WINDOW_MIN = 7;

const test = process.argv.includes('--test');
const dryRun = process.argv.includes('--dry-run');

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_FROM_NUMBER;
const to = process.env.TWILIO_TO_NUMBER;

function missingEnv() {
  const need = { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, TWILIO_TO_NUMBER: to };
  return Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
}

/** Current time in America/New_York as { hour, minute } (24h, DST-correct). */
function nowInNewYork() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { hour: get('hour') % 24, minute: get('minute') };
}

function pickReminder({ hour, minute }) {
  const now = hour * 60 + minute;
  return REMINDERS.find(({ at: [h, m] }) => Math.abs(now - (h * 60 + m)) <= WINDOW_MIN) ?? null;
}

function twimlFor(message) {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<Response><Say voice="Polly.Amy">${safe}</Say><Pause length="1"/><Say voice="Polly.Amy">This is your G T 2 F X journal reminder.</Say></Response>`;
}

async function placeCall(twiml) {
  const missing = missingEnv();
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')} (add them as GitHub Secrets)`);
    process.exit(1);
  }
  const body = new URLSearchParams({ To: to, From: from, Twiml: twiml });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Twilio call failed (${res.status}): ${JSON.stringify(data)}`);
    process.exit(1);
  }
  console.log(`Call placed ✅  SID=${data.sid}  to=${to}  from=${from}`);
}

async function main() {
  const now = nowInNewYork();
  const clock = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')} ET`;

  if (test) {
    console.log(`Test call requested (current time ${clock}).`);
  } else {
    const due = pickReminder(now);
    if (!due) {
      console.log(`${clock} — not a killzone reminder time. No call. Exiting 0.`);
      return;
    }
    console.log(`${clock} matches ${due.label}.`);
  }

  const reminder = test ? { label: 'test call', say: 'This is a test call from your G T 2 F X trading journal. Killzone reminders are working.' } : pickReminder(now);
  console.log(`Reminder: ${reminder.label}`);
  const twiml = twimlFor(reminder.say);
  console.log(`TwiML: ${twiml}`);

  if (dryRun) {
    console.log('Dry run — no call placed.');
    return;
  }
  await placeCall(twiml);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
