/*
 * Content script injected into Mailcoup page.
 * Allows draft from gmail to be populated into the Mailcoup page.
 */

console.log('content_mailcoup.js loaded.');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(
      "Relaying message " +
          (sender.tab ?
          "from a content script:" + sender.tab.url :
          "from the extension") +
          " to Mailcoup page.",
      request);

  // Relay the message to the Mailcoup page (from the content script).
  // TODO(adam): don't broadcast the draft id to every open window.
  window.postMessage(request, '*');
});