(function() {

  /** Firebase utility methods. */
  window.fbutil = {
    /**
     * Invokes a callback every time the value of a reference changes. The callback receives
     * the new state as a POJO.
     *
     * @param {Object} ref reference to monitor
     * @param {Function} callback function to invoke
     */
    onChanged: function(ref, callback) {
      ref.on('value', function (snapshot) {
        callback(snapshot.val())
      });
    },

    /**
     * Appends a value to an array reference if it is not already present.
     *
     * @param {Object} ref firebase node to mutate
     * @param {Object} value value to append
     * @param {Function} onAdd called if array was mutated
     */
    arraySetAdd: function(ref, value, onAdd) {
      return ref.transaction(function(current) {
        if (current == null) {
          current = [];
        }
        if (current.indexOf(value) == -1) {
          current.push(value);
          if (typeof onAdd === 'function') {
            onAdd();
          }
        }
        return current;
      });
    },

    /**
     * Removes all instances of a value from an array reference.
     *
     * @param {Object} ref firebase node to mutate
     * @param {Object} value value to append
     */
    arraySetRemove: function (ref, value) {
      ref.transaction(function(current) {
        if (current == null) {
          current = [];
        }
        var index = current.indexOf(value);
        while (index != -1) {
          current.splice(index, 1);
          index = current.indexOf(value);
        }
        return current;
      });
    }
  };
})();
