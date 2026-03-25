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

function asegurarArreglo(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor === undefined || valor === null) return [];
  return [valor];
}

function generarFolio() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mi = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");

  return `PED-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function construirOldPedido(body) {
  const productosIds = asegurarArreglo(body.productoId);
  const cantidades = asegurarArreglo(body.cantidad);
  const preciosUnitarios = asegurarArreglo(body.precioUnitario);

  const productos = productosIds.length
    ? productosIds.map((productoId, index) => ({
        productoId: productoId || "",
        cantidad: cantidades[index] || 1,
        precioUnitario: preciosUnitarios[index] || "0.00",
      }))
    : [
        {
          productoId: "",
          cantidad: 1,
          precioUnitario: "0.00",
        },
      ];

  return {
    artesanoId: body.artesanoId || "",
    fechaEntregaEstimada: body.fechaEntregaEstimada || "",
    observaciones: body.observaciones || "",
    productos,
  };
}

async function cargarDatosFormularioPedido() {
  const [artesanos, productos] = await Promise.all([
    prisma.artesano.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.producto.findMany({
      where: { activo: true },
      include: {
        artesano: true,
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const productosFormateados = productos.map((producto) => ({
    ...producto,
    precioBasePesos: convertirCentavosAPesos(producto.precioBase),
  }));

  return { artesanos, productos: productosFormateados };
}

exports.listarPedidos = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const estado = (req.query.estado || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = 10;

    const where = {};

    if (q) {
      where.OR = [
        { folio: { contains: q } },
        { artesano: { nombre: { contains: q } } },
      ];
    }

    if (estado) {
      where.estado = estado;
    }

    const total = await prisma.pedido.count({ where });
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * limit;

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        artesano: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
      skip,
      take: limit,
    });

    const pedidosFormateados = pedidos.map((pedido) => ({
      ...pedido,
      totalPactadoPesos: convertirCentavosAPesos(pedido.totalPactado),
      totalAbonadoPesos: convertirCentavosAPesos(pedido.totalAbonado),
      saldoPendientePesos: convertirCentavosAPesos(pedido.saldoPendiente),
    }));

    const searchParams = new URLSearchParams();
    if (q) searchParams.append("q", q);
    if (estado) searchParams.append("estado", estado);
    const queryString = searchParams.toString() ? `&${searchParams.toString()}` : "";

    res.render("pedidos/index", {
      titulo: "Pedidos",
      pedidos: pedidosFormateados,
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
        baseUrl: "/pedidos",
        queryString,
      },
    });
  } catch (error) {
    console.error("Error al listar pedidos:", error);
    res.status(500).send("Error al listar pedidos");
  }
};

exports.formNuevoPedido = async (req, res) => {
  try {
    const { artesanos, productos } = await cargarDatosFormularioPedido();

    res.render("pedidos/new", {
      titulo: "Nuevo pedido",
      errores: [],
      artesanos,
      productos,
      old: {
        artesanoId: "",
        fechaEntregaEstimada: "",
        observaciones: "",
        productos: [
          {
            productoId: "",
            cantidad: 1,
            precioUnitario: "0.00",
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error al cargar formulario de pedido:", error);
    res.status(500).send("Error al cargar formulario");
  }
};

exports.crearPedido = async (req, res) => {
  try {
    const { artesanoId, fechaEntregaEstimada, observaciones } = req.body;

    const productosIds = asegurarArreglo(req.body.productoId);
    const cantidades = asegurarArreglo(req.body.cantidad);
    const preciosUnitarios = asegurarArreglo(req.body.precioUnitario);

    const errores = [];
    const artesanoIdNumero = parseInt(artesanoId);

    if (!artesanoId || isNaN(artesanoIdNumero)) {
      errores.push("Debes seleccionar un artesano.");
    }

    const artesano = !isNaN(artesanoIdNumero)
      ? await prisma.artesano.findUnique({
          where: { id: artesanoIdNumero },
        })
      : null;

    if (artesanoId && !artesano) {
      errores.push("El artesano seleccionado no existe.");
    }

    if (productosIds.length === 0) {
      errores.push("Debes agregar al menos un producto.");
    }

    const detalles = [];
    let totalPactado = 0;

    for (let i = 0; i < productosIds.length; i++) {
      const productoId = parseInt(productosIds[i]);
      const cantidad = parseInt(cantidades[i]);
      const precioUnitarioTexto = preciosUnitarios[i];

      if (isNaN(productoId)) {
        errores.push(`La fila ${i + 1} no tiene producto válido.`);
        continue;
      }

      if (isNaN(cantidad) || cantidad <= 0) {
        errores.push(`La cantidad de la fila ${i + 1} debe ser mayor a 0.`);
        continue;
      }

      const precioUnitarioNumero = parseFloat(precioUnitarioTexto);
      if (isNaN(precioUnitarioNumero) || precioUnitarioNumero < 0) {
        errores.push(`El precio unitario de la fila ${i + 1} no es válido.`);
        continue;
      }

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        errores.push(`El producto de la fila ${i + 1} no existe.`);
        continue;
      }

      if (producto.artesanoId !== artesanoIdNumero) {
        errores.push(`El producto "${producto.nombre}" no pertenece al artesano seleccionado.`);
        continue;
      }

      const precioUnitarioCentavos = convertirPesosACentavos(precioUnitarioTexto);
      const subtotal = cantidad * precioUnitarioCentavos;

      totalPactado += subtotal;

      detalles.push({
        productoId,
        cantidad,
        precioUnitario: precioUnitarioCentavos,
        subtotal,
      });
    }

    if (detalles.length === 0) {
      errores.push("No hay líneas válidas en el pedido.");
    }

    if (errores.length > 0) {
      const { artesanos, productos } = await cargarDatosFormularioPedido();

      return res.render("pedidos/new", {
        titulo: "Nuevo pedido",
        errores,
        artesanos,
        productos,
        old: construirOldPedido(req.body),
      });
    }

    const folio = generarFolio();

    const pedidoCreado = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          folio,
          artesanoId: artesanoIdNumero,
          fechaEntregaEstimada: fechaEntregaEstimada ? new Date(fechaEntregaEstimada) : null,
          observaciones: limpiarTexto(observaciones),
          totalPactado,
          totalAbonado: 0,
          saldoPendiente: totalPactado,
          detalles: {
            create: detalles,
          },
        },
      });

      await tx.movimiento.create({
        data: {
          pedidoId: pedido.id,
          tipo: "ALTA_PEDIDO",
          descripcion: `Se creó el pedido ${folio}`,
          monto: totalPactado,
        },
      });

      await tx.artesano.update({
        where: { id: artesanoIdNumero },
        data: {
          saldoPendiente: {
            increment: totalPactado,
          },
        },
      });

      return pedido;
    });

    res.redirect(`/pedidos/${pedidoCreado.id}`);
  } catch (error) {
    console.error("Error al crear pedido:", error);
    res.status(500).send("Error al crear pedido");
  }
};

exports.verPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        artesano: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        movimientos: {
          orderBy: {
            fechaMovimiento: "desc",
          },
        },
      },
    });

    if (!pedido) {
      return res.status(404).send("Pedido no encontrado");
    }

    const pedidoFormateado = {
      ...pedido,
      totalPactadoPesos: convertirCentavosAPesos(pedido.totalPactado),
      totalAbonadoPesos: convertirCentavosAPesos(pedido.totalAbonado),
      saldoPendientePesos: convertirCentavosAPesos(pedido.saldoPendiente),
      detalles: pedido.detalles.map((detalle) => ({
        ...detalle,
        precioUnitarioPesos: convertirCentavosAPesos(detalle.precioUnitario),
        subtotalPesos: convertirCentavosAPesos(detalle.subtotal),
      })),
      movimientos: pedido.movimientos.map((movimiento) => ({
        ...movimiento,
        montoPesos: convertirCentavosAPesos(movimiento.monto),
      })),
    };

    res.render("pedidos/show", {
      titulo: `Pedido ${pedido.folio}`,
      pedido: pedidoFormateado,
    });
  } catch (error) {
    console.error("Error al ver pedido:", error);
    res.status(500).send("Error al ver pedido");
  }
};

exports.cambiarEstadoPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { estado } = req.body;

    const estadosValidos = ["PENDIENTE", "EN_PROCESO", "TERMINADO", "ENTREGADO", "CANCELADO"];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).send("Estado no válido");
    }

    const pedidoActual = await prisma.pedido.findUnique({
      where: { id },
    });

    if (!pedidoActual) {
      return res.status(404).send("Pedido no encontrado");
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: { estado },
      });

      await tx.movimiento.create({
        data: {
          pedidoId: id,
          tipo: "CAMBIO_ESTADO",
          descripcion: `El pedido cambió de estado a ${estado}`,
          monto: 0,
        },
      });
    });

    res.redirect(`/pedidos/${id}`);
  } catch (error) {
    console.error("Error al cambiar estado del pedido:", error);
    res.status(500).send("Error al cambiar estado del pedido");
  }
};

exports.registrarMovimientoManual = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tipo, descripcion, monto } = req.body;

    const tiposValidos = ["ABONO", "CARGO", "NOTA"];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).send("Tipo de movimiento no válido");
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        artesano: true,
      },
    });

    if (!pedido) {
      return res.status(404).send("Pedido no encontrado");
    }

    const descripcionLimpia =
      descripcion && descripcion.trim() !== ""
        ? descripcion.trim()
        : `Movimiento manual: ${tipo}`;

    const montoNumero = parseFloat(monto || 0);

    if (tipo !== "NOTA") {
      if (isNaN(montoNumero) || montoNumero <= 0) {
        return res.status(400).send("El monto debe ser mayor a 0");
      }
    }

    const montoCentavos = tipo === "NOTA" ? 0 : convertirPesosACentavos(montoNumero);

    await prisma.$transaction(async (tx) => {
      if (tipo === "ABONO") {
        if (montoCentavos > pedido.saldoPendiente) {
          throw new Error("El abono no puede ser mayor al saldo pendiente del pedido");
        }

        await tx.pedido.update({
          where: { id },
          data: {
            totalAbonado: {
              increment: montoCentavos,
            },
            saldoPendiente: {
              decrement: montoCentavos,
            },
          },
        });

        await tx.artesano.update({
          where: { id: pedido.artesanoId },
          data: {
            saldoPendiente: {
              decrement: montoCentavos,
            },
          },
        });

        await tx.movimiento.create({
          data: {
            pedidoId: id,
            tipo: "ABONO",
            descripcion: descripcionLimpia,
            monto: montoCentavos,
          },
        });
      }

      if (tipo === "CARGO") {
        await tx.pedido.update({
          where: { id },
          data: {
            totalPactado: {
              increment: montoCentavos,
            },
            saldoPendiente: {
              increment: montoCentavos,
            },
          },
        });

        await tx.artesano.update({
          where: { id: pedido.artesanoId },
          data: {
            saldoPendiente: {
              increment: montoCentavos,
            },
          },
        });

        await tx.movimiento.create({
          data: {
            pedidoId: id,
            tipo: "CARGO",
            descripcion: descripcionLimpia,
            monto: montoCentavos,
          },
        });
      }

      if (tipo === "NOTA") {
        await tx.movimiento.create({
          data: {
            pedidoId: id,
            tipo: "NOTA",
            descripcion: descripcionLimpia,
            monto: 0,
          },
        });
      }
    });

    res.redirect(`/pedidos/${id}`);
  } catch (error) {
    console.error("Error al registrar movimiento manual:", error);
    res.status(500).send(error.message || "Error al registrar movimiento");
  }
};
exports.eliminarPedido = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        artesano: true,
      },
    });

    if (!pedido) {
      return res.status(404).send("Pedido no encontrado");
    }

    await prisma.$transaction(async (tx) => {
      // Ajustar saldo del artesano restando el saldo pendiente actual del pedido
      if (Number(pedido.saldoPendiente) > 0) {
        await tx.artesano.update({
          where: { id: pedido.artesanoId },
          data: {
            saldoPendiente: {
              decrement: pedido.saldoPendiente,
            },
          },
        });
      }

      // Eliminar pedido
      // Los detalles y movimientos se eliminan por cascade si tu schema ya está como lo armamos
      await tx.pedido.delete({
        where: { id },
      });
    });

    res.redirect("/pedidos");
  } catch (error) {
    console.error("Error al eliminar pedido:", error);
    res.status(500).send("Error al eliminar pedido");
  }
};