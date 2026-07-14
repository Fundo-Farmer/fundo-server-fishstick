const express = require('express');
const { generateReport, listReports, getReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { requireFarmManager } = require('../middleware/roles');

const router = express.Router();

router.use(protect);
router.get('/', listReports);
router.get('/:id', getReport);
router.post('/generate', requireFarmManager, generateReport);

module.exports = router;
