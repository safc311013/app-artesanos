const prisma = require("../lib/prisma");

function convertirPesosACentavos(valor) {
  const numero = parseFloat(valor || 0);
  return Math.round(numero * 100);
}

function convertirCentavosAPesos(valor) {
  return (Number(valor || 0) / 100).toFixed(2);
}

function limpiarTexto(valor) {
  return valor && valor.trim() !== "" ? valor.trim() : null;
}

function escaparCsv(valor) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

function dividirLineaCsv(linea) {
  const columnas = [];
  let actual = "";
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    const siguiente = linea[i + 1];

    if (caracter === '"' && dentroComillas && siguiente === '"') {
      actual += '"';
      i += 1;
      continue;
    }

    if (caracter === '"') {
      dentroComillas = !dentroComillas;
      continue;
    }

    if (caracter === "," && !dentroComillas) {
      columnas.push(actual.trim());
      actual = "";
      continue;
    }

    actual += caracter;
  }

  columnas.push(actual.trim());
  return columnas;
}

function parsearBooleano(valor) {
  const normalizado = String(valor ?? "").trim().toLowerCase();

  if (["si", "s", "true", "1", "activo", "activa"].includes(normalizado)) {
    return true;
  }

  if (["no", "n", "false", "0", "inactivo", "inactiva"].includes(normalizado)) {
    return false;
  }

  return null;
}

function parsearProductosCsv(csvTexto) {
  const lineas = String(csvTexto || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");

  const errores = [];

  if (lineas.length < 2) {
    return {
      productos: [],
      errores: ["Agrega el encabezado y al menos una línea de producto."],
    };
  }

  const encabezadosEsperados = ["nombre", "descripcion", "precioArtesano", "existencia", "unidad", "activo"];
  const encabezados = dividirLineaCsv(lineas[0]);

  const encabezadoValido =
    encabezados.length === encabezadosEsperados.length &&
    encabezados.every((encabezado, index) => {
      if (index === 2) {
        return encabezado === "precioArtesano" || encabezado === "precioBase";
      }

      return encabezado === encabezadosEsperados[index];
    });

  if (!encabezadoValido) {
    errores.push(`El encabezado debe ser exactamente: ${encabezadosEsperados.join(",")}`);
  }

  const productos = [];

  lineas.slice(1).forEach((linea, index) => {
    const numeroLinea = index + 2;
    const columnas = dividirLineaCsv(linea);

    if (columnas.length !== encabezadosEsperados.length) {
      errores.push(`Línea ${numeroLinea}: debe tener ${encabezadosEsperados.length} columnas.`);
      return;
    }

    const [nombre, descripcion, precioArtesano, existencia, unidad, activo] = columnas;
    const precioNumero = parseFloat(precioArtesano);
    const existenciaNumero = parseInt(existencia, 10);
    const activoBooleano = parsearBooleano(activo);

    if (!nombre || nombre.trim() === "") {
      errores.push(`Línea ${numeroLinea}: el nombre es obligatorio.`);
    }

    if (isNaN(precioNumero) || precioNumero < 0) {
      errores.push(`Línea ${numeroLinea}: precioArtesano debe ser un número mayor o igual a 0.`);
    }

    if (isNaN(existenciaNumero) || existenciaNumero < 0) {
      errores.push(`Línea ${numeroLinea}: existencia debe ser un entero mayor o igual a 0.`);
    }

    if (activoBooleano === null) {
      errores.push(`Línea ${numeroLinea}: activo debe ser si/no, true/false o 1/0.`);
    }

    productos.push({
      nombre: nombre.trim(),
      descripcion: limpiarTexto(descripcion),
      precioBase: convertirPesosACentavos(precioArtesano),
      existencia: existenciaNumero,
      unidad: unidad && unidad.trim() !== "" ? unidad.trim() : "pieza",
      activo: activoBooleano,
    });
  });

  return { productos, errores };
}

function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });

  const result = searchParams.toString();
  return result ? `&${result}` : "";
}

