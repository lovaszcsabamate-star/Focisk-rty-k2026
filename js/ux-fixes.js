import { UI } from './ui.js';
import { ATTRIBUTE_BY_KEY, calculateAge } from './data/players.js';

const birthDateAttribute = ATTRIBUTE_BY_KEY.birthDate;
if (birthDateAttribute) {
  birthDateAttribute.format = (_value, card) => {
    const storedAge = card?.stats?.age;
    const age = typeof storedAge === 'number' && Number.isFinite(storedAge)
      ? storedAge
      : calculateAge(card?.birthDate);
    return typeof age === 'number' && Number.isFinite(age)
      ? `${Math.round(age)} év`
      : 'Nincs adat';
  };
}

const originalRenderInspector = UI.prototype._renderInspector;
UI.prototype._renderInspector = function renderInspectorWithoutMissingDetails() {
  originalRenderInspector.call(this);
  const details = document.querySelector('#inspector .inspector__details');
  if (!details) return;
  details.querySelectorAll('span').forEach(row => {
    if (row.textContent.includes('Nincs adat')) row.remove();
  });
  if (!details.children.length) details.remove();
};
