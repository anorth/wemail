(function() {

  var MONTHS = ["Jan", "Feb", "Mar",
      "Apr", "May", "Jun", "Jul", "Aug", "Sep",
      "Oct", "Nov", "Dec"];

  // From http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
  var queryParams;
  (function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    queryParams = {};
    while (match = search.exec(query)) {
      queryParams[decode(match[1])] = decode(match[2]);
    }
    console.log("Query params", queryParams);
  })();

  var isDev = window.location.hostname === 'localhost';

  /////
  ///// Main
  /////

  function main() {
    Bugsense.initAndStartSession( { apiKey: isDev ? "6e92a61d" : "f837bbea" } );

    console.log('Initializing firebase.');
    var firebase = new Firebase("https://wemail.firebaseio.com/");
    var rootModel = model.createRootModel(firebase);
    var userModel;
    var padModel;
    var firepad;

    var initiallySignedIn = !!firebase.getAuth();
    var recordedSessionStart = false;

    var hashAccessToken = maybeGetHashAccessToken(document.location.hash);
    if (hashAccessToken) {
      // User just bounced from a Google sign-in page. Sign them in to Firebase as well.
      onGoogleSignin({'access_token': hashAccessToken});
      window.location.hash = '';  // assumes for now no redirects to a specific pad
    } else if (firebase.getAuth()) {
      // Google cookie doesn't actually get wiped, so we're technically always still logged in.
      // ... but take advantage of the fact that we signed out from firebase.

      // Since the Google token expires after 1 hr, get a new one:
      gmail.checkAuth(function(response) {
        if (response.error) {
          console.log('User not already signed in with Google.');
          track('Google auth expired');
        } else {
          // Update the firebase auth with the new Google token:
          onGoogleSignin(response);
        }
      });
    }

    firebase.onAuth(function (authData) {
      if (authData != null) {
        console.log("Signed in " + authData.uid);
        if (!initiallySignedIn) {
          track('Signed in');
        }
        signedIn(authData);

        userModel = rootModel.user(authData.uid);
        bindUserData(userModel);

        hashChanged();
        maybeLoadDraft();
      } else {
        console.log("Signed out");
        track('Signed out')
        signedOut();
      }
      if (!recordedSessionStart) {
        track('Session started', {'Authenticated': authData != null});
        recordedSessionStart = true;
      }
    });

    window.onhashchange = hashChanged;

    window.addEventListener('message', function(event) {
      // TODO(adam): enforce origin of message, to avoid evil extensions sending messages here.
      //console.log('Message received from extension:', event.data, event);
      if (!event.data.draftId) {
        return;
      }

      track('Gmail draft requested');
      var draftId = event.data.draftId;
      if (gapi.auth.getToken()) {
        loadDraft(draftId);
      } else {
        console.log('Remembering draft ID ' + draftId + ' for when Google is signed in');
        window.localStorage.setItem('wemail.draftId', draftId);
        window.localStorage.setItem('wemail.draftIdTimestamp', Date.now());
      }
    });

    function hashChanged() {
      console.log("Hash changed: " + window.location.hash || "[null]");
      if (window.location.hash.length <= 1) {
        padModel = null;
      }
      if (userModel) {
        selectPad(userModel, function (padId) {
          openPad(padId, firebase.getAuth());
        });
      }
    }


    /**
     * If a gmail draft ID was stored before sign in, load the draft now that we're signed in.
     */
    function maybeLoadDraft() {
      if (!gapi.auth.getToken()) { return; }  // Google not yet signed in

      var draftId = window.localStorage.getItem('wemail.draftId');
      var draftIdTimestamp = window.localStorage.getItem('wemail.draftIdTimestamp');
      if (!!draftId) {
        if (Date.now() - draftIdTimestamp < 10*60*1000) {
          loadDraft(draftId);
        }
        window.localStorage.removeItem('wemail.draftId');
        window.localStorage.removeItem('wemail.draftIdTimestamp');
      }
    }


    /**
     * Loads a draft from Gmail with the given message ID.
     */
    function loadDraft(messageId) {
      // Assumes that this tab was opened to a new wemail message, e.g. with #new
      console.log('Initializing draft for draftId:', messageId);

      gmail.getDraft(messageId, function(draftId, threadId, headers, bodyHtml) {
        track('Gmail draft loaded');
        // Populate the headers from the draft data.
        var HEADER_NAMES = ['Subject', 'To', 'Cc', 'Bcc', 'In-Reply-To', 'Message-ID', 'References'];
        console.log('got draft headers:', headers);
        _.each(HEADER_NAMES, function(headerName) {
          if (headerName in headers) {
            padModel.setHeader(headerName.toLowerCase(), headers[headerName]);
            console.log('setting model header ' + headerName + ' to ' + headers[headerName]);
          }
        });

        // Hang on to the draft id so we can delete the Gmail copy after sending.
        padModel.setHeader('gmail-draft-id', draftId);
        // Also hang on to the thread id so the draft gets set on the correct thread.
        padModel.setHeader('thread-id', threadId);

        // Populate the body from the draft data.
        if (firepad.ready) {  // poor man's async.join()
          firepad.setHtml(bodyHtml);
        } else {
          firepad.on('ready', _.bind(firepad.setHtml, firepad, bodyHtml));
        }
      }, function(response) {
        track('Gmail draft load failed');
        // failure
      });
    }

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
        // Find most recent pad
        userModel.getPads(function(pads) {
          //console.log('Users pads: ', _.keys(pads));
          var lastPadId = (typeof pads === 'object') ? _.findLastKey(pads) : null;
          callback(lastPadId);
        });
      }
    }

    function openPad(padId, authData) {
      authData = authData || firebase.getAuth();
      if (!authData) { return; }

      if (padId === 'new') { padId = null; }
      if (!!padModel && padModel.id === padId) { return; }

      if (!!padModel) { padModel.unbind(); }
      if (!!firepad) {
        firepad.setUserColor(null);
        firepad.dispose();
      }

      console.log("Opening pad " + (padId || "[new]"));
      padModel = rootModel.pad(padId, authData.uid);
      window.location.hash = padModel.id;

      padModel.setMe(authData.google.email, authData.google.displayName, queryParams.token,
          function(err) {
            if (!err) {
              // Confirmed we have access to this pad.
              padModel.removeInvitedEmail(authData.google.email);

              initCollaboration(authData, padModel);
              firepad = initFirepad(authData.uid, rootModel.refForPad(padModel.id));

              firepad.on('ready', function() {
                // Reset collaborator info as Firepad trashes color
                padModel.setMe(authData.google.email, authData.google.displayName);
              });
            }
          });

      // Remember this pad for the user.
      // Currently, this is the only way a pad ends up in a user's list; they have to visit it
      // at least once, presumably via a linked emailed to them.
      padModel.onHeaderChanged('subject', function(subject) {
        if (subject !== null) { // Don't trigger when pad being deleted
          userModel.rememberPad(padModel.id, subject);
        }
        document.title = 'Mailcoup - ' + (subject || 'New draft');
      });

      padModel.owner(function(owner) {
        track('Draft opened', {'New': !padId, 'Owned': owner === authData.uid});
        // Migration to ensure pads have owners: first viewer wins.
        if (owner == null) {
          owner = authData.uid;
          padModel.setOwner(owner);
        }

        initOwnershipUi(owner == authData.uid);
      });

      padModel.onRemoved(function() {
        window.location.hash = '';
      });

      return padModel;
    }

    function deletePad(authData) {
      padModel.owner(function(owner) {
        if (owner === authData.uid || owner == null) {
          console.log("Retracting and deleting pad " + padModel.id);
          padModel.collaborators(function(collaborators) {
            _.forOwn(collaborators, function(val, uid) {
              //if (uid == authData.uid) {
              //  userModel.forgetPad(padModel.id)
              //} else {
              rootModel.user(uid).forgetPad(padModel.id);
              //}
            });
            padModel.remove(); // Observer will see and refresh location.hash
          });

        } else {
          console.log("Forgetting reference to non-owned pad " + padModel.id);
          padModel.removeCollaborator(authData.uid);
          userModel.forgetPad(padModel.id);
          window.location.hash = '';
        }
      });
    }

    function onGoogleSignin(oauthToken) {
      console.log('Signed in with Google:', oauthToken);
      firebase.authWithOAuthToken("google", oauthToken.access_token, function(error, authData) {
        if (error) {
          console.log("Firebase login failed!", error);
        } else {
          console.log("Firebase login successful.");
        }
      });
    }

    function signOut() {
      gapi.auth.signOut();  // warning, no-op, see https://code.google.com/p/google-plus-platform/issues/detail?id=976
      firebase.unauth();
    }

    attachUiEvents({
      signIn: function() {
        gmail.authorize(onGoogleSignin);
        track('Sign-in clicked');

      },

      signOut: function() {
        track('Sign-out clicked');
        signOut();
      },

      newPad: function() {
        track('Draft new clicked');
        openPad(null);
      },

      deletePad: function() {
        track('Draft delete clicked');
        deletePad(firebase.getAuth());
      },

      sendEmail: function(onSuccess, onFailure) {
        var body = firepad.getHtml();
        var authData = firebase.getAuth();
        var googleAuth = authData.google;

        // TODO(alex): Replace nested callbacks with a promise chain
        padModel.headers(function (headers) {
          padModel.collaborators(function (collaborators) {
            // TODO(alex): Validate addressees, content
            var toRecipients = splitEmailAddresses(headers['to']);
            var ccRecipients = splitEmailAddresses(headers['cc']);
            var bccRecipients = splitEmailAddresses(headers['bcc']);
            var extraHeaders = {
              'In-Reply-To': headers['in-reply-to'],
              'Message-ID': headers['message-id'],
              'References': headers['references']
            };
            var threadId = headers['thread-id'];
            _.forEach(collaborators, function(collaborator) {
              if (!!collaborator.email && collaborator.email !== googleAuth.email) {
                bccRecipients.push(collaborator.email);
              }
            });
            track('Email send clicked', {
              'To': toRecipients.length,
              'Cc': ccRecipients.length,
              'Bcc': bccRecipients.length,
              'Collaborators': _.size(collaborators),
              'Has Thread-Id': !!threadId,
              'Has In-Reply-To': !!headers['in-reply-to'],
              'Body Length': body.length

            });

            var sendEmail = function(threadId, onSuccess, onFailure) {
              gmail.sendHtmlEmail(googleAuth,
                  toRecipients,
                  ccRecipients,
                  bccRecipients,
                  headers['subject'],
                  extraHeaders,
                  body,
                  threadId,
                  onSuccess,
                  onFailure);
            };

            var onSendSuccess = function(success) {
              console.log("Mail was sent!");
              track('Email send succeeded');

              // TODO(adam): consider using the chrome extension to refresh the UI, as the
              // deleted draft still appears.
              if (headers['gmail-draft-id']) {
                gmail.deleteDraft(headers['gmail-draft-id']);
              }

              onSuccess(success);
              deletePad(authData);
            };

            var onSendFailure = function(reason) {
              console.log("Failed to send :-(");
              track('Email send failed');
              onFailure(reason);
              signOut();
            };

            sendEmail(threadId, onSendSuccess, function(reason) {
              if (reason.status == 404) {
                // threadId is not found, meaning the original thread was deleted.
                // It's safe to send the email without the thread id, i.e. a solo message.
                threadId = '';
                sendEmail(threadId, onSendSuccess, onSendFailure);
              } else {
                onSendFailure(reason);
              }
            });
          });
        });
      }
    });
  }

  /////
  ///// UI
  /////

  function attachUiEvents(handlers) {
    document.getElementById("signin").onclick = handlers.signIn;
    document.getElementById("signout").onclick = handlers.signOut;
    document.getElementById("newpad").onclick = handlers.newPad;
    document.getElementById("deletepad").onclick = handlers.deletePad;
    document.getElementById("send").onclick = function(e) {
      var button = e.target;
      var oldTitle = button.value;
      button.disabled = true;
      button.value = "Sending...";
      handlers.sendEmail(function() {
        alert('Sent!');
        button.disabled = false;
        button.value = oldTitle;
      }, function(e) {
        button.disabled = false;
        button.value = oldTitle;
        alert('Send failed. Please sign in to try again.');
        // TODO(alex): Display failures to user
      });
    };
  }

  function signedIn(authData) {
    $('#signedin').attr('title', 'Signed in as ' + authData.google.email);
    $('#signedin .user').text(authData.google.displayName || authData.google.email);
    var profilePicUrl = authData.google.cachedUserProfile.picture;
    if (profilePicUrl) {
      $('#signedin .photo').show().css('background-image', 'url(' + profilePicUrl + '?imgmax=32)')
    } else {
      $('#signedin .photo').hide();
    }

    $('#landing').addClass('hidden');
    $('#app').removeClass('hidden');
    $('.account').removeClass('hidden');

    if (!window.location.hash.slice((1))) {
      var savedHash = window.localStorage.getItem('wemail.hash');
      var savedTimestamp = window.localStorage.getItem('wemail.timestamp');
      if (!!savedHash && (Date.now() - savedTimestamp < 10*60*60*1000)) {
        console.log('Restoring hash ' + savedHash);
        window.location.hash = savedHash;
      }
    }
  }

  function signedOut() {
    $('#signedin .user').text('');
    $('#signedin .photo').css('background-image', '');

    $('#landing').removeClass('hidden');
    $('#app').addClass('hidden');
    $('.account').addClass('hidden');

    var hash = window.location.hash.slice(1);
    if (!!hash) {
      console.log('Remembering hash ' + hash + ' for next auth');
      window.localStorage.setItem('wemail.hash', hash);
      window.localStorage.setItem('wemail.timestamp', Date.now());
    }
  }

  function bindUserData(userModel) {
    bindList(userModel.onPadListChanged, document.getElementById('otherpads'), function(val, padId) {
      var title = (!!val && !!val.subject && val.subject) || padId;
      return '<a href="#' + padId + '">' + title + '</a>';
    }, true /* newest displayed first */);
  }

  function initCollaboration(authData, padModel) {
    if (!authData) { return; }

    // Mail headers
    var headers = document.getElementById('headers');
    var HEADER_NAMES = [
        'to', 'cc', 'bcc', 'subject', 'in-reply-to', 'message-id', 'references', 'thread-id',
        'gmail-draft-id'];
    _.each(HEADER_NAMES, function(headerName) {
      bindHeaderField(padModel, headerName, headers.elements[headerName]);
    });

    // Collaborators
    var invitation = document.getElementById('invitation');
    invitation.onsubmit = function(evt) {
      var email = invitation.elements['email'].value;
      if (!!email) {
        padModel.addInvitedEmail(email, function() {
          padModel.accessToken(function(token) {
            track('Invitation sent');
            gmail.sendInvite(authData.google, email, padModel.id, token, function(response) {
              console.log('Invitation sent to ' + email + '.');
            }, function(reason) {
              console.log('Invitation failed to send to ' + email + ': ' + reason.result.error.message);
              padModel.removeInvitedEmail(email); // Enable re-trying the failed send later.
            });
          });
        });
        invitation.elements['email'].value = '';
      }
      return false;
    };

    bindList(padModel.onInvitedChanged, document.getElementById('invited'), function(value, key) {
      return '○ ' + value;
    });

    bindList(padModel.onCollaboratorsChanged, document.getElementById('collaborators'),
        function (obj, key) {
          var label = obj.displayName || obj.email || key;
          var color = obj.color || '#666';
          return '<span style="color: ' + color + ';">● </span>' + label;
        });

    // Chat
    var chatContainer = document.getElementById('chat-container');
    document.getElementById('chat-send').onclick = function() {
      var input = document.getElementById('chat-input');
      if (!!input.value) {
        track('Chat sent');
        padModel.sendChat(authData.uid, authData.google.displayName, input.value);
        input.value = '';
      }
    };
    bindList(padModel.onChatChanged, document.getElementById('messages'), function(val) {
      var d = new Date(val.timestamp);
      var dateStr =  d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' +
          d.getHours() + ':' + d.getMinutes() + ' ';

      return '<div class="chat-author">' + (val.displayName || val.userId) + '</div>' +
          '<div class="chat-timestamp">' + dateStr + '</div>' +
          '<div class="chat-message">' + val.message + '</div>';
    });

    padModel.onChatChanged(function() {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    // Only show the chat window if there are collaborators
    padModel.onCollaboratorsChanged(function(val) {
      $('#rightpanel > .chat').toggle(_.size(val) > 1);
    });
  }

  /**
   * Inits UI elements whose state depends on whether the user is the pad owner.
   */
  function initOwnershipUi(isOwner) {
    var sendEl = document.getElementById('send');
    if (isOwner) {
      sendEl.disabled = false;
      sendEl.innerHTML = 'Send from my Gmail';
      sendEl.title = 'Send draft to final recipients';
    } else {
      sendEl.disabled = true;
      sendEl.innerHTML = 'Sending disabled';
      sendEl.title = 'Only the original author can send.';
    }
  }

  function initFirepad(userId, padRef) {
    var padEl = document.getElementById('firepad');
    padEl.innerHTML = '';

    var codeMirror = CodeMirror(padEl, {lineWrapping: true});
    var firepad = Firepad.fromCodeMirror(padRef, codeMirror, {
      userId: userId,
      userColor: null, // We'll set color later
      richTextShortcuts: true,
      richTextToolbar: true,
      defaultText: ''
    });

    // Fix copy/paste behaviour, dapted from
    // https://github.com/iclems/javascriptcore-firebase/blob/master/JavaScriptCore%2BFirebaseJS/panelText.html
    // and https://gist.github.com/iclems/31b44bb7aba9bf7713a8
    var MIME_TYPE = {
      PLAIN: 'text/plain',
      HTML: window.clipboardData ? 'Text' : 'text/html'
    };
    var LineSentinelCharacter = '\uE000';
    var EntitySentinelCharacter = '\uE001';
    firepad.codeMirror_.getInputField().addEventListener('copy', function(e) {
      track('Draft content copied');
      var input = firepad.codeMirror_.getInputField();
      var copyText = input.value.replace(new RegExp('['+LineSentinelCharacter+EntitySentinelCharacter+']', 'g'), '');
      selectInput(input);
      if (e.clipboardData && e.clipboardData.setData) {
        e.preventDefault();
        e.clipboardData.setData(MIME_TYPE.PLAIN, copyText);
        e.clipboardData.setData(MIME_TYPE.HTML, firepad.getHtmlFromSelection());
        return false;
      }
    });

    firepad.codeMirror_.getInputField().addEventListener('paste', function(e) {
      track('Draft content pasted');
      if (e.clipboardData && e.clipboardData.getData) {
        var html = e.clipboardData.getData(MIME_TYPE.HTML);
        if (!!html) {
          firepad.codeMirror_.replaceSelection('');
          firepad.insertHtmlAtCursor(html);
          e.preventDefault();
          return false;
        }
      }
    });

    showSpinner(true);
    firepad.on('ready', function() {
      firepad.ready = true;
      showSpinner(false);
      console.log("Firepad ready");
    });
    //firepad.on('synced', function() { console.log("Firepad synced"); });
    return firepad;
  }

  function bindHeaderField(padModel, name, elt) {
    bindFormField(function(value) {padModel.setHeader(name, value); },
        function(callback) {padModel.onHeaderChanged(name, callback); },
        elt);
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
   * @param {Boolean} reverse If provided and true, the list will be iterated in reverse.
   */
  function bindList(listenFn, listElt, renderFn, reverse) {
    if (!renderFn) { renderFn = _.identity; }
    var iterateFn = reverse ? _.forOwnRight : _.forOwn;
    listenFn(function(value) {
      var html = '';
      iterateFn(value, function(val, key) {
        html += '<li>' + renderFn(val, key) + '</li>';
      });
      listElt.innerHTML = html;
    });
  }

  function showSpinner(show) {
    var className = !!show ? '' : 'hidden';
    document.getElementById('spinner-container').className = className;
  }

  function splitEmailAddresses(addresseeLine) {
    if (!!addresseeLine) {
      return _.filter(addresseeLine.split(/[,;] */), _.identity);
    }
    return [];
  }

  // From https://gist.github.com/iclems/31b44bb7aba9bf7713a8
  function selectInput(node) {
    var ios = /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent);
    if (ios) { // Mobile Safari apparently has a bug where select() is broken.
      node.selectionStart = 0;
      node.selectionEnd = node.value.length;
    } else {
      // Suppress mysterious IE10 errors
      try { node.select(); }
      catch(_e) {}
    }
  }

  /**
   * Returns access_token or empty string if not present in hash.
   *
   * @param  {String} hash The hash fragment from the URL.
   * @returns  {String}
   */
  // e.g. URL: http://mailcoup.com/draft/#access_token=ya29.VAHWo0rtfF6rMCrinWelhVeaxfe8B0HpX4vGtxAVzDI1M8pDtGgTGv8nHz8nabM55dHXhxjvSTnVgg&token_type=Bearer&expires_in=3600&code=4/VNQJS5B_9g6qJfUl56lgBBZ2AJlUVf62tMPnvF5QsgQ.4kzJvt0Ty6sUgrKXntQAax10cmBjmQI
  function maybeGetHashAccessToken(hash) {
    if (!hash) { return ''; };

    hash = hash.substr(1);  // remove '#' character
    if (!hash) { return ''; };

    // Assumes access_token is the first 'param' passed in the hash.
    var firstKeyValue = hash.split('&')[0].split('=');

    if (firstKeyValue.length == 2 && firstKeyValue[0] == 'access_token') {
      return firstKeyValue[1];
    } else {
      return '';
    }
  }

  function track(event, properties) {
    if (!isDev) {
      mixpanel.track(event, properties);
    } else {
      console.log("Track: " + event, properties);
    }
  }

  window.main = main;
})();


