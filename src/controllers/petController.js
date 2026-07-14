const asyncHandler = require('express-async-handler');
const Pet = require('../models/Pet');
const genericCrudFactory = require('./genericCrudFactory');
const { buildFamilyTree } = require('../utils/familyTree');

const base = genericCrudFactory(Pet, {
  populate: ['parentMale', 'parentFemale'],
  filterFields: ['species', 'status', 'gender'],
});

// @desc  Upload/append photos to a pet record
// @route POST /api/pets/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const pet = await Pet.findById(req.params.id);
  if (!pet) {
    res.status(404);
    throw new Error('Pet record not found.');
  }
  const files = req.files || [];
  const urls = files.map((f) => `/uploads/${f.filename}`);
  pet.photos.push(...urls);
  await pet.save();
  res.json({ success: true, data: pet });
});

// @desc  Get the family tree (ancestors + descendants) for a pet
// @route GET /api/pets/:id/family-tree
const familyTree = asyncHandler(async (req, res) => {
  const tree = await buildFamilyTree(Pet, req.params.id);
  if (!tree) {
    res.status(404);
    throw new Error('Pet record not found.');
  }
  res.json({ success: true, data: tree });
});

module.exports = { ...base, uploadPhotos, familyTree };
