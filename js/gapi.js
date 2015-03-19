/*
 * Google API-related code, e.g. to invoke the GMail api.
 */

function handleGapiLoad() {
  console.log("Google API loaded.");

  WEMAIL_CLIENT_ID = '638270974877-c2ss7kkkofab78g9cirjdm5ubgpfoegv.apps.googleusercontent.com';

  // doc: https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauthinit
  // This gives "origin_mismatch" error in the oauth flow.
  /*
  gapi.auth.authorize({
    client_id: WEMAIL_CLIENT_ID,
    immediate: false,  // ideally true, to have this occur in background
    scope: 'email https://www.googleapis.com/auth/gmail.compose'
  }, function(token) {
    console.log(token);
  });
  */

  gapi.client.load('gmail', 'v1').then(initFirebase);  // TODO(adam): confirm best version.
}

/**
 * Send Message.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} email RFC 5322 formatted String.
 * @param  {Function} callback Function to call when the request is complete.
 */
function sendMessage(userId, email, callback) {
  var base64EncodedEmail = btoa(email);
  var request = gapi.client.gmail.users.messages.send({
    'userId': userId,
    'message': {
      'raw': base64EncodedEmail
    }
  });
  request.execute(callback);
}


/**
 * Sends an email via the REST API.
 *
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} subject The subject of the email.
 * @param  {String} body The body of the email.
 * @param  {Function} callback Function to call when the request is complete.
 *
 * TODO(adam): rather use the JS lib, if you can figure out how to get auth working
 * https://developers.google.com/gmail/api/v1/reference/users/messages/send#examples
 */
function sendEmail(toEmail, subject, body, callback) {
  // NOTE(adam): to make this work, Gmail API needed to be enabled within the developer console:
  // https://console.developers.google.com/project/wemail-dev/apiui/apiview/gmail/usage
  gapi.client.request({
    path: 'https://content.googleapis.com/gmail/v1/users/me/messages/send',
    method: 'POST',
    params: {
      access_token: GOOGLE_AUTH_DATA.accessToken
    },
    body: {
      'raw': btoa(
        'To: ' + toEmail + '\n' +  // TODO(adam): validate email, escaping etc.
        'Subject: ' + subject + '\n' +
        '\n' +
        body)
    }
  }).execute(callback);
}

/**
 * Sends an email invite to a collaborator to join the draft.
 *
 * @param  {String} toEmail The intended recipient of the email.
 * @param  {String} draftId The id of the draft pad.
 * @param  {Function} callback Function to call when the request is complete.
 */
function sendInvite(toEmail, padId, callback) {
  sendEmail(
    toEmail,
    'Please review my draft',
    'Hey - I need your help drafting an email.\n' +
    'Can you please take a look at http://localhost:8000/#' + padId + ' ?\n' +
    '\n' +
    'Thanks!',
    callback);
}
