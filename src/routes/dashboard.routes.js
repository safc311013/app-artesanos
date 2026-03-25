const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");

router.get("/", dashboardController.mostrarDashboard);
router.get("/reportes", dashboardController.mostrarReportes);

module.exports = router;