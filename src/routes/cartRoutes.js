const express = require('express');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', getCart);
router.delete('/', clearCart);
router.post('/items', addItem);
router.put('/items/:marketItemId', updateItem);
router.delete('/items/:marketItemId', removeItem);

module.exports = router;
