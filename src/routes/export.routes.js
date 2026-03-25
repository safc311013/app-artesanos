const express = require("express");
const router = express.Router();
const exportController = require("../controllers/export.controller");

router.get("/exportaciones", exportController.showExportaciones);
router.get("/exportaciones/artesanos", exportController.exportArtesanos);
router.get("/exportaciones/productos", exportController.exportProductos);
router.get("/exportaciones/pedidos", exportController.exportPedidos);
router.get("/exportaciones/movimientos", exportController.exportMovimientos);
router.get("/exportaciones/saldos", exportController.exportSaldos);
router.get("/exportaciones/respaldo", exportController.backupDatabase);

module.exports = router;