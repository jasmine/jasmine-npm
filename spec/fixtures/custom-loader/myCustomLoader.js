console.log('loaded myCustomLoader.js');

module.exports = async function myCustomLoader(path) {
  if (path.endsWith('.json')) {
    return new Promise(resolve => resolve(require(path)));
  } else if (path.endsWith('/aSpec.js')) {
    return await import('./contentsOfASpec.js');
  } else {
    const e = new Error(`Don't know how to load ${path}`);
    e.code = 'ERR_MODULE_NOT_FOUND';
    throw e;
  }
};
