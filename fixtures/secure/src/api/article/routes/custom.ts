export default {
  routes: [
    {
      method: 'GET',
      path: '/articles/featured',
      handler: 'api::article.article.featured',
      config: { auth: true, policies: ['api::article.can-read'] },
    },
  ],
};
