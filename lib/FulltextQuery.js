//@ts-check
const Query = require('./Query');

module.exports = class FulltextQuery extends (
  Query
) {
  build() {
    this.opts.pagination = {
      page: 1,
      perPage: this.opts.__size,
    };
    let body = {
      query_string: {
        query: this.opts.query,
        fields: ['fahrgestellnr^5', 'ordernummer^5', '*.*'],
      },
    };
    let query = {
      index: this.index,
      type: '_doc',
      sort: 'fzg_id:desc',
      body: { query: body },
    };
    this.query = query;
    this.addPageAndOrder();
  }
};
