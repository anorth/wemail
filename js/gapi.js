/*
 * Google API-related code, e.g. to invoke the GMail api.
 */

function handleGapiLoad() {
  console.log("Google API loaded.");

  // HACK(adam): re-use the firebase oauth / client id to avoid a double auth.
  // The following was reverse engineered from firebase oauth flow:
  FIREBASE_CLIENT_ID = '638270974877-c2ss7kkkofab78g9cirjdm5ubgpfoegv.apps.googleusercontent.com';

  gapi.client.load('gmail', 'v1').then(initFirebase);  // TODO(adam): confirm best version.

  // doc: https://developers.google.com/api-client-library/javascript/reference/referencedocs#gapiauthinit
  /*
  // This gives "origin_mismatch" error in the oauth flow. Firebase != Wemail.
  gapi.auth.authorize({
    client_id: FIREBASE_CLIENT_ID,
    immediate: false,  // ideally true, to have this occur in background
    scope: 'email https://www.googleapis.com/auth/gmail.compose'
  }, function(token) {
    console.log(token);
  });
  */
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
