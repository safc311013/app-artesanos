const prisma = require("../lib/prisma");

function convertirPesosACentavos(valor) {
  const numero = parseFloat(valor || 0);
  return Math.round(numero * 100);
}

function convertirCentavosAPesos(valor) {
  return (valor / 100).toFixed(2);
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

exports.listarArtesanos = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const estado = (req.query.estado || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = 10;

    const where = {};

    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { telefono: { contains: q } },
        { email: { contains: q } },
      ];
    }

    if (estado === "activos") {
      where.activo = true;
    }

    if (estado === "inactivos") {
      where.activo = false;
    }

    const total = await prisma.artesano.count({ where });
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * limit;

    const artesanos = await prisma.artesano.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    });

    const artesanosFormateados = artesanos.map((artesano) => ({
      ...artesano,
      saldoPendientePesos: convertirCentavosAPesos(artesano.saldoPendiente),
    }));

    res.render("artesanos/index", {
      titulo: "Artesanos",
      artesanos: artesanosFormateados,
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
        baseUrl: "/artesanos",
        queryString: buildQueryString({ q, estado }),
      },
    });
  } catch (error) {
    console.error("Error al listar artesanos:", error);
    res.status(500).send("Error al listar artesanos");
  }
};

exports.formNuevoArtesano = (req, res) => {
  res.render("artesanos/new", {
    titulo: "Nuevo artesano",
    errores: [],
    old: {
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
      notas: "",
      saldoPendiente: "0.00",
      activo: true,
    },
  });
};

exports.crearArtesano = async (req, res) => {
  try {
    const { nombre, telefono, email, direccion, notas, saldoPendiente, activo } = req.body;
    const errores = [];

    if (!nombre || nombre.trim() === "") {
      errores.push("El nombre es obligatorio.");
    }

    const saldoNumero = parseFloat(saldoPendiente || 0);
    if (isNaN(saldoNumero) || saldoNumero < 0) {
      errores.push("El saldo pendiente debe ser un número válido mayor o igual a 0.");
    }

    if (errores.length > 0) {
      return res.render("artesanos/new", {
        titulo: "Nuevo artesano",
        errores,
        old: {
          nombre,
          telefono,
          email,
          direccion,
          notas,
          saldoPendiente,
          activo: activo === "on",
        },
      });
    }

    await prisma.artesano.create({
      data: {
        nombre: nombre.trim(),
        telefono: limpiarTexto(telefono),
        email: limpiarTexto(email),
        direccion: limpiarTexto(direccion),
        notas: limpiarTexto(notas),
        saldoPendiente: convertirPesosACentavos(saldoPendiente),
        activo: activo === "on",
      },
    });

    res.redirect("/artesanos?ok=Artesano creado correctamente");
  } catch (error) {
    console.error("Error al crear artesano:", error);
    res.status(500).send("Error al crear artesano");
  }
};

exports.formEditarArtesano = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const artesano = await prisma.artesano.findUnique({
      where: { id },
    });

    if (!artesano) {
      return res.status(404).send("Artesano no encontrado");
    }

    res.render("artesanos/edit", {
      titulo: "Editar artesano",
      errores: [],
      artesano: {
        ...artesano,
        saldoPendiente: convertirCentavosAPesos(artesano.saldoPendiente),
      },
    });
  } catch (error) {
    console.error("Error al mostrar formulario de edición:", error);
    res.status(500).send("Error al cargar el formulario");
  }
};

exports.actualizarArtesano = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, telefono, email, direccion, notas, saldoPendiente, activo } = req.body;
    const errores = [];

    if (!nombre || nombre.trim() === "") {
      errores.push("El nombre es obligatorio.");
    }

    const saldoNumero = parseFloat(saldoPendiente || 0);
    if (isNaN(saldoNumero) || saldoNumero < 0) {
      errores.push("El saldo pendiente debe ser un número válido mayor o igual a 0.");
    }

    if (errores.length > 0) {
      return res.render("artesanos/edit", {
        titulo: "Editar artesano",
        errores,
        artesano: {
          id,
          nombre,
          telefono,
          email,
          direccion,
          notas,
          saldoPendiente,
          activo: activo === "on",
        },
      });
    }

    await prisma.artesano.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        telefono: limpiarTexto(telefono),
        email: limpiarTexto(email),
        direccion: limpiarTexto(direccion),
        notas: limpiarTexto(notas),
        saldoPendiente: convertirPesosACentavos(saldoPendiente),
        activo: activo === "on",
      },
    });

    res.redirect("/artesanos?ok=Artesano actualizado correctamente");
  } catch (error) {
    console.error("Error al actualizar artesano:", error);
    res.status(500).send("Error al actualizar artesano");
  }
};

exports.cambiarEstadoArtesano = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const nuevoEstado = req.body.activo === "true";

    await prisma.artesano.update({
      where: { id },
      data: {
        activo: nuevoEstado,
      },
    });

    res.redirect("/artesanos?ok=Estado del artesano actualizado");
  } catch (error) {
    console.error("Error al cambiar estado del artesano:", error);
    res.redirect("/artesanos?error=No se pudo cambiar el estado del artesano");
  }
};

exports.eliminarArtesano = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const artesano = await prisma.artesano.findUnique({
      where: { id },
    });

    if (!artesano) {
      return res.redirect("/artesanos?error=El artesano no existe");
    }

    await prisma.artesano.delete({
      where: { id },
    });

    res.redirect("/artesanos?ok=Artesano eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar artesano:", error);
    res.redirect("/artesanos?error=No se pudo eliminar el artesano");
  }
};