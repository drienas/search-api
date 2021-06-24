if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const qex = require('./lib/QueryExecutors');
const System = require('./System');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();

app.use(morgan('common'));
app.use(cors());
app.use(bodyParser.json());

const filter = qex.filterQuery;
const run = qex.fullTextQuery;
const read = qex.indexQuery;

app.get('/definitions/wib/:id', async (req, res) => {
  try {
    let data = await System.getDropdownKVbyID(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.get('/api/:version/:idx/index/:id', (req, res) => {
  let id = req.params.id;
  let index = req.params.idx;
  switch (req.params.version) {
    case 'v1':
      read(id, res);
      break;
    case 'v2':
    case 'v3':
      read(id, res, index);
      break;
    default:
      res.status(400).json({ success: false, message: 'Unbekannte Version' });
      break;
  }
});

app.post('/api/:version/:idx/filter', (req, res) => {
  switch (req.params.version) {
    case 'v1':
      filter(req.body, res);
      break;
    case 'v2':
      filter(req.body, res, req.params.idx);
      break;
    default:
      res.status(400).json({ success: false, message: 'Unbekannte Version' });
      break;
  }
});

app.get('/api/:version/:idx/full/:query', (req, res) => {
  switch (req.params.version) {
    case 'v1':
      run(req.params.query, res);
      break;
    case 'v2':
    case 'v3':
      run(req.params.query, res, req.params.idx);
      break;
    default:
      res.status(400).json({ success: false, message: 'Unbekannte Version' });
      break;
  }
});

app.post('/api/:version/:idx/full', (req, res) => {
  switch (req.params.version) {
    case 'v1':
      res.status(405).send('');
      break;
    case 'v2':
      res.status(405).send('');
      break;
    case 'v3':
      run(
        req.body.query ? req.body.query : '*',
        res,
        req.params.idx,
        req.body.size,
        req.body.sources
      );
      break;
    default:
      res.status(400).json({ success: false, message: 'Unbekannte Version' });
      break;
  }
});

(async () => {
  System.ready(() => {
    app.listen(3333, () => console.log(`Listening on port 3333`));
  });
})();
