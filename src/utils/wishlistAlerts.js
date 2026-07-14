const WishlistItem = require('../models/WishlistItem');
const notify = require('./notify');

/**
 * Called whenever a listing's status flips back to "available" after being
 * sold out (either restocked manually, or an order that had reserved its last
 * units gets cancelled) — see inventorySync.restockListing and
 * marketController.updateListing.
 */
const notifyWishlistersBackInStock = async (marketItem) => {
  const wishlisted = await WishlistItem.find({ marketItem: marketItem._id }).select('user');
  await Promise.all(
    wishlisted.map((w) =>
      notify(w.user, {
        type: 'wishlist_back_in_stock',
        title: 'Back in stock',
        body: `"${marketItem.title}" is available again.`,
        link: `/shop/${marketItem._id}`,
      })
    )
  );
};

/**
 * Called whenever a seller lowers the price on a listing someone has
 * wishlisted — see marketController.updateListing.
 */
const notifyWishlistersPriceDrop = async (marketItem, oldPrice) => {
  const wishlisted = await WishlistItem.find({ marketItem: marketItem._id }).select('user');
  await Promise.all(
    wishlisted.map((w) =>
      notify(w.user, {
        type: 'wishlist_price_drop',
        title: 'Price drop',
        body: `"${marketItem.title}" dropped from UGX ${oldPrice.toLocaleString()} to UGX ${marketItem.price.toLocaleString()}.`,
        link: `/shop/${marketItem._id}`,
      })
    )
  );
};

module.exports = { notifyWishlistersBackInStock, notifyWishlistersPriceDrop };
