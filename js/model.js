/**
 * Data models and Firebase.
 */
(function() {
  var SUBJECT_MONTHS = ["January", "February", "March",
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

  // @see org/waveprotocol/wave/client/doodad/selection/SelectionAnnotationHandler.java
  var COLORS = [
    'rgb(81, 209, 63)', // Green
    'rgb(252, 146, 41)', // Orange
    'rgb(183, 68, 209)', // Purple
    'rgb(59, 201, 209)', // Cyan
    'rgb(209, 59, 69)', // Pinky Red
    'rgb(70, 95, 230)', // Blue
    'rgb(244, 27, 219)', // Magenta
    'rgb(183, 172, 74)', // Vomit
    'rgb(114, 50, 38)' // Poo
  ];

  window.model = {
    createRootModel: createRootModel
  };

  function createRootModel(firebase) {
    var usersRef = firebase.child('users');
    var padsRef = firebase.child('pads');

    return {
      user: function(userId) {
        return createUserModel(usersRef.child(userId));
      },

      pad: function(padId, userId) {
        var padModel = createPadModel(this.refForPad(padId, userId));
        if (!padId) {
          var now = new Date();
          var dateStr = now.getDate() + '-' + SUBJECT_MONTHS[now.getMonth()] + "-" + now.getFullYear();
          padModel.setHeader('subject', "Draft email " + dateStr);
        }
        return padModel;
      },

      refForPad: function(padId, userId) {
        if (!!padId) {
          return padsRef.child(padId);
        } else {
          if (!userId) {
            throw "User id required for new pad";
          }
          var ref = padsRef.push();
          ref.update({owner: userId});
          return ref;
        }
      },

      newPadRef: function() {
        return padsRef.push();
      }
    };
  }

  function createUserModel(userRef) {
    var padsRef = userRef.child('pads');

    return {
      rememberPad: function(padId, subject) {
        padsRef.child(padId).set({subject: subject || ""});
      },

      getPads: function(callback) {
        padsRef.once('value', function(snapshot) {
          callback(snapshot.val());
        });
      },

      forgetPad: function(padId) {
        padsRef.child(padId).remove();
      },

      onPadListChanged: function(callback) {
        fbutil.onChanged(padsRef, callback);
      }
    };
  }

  function createPadModel(padRef) {
    var usersRef = padRef.child('users');
    var invitedRef = padRef.child('invited');
    var headersRef = padRef.child('headers');

    function setMeMetadata() {
      var uid = padRef.getAuth().uid;
      var me = usersRef.child(uid);
      // Set priority so that subsequent iteration is correctly ordered.
      usersRef.once('value', function(snap) {
        if (snap.child(uid).getPriority() === null) {
          me.setPriority(Date.now());
        }
      });
      // Set cursor color based on collaborator order
      usersRef.once('value', function(snap) {
        var i = 0;
        snap.forEach(function(userSnap) {
          if (userSnap.key() === uid) {
            me.update({color: COLORS[i % COLORS.length]});
          }
          ++i;
        });
      });
    }

    return {
      get id() {
        return padRef.key();
      },

      owner: function(callback) {
        fbutil.once(padRef.child('owner'), callback);
      },

      setOwner: function(userId) {
        // Usually not required, called if someone hits a non-existing pad id, e.g. thru URL hash
        padRef.child('owner').set(userId);
      },

      headers: function(callback) {
        fbutil.once(headersRef, callback);
      },

      setHeader: function(headerName, value) {
        headersRef.child(headerName.toLowerCase()).set(value);
      },

      onHeaderChanged: function(headerName, callback) {
        fbutil.onChanged(headersRef.child(headerName.toLowerCase()), callback);
      },

      me: function(callback) {
        fbutil.once(usersRef.child(padRef.getAuth().uid), callback);
      },

      setMe: function(email, displayName) {
        usersRef.child(padRef.getAuth().uid).update({
          email: email,
          displayName: displayName
        });
        setMeMetadata();
      },

      collaborators: function(callback) {
        fbutil.once(usersRef, callback);
      },

      onCollaboratorsChanged: function(callback) {
        fbutil.onChanged(usersRef, callback);
      },

      removeCollaborator: function(userId) {
        usersRef.child(userId).remove();
      },

      addInvitedEmail: function(emailAddress, onsuccess) {
        fbutil.arraySetAdd(invitedRef, emailAddress, onsuccess);
      },

      removeInvitedEmail: function(emailAddress) {
        fbutil.arraySetRemove(invitedRef, emailAddress);
      },

      onInvitedChanged: function(callback) {
        fbutil.onChanged(invitedRef, callback);
      },

      sendChat: function(userId, displayName, message) {
        padRef.child('chat').push().set({
          userId: userId,
          displayName: displayName,
          message: message,
          timestamp: Date.now()
        });
      },

      onChatChanged: function(callback) {
        fbutil.onChanged(padRef.child('chat'), callback);
      },

      remove: function() {
        padRef.remove();
      },

      onRemoved: function(callback) {
        padRef.child('owner').on('value', function(snapshot) {
          //console.log("Owner: ", snapshot.val());
          if (snapshot.val() == null) {
            callback();
          }
        })
      },

      unbind: function() {
        invitedRef.off();
        usersRef.off();
        padRef.off();
      }
    };
  }
})();
