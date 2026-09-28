/**
 * GT2FX killzone WhatsApp reminders (free, via CallMeBot).
 *
 * Zero dependencies — run by the scheduled `killzone-reminder` GitHub Actions
 * workflow (cron every 15 min). The script checks the *actual* current time
 * in America/New_York (DST-correct) and sends a WhatsApp message when it
 * matches one of the four killzone reminder slots:
 *
 *   06:00 ET  London killzone open
 *   08:00 ET  NY AM killzone open
 *   10:00 ET  NY AM killzone closing
 *   14:00 ET  London-close killzone
 *
 * Required env vars (GitHub Secrets — never commit these):
 *   CALLMEBOT_PHONE   destination phone, E.164 (e.g. +2348069530581)
 *   CALLMEBOT_APIKEY  personal CallMeBot apikey (free — see README activation)
 *
 * Flags:
 *   --test     send the test message now, ignoring the killzone window
 *   --dry-run  print the computed time and message; send nothing
 */

const REMINDERS = [
  {
    at: [6, 0],
    label: 'London killzone open',
    text:
      '🌅 GT2FX — London killzone opening now. Review your plan, mark your ' +
      'levels, trade only what fits your checklist.',
  },
  {
    at: [8, 0],
    label: 'NY AM killzone open',
    text:
      '🔔 GT2FX — NY AM killzone is open. Trade your plan, keep risk within ' +
      'limits, journal the setup before you enter.',
  },
  {
    at: [10, 0],
    label: 'NY AM killzone closing',
    text:
      '⏳ GT2FX — NY AM killzone closes soon. Final window: stick to the ' +
      'checklist, do not chase.',
  },
  {
    at: [14, 0],
    label: 'London-close killzone',
    text:
      '🌆 GT2FX — London-close killzone. Planned setups only, then journal ' +
      'the session before the day ends.',
  },
];

const TEST_TEXT =
  '✅ GT2FX test — WhatsApp killzone reminders are working. ' +
  'Next message arrives at the next killzone slot (6:00, 8:00, 10:00 or 14:00 ET).';

// Fire if we're within this many minutes of the target (cron can run late).
const WINDOW_MIN = 7;

const test = process.argv.includes('--test');
const dryRun = process.argv.includes('--dry-run');

const phone = process.env.CALLMEBOT_PHONE;
const apikey = process.env.CALLMEBOT_APIKEY;

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

function buildUrl(text) {
  const params = new URLSearchParams({ phone, text, apikey });
  return `https://api.callmebot.com/whatsapp.php?${params.toString()}`;
}

async function send(text) {
  if (!phone || !apikey) {
    const missing = [!phone && 'CALLMEBOT_PHONE', !apikey && 'CALLMEBOT_APIKEY'].filter(Boolean);
    console.error(`Missing required env vars: ${missing.join(', ')} (add them as GitHub Secrets — see README)`);
    process.exit(1);
  }
  const url = buildUrl(text);
  const res = await fetch(url, { headers: { 'User-Agent': 'gt2fx-journal' } });
  const body = (await res.text().catch(() => '')).trim();
  if (!res.ok) {
    console.error(`CallMeBot request failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    process.exit(1);
  }
  // CallMeBot can answer HTTP 200 with an error page for a wrong apikey —
  // surface those as failures so the workflow run shows red.
  if (/ERROR|Wrong APIKEY|Invalid APIKEY|api key/i.test(body) && !/Message Queued/i.test(body)) {
    console.error(`CallMeBot rejected the message: ${body.slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`WhatsApp sent ✅  to=${phone}  (${body.slice(0, 80) || 'no body'})`);
}

async function main() {
  const now = nowInNewYork();
  const clock = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')} ET`;

  let message;
  if (test) {
    console.log(`Test message requested (current time ${clock}).`);
    message = { label: 'test message', text: TEST_TEXT };
  } else {
    const due = pickReminder(now);
    if (!due) {
      console.log(`${clock} — not a killzone reminder time. No message. Exiting 0.`);
      return;
    }
    console.log(`${clock} matches ${due.label}.`);
    message = due;
  }

  console.log(`Reminder: ${message.label}`);
  if (dryRun) {
    console.log(`Would send to ${phone || '(CALLMEBOT_PHONE unset)'}: ${message.text}`);
    console.log('Dry run — nothing sent.');
    return;
  }
  await send(message.text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
