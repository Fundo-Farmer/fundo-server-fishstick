const MarketItem = require('../models/MarketItem');
const Livestock = require('../models/Livestock');
const Pet = require('../models/Pet');
const HarvestRecord = require('../models/HarvestRecord');
const ProduceRecord = require('../models/ProduceRecord');
const SaleRecord = require('../models/SaleRecord');
const { notifyWishlistersBackInStock } = require('./wishlistAlerts');
const { LISTING_STATUS } = require('../config/constants');

const SOURCE_TO_MODULE = {
  Livestock: 'livestock',
  Pet: 'pets',
  CoffeeGarden: 'coffee',
  Plantation: 'plantation',
};

// Only these get flipped to "sold" on fulfillment — a garden/plot itself never
// goes "sold", only the individual animal a listing represents.
const STATUS_FLIP_MODELS = { Livestock, Pet };

/**
 * Restores stock to a listing when an order is cancelled, reopening it if it had sold out.
 */
const restockListing = async (order) => {
  await Promise.all(
    order.items.map(async (line) => {
      const item = await MarketItem.findById(line.marketItem);
      if (!item) return;
      const wasSoldOut = item.status === LISTING_STATUS.SOLD;
      item.quantity += line.quantity;
      if (wasSoldOut && item.quantity > 0) {
        item.status = LISTING_STATUS.AVAILABLE;
        await item.save();
        await notifyWishlistersBackInStock(item);
        return;
      }
      await item.save();
    })
  );
};

/**
 * A listing's sourceType/sourceId may point at a HarvestRecord or ProduceRecord
 * (a specific batch), not the farm entity itself — resolve down to the actual
 * Livestock/Pet/CoffeeGarden/Plantation the sale should be logged against.
 * Returns null if the sale can't be attributed to anything (e.g. produce with
 * no linked animal).
 */
const resolveSaleTarget = async (item) => {
  if (item.sourceType === 'HarvestRecord') {
    const harvest = await HarvestRecord.findById(item.sourceId);
    if (!harvest) return null;
    return { subjectType: harvest.subjectType, subjectId: harvest.subject };
  }
  if (item.sourceType === 'ProduceRecord') {
    const produce = await ProduceRecord.findById(item.sourceId);
    if (!produce || !produce.livestock) return null;
    return { subjectType: 'Livestock', subjectId: produce.livestock };
  }
  if (['Livestock', 'Pet', 'CoffeeGarden', 'Plantation'].includes(item.sourceType)) {
    return { subjectType: item.sourceType, subjectId: item.sourceId };
  }
  return null;
};

/**
 * Called when an order reaches a terminal successful state (delivered / picked_up).
 * For any line item whose listing is now fully sold out AND is linked to a farm
 * record, this:
 *   - marks the linked Livestock/Pet as 'sold' (single-animal listings)
 *   - writes a SaleRecord into that module's own ledger, so the sale shows up in
 *     the farm's internal reports exactly like a manually logged sale would.
 */
const syncFarmRecordsOnFulfilled = async (order) => {
  for (const line of order.items) {
    // eslint-disable-next-line no-await-in-loop
    const item = await MarketItem.findById(line.marketItem);
    if (!item || !item.sourceType || !item.sourceId) continue;
    if (item.status !== LISTING_STATUS.SOLD) continue; // only sync once fully sold out

    // eslint-disable-next-line no-await-in-loop
    const target = await resolveSaleTarget(item);
    if (!target) continue;
    const moduleName = SOURCE_TO_MODULE[target.subjectType];
    if (!moduleName) continue;

    // eslint-disable-next-line no-await-in-loop
    const alreadyLogged = await SaleRecord.findOne({
      module: moduleName,
      subjectType: target.subjectType,
      subject: target.subjectId,
      notes: { $regex: `fundo-order:${order._id}` },
    });
    if (alreadyLogged) continue; // avoid double-logging if this runs more than once

    if (STATUS_FLIP_MODELS[target.subjectType]) {
      // eslint-disable-next-line no-await-in-loop
      const record = await STATUS_FLIP_MODELS[target.subjectType].findById(target.subjectId);
      if (record && record.status === 'active') {
        record.status = 'sold';
        // eslint-disable-next-line no-await-in-loop
        await record.save();
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await SaleRecord.create({
      farm: item.farm,
      module: moduleName,
      subjectType: target.subjectType,
      subject: target.subjectId,
      quantity: line.quantity,
      unit: line.unit,
      pricePerUnit: line.priceEach,
      date: new Date(),
      notes: `Sold via Fundo shop (fundo-order:${order._id})`,
      createdBy: order.seller,
    });
  }
};

module.exports = { restockListing, syncFarmRecordsOnFulfilled };
