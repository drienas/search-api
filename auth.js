const axios = require('axios');
const AUTH_SERVER = process.env.AUTH_SERVER || null;

module.exports = async (req, res, next) => {
  try {
    if (!req.headers.authorization) throw `No Auth Header`;
    const token = req.headers.authorization.split(' ')[1];

    if (!AUTH_SERVER) throw `Authentication server not set`;
    let data = await axios.get(`${AUTH_SERVER}/validate/${token}`);
    if (data.status !== 200)
      throw `Authentication server responded with status code ${data.status}`;
    data = data.data;
    if (data.valid) next();
    else res.status(401).send('Unauthorized');
  } catch (error) {
    console.error(new Error(error));
    res.status(401).send('Unauthorized');
  }
};
