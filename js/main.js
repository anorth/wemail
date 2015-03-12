(function () {

  var firebase = new Firebase("https://wemail.firebaseio.com/");

  var codeMirror = CodeMirror(document.getElementById('firepad'), {lineWrapping: true});
  var firepad = Firepad.fromCodeMirror(firebase, codeMirror, {
    //userId: userId,
    richTextShortcuts: true,
    richTextToolbar: true,
    defaultText: 'Hello, World!'
  });


  firepad.on('ready', function() { console.log("Firepad ready"); });
  firepad.on('synced', function() { console.log("Firepad synced"); });

})();

