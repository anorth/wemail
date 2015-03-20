/*
 * Google API-related code, e.g. to invoke the GMail api.
 */

var CLIENT_ID = '638270974877-c2ss7kkkofab78g9cirjdm5ubgpfoegv.apps.googleusercontent.com';
var SCOPE = 'email https://www.googleapis.com/auth/gmail.compose';

function checkGoogleAuth(callback) {
  gapi.auth.authorize({
    client_id: CLIENT_ID,
    immediate: true,
    scope: SCOPE
  }, callback);
}

/**
 * Signs the user in to Google for this application.
 *
 * @param  {Function} callback Called on auth, takes an OAuth 2.0 token object as param.
 */
function doGoogleAuth(callback) {
  // TODO(adam): Google auth_token expires before firebase, so need to refresh
  // google token.

  // Attempt immediate auth first; failing that, show the auth UI.
  gapi.auth.authorize({
    client_id: CLIENT_ID,
    immediate: false,
    scope: SCOPE
  }, callback);
}

/**
 * Sends an email via the REST API.
 *
 * @param  {Object} googleAuth The google object from Firebase authData, per
 *     https://www.firebase.com/docs/web/guide/login/google.html.
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} subject The subject of the email.
 * @param  {String} body The body of the email.
 * @param  {Function} onSuccess Function to call on success, with response.
 * @param  {Function} onFailure Function to call on failure, with reason.
 *
 * TODO(adam): rather use the JS lib, if you can figure out how to get auth working
 * https://developers.google.com/gmail/api/v1/reference/users/messages/send#examples
 */
function sendEmail(googleAuth, toEmail, subject, body, onSuccess, onFailure) {
  // NOTE(adam): to make this work, Gmail API needed to be enabled within the developer console:
  // https://console.developers.google.com/project/wemail-dev/apiui/apiview/gmail/usage
  // TODO(adam): if not using gapi more extensively, don't include google's JS,
  // use another lib for XHR.
  gapi.client.request({
    path: 'https://content.googleapis.com/gmail/v1/users/me/messages/send',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + googleAuth.accessToken
    },
    body: {
      'raw': btoa(
        'To: ' + toEmail + '\n' +  // TODO(adam): validate email, escaping etc.
        'From: ' + googleAuth.displayName + ' <' + googleAuth.email + '>\n' +
        'Subject: ' + subject + '\n' +
        '\n' +
        body)
    }
  }).then(onSuccess, onFailure);
}


/**
 * Sends an email invite to a collaborator to join the draft.
 *
 * @param  {Object} googleAuth The google object from Firebase authData, per
 *     https://www.firebase.com/docs/web/guide/login/google.html.
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} draftId The id of the draft pad.
 * @param  {Function} onSuccess Function to call on success, with response.
 * @param  {Function} onFailure Function to call on failure, with reason.
 */
function sendInvite(googleAuth, toEmail, padId, onSuccess, onFailure) {
  var body =
    'Hey - I need your help drafting an email.\n' +
    'Can you please take a look at https://wemail.firebaseapp.com/#' + padId + ' ?\n' +
    '\n' +
    'Thanks!';

  sendEmail(googleAuth, toEmail, 'Please review my draft', body, onSuccess, onFailure);
}
