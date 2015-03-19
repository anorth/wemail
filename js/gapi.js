/*
 * Google API-related code, e.g. to invoke the GMail api.
 */

/**
 * Sends an email via the REST API.
 *
 * @param  {Object} googleAuth The google object from Firebase authData, per
 *     https://www.firebase.com/docs/web/guide/login/google.html.
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} subject The subject of the email.
 * @param  {String} body The body of the email.
 * @param  {Function} callback Function to call when the request is complete.
 *
 * TODO(adam): rather use the JS lib, if you can figure out how to get auth working
 * https://developers.google.com/gmail/api/v1/reference/users/messages/send#examples
 */
function sendEmail(googleAuth, toEmail, subject, body, callback) {
  // NOTE(adam): to make this work, Gmail API needed to be enabled within the developer console:
  // https://console.developers.google.com/project/wemail-dev/apiui/apiview/gmail/usage
  // TODO(adam): if not using gapi more extensively, don't include google's JS,
  // use another lib for XHR.
  gapi.client.request({
    path: 'https://content.googleapis.com/gmail/v1/users/me/messages/send',
    method: 'POST',
    params: {
      access_token: googleAuth.accessToken
    },
    body: {
      'raw': btoa(
        'To: ' + toEmail + '\n' +  // TODO(adam): validate email, escaping etc.
        'From: ' + googleAuth.displayName + ' <' + googleAuth.email + '>\n' +
        'Subject: ' + subject + '\n' +
        '\n' +
        body)
    }
  }).execute(callback);
}


/**
 * Sends an email invite to a collaborator to join the draft.
 *
 * @param  {Object} googleAuth The google object from Firebase authData, per
 *     https://www.firebase.com/docs/web/guide/login/google.html.
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} draftId The id of the draft pad.
 * @param  {Function} callback Function to call when the request is complete.
 */
function sendInvite(googleAuth, toEmail, padId, callback) {
  sendEmail(
    googleAuth,
    toEmail,
    'Please review my draft',
    'Hey - I need your help drafting an email.\n' +
    'Can you please take a look at http://localhost:8000/#' + padId + ' ?\n' +
    '\n' +
    'Thanks!',
    callback);
}
