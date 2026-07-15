const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const { ROLES, CONTENT_STATUS } = require('../config/constants');

const requireEventsManager = (req) => {
  if (![ROLES.EVENTS_ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    const err = new Error('Only an events manager can do this.');
    err.statusCode = 403;
    throw err;
  }
};

// @desc  Public: upcoming/published events
// @route GET /api/events
const browseEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ status: CONTENT_STATUS.PUBLISHED }).sort({ startAt: 1 });
  res.json({ success: true, data: events });
});

// @desc  Public: get one event
// @route GET /api/events/:id
const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event || event.status !== CONTENT_STATUS.PUBLISHED) {
    res.status(404);
    throw new Error('Event not found.');
  }
  res.json({ success: true, data: event });
});

// @desc  Events manager: list all events (any status)
// @route GET /api/events/mine/all
const myEvents = asyncHandler(async (req, res) => {
  requireEventsManager(req);
  const events = await Event.find().sort({ startAt: -1 });
  res.json({ success: true, data: events });
});

// @desc  Create an event
// @route POST /api/events
const createEvent = asyncHandler(async (req, res) => {
  requireEventsManager(req);
  const { title, description, location, startAt, endAt, status } = req.body;
  if (!title || !description || !startAt) {
    res.status(400);
    throw new Error('Title, description, and a start date are required.');
  }
  const event = await Event.create({
    createdBy: req.user._id, title, description, location, startAt, endAt,
    status: status === CONTENT_STATUS.DRAFT ? CONTENT_STATUS.DRAFT : CONTENT_STATUS.PUBLISHED,
  });
  res.status(201).json({ success: true, data: event });
});

// @desc  Update an event
// @route PUT /api/events/:id
const updateEvent = asyncHandler(async (req, res) => {
  requireEventsManager(req);
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found.');
  }
  const { title, description, location, startAt, endAt, status } = req.body;
  if (title) event.title = title;
  if (description) event.description = description;
  if (location !== undefined) event.location = location;
  if (startAt) event.startAt = startAt;
  if (endAt !== undefined) event.endAt = endAt;
  if (status && Object.values(CONTENT_STATUS).includes(status)) event.status = status;
  await event.save();
  res.json({ success: true, data: event });
});

// @desc  Upload images for an event
// @route POST /api/events/:id/photos
const uploadEventPhotos = asyncHandler(async (req, res) => {
  requireEventsManager(req);
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found.');
  }
  const files = req.files || [];
  event.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await event.save();
  res.json({ success: true, data: event });
});

// @desc  Delete an event
// @route DELETE /api/events/:id
const deleteEvent = asyncHandler(async (req, res) => {
  requireEventsManager(req);
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found.');
  }
  await event.deleteOne();
  res.json({ success: true, message: 'Event removed.' });
});

module.exports = { browseEvents, getEvent, myEvents, createEvent, updateEvent, uploadEventPhotos, deleteEvent };
