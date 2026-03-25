const prisma = require("../lib/prisma");

function convertirCentavosAPesos(valor) {
  return (Number(valor || 0) / 100).toFixed(2);
}

exports.mostrarDashboard = async (req, res) => {
  try {
    const [
      totalArtesanos,
      artesanosActivos,
      totalProductos,
      productosActivos,
      totalPedidos,
      pedidosAbiertos,
      artesanos,
      pedidosRecientes,
      movimientosRecientes,
      pedidosPorEstadoRaw,
    ] = await Promise.all([
      prisma.artesano.count(),
      prisma.artesano.count({ where: { activo: true } }),
      prisma.producto.count(),
      prisma.producto.count({ where: { activo: true } }),
      prisma.pedido.count(),
      prisma.pedido.count({
        where: {
          estado: {
            in: ["PENDIENTE", "EN_PROCESO", "TERMINADO"],
          },
        },
      }),
      prisma.artesano.findMany({
        orderBy: { saldoPendiente: "desc" },
      }),
      prisma.pedido.findMany({
        include: {
          artesano: true,
        },
        orderBy: {
          fechaPedido: "desc",
        },
        take: 5,
      }),
      prisma.movimiento.findMany({
        include: {
          pedido: {
            include: {
              artesano: true,
            },
          },
        },
        orderBy: {
          fechaMovimiento: "desc",
        },
        take: 10,
      }),
      prisma.pedido.groupBy({
        by: ["estado"],
        _count: {
          estado: true,
        },
      }),
    ]);

    const saldoTotalArtesanos = artesanos.reduce(
      (acc, artesano) => acc + Number(artesano.saldoPendiente || 0),
      0
    );

    const artesanosConSaldo = artesanos
      .filter((artesano) => Number(artesano.saldoPendiente) > 0)
      .slice(0, 5)
      .map((artesano) => ({
        ...artesano,
        saldoPendientePesos: convertirCentavosAPesos(artesano.saldoPendiente),
      }));

    const pedidosRecientesFormateados = pedidosRecientes.map((pedido) => ({
      ...pedido,
      totalPactadoPesos: convertirCentavosAPesos(pedido.totalPactado),
      saldoPendientePesos: convertirCentavosAPesos(pedido.saldoPendiente),
    }));

    const movimientosRecientesFormateados = movimientosRecientes.map((movimiento) => ({
      ...movimiento,
      montoPesos: convertirCentavosAPesos(movimiento.monto),
    }));

    const pedidosPorEstado = {
      PENDIENTE: 0,
      EN_PROCESO: 0,
      TERMINADO: 0,
      ENTREGADO: 0,
      CANCELADO: 0,
    };

    pedidosPorEstadoRaw.forEach((item) => {
      pedidosPorEstado[item.estado] = item._count.estado;
    });

    res.render("dashboard/index", {
      titulo: "Dashboard",
      resumen: {
        totalArtesanos,
        artesanosActivos,
        totalProductos,
        productosActivos,
        totalPedidos,
        pedidosAbiertos,
        saldoTotalArtesanosPesos: convertirCentavosAPesos(saldoTotalArtesanos),
      },
      pedidosPorEstado,
      artesanosConSaldo,
      pedidosRecientes: pedidosRecientesFormateados,
      movimientosRecientes: movimientosRecientesFormateados,
    });
  } catch (error) {
    console.error("Error al cargar dashboard:", error);
    res.status(500).send("Error al cargar dashboard");
  }
};

exports.mostrarReportes = async (req, res) => {
  try {
    const tipo = (req.query.tipo || "").trim();
    const fechaInicio = (req.query.fechaInicio || "").trim();
    const fechaFin = (req.query.fechaFin || "").trim();

    const whereMovimientos = {};

    if (tipo) {
      whereMovimientos.tipo = tipo;
    }

    if (fechaInicio || fechaFin) {
      whereMovimientos.fechaMovimiento = {};
      if (fechaInicio) {
        whereMovimientos.fechaMovimiento.gte = new Date(`${fechaInicio}T00:00:00`);
      }
      if (fechaFin) {
        whereMovimientos.fechaMovimiento.lte = new Date(`${fechaFin}T23:59:59`);
      }
    }

    const [artesanos, pedidos, movimientos] = await Promise.all([
      prisma.artesano.findMany({
        orderBy: { saldoPendiente: "desc" },
      }),
      prisma.pedido.findMany({
        include: {
          artesano: true,
        },
        orderBy: {
          saldoPendiente: "desc",
        },
      }),
      prisma.movimiento.findMany({
        where: whereMovimientos,
        include: {
          pedido: {
            include: {
              artesano: true,
            },
          },
        },
        orderBy: {
          fechaMovimiento: "desc",
        },
        take: 50,
      }),
    ]);

    const artesanosConSaldo = artesanos
      .filter((artesano) => Number(artesano.saldoPendiente) > 0)
      .map((artesano) => ({
        ...artesano,
        saldoPendientePesos: convertirCentavosAPesos(artesano.saldoPendiente),
      }));

    const pedidosConSaldo = pedidos
      .filter((pedido) => Number(pedido.saldoPendiente) > 0)
      .map((pedido) => ({
        ...pedido,
        totalPactadoPesos: convertirCentavosAPesos(pedido.totalPactado),
        totalAbonadoPesos: convertirCentavosAPesos(pedido.totalAbonado),
        saldoPendientePesos: convertirCentavosAPesos(pedido.saldoPendiente),
      }));

    const movimientosFormateados = movimientos.map((movimiento) => ({
      ...movimiento,
      montoPesos: convertirCentavosAPesos(movimiento.monto),
    }));

    res.render("reportes/index", {
      titulo: "Reportes",
      artesanosConSaldo,
      pedidosConSaldo,
      movimientos: movimientosFormateados,
      filtros: {
        tipo,
        fechaInicio,
        fechaFin,
      },
    });
  } catch (error) {
    console.error("Error al cargar reportes:", error);
    res.status(500).send("Error al cargar reportes");
  }
};