'use strict';

const desktopBridge = globalThis.chrome?.webview;
const topmostCheckbox = document.getElementById('always-on-top');

if (desktopBridge) {
  desktopBridge.addEventListener('message', event => {
    if (!['always-on-top:on', 'always-on-top:off'].includes(event.data)) return;
    document.getElementById('always-on-top-option').hidden = false;
    topmostCheckbox.checked = event.data === 'always-on-top:on';
  });
  topmostCheckbox.addEventListener('change', () => {
    desktopBridge.postMessage(topmostCheckbox.checked ? 'always-on-top:on' : 'always-on-top:off');
  });
  // Ask the host for its current state, including after a page reload.
  desktopBridge.postMessage('desktop-ready');
}

document.getElementById('about').addEventListener('click', () => {
  document.getElementById('about-dialog').showModal();
});
