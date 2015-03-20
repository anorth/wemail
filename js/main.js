(function() {

  /////
  ///// Main
  /////

  function main() {
    console.log('Initializing firebase.');
    var firebase = new Firebase("https://wemail.firebaseio.com/");
    var firepad;
    var userModel;
    var padModel;

    attachUiEvents(firebase);

    firebase.onAuth(function (authData) {
      console.log("Firebase authentication:", authData);
      if (authData) {
        document.getElementById("signedin").innerText = authData.google.displayName +
        ' <' + authData.google.email + '>';
        // Note: user data is not (yet) persisted to firebase

        userModel = createUserModel(firebase.child('users').child(authData.uid));
        bindUserData(userModel);

        var padRef = openPad(firebase);
        padModel = createPadModel(padRef);
        initCollaboration(authData, userModel, padModel);
        firepad = initFirepad(authData, padRef);
      } else {
        document.getElementById("signedin").innerText = "No";
        console.log("User is logged out");
      }
    });

    window.onhashchange = function() {
      var padRef = openPad(firebase);
      var authData = firebase.getAuth();

      padModel = createPadModel(padRef);
      initCollaboration(authData, userModel, padModel);
      firepad = initFirepad(authData, padRef);
    };

    /**
     * Returns firebase reference to the pad indicated by the current location, else a new pad.
     */
    function openPad(firebase) {
      var padId = window.location.hash.slice(1);
      if (!!padId) {
        return firebase.child('pads').child(padId);
      } else {
        return firebase.child('pads').push();
      }
    }
  }

  /////
  ///// Models
  /////

  function createUserModel(userRef) {
    return {
      rememberPad: function(padId) {
        userRef.child('pads').child(padId).set('1');
      },

      onPadListChanged: function(callback) {
        userRef.child('pads').on('value', function(snapshot) {
          callback(snapshot.val());
        });
      }
    };
  }

  function createPadModel(padRef) {
    return {
      id: function() { return padRef.key(); },
      ref: function() { return padRef; }, // TODO: remove this accessor

      setToAddresses: function(addressString) {
        padRef.child('to').set(addressString);
      },

      onToAddressesChanged: function(callback) {
        fbutil.onChanged(padRef.child('to'), callback);
      },

      setSubject: function(subject) {
        padRef.child('subject').set(subject);
      },

      onSubjectChanged: function(callback) {
        fbutil.onChanged(padRef.child('subject'), callback);
      },

      setMyDisplayName: function(displayName) {
        padRef.child('users').child(padRef.getAuth().uid).update({'displayName': displayName});
      },

      onCollaboratorsChanged: function(callback) {
        fbutil.onChanged(padRef.child('users'), callback);
      },

      addInvitedEmail: function(emailAddress, onsuccess) {
        fbutil.arraySetAdd(padRef.child('invited'), emailAddress, onsuccess);
      },

      removeInvitedEmail: function(emailAddress) {
        fbutil.arraySetRemove(padRef.child('invited'), emailAddress);
      },

      onInvitedChanged: function(callback) {
        fbutil.onChanged(padRef.child('invited'), callback);
      },

      sendChat: function(userId, message) {
        padRef.child('chat').push().set({
          userId: userId,
          message: message,
          timestamp: Date.now()
        });
      },

      onChatChanged: function(callback) {
        fbutil.onChanged(padRef.child('chat'), callback);
      }
    };
  }

  /////
  ///// UI
  /////

  function onGoogleSignin(firebase, oauthToken) {
    console.log('Signed in with Google:', oauthToken);
    firebase.authWithOAuthToken("google", oauthToken.access_token, function(error, authData) {
      if (error) {
        console.log("Firebase login failed!", error);
      } else {
        console.log("Firebase login successful.");
      }
    });
  }

  function attachUiEvents(firebase) {
    document.getElementById("signin").onclick = function() {
      googleSignin(_.curry(onGoogleSignin)(firebase));
    };

    document.getElementById("signout").onclick = function() {
      firebase.unauth();
      window.location.reload();
    };

  }

  function bindUserData(userModel) {
    userModel.onPadListChanged(function(val) {
      // TODO (alex): use an <ul> and bindList
      var html = '';
      _.forOwn(val, function(valueIgnored, padId) {
        html += ' <a href="#' + padId + '">' + padId + '</a>';
      });
      document.getElementById('otherpads').innerHTML = html;
    });
  }

  function initCollaboration(authData, userModel, padModel) {
    if (!authData) { return; }
    if (window.location.hash.slice(1) !== padModel.id()) { window.location.hash = padModel.id(); }

    // Remember this pad for the user.
    // Currently, this is the only way a pad ends up in a user's list; they have to visit it
    // at least once, presumably via a linked emailed to them.
    userModel.rememberPad(padModel.id());

    // Mail headers
    var headers = document.getElementById('headers');
    headers.elements["from"].value = authData.google.displayName;

    bindFormField(padModel.setToAddresses, padModel.onToAddressesChanged, headers.elements['to']);
    bindFormField(padModel.setSubject, padModel.onSubjectChanged, headers.elements['subject']);

    // Collaborators
    var invitation = document.getElementById('invitation');
    invitation.onsubmit = function(evt) {
      var email = invitation.elements['email'].value;
      if (!!email) {
        padModel.addInvitedEmail(email, function() {
          sendInvite(authData.google, email, padModel.id(), function(response) {
            console.log('Invitation sent to ' + email + '.');
          }, function(reason) {
            console.log('Invitation failed to send to ' + email + ': ' + reason.result.error.message);
            padModel.removeInvitedEmail(email); // Enable re-trying the failed send later.
          });
        });
        invitation.elements['email'].value = '';
      }
      return false;
    };

    bindList(padModel.onInvitedChanged, document.getElementById('invited'));

    bindList(padModel.onCollaboratorsChanged, document.getElementById('collaborators'),
        function (obj, key) {
          return obj.displayName || obj.email || key;
        });

    //padModel.arrayRemove('invited', authData.google.email);
    padModel.removeInvitedEmail(authData.google.email);
    padModel.setMyDisplayName(authData.google.displayName);

    // Chat
    var chatContainer = document.getElementById('chat-container');
    document.getElementById('chat-send').onclick = function() {
      var input = document.getElementById('chat-input');
      if (!!input.value) {
        padModel.sendChat(authData.uid, input.value);
        input.value = '';
      }
    };
    bindList(padModel.onChatChanged, document.getElementById('messages'), function(val) {
      return '<div class="chat-author">' + val.userId + '</div>' +
          '<div class="chat-message">' + val.message + '</div>';
    });

    padModel.onChatChanged(function() {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  }

  function initFirepad(authData, padRef) {
    if (!!firepad) { firepad.dispose(); }
    var padEl = document.getElementById('firepad');
    padEl.innerHTML = '';

    var codeMirror = CodeMirror(padEl, {lineWrapping: true});
    var firepad = Firepad.fromCodeMirror(padRef, codeMirror, {
      userId: authData.uid,
      richTextShortcuts: true,
      richTextToolbar: true,
      defaultText: 'Hello, World!'
    });

    firepad.on('ready', function() { console.log("Firepad ready"); });
    firepad.on('synced', function() { console.log("Firepad synced"); });
    return firepad;
  }

  /**
   * Binds a form field to a model via a setter and a listener method.
   *
   * @param {Function} setFn unary function which sets the model value
   * @param {Function} listenFn registers a unary callback to be invoked whenever the model value
   *  changes
   * @param {Element} field HTML form element to bind
   */
  function bindFormField(setFn, listenFn, field) {
    listenFn(function(value) {
      //console.log("Received new value for " + field.name);
      field.value = value;
    });
    field.onchange = function(evt) {
      setFn(evt.target.value);
    }
  }

  /**
   * Registers a callback to render a sequence of list elements whenever the callback is invoked.
   * The callback accepts a single object or array as an argument, and renders list elements
   * with the array/object values inside.
   *
   * If a render function is provided, the items are transformed by that function.
   *
   * @param {Function} listenFn
   * @param {Element} listElt
   * @param {Function} renderFn
   */
  function bindList(listenFn, listElt, renderFn) {
    if (!renderFn) { renderFn = identity; }
    listenFn(function(value) {
      var html = '';
      _.each(value, function(val, key) {
        html += '<li>' + renderFn(val, key) + '</li>';
      });
      listElt.innerHTML = html;
    });
  }

  function identity(x) {
    return x;
  }

  window.main = main;
})();


