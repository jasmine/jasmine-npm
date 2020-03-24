var configurations = [];

exports.reporter = function Report(configuration) {
  configurations.push(configuration);
};

exports.configurations = configurations;
