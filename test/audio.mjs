import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

class FakeAudio {
  constructor(src = '') {
    this.src = src;
    this.volume = 1;
    this.loop = false;
    this.paused = true;
    this.listeners = {};
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

globalThis.Audio = FakeAudio;
globalThis.requestAnimationFrame = callback => callback();

const { Music } = await import('../src/audio.js');
const music = new Music();

assert.match(music.menuPlayer.src, /menu-theme\.mp3$/, 'the supplied soundtrack is the dedicated menu theme');
assert.equal(music.menuPlayer.loop, true, 'the menu theme loops without entering the game playlist');
music.playMenu();
assert.equal(music.menuPlayer.paused, false, 'menu screens resume the menu theme');
music.playGame();
assert.match(music.gamePlayer.src, /moonshine\.mp3$/, 'a run starts with the existing gameplay playlist');
assert.equal(music.menuPlayer.paused, true, 'the menu theme fades out after entering a run');
music.playMenu();
assert.equal(music.gamePlayer.paused, true, 'the gameplay track fades out after returning to the menu');
assert.equal(music.menuPlayer.paused, false, 'the preserved menu track resumes after a run');

console.log('Menu and gameplay music mode test passed');
