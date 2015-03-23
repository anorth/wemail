console.log('WeMail event page loaded.');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(sender.tab ?
      "Received message from a content script: " + sender.tab.url :
      "Received message from the extension");

  chrome.tabs.create({
    //url: 'http://localhost:8000'
    url: 'https://wemail.firebaseapp.com/'
  }, function(tab) {
    // Send the payload to the wemail page once it is ready to receive messages (i.e. loaded).
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, changedTab) {
      if (tab.id != changedTab.id) return;

      if (changeInfo.status == 'complete') {
        // chrome.tabs.sendMessage speaks to the content script, which in turn talks to the page it wraps.
        chrome.tabs.sendMessage(tab.id, request);
        console.log('Relaying message to wemail content script (tab ' + tab.id + '):', request);
      }
    })
  });

  sendResponse(request);
});