class ExitHandler {
  constructor(onExit) {
    this._onExit = onExit;
  }

  install() {
    process.on('exit', this._onExit);
  }

  uninstall() {
    process.removeListener('exit', this._onExit);
  }
}

module.exports = ExitHandler;
