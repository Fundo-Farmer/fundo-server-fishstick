const asyncHandler = require('express-async-handler');
const CoffeeGarden = require('../models/CoffeeGarden');
const genericCrudFactory = require('./genericCrudFactory');

const base = genericCrudFactory(CoffeeGarden, { filterFields: ['status', 'variety'] });

// @desc  Upload/append photos to a coffee garden
// @route POST /api/coffee/gardens/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const garden = await CoffeeGarden.findById(req.params.id);
  if (!garden) {
    res.status(404);
    throw new Error('Coffee garden not found.');
  }
  const files = req.files || [];
  garden.photos.push(...files.map((f) => `/uploads/${f.filename}`));
  await garden.save();
  res.json({ success: true, data: garden });
});

module.exports = { ...base, uploadPhotos };
