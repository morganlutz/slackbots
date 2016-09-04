const cluster = require('cluster');

const Workers = require('./clusters');

new Workers();

if (!cluster.isMaster) {
  require('./robin-bot/app');
}