exports.listarProductos = async (req, res) => {
  try {
    const artesanoId = req.query.artesanoId ? parseInt(req.query.artesanoId) : null;
    const q = (req.query.q || "").trim();
    const estado = (req.query.estado || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = 10;

    const where = {};

    if (artesanoId && !isNaN(artesanoId)) {
      where.artesanoId = artesanoId;
    }

    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { descripcion: { contains: q } },
      ];
    }

    if (estado === "activos") {
      where.activo = true;
    }

    if (estado === "inactivos") {
      where.activo = false;
    }

    const total = await prisma.producto.count({ where });
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * limit;

    const [productos, artesanos] = await Promise.all([
      prisma.producto.findMany({
        where,
        include: {
          artesano: true,
        },
        orderBy: {
          id: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.artesano.findMany({
        orderBy: {
          nombre: "asc",
        },
      }),
    ]);

    const productosFormateados = productos.map((producto) => ({
      ...producto,
      precioBasePesos: convertirCentavosAPesos(producto.precioBase),
    }));

    res.render("productos/index", {
      titulo: "Productos",
      productos: productosFormateados,
      artesanos,
      filtroArtesanoId: artesanoId || "",
      filtros: {
        q,
        estado,
      },
      mensajeOk: req.query.ok || "",
      mensajeError: req.query.error || "",
      paginacion: {
        currentPage,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
        baseUrl: "/productos",
        queryString: buildQueryString({
          q,
          estado,
          artesanoId: artesanoId || "",
        }),
      },
    });
  } catch (error) {
    console.error("Error al listar productos:", error);
    res.status(500).send("Error al listar productos");
  }
};

exports.formNuevoProducto = async (req, res) => {
  try {
    const artesanos = await prisma.artesano.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });

    res.render("productos/new", {
      titulo: "Nuevo producto",
      errores: [],
      artesanos,
      old: {
        artesanoId: req.query.artesanoId || "",
        nombre: "",
        descripcion: "",
        precioBase: "0.00",
        existencia: 0,
        unidad: "pieza",
        activo: true,
      },
    });
  } catch (error) {
    console.error("Error al cargar formulario nuevo producto:", error);
    res.status(500).send("Error al cargar formulario");
  }
};

exports.crearProducto = async (req, res) => {
  try {
    const { artesanoId, nombre, descripcion, precioBase, existencia, unidad, activo } = req.body;
    const errores = [];

    const artesanoIdNumero = parseInt(artesanoId);
    const existenciaNumero = parseInt(existencia);
    const precioNumero = parseFloat(precioBase);

    if (!artesanoId || isNaN(artesanoIdNumero)) {
      errores.push("Debes seleccionar un artesano.");
    }

    if (!nombre || nombre.trim() === "") {
      errores.push("El nombre del producto es obligatorio.");
    }

    if (isNaN(precioNumero) || precioNumero < 0) {
      errores.push("El precio artesano debe ser un número válido mayor o igual a 0.");
    }

    if (isNaN(existenciaNumero) || existenciaNumero < 0) {
      errores.push("La existencia debe ser un número entero mayor o igual a 0.");
    }

    const artesanos = await prisma.artesano.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });

    const artesanoExiste = !isNaN(artesanoIdNumero)
      ? await prisma.artesano.findUnique({
          where: { id: artesanoIdNumero },
        })
      : null;

    if (artesanoId && !artesanoExiste) {
      errores.push("El artesano seleccionado no existe.");
    }

    if (errores.length > 0) {
      return res.render("productos/new", {
        titulo: "Nuevo producto",
        errores,
        artesanos,
        old: {
          artesanoId,
          nombre,
          descripcion,
          precioBase,
          existencia,
          unidad,
          activo: activo === "on",
        },
      });
    }

    await prisma.producto.create({
      data: {
        artesanoId: artesanoIdNumero,
        nombre: nombre.trim(),
        descripcion: limpiarTexto(descripcion),
        precioBase: convertirPesosACentavos(precioBase),
        existencia: existenciaNumero,
        unidad: unidad && unidad.trim() !== "" ? unidad.trim() : "pieza",
        activo: activo === "on",
      },
    });

    res.redirect(`/productos?artesanoId=${artesanoIdNumero}&ok=Producto creado correctamente`);
  } catch (error) {
    console.error("Error al crear producto:", error);
    res.status(500).send("Error al crear producto");
  }
};

