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
      errores.push("El precio base debe ser un número válido mayor o igual a 0.");
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
      errores.push("El precio base debe ser un número válido mayor o igual a 0.");
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