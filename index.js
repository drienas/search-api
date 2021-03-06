if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const AUTH_SERVER = process.env.AUTH_SERVER || null;
const auth = require('./auth');

const qex = require('./lib/QueryExecutors');
const System = require('./System');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const axios = require('axios');

const app = express();

app.use(morgan('common'));
app.use(cors());
app.use(bodyParser.json());

const filter = qex.filterQuery;
const run = qex.fullTextQuery;
const read = qex.indexQuery;

app.get('/definitions/wib/:id', auth, async (req, res) => {
  try {
    let data = await System.getDropdownKVbyID(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.get('/api/:version/:idx/index/:id', auth, (req, res) => {
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

app.post('/api/:version/:idx/filter', auth, (req, res) => {
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

app.get('/api/:version/:idx/full/:query', auth, (req, res) => {
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

app.post('/api/:version/:idx/full', auth, (req, res) => {
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

app.post('/auth/login', async (req, res) => {
  const body = req.body;

  const username = body.username;
  const password = body.password;

  if (!username || !password) {
    res
      .status(400)
      .json({ success: false, error: 'No username or no password set' });
  }

  try {
    if (!AUTH_SERVER) throw `Authentication server not set`;

    let data = await axios.post(`${AUTH_SERVER}/login`, { username, password });
    console.log(data.status);
    if (data.status !== 200)
      throw `Authentication server responded with status code ${data.status}`;

    data = data.data;
    res.json({ success: true, token: data.token });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

app.get('/auth/validate/:token', async (req, res) => {
  try {
    if (!AUTH_SERVER) throw `Authentication server not set`;
    const token = req.params.token;

    let data = await axios.get(`${AUTH_SERVER}/validate/${token}`);

    if (data.status !== 200)
      throw `Authentication server responded with status code ${data.status}`;

    data = data.data;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

app.post('/seax/reserve', auth, async (req, res) => {
  let body = req.body;
  console.log(body);
  if (!global.rmqChannel) {
    console.log(`No RMQ CHANNEL`);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver!`,
    });
    return;
  }
  try {
    await global.rmqChannel.publish(
      'search_x',
      'reservation.set',
      Buffer.from(JSON.stringify({ ...body }))
    );
    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver! - ${error}`,
    });
    return;
  }
});

app.post('/seax/cancelreservation', auth, async (req, res) => {
  let body = req.body;
  console.log(body);
  if (!global.rmqChannel) {
    console.log(`No RMQ CHANNEL`);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver!`,
    });
    return;
  }
  try {
    await global.rmqChannel.publish(
      'search_x',
      'reservation.delete',
      Buffer.from(JSON.stringify({ ...body }))
    );
    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver! - ${error}`,
    });
    return;
  }
});

app.post('/seax/comment', auth, async (req, res) => {
  let body = req.body;
  console.log(body);
  if (!global.rmqChannel) {
    console.log(`No RMQ CHANNEL`);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver!`,
    });
    return;
  }
  try {
    await global.rmqChannel.publish(
      'search_x',
      'reservation.comment',
      Buffer.from(JSON.stringify({ ...body }))
    );
    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver! - ${error}`,
    });
    return;
  }
});

app.post('/seax/order', auth, async (req, res) => {
  let body = req.body;
  console.log(body);
  if (!global.rmqChannel) {
    console.log(`No RMQ CHANNEL`);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver!`,
    });
    return;
  }
  try {
    await global.rmqChannel.publish(
      'search_x',
      'reservation.order',
      Buffer.from(JSON.stringify({ ...body }))
    );
    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      error: `Keine Verbindung zum Reservierungsserver! - ${error}`,
    });
    return;
  }
});

(async () => {
  System.ready(() => {
    app.listen(3333, () => console.log(`Listening on port 3333`));
  });
})();
