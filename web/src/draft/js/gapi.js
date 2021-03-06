/*
 * Google API-related code, e.g. to invoke the GMail api.
 */
(function() {
  /**
   * Client id for authorization; per google admin console.
   */
  var CLIENT_ID = '638270974877-c2ss7kkkofab78g9cirjdm5ubgpfoegv.apps.googleusercontent.com';

  /**
   * Permissions requested from the gapi.
   */
  var SCOPE = [
    'email',
    'https://www.googleapis.com/auth/gmail.compose',  // to send email
  ].join(' ');

  window.gmail = {
    /**
     * Signs the user in to Google for this application.
     *
     * @param  {Function} callback Called on auth, takes an OAuth 2.0 token object as param.
     */
    authorize: function(callback) {
      // NOTE(adam): google access_token can expire if page is left open for >1hr;
      // this is not a problem if the page is reloaded in the interim.
      gapi.auth.authorize({
        client_id: CLIENT_ID,
        immediate: false,
        scope: SCOPE,
        cookie_policy: 'single_host_origin'
      }, callback);
    },

    /**
     * Checks if the user is already signed in to Google for this application.
     *
     * @param  {Function} callback Called on auth, takes an OAuth 2.0 token object as param.
     */
    checkAuth: function(callback) {
      gapi.auth.authorize({
        client_id: CLIENT_ID,
        immediate: true,
        scope: SCOPE,
        cookie_policy: 'single_host_origin'
      }, callback);
    },

    /**
     * For non-interactive sign-in, provide a URL to sign in to Google and
     * redirect back to the draft page.
     *
     * @param  {String} redirectUri The URI to redirect to after Google auth.
     */
    getSignInUrl: function(redirectUri) {
      return 'https://accounts.google.com/o/oauth2/auth?' +
        'response_type=token&' +
        'redirect_uri=' + redirectUri + '&' +
        'scope=' + SCOPE.replace(/ /g, '+') + '&' +
        'client_id=' + CLIENT_ID;
    },

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
    sendInvite: function(googleAuth, toEmail, padId, token, onSuccess, onFailure) {
      var body =
          'Hi - I need help drafting an email.\n' +
          'Can you please take a look at http://mailcoup.com/draft?token=' + token + '#' + padId + ' ?\n' +
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
    sendSimpleEmail: function(googleAuth, toEmail, subject, body, onSuccess, onFailure) {
      console.log("Sending plain email to " + toEmail + ', subject: "' + subject + '"');
      var headerLines = [
        'To: ' + toEmail,
        'From: ' + formatFromGoogle(googleAuth),
        'Subject: ' + makeSubjectSafe(subject)
      ];
      return sendEmailRequest(headerLines, body, '', onSuccess, onFailure);
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
     * @param {Object} extraHeaders Map of other headers to include in the email.
     * @param {String} bodyHtml The body of the email.
     * @param {String} threadId Gmail thread ID to reply on the same thread as.
     *     Pass '' if there is no thread (i.e. this is the first email).
     * @param {Function} onSuccess Function to call on success, with response.
     * @param {Function} onFailure Function to call on failure, with reason.
     */
    sendHtmlEmail: function(googleAuth, toRecipients, ccRecipients, bccRecipients,
        subject, extraHeaders, bodyHtml, threadId, onSuccess, onFailure) {
      console.log("Sending HTML email to " + toRecipients.join(', ') + ', subject: "' + subject + '"');
      var headerLines = [
        'From: ' + formatFromGoogle(googleAuth),
        'Subject: ' + makeSubjectSafe(subject),
        'Content-Type: text/html; charset=UTF-8'
      ];
      _.each(extraHeaders, function(val, key) {
        headerLines.push(key + ': ' + val);
      });
      _.forEach(toRecipients, function(r) {headerLines.push('to: ' + r)});
      _.forEach(ccRecipients, function(r) {headerLines.push('cc: ' + r)});
      _.forEach(bccRecipients, function(r) {headerLines.push('bcc: ' + r)});
      return sendEmailRequest(headerLines, bodyHtml, threadId, onSuccess, onFailure);
    },

    /**
     * Gets the specified draft from the Google REST API.
     *
     * @param {String} messageId Id of the message to retrieve, as a hex string.
     * @param {Function} onSuccess Function to call on success, with:
     *     @param {String} draftId Draft ID useful for Users.drafts REST calls.
     *         Note that draftId may but does not necessarily equal messageId.
     *     @param {Object} headers Map of headers, e.g. headers['Subject'] = 'I quit'
     *     @param {String} bodyHtml HTML extracted representing the body of the draft.
     * @param {Function} onFailure Function to call on failure, with reason.
     */
    getDraft: function(messageId, onSuccess, onFailure) {
      console.log("Retrieving draft message for message id:", messageId);

      // First map the message id to a draft id ...
      return gapiRequest('GET', 'drafts').then(function(response) {
        // NOTE(adam): assumes that the current draft is in the N most recent drafts.
        // If this assumption is violated, best to cursor back and retrieve more drafts.
        console.log('Gmail drafts.get received: ', response.result);

        return draftDataForMessageId(response.result, messageId);
      }, function(reason) {
        console.error("Gmail drafts.get failed", reason.result.error.message);
        onFailure(reason);
      }).then(function(draftData) {
        if (!draftData) {
          console.error('No draft data found for message id ', messageId);
          onFailure('Draft not found');
          return;
        }

        var draftId = draftData.draftId;
        var threadId = draftData.threadId;

        // ... then get the contents using the draft id.
        return gapiRequest('GET', 'drafts/' + draftId).then(function(response) {
          console.log('Gmail drafts.get(' + draftId + ') received: ', response.result);
          onSuccess(draftId, threadId,
              getDraftHeaders(response.result.message), getDraftBodyHtml(response.result.message));
        }, function(reason) {
          console.error("Gmail drafts.get(' + draftId + ') failed", reason.result.error.message);
          onFailure(reason);
        });
      });
    },

    /**
     * Deletes the original draft from within Gmail.
     *
     * @param {String} draftId Id of the draft to retrieve, as a hex string.
     */
    deleteDraft: function(draftId) {
      console.log('Deleting Gmail draft message for id: ' + draftId);

      return gapiRequest('DELETE', 'drafts/' + draftId).then(function(response) {
        console.log('Gmail drafts.delete successful.');
      }, function(reason) {
        console.error('Gmail drafts.delete failed: ', reason);
      });
    }
  };

  ///// Helpers /////

  /**
   * Makes an email send request with the Google REST API.
   *
   * TODO(adam): rather use the JS lib, if you can figure out how to get auth working
   * https://developers.google.com/gmail/api/v1/reference/users/messages/send#examples

   * @param {String[]} headerLines lines of the form "Header: value"
   * @param {String} body message body
   * @param {String} threadId Gmail thread ID to reply on the same thread as.
   *     Pass '' if there is no thread (i.e. this is the first email).
   * @param {Function} onSuccess Function to call on success, with response.
   * @param {Function} onFailure Function to call on failure, with reason.
   */
  function sendEmailRequest(headerLines, body, threadId, onSuccess, onFailure) {
    // NOTE(adam): to make this work, Gmail API needed to be enabled within the developer console:
    // https://console.developers.google.com/project/wemail-dev/apiui/apiview/gmail/usage
    // TODO(adam): if not using gapi more extensively, don't include google's JS,
    // use another lib for XHR.

    var requestParams = {
      'raw': utf8ToB64(headerLines.join('\n') + '\n\n' + body)
    };
    if (threadId) {
      requestParams['threadId'] = threadId;
    }

    console.log("Sending email", headerLines, body);
    return gapiRequest('POST', 'messages/send', requestParams).then(function(response) {
      console.log("Gmail send succeeded", response);
      onSuccess(response);
    }, function(reason) {
      console.error("Gmail send failed", reason.result.error.message);
      onFailure(reason);
    });
  }

  /**
   * Sends an authenticated request to the GMail API.
   *
   * @param {String} method HTTP method
   * @param {String} path URL path relative to gmail/v1/users/me
   * @param {Object=} body optional request body JSON
   */
  function gapiRequest(method, path, body) {
    // NOTE(adam): since we use gapi.authorize, Authorization is provided as an HTTP header.
    return gapi.client.request({
      path: 'https://www.googleapis.com/gmail/v1/users/me/' + path,
      method: method,
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
   * Ensure a subject string is displayed only with ASCII characters.
   * If only ASCII already in subject, string is left as is; otherwise encode
   * per http://ncona.com/2011/06/using-utf-8-characters-on-an-e-mail-subject/
   *
   * @returns  {String} ASCII only characters for a subject string.
   */
  // TODO(adam): perfect candidate for unit test, e.g. "– encoding test"
  function makeSubjectSafe(str) {
    // http://stackoverflow.com/questions/13522782/how-can-i-tell-if-a-string-has-any-non-ascii-characters-in-it
    var ascii = /^[ -~]+$/;

    if (ascii.test(str)) {
      return str;
    } else {
      // string has non-ascii characters
      return '=?utf-8?B?' + utf8ToB64(str) + '?=';
    }
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
    return b64ToUtf8(getContentPart(message.payload).body.data);
  }

  /**
   * Recursively locates the best part of the multipart email to use as the email body.
   * @returns  {Object|null} The content part, or null if no content part is within the tree.
   */
  function getContentPart(rootPart) {
    // TODO(adam): fantastic candidate for a unit test.

    // Find a multipart/alternative part, and take its last part (highest priority).
    // Per: http://en.wikipedia.org/wiki/MIME#Alternative
    if (rootPart.mimeType == 'multipart/alternative') {
      return _.last(rootPart.parts);
    } else if (rootPart.mimeType == 'text/html') {
      // shouldn't get here if part of a multipart/alternative, but just in case.
      return rootPart;
    }

    for (var partId in rootPart.parts) {
      var contentPart = getContentPart(rootPart.parts[partId]);
      if (contentPart) {
        return contentPart;
      }
    }
    return null;
  }

  /**
   * Given the response of drafts.get, converts a specific message id to a draft id and thread id.
   *
   * @param draftsGetResponse {https://developers.google.com/gmail/api/v1/reference/users/drafts#resource}
   * @param messageId Hex ID for message.
   * @return {Object} Map with key/values, or null if not found:
   *     draftId -> decimal ID for draft
   *     threadId -> hex thread ID for draft
   */
  function draftDataForMessageId(draftsGetResponse, messageId) {
    var draft = _.find(draftsGetResponse.drafts, function(draft) {
      return draft.message.id == messageId;
    })

    return draft ? {
      draftId: draft.id,
      threadId: draft.message.threadId
    } : null;
  }
})();



