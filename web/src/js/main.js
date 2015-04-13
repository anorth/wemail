(function() {
  function main() {
    setSigninHref();
  }

  function setSigninHref() {
    var redirectUri = document.location.origin + '/draft';
    var siginInUrl = window.gmail.getSignInUrl(redirectUri);

    $('.actions .auth').attr('href', siginInUrl);
  }

  $(document).ready(main);
})();
