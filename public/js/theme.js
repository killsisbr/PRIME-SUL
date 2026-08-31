/**
 * PRIME SUL — Theme Switcher
 * Padrão: 'prime' (Azul Prime / BB)
 */

const THEMES = [
    { id: 'prime', name: 'Azul Prime', icon: 'fa-building-columns', color: '#2563eb' },
    { id: 'green', name: 'Verdinho WA', icon: 'fa-whatsapp', color: '#10b981' },
    { id: 'gold', name: 'Dourado BB', icon: 'fa-coins', color: '#ffb800' }
];

function getSavedTheme() {
    const saved = localStorage.getItem('prime_sul_theme');
    if (!saved || saved === 'light' || saved === 'orange') return 'prime';
    return saved;
}

function applyTheme(themeId) {
    const valid = THEMES.find(t => t.id === themeId) ? themeId : 'prime';
    document.documentElement.setAttribute('data-theme', valid);
    localStorage.setItem('prime_sul_theme', valid);
    updateThemeButtonUI(valid);
}

function cycleTheme() {
    const current = getSavedTheme();
    const idx = THEMES.findIndex(t => t.id === current);
    const nextIdx = (idx + 1) % THEMES.length;
    const nextTheme = THEMES[nextIdx].id;
    applyTheme(nextTheme);
    if (window.toast) {
        window.toast(`Tema alterado para: ${THEMES[nextIdx].name}`, 'ok');
    }
}

function updateThemeButtonUI(themeId) {
    const info = THEMES.find(t => t.id === themeId) || THEMES[0];
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.innerHTML = `<i class="fab ${info.icon.startsWith('fa-') ? info.icon : 'fa-whatsapp'}" style="color:${info.color};"></i> <span>${info.name}</span>`;
        btn.setAttribute('title', `Tema atual: ${info.name}. Clique para alternar.`);
    }
}

// Aplica imediatamente
applyTheme(getSavedTheme());

document.addEventListener('DOMContentLoaded', () => {
    updateThemeButtonUI(getSavedTheme());
});

window.setTheme = applyTheme;
window.cycleTheme = cycleTheme;
