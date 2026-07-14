const { ROLES } = require('../config/constants');

// Restrict a route to specific roles
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized.');
  }
  if (!roles.includes(req.user.role)) {
    res.status(403);
    throw new Error('You do not have permission to perform this action.');
  }
  next();
};

// Only Fundo platform super admins
const requireSuperAdmin = allowRoles(ROLES.SUPER_ADMIN);

// Farm admins and super admins (management-level actions on a farm)
const requireFarmManager = allowRoles(ROLES.SUPER_ADMIN, ROLES.FARM_ADMIN);

// Anyone attached to a farm (admin or worker) plus super admin
const requireFarmStaff = allowRoles(ROLES.SUPER_ADMIN, ROLES.FARM_ADMIN, ROLES.WORKER);

// Ensures the logged-in user belongs to the farm referenced in the request
// (super_admin bypasses this check since they manage all farms)
const scopeToOwnFarm = (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  const requestedFarmId = req.params.farmId || req.body.farm || req.query.farm;
  if (!req.user.farm) {
    res.status(403);
    throw new Error('Your account is not linked to a farm yet.');
  }
  if (requestedFarmId && String(req.user.farm) !== String(requestedFarmId)) {
    res.status(403);
    throw new Error('You cannot access data from another farm.');
  }
  // Always force the farm to the user's own farm for writes
  req.body.farm = String(req.user.farm);
  next();
};

module.exports = { allowRoles, requireSuperAdmin, requireFarmManager, requireFarmStaff, scopeToOwnFarm };
