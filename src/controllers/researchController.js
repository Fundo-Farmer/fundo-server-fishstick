const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const ResearchApplication = require('../models/ResearchApplication');
const Publication = require('../models/Publication');
const User = require('../models/User');
const notify = require('../utils/notify');
const { ROLES, RESEARCH_APPLICATION_STATUS, CONTENT_STATUS } = require('../config/constants');

// ---------- Public: publications ----------

// @desc  Public: browse published research publications
// @route GET /api/research/publications
const browsePublications = asyncHandler(async (req, res) => {
  const filter = { status: CONTENT_STATUS.PUBLISHED };
  if (req.query.tag) filter.tags = req.query.tag;
  const publications = await Publication.find(filter).populate('author', 'name').sort({ publishedAt: -1 });
  res.json({ success: true, data: publications });
});

// @desc  Public: get a single publication
// @route GET /api/research/publications/:id
const getPublication = asyncHandler(async (req, res) => {
  const publication = await Publication.findById(req.params.id).populate('author', 'name');
  if (!publication || publication.status !== CONTENT_STATUS.PUBLISHED) {
    res.status(404);
    throw new Error('Publication not found.');
  }
  res.json({ success: true, data: publication });
});

// ---------- Researcher: manage own publications ----------

// @desc  My publications (researcher)
// @route GET /api/research/publications/mine
const myPublications = asyncHandler(async (req, res) => {
  const publications = await Publication.find({ author: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: publications });
});

const requireResearcher = (req) => {
  if (![ROLES.RESEARCHER, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    const err = new Error('Only an approved researcher can post publications.');
    err.statusCode = 403;
    throw err;
  }
};

// @desc  Create a publication
// @route POST /api/research/publications
const createPublication = asyncHandler(async (req, res) => {
  requireResearcher(req);
  const { title, abstract, body, tags, status } = req.body;
  if (!title || !abstract || !body) {
    res.status(400);
    throw new Error('Title, abstract, and body are required.');
  }
  const publication = await Publication.create({
    author: req.user._id,
    title,
    abstract,
    body,
    tags: Array.isArray(tags) ? tags : [],
    status: status === CONTENT_STATUS.DRAFT ? CONTENT_STATUS.DRAFT : CONTENT_STATUS.PUBLISHED,
  });
  res.status(201).json({ success: true, data: publication });
});

// @desc  Update my publication
// @route PUT /api/research/publications/:id
const updatePublication = asyncHandler(async (req, res) => {
  const publication = await Publication.findById(req.params.id);
  if (!publication) {
    res.status(404);
    throw new Error('Publication not found.');
  }
  if (String(publication.author) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only edit your own publications.');
  }
  const { title, abstract, body, tags, status } = req.body;
  if (title) publication.title = title;
  if (abstract) publication.abstract = abstract;
  if (body) publication.body = body;
  if (tags) publication.tags = tags;
  if (status && Object.values(CONTENT_STATUS).includes(status)) publication.status = status;
  await publication.save();
  res.json({ success: true, data: publication });
});

// @desc  Upload images for a publication
// @route POST /api/research/publications/:id/photos
const uploadPublicationPhotos = asyncHandler(async (req, res) => {
  const publication = await Publication.findById(req.params.id);
  if (!publication) {
    res.status(404);
    throw new Error('Publication not found.');
  }
  if (String(publication.author) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only edit your own publications.');
  }
  const files = req.files || [];
  publication.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await publication.save();
  res.json({ success: true, data: publication });
});

// @desc  Delete my publication
// @route DELETE /api/research/publications/:id
const deletePublication = asyncHandler(async (req, res) => {
  const publication = await Publication.findById(req.params.id);
  if (!publication) {
    res.status(404);
    throw new Error('Publication not found.');
  }
  if (String(publication.author) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only delete your own publications.');
  }
  await publication.deleteOne();
  res.json({ success: true, message: 'Publication removed.' });
});

// ---------- Public: apply to join the research team ----------

// @desc  Public: submit an application to join the research team
// @route POST /api/research/applications
const submitApplication = asyncHandler(async (req, res) => {
  const { name, email, phone, institution, fieldOfStudy, motivation } = req.body;
  if (!name || !email || !motivation) {
    res.status(400);
    throw new Error('Name, email, and a short motivation are required.');
  }
  const application = await ResearchApplication.create({ name, email, phone, institution, fieldOfStudy, motivation });
  res.status(201).json({ success: true, data: application });
});

// @desc  Upload supporting documents (CV, credentials) for an application
// @route POST /api/research/applications/:id/attachments
const uploadApplicationAttachments = asyncHandler(async (req, res) => {
  const application = await ResearchApplication.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error('Application not found.');
  }
  const files = req.files || [];
  application.attachments.push(...files.map((f) => `/uploads/${f.filename}`));
  await application.save();
  res.json({ success: true, data: application });
});

// ---------- Admin: review applications ----------

// @desc  Super admin: list research applications
// @route GET /api/research/applications
const listApplications = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const applications = await ResearchApplication.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: applications });
});

/** Generates a readable one-time temporary password — shown to the admin to relay,
 * since there's no email service wired up to send it automatically (see README). */
const generateTempPassword = () => crypto.randomBytes(6).toString('base64url');

// @desc  Super admin: approve an application — auto-creates a researcher account
// @route PUT /api/research/applications/:id/approve
const approveApplication = asyncHandler(async (req, res) => {
  const application = await ResearchApplication.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error('Application not found.');
  }
  if (application.status !== RESEARCH_APPLICATION_STATUS.PENDING) {
    res.status(400);
    throw new Error('This application has already been reviewed.');
  }

  let user = await User.findOne({ email: application.email.toLowerCase() });
  let tempPassword = null;
  if (user) {
    user.role = ROLES.RESEARCHER;
    await user.save();
  } else {
    tempPassword = generateTempPassword();
    user = await User.create({
      name: application.name,
      email: application.email,
      phone: application.phone,
      password: tempPassword,
      role: ROLES.RESEARCHER,
    });
  }

  application.status = RESEARCH_APPLICATION_STATUS.APPROVED;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.createdUser = user._id;
  await application.save();

  await notify(user._id, {
    type: 'research_approved',
    title: 'Welcome to the Fundo Research Team',
    body: 'Your application was approved — you can now publish research to the Fundo Research page.',
    link: '/research-dashboard',
  });

  // NOTE: no email/SMS gateway is wired up (see README) — the temp password
  // (only present for brand-new accounts) is returned here for the admin to
  // relay to the applicant directly.
  res.json({ success: true, data: { application, tempPassword, existingAccount: !tempPassword } });
});

// @desc  Super admin: reject an application
// @route PUT /api/research/applications/:id/reject
const rejectApplication = asyncHandler(async (req, res) => {
  const application = await ResearchApplication.findById(req.params.id);
  if (!application) {
    res.status(404);
    throw new Error('Application not found.');
  }
  if (application.status !== RESEARCH_APPLICATION_STATUS.PENDING) {
    res.status(400);
    throw new Error('This application has already been reviewed.');
  }
  application.status = RESEARCH_APPLICATION_STATUS.REJECTED;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.reviewNote = req.body.note || '';
  await application.save();
  res.json({ success: true, data: application });
});

module.exports = {
  browsePublications, getPublication, myPublications, createPublication, updatePublication,
  uploadPublicationPhotos, deletePublication,
  submitApplication, uploadApplicationAttachments,
  listApplications, approveApplication, rejectApplication,
};
