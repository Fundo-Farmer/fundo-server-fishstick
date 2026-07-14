/**
 * SANDBOX PROVIDER — for development/demo only. There's no real SMS gateway
 * credentials available here (e.g. Africa's Talking, Twilio), so this just logs
 * what would have been sent and reports success.
 *
 * To go live: replace the body of `sendSms` with a real API call (Africa's
 * Talking is the common choice for East African SMS delivery; Twilio works
 * globally). Every call site already goes through `notify()` with `sms: true`,
 * so no call sites need to change — only this one file.
 */
const sendSms = async (phoneNumber, message) => {
  if (!phoneNumber) return { success: false, reason: 'No phone number on file.' };
  console.log(`[fundo] (mock SMS) to ${phoneNumber}: ${message}`);
  return { success: true, providerRef: `MOCK-SMS-${Date.now()}` };
};

module.exports = { sendSms };
