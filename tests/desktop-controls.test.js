const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadControls(desktop) {
  const nodes = Object.fromEntries(['always-on-top', 'always-on-top-option', 'about', 'about-dialog'].map(id => [id, {
    hidden: id === 'always-on-top-option', checked: false, open: false, listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    showModal() { this.open = true; },
  }]));
  const bridge = {
    sent: [], listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    postMessage(message) { this.sent.push(message); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop-controls.js'), 'utf8'), {
    document: { getElementById: id => nodes[id] },
    chrome: desktop ? { webview: bridge } : undefined,
  });
  return { nodes, bridge };
}

test('desktop controls synchronize host state and send checkbox changes', () => {
  const { nodes, bridge } = loadControls(true);
  assert.equal(bridge.sent[0], 'desktop-ready');
  assert.equal(nodes['always-on-top-option'].hidden, true);
  bridge.listeners.message({ data: 'always-on-top:on' });
  assert.equal(nodes['always-on-top-option'].hidden, false);
  assert.equal(nodes['always-on-top'].checked, true);
  for (const checked of [false, true]) {
    nodes['always-on-top'].checked = checked;
    nodes['always-on-top'].listeners.change();
    assert.equal(bridge.sent.at(-1), checked ? 'always-on-top:on' : 'always-on-top:off');
  }
  bridge.listeners.message({ data: 'always-on-top:off' });
  assert.equal(nodes['always-on-top'].checked, false);
  nodes.about.listeners.click();
  assert.equal(nodes['about-dialog'].open, true);
});

test('About works in a normal browser without showing unsupported window controls', () => {
  const { nodes } = loadControls(false);
  assert.equal(nodes['always-on-top-option'].hidden, true);
  nodes.about.listeners.click();
  assert.equal(nodes['about-dialog'].open, true);
});
