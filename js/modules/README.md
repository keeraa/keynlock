# ES-module migration boundary

New module code imports shared services from `runtime.mjs`. The current page
keeps its ordered classic scripts so `index.html` still works when opened via
`file://`; native module imports require the local development server.

Do not add new cross-file lexical globals. Publish a small `window.Keynlock*`
service from legacy code, expose it through `runtime.mjs`, and migrate the
consumer. Once direct-file launch is retired, the remaining classic scripts can
be converted one subsystem at a time without changing their public contracts.
