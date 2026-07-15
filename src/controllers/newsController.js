const asyncHandler = require('express-async-handler');
const NewsPost = require('../models/NewsPost');
const { ROLES, CONTENT_STATUS, NEWS_CATEGORY } = require('../config/constants');

const requireBlogger = (req) => {
  if (![ROLES.BLOGGER, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    const err = new Error('Only a blogger can do this.');
    err.statusCode = 403;
    throw err;
  }
};

// @desc  Public: browse published news
// @route GET /api/news
const browseNews = asyncHandler(async (req, res) => {
  const filter = { status: CONTENT_STATUS.PUBLISHED };
  if (req.query.category) filter.category = req.query.category;
  const posts = await NewsPost.find(filter).populate('author', 'name').sort({ publishedAt: -1 });
  res.json({ success: true, data: posts });
});

// @desc  Public: get one news post
// @route GET /api/news/:id
const getNewsPost = asyncHandler(async (req, res) => {
  const post = await NewsPost.findById(req.params.id).populate('author', 'name');
  if (!post || post.status !== CONTENT_STATUS.PUBLISHED) {
    res.status(404);
    throw new Error('Post not found.');
  }
  res.json({ success: true, data: post });
});

// @desc  Blogger: list all posts (any status)
// @route GET /api/news/mine/all
const myNews = asyncHandler(async (req, res) => {
  requireBlogger(req);
  const posts = await NewsPost.find().sort({ createdAt: -1 });
  res.json({ success: true, data: posts });
});

// @desc  Create a news post
// @route POST /api/news
const createNewsPost = asyncHandler(async (req, res) => {
  requireBlogger(req);
  const { title, excerpt, body, category, status } = req.body;
  if (!title || !body || !Object.values(NEWS_CATEGORY).includes(category)) {
    res.status(400);
    throw new Error('Title, body, and a valid category are required.');
  }
  const post = await NewsPost.create({
    author: req.user._id, title, excerpt, body, category,
    status: status === CONTENT_STATUS.DRAFT ? CONTENT_STATUS.DRAFT : CONTENT_STATUS.PUBLISHED,
  });
  res.status(201).json({ success: true, data: post });
});

// @desc  Update a news post
// @route PUT /api/news/:id
const updateNewsPost = asyncHandler(async (req, res) => {
  requireBlogger(req);
  const post = await NewsPost.findById(req.params.id);
  if (!post) {
    res.status(404);
    throw new Error('Post not found.');
  }
  const { title, excerpt, body, category, status } = req.body;
  if (title) post.title = title;
  if (excerpt !== undefined) post.excerpt = excerpt;
  if (body) post.body = body;
  if (category && Object.values(NEWS_CATEGORY).includes(category)) post.category = category;
  if (status && Object.values(CONTENT_STATUS).includes(status)) post.status = status;
  await post.save();
  res.json({ success: true, data: post });
});

// @desc  Upload images for a news post
// @route POST /api/news/:id/photos
const uploadNewsPhotos = asyncHandler(async (req, res) => {
  requireBlogger(req);
  const post = await NewsPost.findById(req.params.id);
  if (!post) {
    res.status(404);
    throw new Error('Post not found.');
  }
  const files = req.files || [];
  post.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await post.save();
  res.json({ success: true, data: post });
});

// @desc  Delete a news post
// @route DELETE /api/news/:id
const deleteNewsPost = asyncHandler(async (req, res) => {
  requireBlogger(req);
  const post = await NewsPost.findById(req.params.id);
  if (!post) {
    res.status(404);
    throw new Error('Post not found.');
  }
  await post.deleteOne();
  res.json({ success: true, message: 'Post removed.' });
});

module.exports = { browseNews, getNewsPost, myNews, createNewsPost, updateNewsPost, uploadNewsPhotos, deleteNewsPost };
