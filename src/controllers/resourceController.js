const asyncHandler = require('express-async-handler');
const ResourceLink = require('../models/ResourceLink');

// @desc  Public: list resource links
// @route GET /api/resources
const listResources = asyncHandler(async (req, res) => {
  const resources = await ResourceLink.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: resources });
});

// @desc  Super admin: create a resource link
// @route POST /api/resources
const createResource = asyncHandler(async (req, res) => {
  const { title, url, description, order } = req.body;
  if (!title || !url) {
    res.status(400);
    throw new Error('Title and URL are required.');
  }
  const resource = await ResourceLink.create({ title, url, description, order, createdBy: req.user._id });
  res.status(201).json({ success: true, data: resource });
});

// @desc  Super admin: update a resource link
// @route PUT /api/resources/:id
const updateResource = asyncHandler(async (req, res) => {
  const resource = await ResourceLink.findById(req.params.id);
  if (!resource) {
    res.status(404);
    throw new Error('Resource not found.');
  }
  Object.assign(resource, req.body);
  await resource.save();
  res.json({ success: true, data: resource });
});

// @desc  Super admin: delete a resource link
// @route DELETE /api/resources/:id
const deleteResource = asyncHandler(async (req, res) => {
  await ResourceLink.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Resource removed.' });
});

module.exports = { listResources, createResource, updateResource, deleteResource };
