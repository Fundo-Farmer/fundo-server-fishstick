const express = require('express');
const {
  createForecast, browseForecasts, myForecasts, getForecast, updateForecast, uploadForecastPhotos,
  cancelForecast, fulfillForecast,
  createPreOrder, listMine, listSelling, cancelPreOrder, simulatePayment, retryPayment,
} = require('../controllers/preOrderController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/forecasts', optionalAuth, browseForecasts);
router.get('/forecasts/mine', protect, myForecasts);
router.get('/forecasts/:id', getForecast);

router.use(protect);

router.post('/forecasts', createForecast);
router.put('/forecasts/:id', updateForecast);
router.post('/forecasts/:id/photos', upload.array('photos', 10), uploadForecastPhotos);
router.put('/forecasts/:id/cancel', cancelForecast);
router.put('/forecasts/:id/fulfill', fulfillForecast);

router.post('/', createPreOrder);
router.get('/mine', listMine);
router.get('/selling', listSelling);
router.put('/:id/cancel', cancelPreOrder);
router.post('/:id/simulate', simulatePayment);
router.post('/:id/retry', retryPayment);

module.exports = router;
