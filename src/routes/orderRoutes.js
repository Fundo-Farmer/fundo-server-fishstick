const express = require('express');
const {
  checkout, quoteDeliveryForCart, listMyOrders, listOrdersForSeller, getOrder, advanceStatus, cancelOrder,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/checkout', checkout);
router.post('/quote-delivery', quoteDeliveryForCart);
router.get('/mine', listMyOrders);
router.get('/selling', listOrdersForSeller);
router.get('/:id', getOrder);
router.put('/:id/status', advanceStatus);
router.put('/:id/cancel', cancelOrder);

module.exports = router;
