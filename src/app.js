require("dotenv").config();

const express = require("express");
const path = require("path");
const morgan = require("morgan");
const methodOverride = require("method-override");
const session = require("express-session");
const prisma = require("./lib/prisma");

const dashboardRoutes = require("./routes/dashboard.routes");
const artesanosRoutes = require("./routes/artesanos.routes");
const productosRoutes = require("./routes/productos.routes");
const pedidosRoutes = require("./routes/pedidos.routes");
const authRoutes = require("./routes/auth.routes");
const exportRoutes = require("./routes/export.routes");

const { requireAuth } = require("./middleware/auth.middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// Configuración de vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Importante detrás de proxy (Render)
app.set("trust proxy", 1);

// Middlewares base
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "..", "node_modules", "bootstrap", "dist"))
);

// Sesión
app.use(
  session({
    name: "artesanos.sid",
    secret: process.env.SESSION_SECRET || "cambia-esta-clave-secreta",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// Variables globales para vistas
app.use((req, res, next) => {
  res.locals.currentPath = req.originalUrl;
  res.locals.currentUser = req.session.user || null;
  next();
});

// Auth
app.use(authRoutes);

// Ruta de prueba de base de datos
app.get("/test-db", requireAuth, async (req, res) => {
  try {
    const totalArtesanos = await prisma.artesano.count();

    res.json({
      ok: true,
      mensaje: "Conexión con Prisma funcionando",
      totalArtesanos,
    });
  } catch (error) {
    console.error("Error en /test-db:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error al conectar con la base de datos",
      error: error.message,
    });
  }
});

// Rutas protegidas
app.use("/", requireAuth, dashboardRoutes);
app.use("/", requireAuth, exportRoutes);
app.use("/artesanos", requireAuth, artesanosRoutes);
app.use("/productos", requireAuth, productosRoutes);
app.use("/pedidos", requireAuth, pedidosRoutes);

// 404
app.use((req, res) => {
  res.status(404).send("Ruta no encontrada");
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});