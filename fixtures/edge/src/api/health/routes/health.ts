const conditionalRoutes = [];
export default {
  routes: [
    ...conditionalRoutes,
    { method: 'GET', path: '/health/live', handler: 'api::health.health.live', config: { auth: true } },
  ],
};
