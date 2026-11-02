// Docker healthcheck and deploy check. Does not touch MongoDB, so a slow database does not restart the container.
export default defineEventHandler(() => ({ ok: true }))
