const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");

exports.showLogin = (req, res) => {
  res.render("auth/login", {
    titulo: "Iniciar sesión",
    error: req.query.error || "",
  });
};

exports.login = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.redirect("/login?error=Debes escribir email y contraseña");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario || !usuario.activo) {
      return res.redirect("/login?error=Usuario o contraseña incorrectos");
    }

    const passwordCorrecto = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordCorrecto) {
      return res.redirect("/login?error=Usuario o contraseña incorrectos");
    }

    req.session.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
    };

    return res.redirect("/");
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return res.redirect("/login?error=No se pudo iniciar sesión");
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.redirect("/login");
  });
};