const asyncHandler = require('express-async-handler');
const Livestock = require('../models/Livestock');
const genericCrudFactory = require('./genericCrudFactory');
const { buildFamilyTree } = require('../utils/familyTree');

const base = genericCrudFactory(Livestock, {
  populate: ['parentMale', 'parentFemale'],
  filterFields: ['species', 'status', 'gender'],
});

// @desc  Upload/append photos to a livestock record
// @route POST /api/livestock/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const animal = await Livestock.findById(req.params.id);
  if (!animal) {
    res.status(404);
    throw new Error('Livestock record not found.');
  }
  const files = req.files || [];
  const urls = files.map((f) => `/uploads/${f.filename}`);
  animal.photos.push(...urls);
  await animal.save();
  res.json({ success: true, data: animal });
});

// @desc  Get the family tree (ancestors + descendants) for an animal
// @route GET /api/livestock/:id/family-tree
const familyTree = asyncHandler(async (req, res) => {
  const tree = await buildFamilyTree(Livestock, req.params.id);
  if (!tree) {
    res.status(404);
    throw new Error('Livestock record not found.');
  }
  res.json({ success: true, data: tree });
});

module.exports = { ...base, uploadPhotos, familyTree };
