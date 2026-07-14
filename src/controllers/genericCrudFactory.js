const asyncHandler = require('express-async-handler');
const { ROLES } = require('../config/constants');

/**
 * Builds a standard set of REST controllers (list, get, create, update, remove)
 * for a Mongoose model that is scoped to a farm.
 *
 * @param {import('mongoose').Model} Model
 * @param {Object} opts
 * @param {String[]} opts.populate - fields to populate on read
 * @param {String[]} opts.filterFields - query params allowed for filtering the list endpoint
 */
const genericCrudFactory = (Model, opts = {}) => {
  const { populate = [], filterFields = [] } = opts;

  const applyFarmScope = (req, filter) => {
    // super_admin may pass ?farm=<id> to inspect any farm; everyone else is locked to their own
    if (req.user.role === ROLES.SUPER_ADMIN) {
      if (req.query.farm) filter.farm = req.query.farm;
    } else {
      filter.farm = req.user.farm;
    }
    return filter;
  };

  const list = asyncHandler(async (req, res) => {
    const filter = {};
    applyFarmScope(req, filter);
    filterFields.forEach((f) => {
      if (req.query[f] !== undefined) filter[f] = req.query[f];
    });
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    let query = Model.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    populate.forEach((p) => {
      query = query.populate(p);
    });

    const [items, total] = await Promise.all([query.exec(), Model.countDocuments(filter)]);
    res.json({ success: true, data: items, page, total, pages: Math.ceil(total / limit) });
  });

  const getOne = asyncHandler(async (req, res) => {
    let query = Model.findById(req.params.id);
    populate.forEach((p) => {
      query = query.populate(p);
    });
    const item = await query.exec();
    if (!item) {
      res.status(404);
      throw new Error('Record not found.');
    }
    if (req.user.role !== ROLES.SUPER_ADMIN && String(item.farm) !== String(req.user.farm)) {
      res.status(403);
      throw new Error('You cannot access data from another farm.');
    }
    res.json({ success: true, data: item });
  });

  const create = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (req.user.role !== ROLES.SUPER_ADMIN) payload.farm = req.user.farm;
    payload.createdBy = req.user._id;

    // A client-generated ID (set by the offline queue when it originally
    // created this record) lets a retried request recognize "I already did
    // this" instead of creating a duplicate — see utils/clientIdPlugin.js.
    if (payload.clientId) {
      const existing = await Model.findOne({ farm: payload.farm, clientId: payload.clientId });
      if (existing) {
        return res.status(200).json({ success: true, data: existing, deduped: true });
      }
    }

    const item = await Model.create(payload);
    res.status(201).json({ success: true, data: item });
  });

  const update = asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Record not found.');
    }
    if (req.user.role !== ROLES.SUPER_ADMIN && String(item.farm) !== String(req.user.farm)) {
      res.status(403);
      throw new Error('You cannot modify data from another farm.');
    }
    Object.assign(item, req.body, { farm: item.farm }); // farm cannot be reassigned via update
    await item.save();
    res.json({ success: true, data: item });
  });

  const remove = asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Record not found.');
    }
    if (req.user.role !== ROLES.SUPER_ADMIN && String(item.farm) !== String(req.user.farm)) {
      res.status(403);
      throw new Error('You cannot delete data from another farm.');
    }
    await item.deleteOne();
    res.json({ success: true, message: 'Record deleted.' });
  });

  return { list, getOne, create, update, remove };
};

module.exports = genericCrudFactory;
