const Notification = require('../models/Notification');
const { sendSms } = require('./smsProvider');

/**
 * Creates an in-app notification for a user, and — for the handful of call
 * sites that pass `sms: true` — also attempts an SMS via the sandbox provider.
 * Fire-and-forget by design: neither channel failing should ever break the
 * action that triggered it.
 *
 * NOTE: push notifications aren't wired up (would need a service worker + a
 * push provider like FCM, which is a much bigger lift for a text-based build
 * like this one) — but the shape is the same: add a `push: true` flag here.
 */
const notify = async (userId, { type, title, body, link, sms = false }) => {
  if (!userId) return null;
  let notification = null;
  try {
    notification = await Notification.create({ user: userId, type, title, body, link });
  } catch (err) {
    console.error('[fundo] failed to create notification:', err.message);
  }

  if (sms) {
    try {
      // Lazy require to avoid a require cycle with models that import notify().
      const User = require('../models/User');
      const user = await User.findById(userId).select('phone');
      if (user?.phone) await sendSms(user.phone, `Fundo: ${title}${body ? ` — ${body}` : ''}`);
    } catch (err) {
      console.error('[fundo] failed to send SMS notification:', err.message);
    }
  }

  return notification;
};

module.exports = notify;
