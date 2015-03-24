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
     * @param  {Object} googleAuth The google object from Firebase authData, per
     *     https://www.firebase.com/docs/web/guide/login/google.html.
     * @param  {String} toEmail The intended recipient of the email.
     * @param  {String} subject The subject of the email.
     * @param  {String} body The body of the email.
     * @param  {Function} onSuccess Function to call on success, with response.
     * @param  {Function} onFailure Function to call on failure, with reason.
     */
    sendSimpleEmail: function (googleAuth, toEmail, subject, body, onSuccess, onFailure) {
      console.log("GAPI Sending email to " + toEmail + ', subject: "' + subject + '"');
      var headerLines = [
        'To: ' + toEmail,
        'From: ' + formatFromGoogle(googleAuth),
        'Subject: ' + subject
      ];
      return sendEmailRequest(googleAuth.accessToken, headerLines, body, onSuccess, onFailure);
    },

    /**
     * Sends an email.
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
      console.log("GAPI Sending email to " + toRecipients.join(', ') + ', subject: "' + subject + '"');
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
     * @param {Function} onSuccess Function to call on success, with response of format per
     *     https://developers.google.com/gmail/api/v1/reference/users/drafts#resource
     * @param {Function} onFailure Function to call on failure, with reason.
     */
    getDraft: function(accessToken, draftId, onSuccess, onFailure) {
      console.log("GAPI retrieving draft message for id:", draftId);

      // NOTE(adam): users.drafts.get is flakey, so using users.messages.get instead.
      return gapi.client.request({
        path: 'https://www.googleapis.com/gmail/v1/users/me/messages/' + draftId,
        method: 'GET',
        params: { 'access_token': accessToken }
      }).then(function(response) {
        console.log('Gmail drafts.get received: ', response.result);
        onSuccess(response.result);
      }, function(reason) {
        console.error("Gmail drafts.get failed", reason.result.error.message);
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
   * @param {Array} headerLines lines of the form "Header: value"
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
    return gapi.client.request({
      path: 'https://content.googleapis.com/gmail/v1/users/me/messages/send',
      method: 'POST',
      params: { 'access_token': accessToken },
      body: {
        'raw': base64.encode(headerLines.join('\n') + '\n\n' + body)
      }
    }).then(onSuccess, function(reason) {
      console.error("GMail send failed", reason.result.error.message);
      onFailure(reason);
    });
  }

  function formatFromGoogle(googleAuth) {
    return googleAuth.displayName + ' <' + googleAuth.email + '>';
  }

  // See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
  function utf8ToB64( str ) {
    return window.btoa(unescape(encodeURIComponent( str )));
  }

  function b64ToUtf8( str ) {
    return decodeURIComponent(escape(window.atob( str )));
  }

  ///// Base64 /////

  /*
   * Modified by Alex North, 2015
   * Wrapped in anonymous function.
   * Use URL-safe B64.
   */

  /*
   * Copyright (c) 2010 Nick Galbreath
   * http://code.google.com/p/stringencoders/source/browse/#svn/trunk/javascript
   *
   * Permission is hereby granted, free of charge, to any person
   * obtaining a copy of this software and associated documentation
   * files (the "Software"), to deal in the Software without
   * restriction, including without limitation the rights to use,
   * copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the
   * Software is furnished to do so, subject to the following
   * conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
   * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
   * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
   * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
   * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
   * OTHER DEALINGS IN THE SOFTWARE.
   */

  /* base64 encode/decode compatible with window.btoa/atob
   *
   * window.atob/btoa is a Firefox extension to convert binary data (the "b")
   * to base64 (ascii, the "a").
   *
   * It is also found in Safari and Chrome.  It is not available in IE.
   *
   * if (!window.btoa) window.btoa = base64.encode
   * if (!window.atob) window.atob = base64.decode
   *
   * The original spec's for atob/btoa are a bit lacking
   * https://developer.mozilla.org/en/DOM/window.atob
   * https://developer.mozilla.org/en/DOM/window.btoa
   *
   * window.btoa and base64.encode takes a string where charCodeAt is [0,255]
   * If any character is not [0,255], then an DOMException(5) is thrown.
   *
   * window.atob and base64.decode take a base64-encoded string
   * If the input length is not a multiple of 4, or contains invalid characters
   *   then an DOMException(5) is thrown.
   */
  var base64 = {};
  base64.PADCHAR = '=';
  base64.ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; // +/

  base64.makeDOMException = function() {
    // sadly in FF,Safari,Chrome you can't make a DOMException
    var e, tmp;

    try {
      return new DOMException(DOMException.INVALID_CHARACTER_ERR);
    } catch (tmp) {
      // not available, just passback a duck-typed equiv
      // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Error
      // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Error/prototype
      var ex = new Error("DOM Exception 5");

      // ex.number and ex.description is IE-specific.
      ex.code = ex.number = 5;
      ex.name = ex.description = "INVALID_CHARACTER_ERR";

      // Safari/Chrome output format
      ex.toString = function() { return 'Error: ' + ex.name + ': ' + ex.message; };
      return ex;
    }
  };

  base64.getbyte64 = function(s,i) {
    // This is oddly fast, except on Chrome/V8.
    //  Minimal or no improvement in performance by using a
    //   object with properties mapping chars to value (eg. 'A': 0)
    var idx = base64.ALPHA.indexOf(s.charAt(i));
    if (idx === -1) {
      throw base64.makeDOMException();
    }
    return idx;
  };

  base64.decode = function(s) {
    // convert to string
    s = '' + s;
    var getbyte64 = base64.getbyte64;
    var pads, i, b10;
    var imax = s.length;
    if (imax === 0) {
      return s;
    }

    if (imax % 4 !== 0) {
      throw base64.makeDOMException();
    }

    pads = 0;
    if (s.charAt(imax - 1) === base64.PADCHAR) {
      pads = 1;
      if (s.charAt(imax - 2) === base64.PADCHAR) {
        pads = 2;
      }
      // either way, we want to ignore this last block
      imax -= 4;
    }

    var x = [];
    for (i = 0; i < imax; i += 4) {
      b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12) |
      (getbyte64(s,i+2) << 6) | getbyte64(s,i+3);
      x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff, b10 & 0xff));
    }

    switch (pads) {
      case 1:
        b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12) | (getbyte64(s,i+2) << 6);
        x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff));
        break;
      case 2:
        b10 = (getbyte64(s,i) << 18) | (getbyte64(s,i+1) << 12);
        x.push(String.fromCharCode(b10 >> 16));
        break;
    }
    return x.join('');
  };

  base64.getbyte = function(s,i) {
    var x = s.charCodeAt(i);
    if (x > 255) {
      throw base64.makeDOMException();
    }
    return x;
  };

  base64.encode = function(s) {
    if (arguments.length !== 1) {
      throw new SyntaxError("Not enough arguments");
    }
    var padchar = base64.PADCHAR;
    var alpha   = base64.ALPHA;
    var getbyte = base64.getbyte;

    var i, b10;
    var x = [];

    // convert to string
    s = '' + s;

    var imax = s.length - s.length % 3;

    if (s.length === 0) {
      return s;
    }
    for (i = 0; i < imax; i += 3) {
      b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8) | getbyte(s,i+2);
      x.push(alpha.charAt(b10 >> 18));
      x.push(alpha.charAt((b10 >> 12) & 0x3F));
      x.push(alpha.charAt((b10 >> 6) & 0x3f));
      x.push(alpha.charAt(b10 & 0x3f));
    }
    switch (s.length - imax) {
      case 1:
        b10 = getbyte(s,i) << 16;
        x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) +
        padchar + padchar);
        break;
      case 2:
        b10 = (getbyte(s,i) << 16) | (getbyte(s,i+1) << 8);
        x.push(alpha.charAt(b10 >> 18) + alpha.charAt((b10 >> 12) & 0x3F) +
        alpha.charAt((b10 >> 6) & 0x3f) + padchar);
        break;
    }
    return x.join('');
  };
})();



