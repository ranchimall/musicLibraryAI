function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");

  toast.className = `toast ${type} pointer-events-auto`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("opacity-0", "transition-opacity", "duration-300");

    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
