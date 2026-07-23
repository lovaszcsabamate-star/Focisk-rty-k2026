/** Közös DOM- és képernyőgrafikai primitívek a vizuális komponensekhez. */

const UI_ART_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const withUiArtExtensions = base => UI_ART_EXTENSIONS.map(extension => `${base}.${extension}`);

export const ART = Object.freeze({
  portrait: id => withUiArtExtensions(`assets/portraits/${id}`),
  cardBack: () => withUiArtExtensions('assets/cards/back'),
  friend: id => withUiArtExtensions(`assets/friends/${id}`),
  pub: () => withUiArtExtensions('assets/pub/background'),
});

export const PUB_SCRIM = 'linear-gradient(rgba(18,11,5,.36), rgba(18,11,5,.64))';

export const $ = selector => document.querySelector(selector);

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function tryArt(node, candidates, loadedClass = 'has-art', overlay = null) {
  const urls = Array.isArray(candidates) ? candidates : [candidates];
  const attempt = index => {
    if (index >= urls.length) return;
    const probe = new Image();
    probe.onload = () => {
      node.style.backgroundImage = overlay ? `${overlay}, url("${urls[index]}")` : `url("${urls[index]}")`;
      node.classList.add(loadedClass);
    };
    probe.onerror = () => attempt(index + 1);
    probe.src = urls[index];
  };
  attempt(0);
}

export const initials = name => String(name ?? '')
  .split(' ')
  .filter(Boolean)
  .map(word => word[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

export const finiteDetail = value => (
  typeof value === 'number' && Number.isFinite(value) ? String(value) : null
);
