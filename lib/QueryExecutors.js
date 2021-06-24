const FulltextQuery = require('./FulltextQuery');
const FilterQuery = require('./FilterQuery');

const indexQuery = (id, res, index = 'cars') => {
  const { ES } = require('../System');
  ES.get({
    index,
    type: '_doc',
    id,
  })
    .then((car) => {
      if (car.found) {
        res.status(200).json({ success: true, car });
      } else {
        res.status(404).json({ success: false, error: car });
      }
    })
    .catch((err) => {
      let status = 500;
      if (err.status) status = err.status;
      if (err.message)
        res.status(status).json({ success: false, error: err.message });
      else res.status(status).json({ success: false, error: err });
    });
};

const filterQuery = (body, res, index = 'cars') => {
  let validQuery = FilterQuery.verifyQuery(body);
  if (!validQuery.valid) {
    res
      .status(400)
      .json({ success: false, messages: validQuery.messages, query: body });
    return;
  }
  new FilterQuery({ ...body, index })
    .exec()
    .then((ans) => {
      if (!ans.found) {
        res.status(404).json({ success: false, ...ans });
      } else {
        res.status(200).json({ success: true, ...ans });
      }
    })
    .catch((err) => {
      res.status(500).json({ success: false, error: err });
    });
};

const fullTextQuery = (
  query,
  res,
  index = 'cars',
  size = 150,
  sources = null
) => {
  new FulltextQuery({ query: query, index, __size: size, __sources: sources })
    .exec()
    .then((ans) => {
      if (!ans.found) {
        res.status(404).json({ success: false, ...ans });
      } else {
        res.status(200).json({ success: true, ...ans });
      }
    })
    .catch((err) => {
      res.status(500).json({ success: false, error: err });
    });
};

module.exports = { fullTextQuery, filterQuery, indexQuery };
