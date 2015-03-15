(function () {
  var firebase = new Firebase("https://wemail.firebaseio.com/");
  var firepad;
  bindEvents();

  firebase.onAuth(function(authData) {
    if (authData) {
      //console.log(authData);
      console.log('Logged in ' + authData.uid + ' ' + authData.google.email);
      document.getElementById("signedin").innerText = authData.google.displayName +
      ' <' + authData.google.email + '>';
      // Note: user data is not (yet) persisted to firebase

      bindData(authData.uid);
      setupPad(authData.uid);
    } else {
      document.getElementById("signedin").innerText = "No";
      console.log("User is logged out");
    }
  });


  function bindEvents() {
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

    window.onhashchange = function() {
      var uid = firebase.getAuth().uid;
      setupPad(uid);
    };
  }

  function bindData(uid) {
    firebase.child('users').child(uid).child('pads').on('value', function(snap) {
      var html = '';
      _.forOwn(snap.val(), function(val, key) {
        console.log(val, key);
        html += ' <a href="#' + key + '">' + key + '</a>';
      });
      document.getElementById('otherpads').innerHTML = html;
    });

  }

  function setupPad(userId) {
    var padId = window.location.hash.slice(1) || newPad(userId);
    firebase.child('users').child(userId).child('pads').child(padId).set('1');
    firepad = initFirepad(userId, padId);

    initFirepad(userId, padId);
  }

  function newPad(userId) {
    var padRef = firebase.child('pads').push();
    return padRef.key();
  }

  function initFirepad(userId, padId) {
    if (!padId) { throw "No pad!"; }

    if (!!firepad) { firepad.dispose(); }
    var padEl = document.getElementById('firepad');
    padEl.innerHTML = '';

    var codeMirror = CodeMirror(padEl, {lineWrapping: true});
    var padRef = firebase.child('pads').child(padId);
    var firepad = Firepad.fromCodeMirror(padRef, codeMirror, {
      userId: userId,
      richTextShortcuts: true,
      richTextToolbar: true,
      defaultText: 'Hello, World!'
    });

    firepad.on('ready', function() { console.log("Firepad ready"); });
    firepad.on('synced', function() { console.log("Firepad synced"); });
    window.location.hash = padId;
    return firepad;
  }
})();

