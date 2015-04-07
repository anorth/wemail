# WeMail website

The web UI for WeMail, i.e. http://wemail.firebaseapp.com.

Powered by Firebase, Firepad, Gmail APIs.

Note that all code under `src/` is published and live.

## Setup

Run a lightweight web server, e.g.:

    $ cd web/src/
    $ python -m SimpleHTTPServer

and open http://localhost:8000

(Note: firebase does not work with file:/// protocol addresses)

## Deployment - Firebase Hosting

To deploy to https://wemail.firebaseapp.com:

    $ cd web/
    $ firebase deploy

See https://www.firebase.com/docs/hosting/quickstart.html for more info.
