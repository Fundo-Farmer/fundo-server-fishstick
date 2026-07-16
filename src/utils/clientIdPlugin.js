/**
 * Adds an optional `clientId` field (set by the frontend's offline queue when
 * a record is created while disconnected) plus a sparse unique index scoping
 * it per-farm. "Sparse" matters here: the field has no default, so it's
 * simply absent on the vast majority of records created the normal
 * (connected) way — only documents that actually have a clientId participate
 * in the uniqueness check.
 *
 * Applied to every model whose creation goes through genericCrudFactory, so
 * offline-queued creates can be retried safely (see genericCrudFactory.create
 * and client/src/context/OfflineContext.jsx).
 */
module.exports = function clientIdPlugin(schema) {
  schema.add({ clientId: { type: String } });
};