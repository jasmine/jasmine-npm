module.exports = async function(modulePath) {
  return new Promise(resolve => {
    const module = require(modulePath);
    resolve(module);
  });
};
