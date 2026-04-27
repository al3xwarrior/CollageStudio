export function setupTabs(tabButtons, tabPanels) {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tabTarget, tabButtons, tabPanels));
  });
}

function activateTab(targetPanelId, tabButtons, tabPanels) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetPanelId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.id === targetPanelId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
}
