// glob interprets backslashes as escape sequences, not directory separators.
// Convert them to slashes. Should only be called when running on Windows.
module.exports = function unWindows(dir) {
  return dir.replace(/\\/g, '/');
};