const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { createWriteStream } = require("fs");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const prisma = require("../lib/prisma");

const TEMP_DIR = path.join(os.tmpdir(), "app-artesanos-exports");

function timestamp() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mi = String(ahora.getMinutes()).padStart(2, "0");
  const ss = String(ahora.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function convertirCentavosAPesosNumero(valor) {
  return Number((Number(valor || 0) / 100).toFixed(2));
}

function formatFecha(valor) {
  if (!valor) return "";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(valor));
}

function formatFechaHora(valor) {
  if (!valor) return "";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

async function ensureTempDir() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

function applySheetStyle(worksheet) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: worksheet.getRow(1).lastCell.address,
  };

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFF3F4F6" } },
      };
      cell.alignment = { vertical: "middle" };
    });
  });
}

async function writeWorkbookAndDownload(res, workbook, baseName) {
  await ensureTempDir();

  const fileName = `${baseName}-${timestamp()}.xlsx`;
  const filePath = path.join(TEMP_DIR, fileName);

  await workbook.xlsx.writeFile(filePath);

  return res.download(filePath, fileName, async () => {
    try {
      await fs.unlink(filePath);
    } catch (_) {}
  });
}

function resolveSqliteDbPath() {
  const dbUrl = process.env.DATABASE_URL || "";

  if (!dbUrl.startsWith("file:")) {
    return null;
  }

  const rawPath = dbUrl.replace(/^file:/, "");

  if (!rawPath) {
    return null;
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(process.cwd(), rawPath);
}

exports.showExportaciones = async (req, res) => {
  res.render("exportaciones/index", {
    titulo: "Exportaciones",
    mensajeOk: req.query.ok || "",
    mensajeError: req.query.error || "",
  });
};

exports.exportArtesanos = async (req, res) => {
  try {
    const artesanos = await prisma.artesano.findMany({
      orderBy: { nombre: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "App Artesanos";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Artesanos");
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Dirección", key: "direccion", width: 30 },
      { header: "Notas", key: "notas", width: 34 },
      { header: "Saldo pendiente", key: "saldoPendiente", width: 18 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Creado", key: "createdAt", width: 14 },
    ];

    artesanos.forEach((artesano) => {
      sheet.addRow({
        id: artesano.id,
        nombre: artesano.nombre,
        telefono: artesano.telefono || "",
        email: artesano.email || "",
        direccion: artesano.direccion || "",
        notas: artesano.notas || "",
        saldoPendiente: convertirCentavosAPesosNumero(artesano.saldoPendiente),
        estado: artesano.activo ? "Activo" : "Inactivo",
        createdAt: formatFecha(artesano.createdAt),
      });
    });

    sheet.getColumn("saldoPendiente").numFmt = '"$"#,##0.00';
    applySheetStyle(sheet);

    return writeWorkbookAndDownload(res, workbook, "artesanos");
  } catch (error) {
    console.error("Error al exportar artesanos:", error);
    res.status(500).send("No se pudo exportar artesanos");
  }
};

exports.exportProductos = async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      include: { artesano: true },
      orderBy: [{ artesanoId: "asc" }, { nombre: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "App Artesanos";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Productos");
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Artesano", key: "artesano", width: 28 },
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Descripción", key: "descripcion", width: 34 },
      { header: "Precio base", key: "precioBase", width: 16 },
      { header: "Existencia", key: "existencia", width: 12 },
      { header: "Unidad", key: "unidad", width: 14 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Creado", key: "createdAt", width: 14 },
    ];

    productos.forEach((producto) => {
      sheet.addRow({
        id: producto.id,
        artesano: producto.artesano ? producto.artesano.nombre : "",
        nombre: producto.nombre,
        descripcion: producto.descripcion || "",
        precioBase: convertirCentavosAPesosNumero(producto.precioBase),
        existencia: producto.existencia,
        unidad: producto.unidad,
        estado: producto.activo ? "Activo" : "Inactivo",
        createdAt: formatFecha(producto.createdAt),
      });
    });

    sheet.getColumn("precioBase").numFmt = '"$"#,##0.00';
    applySheetStyle(sheet);

    return writeWorkbookAndDownload(res, workbook, "productos");
  } catch (error) {
    console.error("Error al exportar productos:", error);
    res.status(500).send("No se pudo exportar productos");
  }
};

exports.exportPedidos = async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      include: {
        artesano: true,
        detalles: true,
      },
      orderBy: { fechaPedido: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "App Artesanos";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Pedidos");
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Folio", key: "folio", width: 22 },
      { header: "Artesano", key: "artesano", width: 28 },
      { header: "Fecha pedido", key: "fechaPedido", width: 16 },
      { header: "Entrega estimada", key: "fechaEntregaEstimada", width: 16 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Total pactado", key: "totalPactado", width: 16 },
      { header: "Total abonado", key: "totalAbonado", width: 16 },
      { header: "Saldo pendiente", key: "saldoPendiente", width: 16 },
      { header: "Productos", key: "productos", width: 12 },
      { header: "Observaciones", key: "observaciones", width: 36 },
    ];

    pedidos.forEach((pedido) => {
      sheet.addRow({
        id: pedido.id,
        folio: pedido.folio,
        artesano: pedido.artesano ? pedido.artesano.nombre : "",
        fechaPedido: formatFecha(pedido.fechaPedido),
        fechaEntregaEstimada: formatFecha(pedido.fechaEntregaEstimada),
        estado: pedido.estado,
        totalPactado: convertirCentavosAPesosNumero(pedido.totalPactado),
        totalAbonado: convertirCentavosAPesosNumero(pedido.totalAbonado),
        saldoPendiente: convertirCentavosAPesosNumero(pedido.saldoPendiente),
        productos: pedido.detalles.length,
        observaciones: pedido.observaciones || "",
      });
    });

    sheet.getColumn("totalPactado").numFmt = '"$"#,##0.00';
    sheet.getColumn("totalAbonado").numFmt = '"$"#,##0.00';
    sheet.getColumn("saldoPendiente").numFmt = '"$"#,##0.00';
    applySheetStyle(sheet);

    return writeWorkbookAndDownload(res, workbook, "pedidos");
  } catch (error) {
    console.error("Error al exportar pedidos:", error);
    res.status(500).send("No se pudo exportar pedidos");
  }
};

exports.exportMovimientos = async (req, res) => {
  try {
    const movimientos = await prisma.movimiento.findMany({
      include: {
        pedido: {
          include: {
            artesano: true,
          },
        },
      },
      orderBy: { fechaMovimiento: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "App Artesanos";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Movimientos");
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Fecha", key: "fechaMovimiento", width: 20 },
      { header: "Tipo", key: "tipo", width: 18 },
      { header: "Pedido", key: "folio", width: 22 },
      { header: "Artesano", key: "artesano", width: 28 },
      { header: "Descripción", key: "descripcion", width: 40 },
      { header: "Monto", key: "monto", width: 16 },
    ];

    movimientos.forEach((movimiento) => {
      sheet.addRow({
        id: movimiento.id,
        fechaMovimiento: formatFechaHora(movimiento.fechaMovimiento),
        tipo: movimiento.tipo,
        folio: movimiento.pedido ? movimiento.pedido.folio : "",
        artesano:
          movimiento.pedido && movimiento.pedido.artesano
            ? movimiento.pedido.artesano.nombre
            : "",
        descripcion: movimiento.descripcion || "",
        monto: convertirCentavosAPesosNumero(movimiento.monto),
      });
    });

    sheet.getColumn("monto").numFmt = '"$"#,##0.00';
    applySheetStyle(sheet);

    return writeWorkbookAndDownload(res, workbook, "movimientos");
  } catch (error) {
    console.error("Error al exportar movimientos:", error);
    res.status(500).send("No se pudo exportar movimientos");
  }
};

exports.exportSaldos = async (req, res) => {
  try {
    const [artesanos, pedidos] = await Promise.all([
      prisma.artesano.findMany({
        orderBy: { saldoPendiente: "desc" },
      }),
      prisma.pedido.findMany({
        include: { artesano: true },
        orderBy: { saldoPendiente: "desc" },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "App Artesanos";
    workbook.created = new Date();

    const sheetArtesanos = workbook.addWorksheet("Saldos Artesanos");
    sheetArtesanos.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Saldo pendiente", key: "saldoPendiente", width: 18 },
      { header: "Estado", key: "estado", width: 14 },
    ];

    artesanos
      .filter((a) => Number(a.saldoPendiente) > 0)
      .forEach((artesano) => {
        sheetArtesanos.addRow({
          id: artesano.id,
          nombre: artesano.nombre,
          telefono: artesano.telefono || "",
          saldoPendiente: convertirCentavosAPesosNumero(artesano.saldoPendiente),
          estado: artesano.activo ? "Activo" : "Inactivo",
        });
      });

    sheetArtesanos.getColumn("saldoPendiente").numFmt = '"$"#,##0.00';
    applySheetStyle(sheetArtesanos);

    const sheetPedidos = workbook.addWorksheet("Saldos Pedidos");
    sheetPedidos.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Folio", key: "folio", width: 22 },
      { header: "Artesano", key: "artesano", width: 28 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "Total pactado", key: "totalPactado", width: 16 },
      { header: "Total abonado", key: "totalAbonado", width: 16 },
      { header: "Saldo pendiente", key: "saldoPendiente", width: 16 },
    ];

    pedidos
      .filter((p) => Number(p.saldoPendiente) > 0)
      .forEach((pedido) => {
        sheetPedidos.addRow({
          id: pedido.id,
          folio: pedido.folio,
          artesano: pedido.artesano ? pedido.artesano.nombre : "",
          estado: pedido.estado,
          totalPactado: convertirCentavosAPesosNumero(pedido.totalPactado),
          totalAbonado: convertirCentavosAPesosNumero(pedido.totalAbonado),
          saldoPendiente: convertirCentavosAPesosNumero(pedido.saldoPendiente),
        });
      });

    sheetPedidos.getColumn("totalPactado").numFmt = '"$"#,##0.00';
    sheetPedidos.getColumn("totalAbonado").numFmt = '"$"#,##0.00';
    sheetPedidos.getColumn("saldoPendiente").numFmt = '"$"#,##0.00';
    applySheetStyle(sheetPedidos);

    return writeWorkbookAndDownload(res, workbook, "saldos");
  } catch (error) {
    console.error("Error al exportar saldos:", error);
    res.status(500).send("No se pudo exportar saldos");
  }
};

exports.backupDatabase = async (req, res) => {
  try {
    const dbPath = resolveSqliteDbPath();

    if (!dbPath) {
      return res.redirect("/exportaciones?error=No se pudo resolver la ruta de la base de datos");
    }

    await fs.access(dbPath);
    await ensureTempDir();

    const zipName = `respaldo-app-artesanos-${timestamp()}.zip`;
    const zipPath = path.join(TEMP_DIR, zipName);

    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      archive.file(dbPath, {
        name: path.basename(dbPath),
      });

      archive.append(
        JSON.stringify(
          {
            app: "App Artesanos",
            generadoEn: new Date().toISOString(),
            archivoBaseDatos: path.basename(dbPath),
          },
          null,
          2
        ),
        { name: "metadata.json" }
      );

      archive.finalize();
    });

    return res.download(zipPath, zipName, async () => {
      try {
        await fs.unlink(zipPath);
      } catch (_) {}
    });
  } catch (error) {
    console.error("Error al crear respaldo:", error);
    return res.redirect("/exportaciones?error=No se pudo crear el respaldo");
  }
};