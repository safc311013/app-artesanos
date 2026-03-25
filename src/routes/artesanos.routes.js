const express = require("express");
const router = express.Router();
const artesanosController = require("../controllers/artesanos.controller");

router.get("/", artesanosController.listarArtesanos);
router.get("/nuevo", artesanosController.formNuevoArtesano);
router.post("/", artesanosController.crearArtesano);
router.get("/:id/editar", artesanosController.formEditarArtesano);
router.put("/:id", artesanosController.actualizarArtesano);
router.put("/:id/estado", artesanosController.cambiarEstadoArtesano);
router.delete("/:id", artesanosController.eliminarArtesano);

module.exports = router;