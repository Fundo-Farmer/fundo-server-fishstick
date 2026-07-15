const express = require('express');
const { getContent, listContent, upsertContent } = require('../controllers/siteContentController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();

router.get('/', protect, requireSuperAdmin, listContent);
router.get('/:key', getContent);
router.put('/:key', protect, requireSuperAdmin, upsertContent);

module.exports = router;
