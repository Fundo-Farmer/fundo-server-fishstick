require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { startAuctionScheduler } = require('./utils/auctionScheduler');
const { startSubscriptionScheduler } = require('./utils/subscriptionScheduler');
const { startFeaturedListingScheduler } = require('./utils/featuredListingScheduler');
const { startPremiumScheduler } = require('./utils/premiumScheduler');
const { seedSiteContent } = require('./utils/seedContent');
const User = require('./models/User');
const { ROLES } = require('./config/constants');

const app = express();

// CLIENT_URL can be a single origin or a comma-separated list — useful once
// there's more than one legitimate frontend (the website, plus each native
// app wrapper, which the WebView presents as its own origin: by default
// https://localhost on Android, capacitor://localhost on iOS). Left unset,
// this defaults to allowing any origin, which is fine here since auth is a
// Bearer token in the Authorization header, not a cookie — there's no CSRF
// surface being protected by a strict origin lock in the first place.
const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Serve uploaded photos & generated report PDFs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Fundo API is running.' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/farms', require('./routes/farmRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/livestock', require('./routes/livestockRoutes'));
app.use('/api/pets', require('./routes/petRoutes'));
app.use('/api/coffee/gardens', require('./routes/coffeeRoutes'));
app.use('/api/plantations', require('./routes/plantationRoutes'));
app.use('/api/records', require('./routes/recordRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/auctions', require('./routes/auctionRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/couriers', require('./routes/courierRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/preorders', require('./routes/preOrderRoutes'));
app.use('/api/ussd', require('./routes/ussdRoutes'));
app.use('/api/premium', require('./routes/premiumRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/research', require('./routes/researchRoutes'));
app.use('/api/events', require('./routes/eventsRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/content', require('./routes/siteContentRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/partners', require('./routes/partnerRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const bootstrapSuperAdmin = async () => {
  const anyUser = await User.countDocuments();
  if (anyUser > 0) return;
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@fundo.africa').toLowerCase();
  await User.create({
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Fundo Admin',
    email,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!',
    role: ROLES.SUPER_ADMIN,
  });
  console.log(`[fundo] Bootstrapped first super admin account: ${email}`);
};

const start = async () => {
  await connectDB();
  await bootstrapSuperAdmin();
  await seedSiteContent();
  startAuctionScheduler();
  startSubscriptionScheduler();
  startFeaturedListingScheduler();
  startPremiumScheduler();
  app.listen(PORT, () => console.log(`[fundo] API listening on port ${PORT}`));
};

start().catch((err) => {
  console.error('[fundo] Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
