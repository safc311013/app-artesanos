const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { requireGuest } = require("../middleware/auth.middleware");

router.get("/login", requireGuest, authController.showLogin);
router.post("/login", requireGuest, authController.login);
router.post("/logout", authController.logout);

module.exports = router;