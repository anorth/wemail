console.log('WeMail extension loaded.');

/**
 * @param {JQuery}  messageForm The form element containing hidden field
 *     data for the email message.
 */
function logMessageData(messageForm) {
  var formData = {};
  messageForm.find('input[type=hidden]').each(function() {
    var name = $(this).attr('name');
    var val = $(this).attr('value');

    if (val == '') {
      return;
    }

    // since a given field name can appear multiple times,
    // e.g. 'to' field for multiple recipients.
    formData[name] = (name in formData) ? formData[name].concat(val) : [val];
  });

  console.log('Sending to event page data for email:', formData);
}

// Technique to detect new draft emails per:
// http://developer.streak.com/2012/11/how-to-detect-dom-changes-in-css.html
$('body').bind('animationstart MSAnimationStart webkitAnimationStart', function(event) {
  if (event.originalEvent.animationName == 'nodeInserted') {
    // This is the debug for knowing our listener worked!
    // event.target is the new node!
    console.debug("Another node has been inserted! ", event, event.target);

    var toolbar = $(event.target);

    var draftContainer = toolbar.children().first();
    var sendButton = draftContainer.find('div[role=button]').first();
    var draftButton = sendButton.clone();
    draftButton
      .text('Share Draft')
      .attr('data-tooltip', 'Share Draft')
      .attr('aria-label', 'Share Draft');

    draftButton.on('click', function() {
      var GMAIL_MESSAGE_SELECTOR = '.I5';
      var messageForm = $(this).closest(GMAIL_MESSAGE_SELECTOR).find('form');

      // Gmail stores message metadata as hidden fields within this form.
      logMessageData(messageForm);

      // Background script will be responsible for invoking new wemail page
      chrome.runtime.sendMessage({
        draftId: messageForm.find('input[name=draft]').attr('value'),
        threadId: messageForm.find('input[name=rm]').attr('value')  // empty if new thread
      }, function(response) {
        console.log('Message sent; received response:', response);
      });
    });

    draftButton.insertBefore(sendButton);
  }
});
