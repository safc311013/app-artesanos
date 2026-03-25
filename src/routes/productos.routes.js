const express = require("express");
const router = express.Router();
const productosController = require("../controllers/productos.controller");

router.get("/", productosController.listarProductos);
router.get("/nuevo", productosController.formNuevoProducto);
router.post("/", productosController.crearProducto);
router.get("/:id/editar", productosController.formEditarProducto);
router.put("/:id", productosController.actualizarProducto);
router.put("/:id/estado", productosController.cambiarEstadoProducto);
router.delete("/:id", productosController.eliminarProducto);

module.exports = router;