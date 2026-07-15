const SiteContent = require('../models/SiteContent');

const DEFAULTS = [
  {
    key: 'privacy_policy',
    title: 'Privacy Policy',
    body: `_Last updated: automatically generated on first launch — update this from the admin panel._

## 1. Who we are

Fundo ("Fundo", "we", "us") operates a farmer-to-consumer marketplace connecting farms, buyers, delivery couriers, and researchers across the platform described at this site (the "Platform").

## 2. Information we collect

- **Account information**: name, email, phone number, password (stored hashed, never in plain text), and role (buyer, farm, courier, researcher, staff).
- **Farm & marketplace data**: listings, orders, bids, reviews, wallet and transaction history, and farm records you choose to enter (livestock, crops, harvests, and similar operational data).
- **Location data**: if you provide a delivery address or pin a location on the map (for a farm's pickup point, a delivery address, or a courier's base location), we store those coordinates to calculate delivery distance and pricing.
- **Payment information**: we do not store your full mobile money PIN or card number. Payments are processed through mobile money and card providers; we retain transaction references, amounts, and status.
- **Courier verification (KYC)**: if you register as a delivery courier, we collect and store the permit and national ID documents you upload for verification purposes.
- **Communications**: messages sent through in-app chat, and content you submit for research publications, news, or event listings.
- **Usage data**: log data such as IP address, device/browser type, and pages visited, for security and service improvement.

## 3. How we use your information

We use your information to: operate and improve the Platform; process orders, payments, and deliveries; verify courier and farm identities; calculate delivery pricing; send order, payment, and account notifications (in-app, SMS, or email where enabled); prevent fraud and abuse; and comply with legal obligations.

## 4. How we share your information

- **Other users**: your name, rating, and relevant order/listing details are visible to the buyer or seller you transact with, and to any courier assigned to your delivery.
- **Service providers**: mobile money and card payment processors, SMS providers, and map/tile providers process data on our behalf solely to deliver those specific services.
- **Legal requirements**: we may disclose information if required by law, regulation, or valid legal process.
- We do not sell your personal information to third parties.

## 5. Data retention

We retain account and transaction data for as long as your account is active and as needed to comply with legal, tax, and accounting obligations. You may request deletion of your account; some transaction records may be retained where required by law.

## 6. Your rights

Depending on your location, you may have the right to access, correct, export, or delete your personal information, and to object to certain processing. Contact us using the details on this Platform to exercise these rights.

## 7. Security

We use industry-standard measures (password hashing, access controls, encrypted connections) to protect your information. No system is completely secure, and we encourage you to use a strong, unique password.

## 8. Children's privacy

The Platform is not directed at children under 18. We do not knowingly collect personal information from children.

## 9. Changes to this policy

We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "last updated" date above.

## 10. Contact

Questions about this policy can be directed to the Fundo team through the contact details published on this Platform.`,
  },
  {
    key: 'terms_conditions',
    title: 'Terms & Conditions',
    body: `_Last updated: automatically generated on first launch — update this from the admin panel._

## 1. Acceptance of terms

By creating an account or using Fundo (the "Platform"), you agree to these Terms & Conditions. If you do not agree, please do not use the Platform.

## 2. Accounts

- You must provide accurate information when registering, and keep your credentials confidential.
- Fundo supports several account types: buyers/customers, farm accounts (farm admin and staff), delivery couriers, researchers, and platform staff (events and news administrators) — each with different capabilities described elsewhere on the Platform.
- Listing items for sale or auction is limited to verified farm accounts; plain buyer accounts may purchase, bid, save wishlists, and message sellers, but may not list items.
- You are responsible for all activity under your account.

## 3. Marketplace transactions

- **Escrow**: payment for an order is held in escrow and released to the seller once the order is confirmed fulfilled (delivered or picked up), less Fundo's platform commission.
- **Commission**: Fundo charges a platform commission on completed sales, disclosed at checkout and in seller wallets. Farms subscribed to Fundo Premium receive a reduced commission rate, as described on the Pricing page.
- **Auctions**: bids are binding offers to purchase at the bid amount if you win. Auction listings may only be created by verified farm accounts.
- **Pre-orders**: reserving a share of a forecasted harvest is a binding commitment to purchase once the harvest is fulfilled by the farm; refunds are issued to your Fundo wallet if the forecast or your pre-order is cancelled.
- **Subscriptions**: recurring orders are billed automatically on the schedule you choose until you pause or cancel them.
- **Cancellations & refunds**: orders may be cancelled subject to their current fulfillment status; approved refunds are credited to your Fundo wallet. See the Marketplace Policy for details.

## 4. Delivery & logistics

- Delivery fees are calculated based on distance between the seller and the delivery address, using tiers published on the Platform.
- Couriers must complete identity verification (permit and national ID) before accepting deliveries, and are responsible for handling goods with care and completing deliveries as accepted.
- Fundo is not a common carrier; couriers are independent delivery partners, not Fundo employees.

## 5. Payments

Payments are processed via supported mobile money networks and card providers. You authorize Fundo and its payment providers to process the amounts shown at checkout. Fraudulent or disputed payments may result in account suspension.

## 6. Premium plan & featured listings

Farms may subscribe to Fundo Premium for a reduced commission rate and other benefits, billed monthly until cancelled. Sellers may pay a one-time fee to feature a listing at the top of shop search for a limited time. Fees for both are disclosed before purchase and may be adjusted from time to time.

## 7. Content & conduct

- You may not post false, misleading, fraudulent, or illegal listings, reviews, publications, or other content.
- Research publications, news posts, and event listings are moderated by their respective platform staff and may be removed if they violate these Terms.
- You retain ownership of content you submit, but grant Fundo a license to display it on the Platform.

## 8. Prohibited conduct

You may not: use the Platform for unlawful purposes; circumvent payment or escrow mechanisms; misrepresent your identity, farm, or products; harass other users; or attempt to disrupt or reverse-engineer the Platform.

## 9. Intellectual property

The Fundo name, logo, and Platform design are the property of Fundo. Content you submit remains yours, subject to the license granted above.

## 10. Disclaimers & limitation of liability

The Platform is provided "as is." Fundo facilitates transactions between independent buyers, farms, and couriers, and is not a party to the underlying sale of goods. To the maximum extent permitted by law, Fundo is not liable for indirect, incidental, or consequential damages arising from use of the Platform.

## 11. Termination

We may suspend or terminate accounts that violate these Terms or the Marketplace Policy. You may close your account at any time.

## 12. Governing law

These Terms are governed by the laws of the jurisdiction in which Fundo operates, without regard to conflict-of-law principles.

## 13. Changes

We may update these Terms from time to time. Continued use of the Platform after changes take effect constitutes acceptance of the updated Terms.`,
  },
  {
    key: 'marketplace_policy',
    title: 'Marketplace Policy',
    body: `_Last updated: automatically generated on first launch — update this from the admin panel._

## Who can sell

Only verified farm accounts (farm admins and their staff) may list items for sale or start an auction. Plain buyer/customer accounts can browse, buy, bid, subscribe, pre-order, wishlist, and message sellers, but cannot list items.

## Listing standards

- Listings must accurately describe the item, quantity, unit, and condition. Quality tags (e.g. organic, free-range) are seller-declared unless the farm holds independent Fundo verification.
- Photos should represent the actual item or a genuine representative example (e.g. for livestock/produce categories).
- Prohibited listings include: counterfeit goods, illegal substances or wildlife products, items that violate local agricultural or trade regulations, and anything not genuinely available for sale.

## Orders & fulfillment

- Sellers must keep listed quantities accurate and mark orders "packed" promptly once payment is confirmed.
- For delivery orders, a courier handles pickup and delivery once the seller marks the order packed; for pickup orders, the seller and buyer coordinate directly.
- Buyers should inspect goods at pickup/delivery and raise any issue promptly through order support or in-app chat.

## Cancellations & refunds

- Orders may be cancelled before the seller marks them packed (for delivery) or ready-for-pickup, subject to the seller's discretion afterward.
- Approved refunds (including delivery fees for a delivery that could not be completed) are credited to the buyer's Fundo wallet, from which they can be spent again or withdrawn.
- Repeated cancellations or disputes may affect a buyer's or seller's account standing and rating.

## Auctions

- Bids are binding; winning bidders are expected to complete payment. Sellers may not bid on their own auctions or artificially inflate bidding.
- Auction listings follow the same content standards as shop listings.

## Reviews & ratings

- Reviews must reflect a genuine transaction and be honest and non-abusive. Fundo may remove reviews that violate this policy.

## Couriers

- Couriers must complete KYC verification before accepting deliveries, handle goods responsibly, and report delivery problems promptly through the courier dashboard rather than abandoning a delivery silently.

## Enforcement

Fundo may remove listings, cancel orders, or suspend accounts that violate this Marketplace Policy, at its reasonable discretion, with notice where practical.`,
  },
  {
    key: 'legal',
    title: 'Legal Notices',
    body: `_Last updated: automatically generated on first launch — update this from the admin panel._

## Company information

Fundo is operated as described in these Legal Notices. Company registration details, address, and regulatory information should be added here by the platform operator.

## Copyright

All content on this Platform — including text, graphics, logos, and software — is the property of Fundo or its licensors and is protected by applicable copyright and intellectual property law, except for content submitted by users under the license described in the Terms & Conditions.

## Trademarks

"Fundo" and associated logos are trademarks of Fundo. Other trademarks appearing on the Platform belong to their respective owners.

## Copyright/IP complaints

If you believe content on the Platform infringes your intellectual property rights, please contact the Fundo team through the contact details published on this Platform, including a description of the material and your rights in it.

## Dispute resolution

Disputes arising from use of the Platform should first be raised through Fundo's support channels. Unresolved disputes are subject to the governing law and venue described in the Terms & Conditions.

## Severability

If any provision of these Legal Notices, the Terms & Conditions, Privacy Policy, or Marketplace Policy is found unenforceable, the remaining provisions continue in full force.

## Regulatory notices

Any additional regulatory disclosures required in the jurisdictions where Fundo operates (e.g. e-commerce, payments, or agricultural trade regulations) should be added here by the platform operator.`,
  },
  {
    key: 'about',
    title: 'About Fundo',
    body: `Fundo is a farmer-to-consumer platform connecting farms directly with buyers — covering the shop, live auctions, harvest pre-orders, logistics, and everything a small or mid-sized farm needs to sell online, alongside tools for delivery couriers, agricultural researchers, and buyers who just want fresh, traceable produce.

Update this page from the admin panel to tell your own story — your mission, your team, and what makes Fundo different.`,
  },
  {
    key: 'careers',
    title: 'Careers at Fundo',
    body: `We're building the infrastructure for farmer-to-consumer commerce — from marketplace and payments to logistics and offline-tolerant tools for low-connectivity areas.

There are no open roles published yet. Update this page from the admin panel when you're ready to list open positions, or add a way for candidates to reach out.`,
  },
  {
    key: 'academy',
    title: 'Fundo Academy',
    body: `Fundo Academy is where we'll share guides and training for farmers, couriers, and buyers getting the most out of the Platform — from listing your first product to reading your farm's analytics.

Update this page from the admin panel to publish your first guide.`,
  },
];

const seedSiteContent = async () => {
  for (const page of DEFAULTS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await SiteContent.findOne({ key: page.key });
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await SiteContent.create(page);
      console.log(`[fundo] Seeded default content page: ${page.key}`);
    }
  }
};

module.exports = { seedSiteContent };
