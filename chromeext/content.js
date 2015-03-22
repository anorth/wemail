console.log('WeMail extension loaded.');

// Technique to detect new draft emails per:
// http://developer.streak.com/2012/11/how-to-detect-dom-changes-in-css.html
$('body').bind('animationstart MSAnimationStart webkitAnimationStart', function(event) {
  if (event.originalEvent.animationName == 'nodeInserted') {
    // This is the debug for knowing our listener worked!
    // event.target is the new node!
    console.debug("Another node has been inserted! ", event, event.target);

    var toolbar = $(event.target);

    var draftContainer = toolbar.children().first().clone();
    var draftButton = draftContainer.find('div[role=button]');
    draftButton
      .text('Share Draft')
      .attr('data-tooltip', 'Share Draft')
      .attr('aria-label', 'Share Draft');

    draftButton.on('click', function() {
      // TODO(adam): implement.
      console.log('Share draft not yet implemented.')
    });

    draftContainer.prependTo(toolbar);
  }
});
