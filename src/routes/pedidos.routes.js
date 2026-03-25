const express = require("express");
const router = express.Router();
const pedidosController = require("../controllers/pedidos.controller");

router.get("/", pedidosController.listarPedidos);
router.get("/nuevo", pedidosController.formNuevoPedido);
router.post("/", pedidosController.crearPedido);
router.get("/:id", pedidosController.verPedido);
router.put("/:id/estado", pedidosController.cambiarEstadoPedido);
router.post("/:id/movimientos", pedidosController.registrarMovimientoManual);

// NUEVA RUTA
router.delete("/:id", pedidosController.eliminarPedido);

module.exports = router;