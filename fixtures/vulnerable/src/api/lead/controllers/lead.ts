export default {
  async create(ctx) {
    console.log(ctx.request.body);
    const callback = ctx.query.callback;
    const data = eval(ctx.request.body.expression);
    const response = await fetch(callback);
    ctx.body = { data, response: await response.text() };
  },
};
