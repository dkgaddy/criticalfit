// ============================================================
// Critical Fit — System Menu (DM only)
// ============================================================

async function loadSystemMenu() {
  try {
    const r = await fetch('api/user.php');
    const j = await r.json();
    if (!j.ok || !j.data?.isDm) throw new Error('forbidden');
  } catch (e) {
    document.querySelector('.journal-page').innerHTML =
      '<div class="card" style="text-align:center;padding:2rem;"><i class="fa-solid fa-lock" style="font-size:2rem;margin-bottom:1rem;"></i><p>Access restricted to the Dungeon Master.</p><a href="index.html" class="btn btn-primary" style="margin-top:1rem;">Back to Journal</a></div>';
  }
}

document.addEventListener('DOMContentLoaded', loadSystemMenu);
