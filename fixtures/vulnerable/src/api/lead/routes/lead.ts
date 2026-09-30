export default {
  routes: [
    {
      method: 'POST',
      path: '/leads',
      handler: 'api::lead.lead.create',
      config: { auth: false },
    },
  ],
};
