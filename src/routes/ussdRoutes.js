const express = require('express');
const { handleUssdRequest } = require('../controllers/ussdController');

const router = express.Router();

// No auth middleware — this is a server-to-server webhook called by a USSD
// aggregator (Africa's Talking, etc.), not a browser. In production, lock
// this down with the aggregator's IP allowlist or a shared-secret header,
// the same way you'd secure any inbound webhook.
router.post('/', handleUssdRequest);

module.exports = router;
