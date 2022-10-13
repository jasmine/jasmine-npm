module.exports = function randomOrder(items) {
  const seed = generateSeed();
  const copy = items.slice();
  copy.sort(function (a, b) {
    return jenkinsHash(seed + a) - jenkinsHash(seed + b);
  });
  return copy;
};

function generateSeed() {
  return String(Math.random()).slice(-5);
}

// Bob Jenkins One-at-a-Time Hash algorithm is a non-cryptographic hash function
// used to get a different output when the key changes slightly.
// We use your return to sort the children randomly in a consistent way when
// used in conjunction with a seed

function jenkinsHash(key) {
  let hash, i;
  for (hash = i = 0; i < key.length; ++i) {
    hash += key.charCodeAt(i);
    hash += hash << 10;
    hash ^= hash >> 6;
  }
  hash += hash << 3;
  hash ^= hash >> 11;
  hash += hash << 15;
  return hash;
}
