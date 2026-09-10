import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

assert.match(html, /A \/ D OR ARROWS · ENTER TO CHOOSE/, 'desktop Crown Power choices publish their keyboard controls');
assert.match(main, /const selectPerkChoice = \(index, focus = false\) =>[\s\S]*classList\.toggle\('perk-selected'/, 'one shared selector owns the visible Crown Power choice');
assert.match(main, /\['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'\][\s\S]*selectPerkChoice\(selectedPerkChoice - 1, true\)/, 'left-side movement keys navigate Crown Power cards');
assert.match(main, /\['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'\][\s\S]*selectPerkChoice\(selectedPerkChoice \+ 1, true\)/, 'right-side movement keys navigate Crown Power cards');
assert.match(main, /event\.code === 'Enter' \|\| event\.code === 'Space'[\s\S]*cards\[selectedPerkChoice\]\?\.click\(\)/, 'Enter and Space confirm the selected Crown Power');
assert.match(main, /\^Digit\[1-3\]\$/, 'number keys offer a direct three-card shortcut');
assert.match(main, /else if \(!ui\.perkOverlay\.classList\.contains\('hidden'\)\) return;/, 'Escape cannot accidentally open Pause behind a mandatory Crown Power choice');
assert.match(css, /\.perk-card\.perk-selected[\s\S]*var\(--perk-color\)/, 'the keyboard-selected card receives a strong rarity-colored visual state');

console.log('Crown Power keyboard navigation contracts passed');
