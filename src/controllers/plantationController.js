const asyncHandler = require('express-async-handler');
const Plantation = require('../models/Plantation');
const genericCrudFactory = require('./genericCrudFactory');

const base = genericCrudFactory(Plantation, { filterFields: ['status', 'cropType'] });

// @desc  Upload/append photos to a plantation
// @route POST /api/plantations/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const plantation = await Plantation.findById(req.params.id);
  if (!plantation) {
    res.status(404);
    throw new Error('Plantation not found.');
  }
  const files = req.files || [];
  plantation.photos.push(...files.map((f) => `/uploads/${f.filename}`));
  await plantation.save();
  res.json({ success: true, data: plantation });
});

module.exports = { ...base, uploadPhotos };
