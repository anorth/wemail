function initFirebase() {
  console.log('Initializing firebase.');

  var firebase = new Firebase("https://wemail.firebaseio.com/");
  var firepad;
  var googleAccessToken;
  bindEvents();

  firebase.onAuth(function(authData) {
    if (authData) {
      document.getElementById("signedin").innerText = authData.google.displayName +
      ' <' + authData.google.email + '>';
      // Note: user data is not (yet) persisted to firebase

      bindUserData(authData.uid);
      setupCollaboration(authData);

      googleAccessToken = authData.google.accessToken;
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
        scope: "email https://www.googleapis.com/auth/gmail.compose"
      });
    };

    document.getElementById("signout").onclick = function() {
      firebase.unauth();
      window.location.reload();
    };

    window.onhashchange = function() {
      setupCollaboration(firebase.getAuth());
    };
  }

  function bindUserData(uid) {
    firebase.child('users').child(uid).child('pads').on('value', function(snap) {
      var html = '';
      _.forOwn(snap.val(), function(val, key) {
        console.log(val, key);
        html += ' <a href="#' + key + '">' + key + '</a>';
      });
      document.getElementById('otherpads').innerHTML = html;
    });

  }

  function setupCollaboration(authData) {
    var padId = window.location.hash.slice(1) || newPad(authData.uid);
    if (window.location.hash.slice(1) !== padId) { window.location.hash = padId; }

    // Remember this pad for the user
    firebase.child('users').child(authData.uid).child('pads').child(padId).set('1');

    var headers = document.getElementById('headers');
    headers.elements["from"].value = authData.google.displayName;
    var padRef = firebase.child('pads').child(padId);
    bindFormElement(padRef.child('to'), headers.elements['to']);
    bindFormElement(padRef.child('subject'), headers.elements['subject']);

    firepad = initFirepad(authData.uid, padRef);

    var invitation = document.getElementById('invitation');
    invitation.onsubmit = function(evt) {
      var email = invitation.elements['email'].value;
      if (!!email) {
        padRef.child('invited').transaction(function(current) {
          if (current == null) { current = []; }
          if (current.indexOf(email) == -1) {
            current.push(email);

            sendInvite(googleAccessToken, email, padId, function() {
              console.log('Invite sent to ' + email + '.');
            });
          }
          return current;
        });
        invitation.elements['email'].value = '';

        // TODO: send email
      }
      return false;
    };
    bindList(padRef.child('invited'), document.getElementById('invited'));
  }

  function newPad(userId) {
    var padRef = firebase.child('pads').push();
    return padRef.key();
  }

  function initFirepad(userId, padRef) {
    if (!!firepad) { firepad.dispose(); }
    var padEl = document.getElementById('firepad');
    padEl.innerHTML = '';

    var codeMirror = CodeMirror(padEl, {lineWrapping: true});
    var firepad = Firepad.fromCodeMirror(padRef, codeMirror, {
      userId: userId,
      richTextShortcuts: true,
      richTextToolbar: true,
      defaultText: 'Hello, World!'
    });

    firepad.on('ready', function() { console.log("Firepad ready"); });
    firepad.on('synced', function() { console.log("Firepad synced"); });
    return firepad;
  }

  function bindFormElement(padRef, formElt) {
    padRef.on('value', function(snap) {
      console.log("Received new value for " + padRef);
      formElt.value = snap.val();
    });
    formElt.onchange = function(evt) {
      padRef.set(evt.target.value);
    };
  }

  function bindList(padRef, listElt) {
    padRef.on('value', function(snap) {
      var html = '';
      _.each(snap.val(), function(v) {
        html += '<li>' + v + '</li>';
      });
      listElt.innerHTML = html;
    });
  }
}
