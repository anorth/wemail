(function () {
  var firebase = new Firebase("https://wemail.firebaseio.com/");
  var firepad;
  bind();

  firebase.onAuth(function(authData) {
    if (authData) {
      //console.log(authData);
      console.log('Logged in ' + authData.uid + ' ' + authData.google.email);
      document.getElementById("signedin").innerText = authData.google.displayName +
      ' <' + authData.google.email + '>';
      // Note: user data is not (yet) persisted to firebase

      var padId = window.location.hash.slice(1) || undefined;
      firepad = initFirepad(authData.uid, padId);
    } else {
      document.getElementById("signedin").innerText = "No";
      console.log("User is logged out");
    }
  });




  function bind() {
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
  }

  function initFirepad(userId, padId) {
    var pads = firebase.child('pads');
    var padRef;
    if (!!padId) {
      padRef = pads.child(padId);
    } else {
      padRef = pads.push();
      padId = padRef.key();
    }

    var codeMirror = CodeMirror(document.getElementById('firepad'), {lineWrapping: true});
    var firepad = Firepad.fromCodeMirror(padRef, codeMirror, {
      userId: userId,
      richTextShortcuts: true,
      richTextToolbar: true,
      defaultText: 'Hello, World!'
    });

    firepad.on('ready', function() { console.log("Firepad ready"); });
    firepad.on('synced', function() { console.log("Firepad synced"); });
    document.getElementById('padid').innerText = padId;
    window.location.hash = padId;
    return firepad;
  }
})();

