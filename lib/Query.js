//@ts-check
const System = require('../System');

module.exports = class Query {
  constructor(opts = {}) {
    this.opts = opts;
    if (opts.index) this.index = opts.index;
    else this.index = 'cars';
    if (!System.Consts.isRefreshedIndex(this.index))
      System.Consts.addToIndex(this.index);
    this.errors = [];
    this.build();
  }

  /**
   * Suche Attribut nach Name
   * @param {string} name
   */
  static getAttribute(name) {
    let attrArray = [];

    let { Attribute } = require('../System');
    for (let i in Attribute) {
      attrArray.push(Attribute[i]);
    }
    let attr = attrArray.filter((x) => x.attributNameExt == name);
    if (attr.length > 0) {
      return { found: true, ...attr[0] };
    } else {
      return { found: false, query: name };
    }
  }

  formatOutput(hits) {
    let hitsArray = [];
    for (let hit of hits) {
      hitsArray.push({ _id: hit._id, ...hit._source });
    }
    return hitsArray;
  }

  addPageAndOrder() {
    if (this.opts.pagination) {
      this.query['from'] =
        (this.opts.pagination.page - 1) * this.opts.pagination.perPage;
      this.query['size'] = this.opts.pagination.perPage;
    }

    if (this.opts.__sources) this.query['_source'] = this.opts.__sources;

    if (this.opts.order) {
      let optsOrder = this.opts.order.split(':');
      this.query['sort'] = `${optsOrder[0]}${
        Query.getAttribute(optsOrder[0]).datentyp.toLowerCase() === 'string' ||
        Query.getAttribute(optsOrder[0]).datentyp.toLowerCase() === 'textarea'
          ? '.keyword'
          : ''
      }:${optsOrder[1]}`;
    }
  }

  build() {
    let body = {};
    if (this.opts.search) {
      this.opts.search.query = this.opts.search.query.toLowerCase();
      body = {
        query: {
          [this.opts.search.type]: {
            [this.opts.search.field]:
              this.opts.search.field === 'match'
                ? this.opts.search.query
                : `*${this.opts.search.query}*`,
          },
        },
      };
    } else {
      body = {
        query: {
          match_all: {},
        },
      };
    }

    let query = {
      index: this.index,
      type: '_doc',
      sort: 'fzg_id:desc',
      body,
    };

    this.query = query;
    this.addPageAndOrder();
  }

  exec() {
    return new Promise((resolve, reject) => {
      System.ES.search(this.query, (err, res) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        resolve(this.handleResult(res));
      });
    });
  }

  showQuery() {
    return new Promise((resolve, reject) => {
      resolve(this.query.body);
    });
  }

  handleResult(res) {
    let total = System.Consts.totalHits[this.index];
    let found =
      res.hits !== undefined && res.hits.hits.length > 0 ? true : false;
    let page = 0;
    let availablePages = 0;
    let hits = !found ? 0 : res.hits.total > 10000 ? 10000 : res.hits.total;
    let filtered = found ? total - res.hits.total.value : 0;
    let hitsTotal = found ? res.hits.total.value : 0;
    if (filtered === 0) filtered = null;
    if (hits > 0) {
      if (this.opts.pagination !== undefined) {
        availablePages = Math.ceil(hits / this.opts.pagination.perPage);
        page = this.opts.pagination.page;
      } else {
        availablePages = Math.ceil(hits / 10);
        page = 1;
      }
    }
    let search = null;
    if (this.opts.search) {
      search = {
        [this.opts.search.field]: `${
          this.opts.search.type === 'wildcard'
            ? '%' + this.opts.search.query + '%'
            : this.opts.search.query
        }`,
      };
    }

    if (this.opts.filter) {
      search = 'filter';
    }

    return {
      found,
      hitsTotal,
      total,
      filtered,
      stats: {
        count: found ? res.hits.hits.length : 0,
        page,
        availablePages,
        order: this.opts.order ? this.opts.order : 'fzg_id:desc',
        search,
      },
      hits: found ? this.formatOutput(res.hits.hits) : null,
    };
  }

  static verifyQuery(query) {
    let valid = true;
    let messages = [];
    if (query.pagination !== undefined) {
      if (
        query.pagination.page === undefined ||
        query.pagination.perPage === undefined
      ) {
        valid = false;
        messages.push(
          'Seitenfunktion [pagination] erfordert Angabe von Seitenzahl [page] und Treffer pro Seite [perPage]'
        );
      }
      if (query.pagination.page < 1) {
        valid = false;
        messages.push('Seite [page] kann nicht kleiner als 1 sein');
      }
      if (valid) {
        if (query.pagination.page * query.pagination.perPage > 10000) {
          valid = false;
          messages.push(
            `Anfrage überschreitet höchste Seite [page] von ${Math.ceil(
              10000 / query.pagination.perPage
            )}`
          );
          messages.push(
            'Achtung: Es können nur 10000 Ergebnisse innerhalb einer Suche angezeigt werden'
          );
        }
      }
    }
    if (query.order) {
      if (query.order.indexOf(':') !== -1) {
        let splittedString = query.order.split(':');
        if (splittedString.length !== 2) {
          valid = false;
          messages.push(`Fehlerhafte Verwendung von : in Sortierung [order]`);
        } else {
          let field = splittedString[0];
          let order = splittedString[1];
          if (order !== 'asc' && order !== 'desc') {
            valid = false;
            messages.push(
              `Sortierreihenfolge "${order}" in Sortierung [order] fehlerhaft: "asc" oder "desc" nutzen`
            );
          }
          if (valid) {
            let isAtt = this.getAttribute(field).found;
            if (!isAtt) {
              valid = false;
              messages.push(
                `Attribut "${field}" in Sortierung [order] existiert nicht.`
              );
            }
          }
        }
      }
    }
    if (query.search) {
      if (
        query.search.type === undefined ||
        query.search.field === undefined ||
        query.search.query === undefined
      ) {
        valid = false;
        messages.push(
          `Suche [search] benötigt Typ [type], Attribut-Feld [field] und Suchstring [query]`
        );
      }
      if (valid) {
        if (query.search.type !== 'wildcard' && query.search.type !== 'match') {
          valid = false;
          messages.push(`Suchtyp [type], muss "match" oder "wildcard" sein`);
        }
      }
      if (query.search.field == 'fzg_id') {
        valid = false;
        messages.push(`Suche nach Fahrzeug-ID nicht gestattet`);
        messages.push(`Zur Suche nach Fahrzeug-IDs Endpunkt GET /index nutzen`);
        if (query.search.type === 'wildcard')
          messages.push(
            `Eine Wildcard-Suche nach Fahrzeug-IDs ist nicht möglich`
          );
      }
      if (valid) {
        let isAtt = this.getAttribute(query.search.field);
        if (!isAtt.found) {
          valid = false;
          messages.push(
            `Attribut "${query.search.field}" in Suche [field] existiert nicht.`
          );
        }
        if (valid) {
          isAtt.datentyp = isAtt.datentyp.trim().toLowerCase();
          if (isAtt.datentyp !== 'string' && isAtt.datentyp !== 'textarea') {
            valid = false;
            messages.push(
              `Attribut [field] in Suche [search] kann nur für Strings verwendet werden`
            );
            messages.push(
              `Für weitere Suchmöglichkeiten die Filter-Option [filter] nutzen`
            );
          }
        }
      }
    }
    return { valid, messages };
  }
};
