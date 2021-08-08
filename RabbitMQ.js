let amqp = require(`amqplib/callback_api`);

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const RMQ = process.env.RMQ || null;

if (!RMQ) process.exit(1);

const connString = RMQ;

class RabbitMQ {
  static connect() {
    return new Promise((resolve, reject) => {
      amqp.connect(connString, (err, conn) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Connected to RMQ`);
        resolve(conn);
      });
    });
  }

  static initExchangeChannel(connection, exchangeName, exchangeType = 'topic') {
    return new Promise((resolve, reject) => {
      connection.createChannel((err, chan) => {
        if (err) {
          reject(err);
          return;
        }
        chan.assertExchange(exchangeName, exchangeType);
        resolve(chan);
      });
    });
  }

  static initQueue(
    channel,
    exchangeName,
    queueName,
    subscribedTopics = [],
    options = {}
  ) {
    return new Promise((resolve, reject) => {
      channel.assertQueue(queueName, {}, (err, q) => {
        if (err) {
          reject(err);
          return;
        }
        if (options.prefetch && options.prefetchCount)
          channel.prefetch(options.prefetchCount);

        if (subscribedTopics.length < 1)
          channel.bindQueue(q.queue, exchangeName, '');
        else {
          subscribedTopics.forEach((x) =>
            channel.bindQueue(q.queue, exchangeName, x)
          );
        }
        resolve(q);
      });
    });
  }
}

module.exports = RabbitMQ;
