const asyncHandler = require('express-async-handler');
const path = require('path');
const Farm = require('../models/Farm');
const Report = require('../models/Report');
const Livestock = require('../models/Livestock');
const Pet = require('../models/Pet');
const MedicalRecord = require('../models/MedicalRecord');
const HealthRecord = require('../models/HealthRecord');
const ProduceRecord = require('../models/ProduceRecord');
const HarvestRecord = require('../models/HarvestRecord');
const ExpenseRecord = require('../models/ExpenseRecord');
const SaleRecord = require('../models/SaleRecord');
const { generateMonthlyReportPDF } = require('../utils/pdfGenerator');
const { ROLES } = require('../config/constants');

const monthRange = (month, year) => {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  return { from, to };
};

const resolveFarmId = (req) => {
  if (req.user.role === ROLES.SUPER_ADMIN && req.body.farm) return req.body.farm;
  if (req.user.role === ROLES.SUPER_ADMIN && req.query.farm) return req.query.farm;
  return req.user.farm;
};

const buildReportData = async (farmId, month, year) => {
  const { from, to } = monthRange(month, year);
  const dateFilter = { farm: farmId, date: { $gte: from, $lte: to } };
  const createdFilter = { farm: farmId, createdAt: { $gte: from, $lte: to } };

  const [
    newLivestock,
    newPets,
    medicalRecords,
    healthRecords,
    produceRecords,
    harvestRecords,
    expenseRecords,
    saleRecords,
  ] = await Promise.all([
    Livestock.find(createdFilter).select('name species gender'),
    Pet.find(createdFilter).select('name species gender'),
    MedicalRecord.find(dateFilter),
    HealthRecord.find(dateFilter),
    ProduceRecord.find(dateFilter),
    HarvestRecord.find(dateFilter).populate('subject', 'name'),
    ExpenseRecord.find(dateFilter),
    SaleRecord.find(dateFilter),
  ]);

  const totalMedicalCost = medicalRecords.reduce((s, r) => s + (r.cost || 0), 0);
  const totalHealthCost = healthRecords.reduce((s, r) => s + (r.cost || 0), 0);
  const totalExpenses = expenseRecords.reduce((s, r) => s + (r.amount || 0), 0);
  const totalSales = saleRecords.reduce((s, r) => s + (r.total || 0), 0);

  const coffeeHarvestKg = harvestRecords
    .filter((h) => h.subjectType === 'CoffeeGarden')
    .reduce((s, r) => s + (r.quantity || 0), 0);
  const plantationHarvestQty = harvestRecords
    .filter((h) => h.subjectType === 'Plantation')
    .reduce((s, r) => s + (r.quantity || 0), 0);

  const healthItems = [
    ...medicalRecords.map((r) => ({ date: r.date, issue: r.condition, cost: r.cost, subjectName: r.subjectType })),
    ...healthRecords.map((r) => ({ date: r.date, issue: r.issue, cost: r.cost, subjectName: r.subjectType })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    summary: {
      newLivestock: newLivestock.length,
      newPets: newPets.length,
      coffeeHarvestKg,
      plantationHarvestQty,
      totalSalesRevenue: totalSales,
      totalExpenses: totalExpenses + totalMedicalCost + totalHealthCost,
      netRevenue: totalSales - (totalExpenses + totalMedicalCost + totalHealthCost),
    },
    health: {
      medicalCount: medicalRecords.length,
      cropHealthCount: healthRecords.length,
      totalCost: totalMedicalCost + totalHealthCost,
      items: healthItems,
    },
    produce: {
      recordCount: produceRecords.length,
      totalQuantity: produceRecords.reduce((s, r) => s + (r.quantity || 0), 0),
    },
    harvests: {
      coffeeKg: coffeeHarvestKg,
      plantationQty: plantationHarvestQty,
    },
    newAnimals: [
      ...newLivestock.map((a) => ({ name: a.name, species: a.species, gender: a.gender, type: 'Livestock' })),
      ...newPets.map((a) => ({ name: a.name, species: a.species, gender: a.gender, type: 'Pet' })),
    ],
    sales: { count: saleRecords.length, total: totalSales },
    expenses: { count: expenseRecords.length, total: totalExpenses },
  };
};

// @desc  Generate (or regenerate) the monthly report + PDF
// @route POST /api/reports/generate
const generateReport = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    res.status(400);
    throw new Error('Month and year are required.');
  }
  const farmId = resolveFarmId(req);
  if (!farmId) {
    res.status(400);
    throw new Error('No farm associated with this account.');
  }
  const farm = await Farm.findById(farmId);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }

  const data = await buildReportData(farmId, month, year);
  const pdfPath = await generateMonthlyReportPDF({ farm, month, year, data });
  const relativePath = `/uploads/reports/${path.basename(pdfPath)}`;

  const report = await Report.findOneAndUpdate(
    { farm: farmId, month, year },
    { data, pdfPath: relativePath, generatedBy: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ success: true, data: report });
});

// @desc  List reports for a farm
// @route GET /api/reports
const listReports = asyncHandler(async (req, res) => {
  const farmId = resolveFarmId(req);
  const reports = await Report.find({ farm: farmId }).sort({ year: -1, month: -1 });
  res.json({ success: true, data: reports });
});

// @desc  Get one report
// @route GET /api/reports/:id
const getReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) {
    res.status(404);
    throw new Error('Report not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(report.farm) !== String(req.user.farm)) {
    res.status(403);
    throw new Error('You cannot access another farm\'s report.');
  }
  res.json({ success: true, data: report });
});

module.exports = { generateReport, listReports, getReport };
