# Host-owned platform capabilities

After the root SDK build, run `npm run dev --workspace=druid-example-druid-plattform`.

The guest loads `server.properties` on initialization. Edit its complete text,
write it, change the editor without saving, and read again to restore the saved
text. Comments, unknown properties, and values containing `=` remain intact.
Fetch status exercises a separate asynchronous HTTP tool against a local fixture.

The authored document uses a custom `ConfigEditor` React component, illustrating
how an application supplies its own controlled editor and state updates. Guest
behavior handles named actions and awaits host tools; it never constructs DOM.

`file_read`, `file_write`, and `http_get` are explicitly registered host handlers.
Files live in an instance-local Map and disappear when the page reloads. Only
`server.properties` and the local `status.json` resource are exposed. There is no
filesystem permission, real deployment, backend, or retired platform SDK here.

This retains both the old platform I/O example and the useful configuration
editor from its no-sandbox variant, without retaining the raw-JavaScript mode.
