(function() {

  /////
  ///// Main
  /////

  function main() {
    console.log('Initializing firebase.');
    var firebase = new Firebase("https://wemail.firebaseio.com/");
    var model = createRootModel(firebase);
    var userModel;
    var firepad;

    firebase.onAuth(function (authData) {
      if (authData != null) {
        console.log("Signed in");
        signedIn(authData);

        userModel = model.user(authData.uid);
        bindUserData(userModel);

        selectPad(userModel, function(padId) {
          openPad(padId, authData);
        });
      } else {
        console.log("Signed out");
        signedOut();
      }
    });

    window.onhashchange = function() {
      var authData = firebase.getAuth();
      selectPad(userModel, function(padId) {
        openPad(padId, authData);
      });
    };

    /**
     * Provides the id of the pad indicated by the current location, or the user's most recent pad,
     * else null.
     *
     * @param {Object} userModel
     * @param {Function} callback receives id of pad, or null
     *
     */
    function selectPad(userModel, callback) {
      var padId = window.location.hash.slice(1);
      if (padId) {
        callback(padId);
      } else {
        userModel.getPads(function(pads) {
          console.log('Pads', pads);
          var lastPadId = (typeof pads === 'object') ? _.findLastKey(pads) : null;
          callback(lastPadId);
        });
      }
    }

    function openPad(padId, authData) {
      authData = authData || firebase.getAuth();
      var padModel = model.pad(padId, authData.uid);

      // Remember this pad for the user.
      // Currently, this is the only way a pad ends up in a user's list; they have to visit it
      // at least once, presumably via a linked emailed to them.
      padModel.onSubjectChanged(function(subject) {
        userModel.rememberPad(padModel.id, subject);
      });

      initCollaboration(authData, padModel);
      firepad = initFirepad(authData.uid, model.refForPad(padModel.id));
    }

    attachUiEvents({
      signIn: function() {
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
      },

      signOut: function() {
        firebase.unauth();
        window.location.reload();
      },

      newPad: function() {
        openPad(null);
      }
    });
  }

  /////
  ///// Models
  /////

  function createRootModel(firebase) {
    var usersRef = firebase.child('users');
    var padsRef = firebase.child('pads');

    return {
      user: function(userId) {
        return createUserModel(usersRef.child(userId));
      },

      pad: function(padId, userId) {
        return createPadModel(this.refForPad(padId, userId));
      },

      refForPad: function(padId, userId) {
        if (!!padId) {
          return padsRef.child(padId);
        } else {
          if (!userId) { throw "User id required for new pad"; }
          var ref = padsRef.push();
          ref.child('owner').set(userId);
          return ref;
        }
      },

      newPadRef: function() {
        return padsRef.push();
      }
    };
  }

  function createUserModel(userRef) {
    return {
      rememberPad: function(padId, subject) {
        userRef.child('pads').child(padId).set({subject: subject || ""});
      },

      getPads: function(callback) {
        userRef.child('pads').once('value', function(snapshot) {
          callback(snapshot.val());
        });
      },

      onPadListChanged: function(callback) {
        console.log('Pad list changed');
        userRef.child('pads').on('value', function(snapshot) {
          callback(snapshot.val());
        });
      }
    };
  }

  function createPadModel(padRef) {
    return {
      get id() { return padRef.key(); },

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

  function attachUiEvents(handlers) {
    document.getElementById("signin").onclick = handlers.signIn;
    document.getElementById("signout").onclick = handlers.signOut;
    document.getElementById("newpad").onclick = handlers.newPad;
  }

  function signedIn(authData) {
    document.getElementById("signedin").innerText = authData.google.displayName +
    ' <' + authData.google.email + '>';
    document.getElementById('landing').className = 'hidden';
    document.getElementById('app').className = '';
  }

  function signedOut() {
    document.getElementById("signedin").innerText = '';
    document.getElementById('landing').className = '';
    document.getElementById('app').className = 'hidden';
  }

  function bindUserData(userModel) {
    bindList(userModel.onPadListChanged, document.getElementById('otherpads'), function(val, key) {
      var title = (!!val && !!val.subject && val.subject) || key;
      return '<a href="#' + key + '">' + title + '</a>';
    });
  }

  function initCollaboration(authData, padModel) {
    if (!authData) { return; }
    if (window.location.hash.slice(1) !== padModel.id) { window.location.hash = padModel.id; }

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
          sendInvite(authData.google, email, padModel.id, function(response) {
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
      _.forOwn(value, function(val, key) {
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