exports.descargarFormatoImportacion = (req, res) => {
  const filas = [
    ["nombre", "descripcion", "precioArtesano", "existencia", "unidad", "activo"],
    ["Camino de mesa bordado", "Algodón bordado a mano", "450.00", "8", "pieza", "si"],
    ["Servilleta bordada", "Paquete con 4 piezas", "280.00", "12", "paquete", "si"],
  ];

  const contenido = filas.map((fila) => fila.map(escaparCsv).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="formato-productos.csv"');
  res.send(contenido);
};

exports.importarProductos = async (req, res) => {
  try {
    const artesanoIdNumero = parseInt(req.body.artesanoId, 10);
    const csvProductos = req.body.csvProductos || "";
    const errores = [];

    if (!req.body.artesanoId || isNaN(artesanoIdNumero)) {
      errores.push("Selecciona un artesano existente.");
    }

    const artesano = !isNaN(artesanoIdNumero)
      ? await prisma.artesano.findUnique({
          where: { id: artesanoIdNumero },
        })
      : null;

    if (req.body.artesanoId && !artesano) {
      errores.push("El artesano seleccionado no existe.");
    }

    if (artesano && !artesano.activo) {
      errores.push("El artesano seleccionado está inactivo.");
    }

    const resultado = parsearProductosCsv(csvProductos);
    errores.push(...resultado.errores);

    if (resultado.productos.length > 100) {
      errores.push("Importa máximo 100 productos por carga.");
    }

    if (errores.length > 0) {
      return res.redirect(`/productos?error=${encodeURIComponent(errores.join(" "))}`);
    }

    await prisma.producto.createMany({
      data: resultado.productos.map((producto) => ({
        ...producto,
        artesanoId: artesanoIdNumero,
      })),
    });

    res.redirect(
      `/productos?artesanoId=${artesanoIdNumero}&ok=${encodeURIComponent(
        `${resultado.productos.length} productos importados correctamente para ${artesano.nombre}`
      )}`
    );
  } catch (error) {
    console.error("Error al importar productos:", error);
    res.redirect("/productos?error=No se pudieron importar los productos");
  }
};

exports.formEditarProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [producto, artesanos] = await Promise.all([
      prisma.producto.findUnique({
        where: { id },
      }),
      prisma.artesano.findMany({
        orderBy: { nombre: "asc" },
      }),
    ]);

    if (!producto) {
      return res.status(404).send("Producto no encontrado");
    }

    res.render("productos/edit", {
      titulo: "Editar producto",
      errores: [],
      artesanos,
      producto: {
        ...producto,
        precioBase: convertirCentavosAPesos(producto.precioBase),
      },
    });
  } catch (error) {
    console.error("Error al cargar formulario de edición del producto:", error);
    res.status(500).send("Error al cargar formulario");
  }
};

exports.actualizarProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { artesanoId, nombre, descripcion, precioBase, existencia, unidad, activo } = req.body;

    const errores = [];

    const artesanoIdNumero = parseInt(artesanoId);
    const existenciaNumero = parseInt(existencia);
    const precioNumero = parseFloat(precioBase);

    if (!artesanoId || isNaN(artesanoIdNumero)) {
      errores.push("Debes seleccionar un artesano.");
    }

    if (!nombre || nombre.trim() === "") {
      errores.push("El nombre del producto es obligatorio.");
    }

    if (isNaN(precioNumero) || precioNumero < 0) {
      errores.push("El precio artesano debe ser un número válido mayor o igual a 0.");
    }

    if (isNaN(existenciaNumero) || existenciaNumero < 0) {
      errores.push("La existencia debe ser un número entero mayor o igual a 0.");
    }

    const [artesanos, artesanoExiste] = await Promise.all([
      prisma.artesano.findMany({
        orderBy: { nombre: "asc" },
      }),
      !isNaN(artesanoIdNumero)
        ? prisma.artesano.findUnique({
            where: { id: artesanoIdNumero },
          })
        : null,
    ]);

    if (artesanoId && !artesanoExiste) {
      errores.push("El artesano seleccionado no existe.");
    }

    if (errores.length > 0) {
      return res.render("productos/edit", {
        titulo: "Editar producto",
        errores,
        artesanos,
        producto: {
          id,
          artesanoId,
          nombre,
          descripcion,
          precioBase,
          existencia,
          unidad,
          activo: activo === "on",
        },
      });
    }

    await prisma.producto.update({
      where: { id },
      data: {
        artesanoId: artesanoIdNumero,
        nombre: nombre.trim(),
        descripcion: limpiarTexto(descripcion),
        precioBase: convertirPesosACentavos(precioBase),
        existencia: existenciaNumero,
        unidad: unidad && unidad.trim() !== "" ? unidad.trim() : "pieza",
        activo: activo === "on",
      },
    });

    res.redirect(`/productos?artesanoId=${artesanoIdNumero}&ok=Producto actualizado correctamente`);
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).send("Error al actualizar producto");
  }
};

exports.cambiarEstadoProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const nuevoEstado = req.body.activo === "true";

    await prisma.producto.update({
      where: { id },
      data: {
        activo: nuevoEstado,
      },
    });

    res.redirect("/productos?ok=Estado del producto actualizado");
  } catch (error) {
    console.error("Error al cambiar estado del producto:", error);
    res.redirect("/productos?error=No se pudo cambiar el estado del producto");
  }
};

exports.eliminarProducto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const producto = await prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      return res.redirect("/productos?error=El producto no existe");
    }

    const usosEnPedidos = await prisma.pedidoDetalle.count({
      where: { productoId: id },
    });

    if (usosEnPedidos > 0) {
      return res.redirect(
        "/productos?error=No se puede eliminar el producto porque ya está usado en pedidos"
      );
    }

    await prisma.producto.delete({
      where: { id },
    });

    res.redirect("/productos?ok=Producto eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.redirect("/productos?error=No se pudo eliminar el producto");
  }
};
