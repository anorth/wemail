/**
 * Data models and Firebase.
 */
(function () {
  var SUBJECT_MONTHS = ["January", "February", "March",
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

  window.model = {
    createRootModel: createRootModel
  };

  function createRootModel(firebase) {
    var usersRef = firebase.child('users');
    var padsRef = firebase.child('pads');

    return {
      user: function (userId) {
        return createUserModel(usersRef.child(userId));
      },

      pad: function (padId, userId) {
        var padModel = createPadModel(this.refForPad(padId, userId));
        if (!padId) {
          var now = new Date();
          var dateStr = now.getDate() + '-' + SUBJECT_MONTHS[now.getMonth()] + "-" + now.getFullYear();
          padModel.setHeader('subject', "Draft email " + dateStr);
        }
        return padModel;
      },

      refForPad: function (padId, userId) {
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

      newPadRef: function () {
        return padsRef.push();
      }
    };
  }

  function createUserModel(userRef) {
    var padsRef = userRef.child('pads');

    return {
      rememberPad: function (padId, subject) {
        padsRef.child(padId).set({subject: subject || ""});
      },

      getPads: function (callback) {
        padsRef.once('value', function (snapshot) {
          callback(snapshot.val());
        });
      },

      forgetPad: function (padId) {
        padsRef.child(padId).remove();
      },

      onPadListChanged: function (callback) {
        fbutil.onChanged(padsRef, callback);
      }
    };
  }

  function createPadModel(padRef) {
    var usersRef = padRef.child('users');
    var invitedRef = padRef.child('invited');
    var headersRef = padRef.child('headers');

    return {
      get id() {
        return padRef.key();
      },

      owner: function (callback) {
        fbutil.once(padRef.child('owner'), callback);
      },

      setOwner: function (userId) {
        // Usually not required, called if someone hits a non-existing pad id, e.g. thru URL hash
        padRef.child('owner').set(userId);
      },

      headers: function (callback) {
        fbutil.once(headersRef, callback);
      },

      setHeader: function (headerName, value) {
        headersRef.child(headerName.toLowerCase()).set(value);
      },

      onHeaderChanged: function (headerName, callback) {
        fbutil.onChanged(headersRef.child(headerName.toLowerCase()), callback);
      },

      setMyCollaboratorProfile: function (email, displayName) {
        usersRef.child(padRef.getAuth().uid).update({email: email, displayName: displayName});
      },

      collaborators: function (callback) {
        fbutil.once(usersRef, callback);
      },

      onCollaboratorsChanged: function (callback) {
        fbutil.onChanged(usersRef, callback);
      },

      removeCollaborator: function (userId) {
        usersRef.child(userId).remove();
      },

      addInvitedEmail: function (emailAddress, onsuccess) {
        fbutil.arraySetAdd(invitedRef, emailAddress, onsuccess);
      },

      removeInvitedEmail: function (emailAddress) {
        fbutil.arraySetRemove(invitedRef, emailAddress);
      },

      onInvitedChanged: function (callback) {
        fbutil.onChanged(invitedRef, callback);
      },

      sendChat: function (userId, displayName, message) {
        padRef.child('chat').push().set({
          userId: userId,
          displayName: displayName,
          message: message,
          timestamp: Date.now()
        });
      },

      onChatChanged: function (callback) {
        fbutil.onChanged(padRef.child('chat'), callback);
      },

      remove: function () {
        padRef.remove();
      },

      onRemoved: function (callback) {
        padRef.child('owner').on('value', function (snapshot) {
          //console.log("Owner: ", snapshot.val());
          if (snapshot.val() == null) {
            callback();
          }
        })
      }
    };
  }
})();
