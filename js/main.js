(function () {

  var firebase = new Firebase("https://wemail.firebaseio.com/");

  firebase.onAuth(function(authData) {
    if (authData) {
      //console.log(authData);
      document.getElementById("signedin").innerText = authData.google.displayName +
        ' <' + authData.google.email + '>';
      console.log('Logged in ' + authData.uid + ' ' + authData.google.email);
      // Note: user data is not (yet) persisted to firebase
    } else {
      document.getElementById("signedin").innerText = "No";
      console.log("User is logged out");
    }
  });

  var codeMirror = CodeMirror(document.getElementById('firepad'), {lineWrapping: true});
  var firepad = Firepad.fromCodeMirror(firebase, codeMirror, {
    //userId: userId,
    richTextShortcuts: true,
    richTextToolbar: true,
    defaultText: 'Hello, World!'
  });


  firepad.on('ready', function() { console.log("Firepad ready"); });
  firepad.on('synced', function() { console.log("Firepad synced"); });

  document.getElementById("signin").onclick = function() {
    firebase.authWithOAuthPopup("google", function(error, authData) {
      if (error) {
        if (error.code === "TRANSPORT_UNAVAILABLE") {
          // fall-back to browser redirects, and pick up the session
          // automatically when we come back to the origin page
          firebase.authWithOAuthRedirect("google", function(error) {
            console.log("Login Failed!", error);
          });
        } else {
          console.log("Login Failed!", error);
        }
      } else {
        console.log("Authenticated successfully with payload:", authData);
      }
    }, {
      scope: "email"
    });
  };

  document.getElementById("signout").onclick = function() {
    firebase.unauth();
    window.location.reload();
  };

})();

