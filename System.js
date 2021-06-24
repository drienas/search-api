const mongoose = require('mongoose');

const mongo = process.env.MONGO_DB;
const ELASTIC_API = process.env.ELASTIC_API;
const mongoUrl = `mongodb://${mongo}/cars`;

let Attributes, Dropdown;

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

const attributSchema = new mongoose.Schema(
  {
    attrId: Number,
    attrTyp: String,
    datentyp: String,
    attributNameExt: String,
  },
  { timestamps: true }
);

const dropdownSchema = new mongoose.Schema(
  {
    wibId: Number,
    attrId: Number,
    attrTyp: String,
    value: String,
  },
  { timestamps: true }
);

class Consts {
  static isRefreshedIndex(index) {
    return true;
  }
  static addToIndex(index) {
    return true;
  }

  static get totalHits() {
    return 0;
  }
}

class Sys {
  static get Attribute() {
    if (!this.__atts) this.__atts = [];
    return this.__atts;
  }

  static set Attribute(v) {
    if (!this.__atts) this.__atts = [];
    this.__atts.push(v);
  }
}

const elasticsearch = require('elasticsearch');
const ES = new elasticsearch.Client({
  host: ELASTIC_API,
});

const getDropdownKVbyID = async (attrId) => {
  let data = await Dropdown.find({ attrId });
  let arr = data.map((x) => ({ key: x._doc.wibId, value: x._doc.value }));
  return arr;
};

const ready = (cb) => {
  mongoose.connection.on('connected', async (err) => {
    console.log(`Connected to MongoDB`);
    Attributes = mongoose.model('Attribute', attributSchema);
    Dropdown = mongoose.model('Dropdown', dropdownSchema);

    let data = await Attributes.find({});

    for (let d of data) Sys.Attribute = d._doc;
    cb();
  });
};
module.exports = {
  Attribute: Sys.Attribute,
  Consts,
  ES,
  ready,
  getDropdownKVbyID,
};
