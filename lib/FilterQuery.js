//@ts-check
const Query = require('./Query');

module.exports = class FilterQuery extends (
  Query
) {
  initObject() {
    return {
      bool: {
        must: [],
        should: [],
        must_not: [],
        filter: [],
      },
    };
  }

  advancedBuilder() {
    return {
      body: function () {
        let bool = {
          must: this._must,
          should: this._should,
          must_not: this._mustnot,
          filter: this._filter,
        };
        if (bool.should.length > 0) bool['minimum_should_match'] = 1;
        return {
          bool,
        };
      },
      _must: [],
      _mustnot: [],
      _filter: [],
      _should: [],
      __swa: '*',
      __ewa: '*',
      __bool: function (obj) {
        this._filter.push({
          term: {
            [obj.field]: !!obj.query,
          },
        });
      },
      __missing: function (obj) {
        this._mustnot.push({
          exists: {
            field: obj.field,
          },
        });
      },
      __exists: function (obj) {
        this._must.push({
          exists: {
            field: obj.field,
          },
        });
      },
      __dateOrNumber: function (obj) {
        let operator = '_must';
        if (obj.operator !== undefined) operator = this.__setOps(obj);
        if (operator === 'null') {
          this.__missing(obj);
          return;
        }
        if (operator === 'exists') {
          this.__exists(obj);
          return;
        }
        if (obj.type == 'range') {
          this[operator].push({
            range: {
              [obj.field]: {
                from: obj.query[0] !== null ? obj.query[0] : 0,
                to:
                  obj.query[1] !== null && obj.query[1] !== undefined
                    ? obj.query[1]
                    : null,
              },
            },
          });
        } else {
          this[operator].push({
            match: {
              [obj.field]: obj.query,
            },
          });
        }
      },
      __string: function (obj) {
        let operator = '_must';
        if (obj.operator !== undefined) operator = this.__setOps(obj);
        if (operator === 'null') {
          this.__missing(obj);
          return;
        }
        if (operator === 'exists') {
          this.__exists(obj);
          return;
        }
        obj.field = `${obj.field}.pdvstring`;
        this[operator].push({
          [obj.type]: {
            [obj.field]:
              obj.type == 'wildcard'
                ? `${this.__swa}${obj.query}${this.__ewa}`
                : obj.query,
          },
        });
      },
      __setOps: function (obj) {
        this.__ewa = '*';
        this.__swa = '*';
        let op = obj.operator.split('/')[0];
        if (
          obj.operator.split('/')[1] !== undefined &&
          obj.operator.split('/')[1] == 'ew'
        )
          this.__ewa = '';
        if (
          obj.operator.split('/')[1] !== undefined &&
          obj.operator.split('/')[1] == 'sw'
        )
          this.__swa = '';
        let output = '_must';
        if (op === 'not') output = '_mustnot';
        if (op === 'is') output = '_must';
        if (op === 'should') output = '_should';
        if (op === 'null') output = 'null';
        if (op === 'exists') output = 'exists';
        return output;
      },
    };
  }

  arrayBuild(filterOpts = this.opts.filter) {
    let builder = this.advancedBuilder();
    for (let filter of filterOpts) {
      let attribut = FilterQuery.getAttribute(filter.field);
      let datatype = attribut.datentyp.toLowerCase();
      switch (datatype) {
        case 'bit':
          builder.__bool(filter);
          break;
        case 'money':
        case 'numeric':
        case 'int':
          function replaceNumericValue(x) {
            if (x && x.toString().indexOf(',') !== -1)
              return x.toString().replace(',', '.');
            return x;
          }
          if (filter.type === 'range')
            filter.query = filter.query.map((x) => replaceNumericValue(x));
          else filter.query = replaceNumericValue(filter.query);
        case 'slider':
        case 'date':
        case 'datetime':
          builder.__dateOrNumber(filter);
          break;
        case 'links':
        case 'colorpicker':
        case 'textarea':
        case 'features':
        case 'string':
        default:
          builder.__string(filter);
          break;
      }
    }
    return builder.body();
  }

  arrayLoop(parent) {
    let result = this.initObject();
    for (let obj of parent) {
      if (obj.and === undefined && obj.or === undefined)
        return this.arrayBuild(parent);
      if (obj.and !== undefined) {
        let hasChild = false;
        for (let subObj of obj.and) {
          if (
            (subObj.and === undefined &&
              subObj.or === undefined &&
              !hasChild) ||
            Array.isArray(subObj)
          ) {
            if (!Array.isArray(subObj)) subObj = [subObj];
            result.bool.must.push(this.arrayLoop(subObj));
          } else hasChild = true;
          if (subObj.and)
            result.bool.must.push({
              bool: { must: [this.arrayLoop([subObj])] },
            });
          if (subObj.or)
            result.bool.must.push({
              bool: { should: [this.arrayLoop([subObj])] },
            });
        }
      }
      if (obj.or !== undefined) {
        let hasChild = false;
        for (let subObj of obj.or) {
          if (
            (subObj.and === undefined &&
              subObj.or === undefined &&
              !hasChild) ||
            Array.isArray(subObj)
          ) {
            if (!Array.isArray(subObj)) subObj = [subObj];
            result.bool.should.push(this.arrayLoop(subObj));
          } else hasChild = true;
          if (subObj.and)
            result.bool.should.push({
              bool: { must: [this.arrayLoop([subObj])] },
            });
          if (subObj.or)
            result.bool.should.push({
              bool: { should: [this.arrayLoop([subObj])] },
            });
        }
      }
    }
    return result;
  }

  build() {
    let body = this.arrayLoop(this.opts.filter);
    let query = {
      index: this.index,
      type: '_doc',
      sort: 'fzg_id:desc',
      body: { query: body },
    };
    this.query = query;
    this.addPageAndOrder();
  }

  static verifyQuery(query) {
    let superQ = Query.verifyQuery(query);
    let valid = superQ.valid;
    let messages = superQ.messages;
    if (Array.isArray(query.filter)) {
      for (let filter of query.filter) {
        if (valid) {
          let attribut = FilterQuery.getAttribute(filter.field);
          if (!attribut.found) {
            valid = false;
            messages.push(
              `Attribut "${filter.field}" in Suche [field] existiert nicht.`
            );
          }
          if (valid) {
            let datatype = attribut.datentyp.toLowerCase();
            switch (datatype) {
              case 'bit':
                if (typeof filter.query !== 'boolean') {
                  valid = false;
                  messages.push(
                    `Attribut-Typ-Konflikt: Query [query] von Attribut [field] "${
                      filter.field
                    }" erwartet boolean. Erhalten: ${typeof filter.query}`
                  );
                }
                break;
              case 'slider':
              case 'money':
              case 'numeric':
              case 'int':
              case 'date':
              case 'datetime':
                if (filter.type !== 'match' && filter.type !== 'range') {
                  valid = false;
                  messages.push(
                    `Suchtyp [type] für Attribut [field] "${filter.field}", muss "match" oder "range" sein`
                  );
                }
                if (
                  filter.type === 'range' &&
                  typeof filter.query !== 'object'
                ) {
                  valid = false;
                  messages.push(
                    `Suche-Typ-Konflikt: Suchtyp [type] "range" von Attribut [field]"${
                      filter.field
                    }" erwartet array. Erhalten: ${typeof filter.query}`
                  );
                }
                break;
              case 'links':
              case 'colorpicker':
              case 'textarea':
              case 'features':
              case 'string':
              default:
                if (filter.type !== 'match' && filter.type !== 'wildcard') {
                  valid = false;
                  messages.push(
                    `Suchtyp [type] für Attribut [field] "${filter.field}", muss "match" oder "wildcard" sein`
                  );
                }
                break;
            }
          }
        }
      }
    }
    //return { valid, messages };
    return { valid: true, messages: null };
  }
};
