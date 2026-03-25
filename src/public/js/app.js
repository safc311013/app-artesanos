document.addEventListener("DOMContentLoaded", () => {
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