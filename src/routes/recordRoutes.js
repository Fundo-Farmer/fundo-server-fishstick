const express = require('express');
const genericCrudFactory = require('../controllers/genericCrudFactory');
const { protect } = require('../middleware/auth');
const { requireFarmStaff } = require('../middleware/roles');

const MedicalRecord = require('../models/MedicalRecord');
const HealthRecord = require('../models/HealthRecord');
const ProduceRecord = require('../models/ProduceRecord');
const HarvestRecord = require('../models/HarvestRecord');
const ExpenseRecord = require('../models/ExpenseRecord');
const SaleRecord = require('../models/SaleRecord');
const BirthRecord = require('../models/BirthRecord');

const router = express.Router();
router.use(protect, requireFarmStaff);

const mount = (path, Model, opts) => {
  const c = genericCrudFactory(Model, opts);
  const r = express.Router();
  r.get('/', c.list);
  r.post('/', c.create);
  r.get('/:id', c.getOne);
  r.put('/:id', c.update);
  r.delete('/:id', c.remove);
  router.use(path, r);
};

// /api/records/medical?subjectType=Livestock&subject=<id>
mount('/medical', MedicalRecord, { populate: ['subject'], filterFields: ['subjectType', 'subject'] });

// /api/records/crop-health?subjectType=CoffeeGarden&subject=<id>
mount('/crop-health', HealthRecord, { populate: ['subject'], filterFields: ['subjectType', 'subject'] });

// /api/records/produce?livestock=<id>&produceType=milk
mount('/produce', ProduceRecord, { populate: ['livestock'], filterFields: ['livestock', 'produceType'] });

// /api/records/harvests?subjectType=CoffeeGarden&subject=<id>
mount('/harvests', HarvestRecord, { populate: ['subject'], filterFields: ['subjectType', 'subject'] });

// /api/records/expenses?module=coffee&subject=<id>
mount('/expenses', ExpenseRecord, { populate: ['subject'], filterFields: ['module', 'subjectType', 'subject', 'category'] });

// /api/records/sales?module=livestock&subject=<id>
mount('/sales', SaleRecord, { populate: ['subject'], filterFields: ['module', 'subjectType', 'subject'] });

// /api/records/births?subjectType=Livestock&mother=<id>
mount('/births', BirthRecord, { populate: ['mother', 'father'], filterFields: ['subjectType', 'mother'] });

module.exports = router;
