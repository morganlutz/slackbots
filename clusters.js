'use strict';

const cluster = require('cluster');
const fs = require('fs');
const path = require('path');

class Workers {
  static get watchFileExtensions() {
    return ['.js', '.json'];
  }

  static get ignoreFiles() {
    return [];
  }

  static get ignoreDirectories() {
    return ['node_modules', '.git', 'data'];
  }

  static restart (file) {
    console.log(`Restarting workers due to file change: ${file}`);

    Object.keys(cluster.workers).forEach((workerID) => {
      cluster.workers[workerID].send({
        type: 'shutdown',
        from: 'master'
      });

      setTimeout((workerID) => {
        if (cluster.workers[workerID])
          cluster.workers[workerID].kill('SIGKILL');
      }, 6000);
    });
  }

  static watchPathForChanges (currentPath) {
    fs.readdir(currentPath, (err, files) => {
      if (!err) {
        for (let file of files) {
          let currentFile = `${currentPath}/${file}`;

          if (fs.lstatSync(currentFile).isDirectory() && !this.ignoreDirectories.includes(file)) {
            this.watchPathForChanges(currentFile);
          } else if (this.watchFileExtensions.includes(path.extname(file)) && !this.ignoreFiles.includes(file)) {
            fs.watch(currentFile, () => {
              clearTimeout(this.restartTimeout);

              this.restartTimeout = setTimeout((currentFile) => {
                this.restart(currentFile);
              }, 2000, currentFile);
            });
          }
        }
      }
    });
  }

  constructor() {
    if (cluster.isMaster) {
      const cpus = [1];

      console.log(`Setting up ${cpus.length} workers.`);

      for (let _ of cpus)
        this.fork();

      Workers.watchPathForChanges('./');

      cluster.on('exit', (deadWorker, code, signal) => {
        console.log(`Worker ${deadWorker.process.pid} died: ${signal || code || 'shutdown'}`);

        this.fork();
      });
    } else {
      process.on('message', (message) => {
        switch (message.type) {
        case 'shutdown':
          process.exit(0);
        }
      });

      console.log(`Worker ${process.pid} is alive.`);
    }
  }

  fork() {
    console.log('Starting new worker.');

    cluster.fork().on('message', (message) => {
      if (message.relay)
        for (let [, worker] of Object.entries(cluster.workers))
          worker.send(message);
    });
  }
}

module.exports = Workers;
