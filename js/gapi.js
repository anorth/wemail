/*
 * Google API-related code, e.g. to invoke the GMail api.
 */
(function() {

  window.gmail = {
    /**
     * Sends an email invite to a collaborator to join the draft.
     *
     * @param  {Object} googleAuth The google object from Firebase authData, per
     *     https://www.firebase.com/docs/web/guide/login/google.html.
     * @param  {String} toEmail The intended recipient of the email.
     * @param  {String} padId The id of the draft pad.
     * @param  {Function} onSuccess Function to call on success, with response.
     * @param  {Function} onFailure Function to call on failure, with reason.
     */
    sendInvite: function (googleAuth, toEmail, padId, onSuccess, onFailure) {
      var body =
          'Hi - Could you help me drafting an email.\n' +
          'Can you please take a look at https://wemail.firebaseapp.com/#' + padId + ' ?\n' +
          '\n' +
          'Thanks!';

      this.sendSimpleEmail(googleAuth, toEmail, 'Please review my draft', body, onSuccess, onFailure);
    },

    /**
     * Sends a plaint-text email to a single recipient.
     *
     * The message is marked read and archived.
     *
     * @param  {Object} googleAuth The google object from Firebase authData, per
     *     https://www.firebase.com/docs/web/guide/login/google.html.
     * @param  {String} toEmail The intended recipient of the email.
     * @param  {String} subject The subject of the email.
     * @param  {String} body The body of the email.
     * @param  {Function} onSuccess Function to call on success, with response.
     * @param  {Function} onFailure Function to call on failure, with reason.
     */
    sendSimpleEmail: function (googleAuth, toEmail, subject, body, onSuccess, onFailure) {
      console.log("Sending plain email to " + toEmail + ', subject: "' + subject + '"');
      var headerLines = [
        'To: ' + toEmail,
        'From: ' + formatFromGoogle(googleAuth),
        'Subject: ' + subject
      ];
      return sendEmailRequest(googleAuth.accessToken, headerLines, body, onSuccess, onFailure);
    },

    /**
     * Sends an email. The message is marked read and archived.
     *
     * @param  {Object} googleAuth The google object from Firebase authData, per
     *     https://www.firebase.com/docs/web/guide/login/google.html.
     * @param {Array} toRecipients email addresses for the "To" line
     * @param {Array} ccRecipients email addresses for the "Cc" line
     * @param {Array} bccRecipients email addresses for the "Bcc" line
     * @param {String} subject The subject of the email.
     * @param {String} bodyHtml The body of the email.
     * @param {Function} onSuccess Function to call on success, with response.
     * @param {Function} onFailure Function to call on failure, with reason.
     */
    sendHtmlEmail: function (googleAuth, toRecipients, ccRecipients, bccRecipients,
        subject, bodyHtml, onSuccess, onFailure) {
      console.log("Sending HTML email to " + toRecipients.join(', ') + ', subject: "' + subject + '"');
      var headerLines = [
        'From: ' + formatFromGoogle(googleAuth),
        'Subject: ' + subject,
        'Content-Type: text/html; charset=UTF-8'
      ];
      _.forEach(toRecipients, function(r) {headerLines.push('to: ' + r)});
      _.forEach(ccRecipients, function(r) {headerLines.push('cc: ' + r)});
      _.forEach(bccRecipients, function(r) {headerLines.push('bcc: ' + r)});
      return sendEmailRequest(googleAuth.accessToken, headerLines, bodyHtml, onSuccess, onFailure);
    },

    /**
     * Gets the specified draft from the Google REST API.
     *
     * @param {String} accessToken
     * @param {String} draftId Id of the draft to retrieve, as a hex string.
     * @param {Function} onSuccess Function to call on success, with:
     *     @param {Object} headers Map of headers, e.g. headers['Subject'] = 'I quit'
     *     @param {String} bodyHtml HTML extracted representing the body of the draft.
     * @param {Function} onFailure Function to call on failure, with reason.
     */
    getDraft: function(accessToken, draftId, onSuccess, onFailure) {
      console.log("Retrieving draft message for id:", draftId);

      // NOTE(adam): users.drafts.get is flakey, so using users.messages.get instead.
      return gapiRequest(accessToken, 'GET', 'messages/' + draftId).then(function(response) {
        console.log('Gmail messages.get received: ', response.result);
        onSuccess(getDraftHeaders(response.result), getDraftBodyHtml(response.result));
      }, function(reason) {
        console.error("Gmail messages.get failed", reason.result.error.message);
        onFailure(reason);
      });
    }
  };

  ///// Helpers /////

  /**
   * Makes an email send request with the Google REST API.
   *
   * TODO(adam): rather use the JS lib, if you can figure out how to get auth working
   * https://developers.google.com/gmail/api/v1/reference/users/messages/send#examples

   * @param {String} accessToken
   * @param {String[]} headerLines lines of the form "Header: value"
   * @param {String} body message body
   * @param {Function} onSuccess Function to call on success, with response.
   * @param {Function} onFailure Function to call on failure, with reason.
   */
  function sendEmailRequest(accessToken, headerLines, body, onSuccess, onFailure) {
    // NOTE(adam): to make this work, Gmail API needed to be enabled within the developer console:
    // https://console.developers.google.com/project/wemail-dev/apiui/apiview/gmail/usage
    // TODO(adam): if not using gapi more extensively, don't include google's JS,
    // use another lib for XHR.
    console.log("Sending email", headerLines, body);
    return gapiRequest(accessToken, 'POST', 'messages/send', {
      'raw': utf8ToB64(headerLines.join('\n') + '\n\n' + body)
    }).then(function(response) {
      console.log("GMail send succeeded", response);
      var msgId = response.result.id;
      gapiRequest(accessToken, 'POST', 'messages/'+ msgId + '/modify', {
        removeLabelIds: ['INBOX', 'UNREAD']
      }).then(function(archiveResponse) {
        console.log("Marked read and archived", archiveResponse)
      }, function(archiveReason) {
        console.log("Failed to read and archive", archiveReason)
      });
      onSuccess(response);
    }, function(reason) {
      console.error("GMail send failed", reason.result.error.message);
      onFailure(reason);
    });
  }

  /**
   * Sends an authenticated request to the GMail API.
   *
   * @param {String} accessToken
   * @param {String} method HTTP method
   * @param {String} path URL path relative to gmail/v1/users/me
   * @param {Object=} body optional request body JSON
   */
  function gapiRequest(accessToken, method, path, body) {
    return gapi.client.request({
      path: 'https://www.googleapis.com/gmail/v1/users/me/' + path,
      method: method,
      params: {'access_token': accessToken},
      body: body
    });
  }

  function formatFromGoogle(googleAuth) {
    return googleAuth.displayName + ' <' + googleAuth.email + '>';
  }

  // See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
  function utf8ToB64( str ) {
    return base64.encode(unescape(encodeURIComponent( str )));
  }

  function b64ToUtf8( str ) {
    return decodeURIComponent(escape(base64.decode( str )));
  }

  /**
   * Extracts a map of email headers from the supplied Gmail message.
   *
   * @param {https://developers.google.com/gmail/api/v1/reference/users/messages#resource} message
   * @returns {Object} Map of header name ({String}) to header value ({String}).
   */
  function getDraftHeaders(message) {
    var result = {};
    _.each(message.payload.headers, function(header) {
      result[header.name] = header.value;
    });
    return result;
  }

  /**
   * Extracts the HTML text for the body from the supplied Gmail message.
   *
   * @param {https://developers.google.com/gmail/api/v1/reference/users/messages#resource} message
   * @returns {String} HTML body of the email.
   */
  function getDraftBodyHtml(message) {
    // HACK(adam): can't assume 'text/html' exists and is the 2nd part.
    return b64ToUtf8(message.payload.parts[1].body.data);
  }
})();



