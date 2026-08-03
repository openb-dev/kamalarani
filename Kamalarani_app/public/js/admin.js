// Admin JS — sidebar toggle + flash auto-dismiss

// Sidebar toggle (mobile)
const sidebarToggle  = document.getElementById('sidebarToggle');
const adminSidebar   = document.getElementById('adminSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (sidebarToggle && adminSidebar) {
  sidebarToggle.addEventListener('click', () => {
    adminSidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });
}
if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    adminSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
}

// Auto-dismiss flash bars
document.querySelectorAll('.flash-bar').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 400);
  }, 5000);
});
