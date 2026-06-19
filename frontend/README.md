This folder contains the static site for Cloudflare Pages.

Quick start (Cloudflare Pages):

- Connect this repository to Cloudflare Pages and set the build output directory to `frontend/`.
- The site is a static demo which calls the Worker API at `/api/players`.

Auth demo

- Use the form to `Register` and `Login`. The demo stores the returned token in `localStorage` and sends it in `Authorization` headers for requests.
- For production use, ensure Pages is served under the same root as the API or configure the API base URL accordingly.
