console.log('Mailcoup event page loaded.');

var LISTENERS = {};  // map from {String} tab id to {Function} listener.

function createTabUpdatedListener(originalTabId, request) {
  if (originalTabId in LISTENERS) {
    return LISTENERS[originalTabId];
  }

  LISTENERS[originalTabId] = function(changedTabId, changeInfo, changedTab) {
    if (originalTabId != changedTabId) return;

    if (changeInfo.status == 'complete') {
      // only listen once per tab, since 'complete'->'loading'->'complete' is possible.
      chrome.tabs.onUpdated.removeListener(LISTENERS[originalTabId]);

      // chrome.tabs.sendMessage speaks to the content script, which in turn talks to the page it wraps.
      chrome.tabs.sendMessage(changedTabId, request);
      console.log('Relaying message to Mailcoup content script (tab ' + changedTabId + '):', request);
    }
  };
  return LISTENERS[originalTabId];
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(sender.tab ?
      "Received message from a content script: " + sender.tab.url :
      "Received message from the extension");

  chrome.tabs.create({
    //url: 'http://localhost:8000/draft/#new'
    //url: 'http://localhost:63343/wemail/draft/#new'
    url: 'http://mailcoup.com/draft/#new'  // TODO: point to https once functional
  }, function(tab) {
    // Send the payload to the Mailcoup page once it is ready to receive messages (i.e. loaded).
    var listener = createTabUpdatedListener(tab.id, request);
    if (!chrome.tabs.onUpdated.hasListener(listener)) {
      chrome.tabs.onUpdated.addListener(listener);
    }
  });

  sendResponse(request);
});
