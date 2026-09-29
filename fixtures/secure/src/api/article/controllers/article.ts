export default ({ strapi }) => ({
  async featured(ctx) {
    await strapi.contentAPI.validate.query(ctx.query, strapi.contentType('api::article.article'), { auth: ctx.state.auth });
    const query = await strapi.contentAPI.sanitize.query(ctx.query, strapi.contentType('api::article.article'), { auth: ctx.state.auth });
    const result = await strapi.documents('api::article.article').findMany(query);
    return strapi.contentAPI.sanitize.output(result, strapi.contentType('api::article.article'), { auth: ctx.state.auth });
  },
});
