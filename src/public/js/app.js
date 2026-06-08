document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Importación de productos
  // =========================
  const importarForm = document.getElementById("importarProductosForm");
  const importarSelect = document.getElementById("importarArtesanoSelect");
  const importarCsv = document.getElementById("importarProductosCsv");
  const importarPreview = document.getElementById("importarProductosPreview");
  const importarConfirmBtn = document.getElementById("importarProductosConfirmBtn");

  function contarLineasProductos() {
    if (!importarCsv) return 0;

    const lineas = importarCsv.value
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea !== "");

    return Math.max(lineas.length - 1, 0);
  }

  function actualizarPreviewImportacion() {
    if (!importarPreview || !importarSelect || !importarConfirmBtn) return;

    const artesanoNombre = importarSelect.options[importarSelect.selectedIndex]?.text || "";
    const totalProductos = contarLineasProductos();

    if (!importarSelect.value) {
      importarPreview.textContent = "Selecciona un artesano existente para asignarle la carga.";
      importarConfirmBtn.dataset.confirmText =
        "Selecciona un artesano antes de importar productos.";
      return;
    }

    if (totalProductos === 0) {
      importarPreview.textContent = `No hay productos listos para importar a ${artesanoNombre}.`;
      importarConfirmBtn.dataset.confirmText =
        "Agrega al menos una línea de producto debajo del encabezado.";
      return;
    }

    importarPreview.textContent = `${totalProductos} producto${totalProductos === 1 ? "" : "s"} se asignarán a ${artesanoNombre}.`;
    importarConfirmBtn.dataset.confirmText =
      `Se crearán ${totalProductos} producto${totalProductos === 1 ? "" : "s"} para ${artesanoNombre}. Esta acción no se puede deshacer automáticamente.`;
  }

  if (importarForm && importarSelect && importarCsv) {
    actualizarPreviewImportacion();
    importarSelect.addEventListener("change", actualizarPreviewImportacion);
    importarCsv.addEventListener("input", actualizarPreviewImportacion);
  }

  // =========================
  // Confirm modal global
  // =========================
  const confirmModalEl = document.getElementById("confirmActionModal");
  const confirmTitle = document.getElementById("confirmActionTitle");
  const confirmText = document.getElementById("confirmActionText");
  const confirmBtn = document.getElementById("confirmActionBtn");

  let currentForm = null;
  let currentHref = null;

  if (confirmModalEl && confirmBtn) {
    const confirmModal = new bootstrap.Modal(confirmModalEl);

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-confirm-trigger]");
      if (!trigger) return;

      event.preventDefault();

      if (trigger === importarConfirmBtn) {
        actualizarPreviewImportacion();

        if (!importarSelect.value) {
          importarSelect.focus();
          return;
        }

        if (contarLineasProductos() === 0) {
          importarCsv.focus();
          return;
        }
      }

      currentForm = null;
      currentHref = null;

      const title = trigger.dataset.confirmTitle || "Confirmar acción";
      const text = trigger.dataset.confirmText || "¿Deseas continuar?";
      const btnText = trigger.dataset.confirmButton || "Continuar";
      const btnClass = trigger.dataset.confirmClass || "btn-danger";

      confirmTitle.textContent = title;
      confirmText.textContent = text;
      confirmBtn.textContent = btnText;
      confirmBtn.className = `btn ${btnClass}`;

      const form = trigger.closest("form");
      const href = trigger.getAttribute("href");

      if (form) currentForm = form;
      if (href && href !== "#") currentHref = href;

      confirmModal.show();
    });

    confirmBtn.addEventListener("click", () => {
      if (currentForm) {
        currentForm.submit();
        return;
      }

      if (currentHref) {
        window.location.href = currentHref;
      }
    });
  }

  // =========================
  // Toasts
  // =========================
  document.querySelectorAll(".toast.app-toast").forEach((toastEl) => {
    const toast = new bootstrap.Toast(toastEl, {
      delay: 3500,
    });
    toast.show();
  });

  // =========================
  // Tema claro / oscuro
  // =========================
  const root = document.documentElement;
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeToggleLabel = document.getElementById("themeToggleLabel");
  const themeToggleIcon = document.getElementById("themeToggleIcon");

  function applyTheme(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
      if (themeToggleLabel) themeToggleLabel.textContent = "Claro";
      if (themeToggleIcon) themeToggleIcon.textContent = "☀";
    } else {
      root.removeAttribute("data-theme");
      if (themeToggleLabel) themeToggleLabel.textContent = "Oscuro";
      if (themeToggleIcon) themeToggleIcon.textContent = "☾";
    }
  }

  const savedTheme = localStorage.getItem("app-theme") || "light";
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("app-theme", next);
      applyTheme(next);
    });
  }
});
