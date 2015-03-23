/*
 * Content script injected into wemail page.
 * Allows draft from gmail to be populated into the wemail page.
 */

console.log('content_wemail.js loaded.');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(
      "Relaying message " +
          (sender.tab ?
          "from a content script:" + sender.tab.url :
          "from the extension") +
          " to wemail page.",
      request);

  // Relay the message to the wemail page (from the content script).
  // TODO(adam): don't broadcast the draft id to every open window.
  window.postMessage(request, '*');
});