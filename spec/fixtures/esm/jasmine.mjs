const config = {
  "spec_dir": ".",
  "spec_files": [
    "commonjs_spec.js",
    "esm_spec.mjs"
  ],
  "helpers": [
    "name_reporter.js",
    "commonjs_helper.js",
    "esm_helper.mjs"
  ],
  "stopSpecOnExpectationFailure": false,
  "env": {
    "random": false
  }
};
export default config;
