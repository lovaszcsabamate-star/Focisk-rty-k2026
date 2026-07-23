/** Kommentárbuborékok és opcionális hangvisszajelzés. */

import { ART, el, tryArt } from './dom.js';

export class FeedbackView {
  constructor(dom) {
    this.dom = dom;
    this.audioContext = null;
  }

  say(line) {
    const bubble = el('div', 'bubble');
    const avatar = el('div', 'avatar', line.speaker.name[0]);
    avatar.style.background = line.speaker.colour;
    tryArt(avatar, ART.friend(line.speaker.id));
    const body = el('div', 'bubble__body');
    const name = el('div', 'bubble__name', line.speaker.name);
    name.style.color = line.speaker.colour;
    body.append(name, el('div', 'bubble__text', line.text));
    bubble.append(avatar, body);
    this.dom.feed.appendChild(bubble);
    this.dom.feed.scrollTop = this.dom.feed.scrollHeight;
    while (this.dom.feed.children.length > 40) this.dom.feed.firstChild.remove();
  }

  playSound(kind) {
    try {
      this.audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const context = this.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequencies = { win: 520, loss: 160, tie: 280, sudden: 110 };
      oscillator.frequency.value = frequencies[kind] ?? 320;
      oscillator.type = kind === 'sudden' ? 'sawtooth' : 'triangle';
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === 'sudden' ? 0.55 : 0.22));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === 'sudden' ? 0.6 : 0.25));
    } catch {
      // A blokkolt böngészőhang nem akadályozhatja a játékot.
    }
  }
}
