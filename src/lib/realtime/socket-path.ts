/**
 * The Socket.IO mount point. Kept in its own module so route handlers and
 * browser code can reference it without pulling in the server bundle.
 */
export const socketPath = "/api/socket";
