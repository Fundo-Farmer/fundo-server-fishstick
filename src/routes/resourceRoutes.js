const express = require('express');
const { listResources, createResource, updateResource, deleteResource } = require('../controllers/resourceController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();

router.get('/', listResources);
router.post('/', protect, requireSuperAdmin, createResource);
router.put('/:id', protect, requireSuperAdmin, updateResource);
router.delete('/:id', protect, requireSuperAdmin, deleteResource);

module.exports = router;
