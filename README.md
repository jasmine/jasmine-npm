[![Build Status](https://circleci.com/gh/jasmine/jasmine-npm.svg?style=shield)](https://circleci.com/gh/jasmine/jasmine-npm)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fjasmine%2Fjasmine-npm.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fjasmine%2Fjasmine-npm?ref=badge_shield)

# The Jasmine Module

The `jasmine` module is a command line interface and supporting code for running
[Jasmine](https://github.com/jasmine/jasmine) specs under Node.

The core of jasmine lives at https://github.com/jasmine/jasmine and is `jasmine-core` in npm.

## Contents

This module allows you to run Jasmine specs for your Node.js code. The output will be displayed in your terminal by default.

## Documentation

https://jasmine.github.io/edge/node.html

## Installation
```sh
# Local installation:
npm install --save-dev jasmine

# Global installation
npm install -g jasmine
```

## Initializing

To initialize a project for Jasmine

`jasmine init`

To initialize a project for Jasmine when being installed locally

`node_modules/.bin/jasmine init`

or

`npx jasmine init`

To seed your project with some examples

`jasmine examples`

## Usage

To run your test suite

`jasmine`

## Configuration

Customize `spec/support/jasmine.json` to enumerate the source and spec files you would like the Jasmine runner to include.
You may use dir glob strings.
More information on the format of `jasmine.json` can be found in [the documentation](http://jasmine.github.io/edge/node.html#section-Configuration)

Alternatively, you may specify the path to your `jasmine.json` by setting an environment variable or an option:

```shell
jasmine JASMINE_CONFIG_PATH=relative/path/to/your/jasmine.json
jasmine --config=relative/path/to/your/jasmine.json
```

## ES and CommonJS module compatibility

By default, Jasmine uses `import` to load spec files and helper files. This
should work for both ES modules and CommonJS modules. No additional 
configuration is required. If you need some files to be loaded via `require`,
add `"jsLoader": "require"` to `jasmine.json`. With that set, Jasmine will use 
`require` to load all files with names that don't end in `.mjs`.


# Filtering specs

Execute only those specs which filename match given glob:

```shell
jasmine "spec/**/critical/*Spec.js"
```

Or a single file:

```shell
jasmine spec/currentSpec.js
```

Or execute only those specs which name matches a particular regex:

```shell
jasmine --filter "adapter21*"
```

(where the *name* of a spec is the first parameter passed to `describe()`)

## Node version compatibility

Jasmine supports Node 12.x where x >=17, Node 14, and Node 16.


## Support

Documentation: [jasmine.github.io](https://jasmine.github.io)
Jasmine Mailing list: [jasmine-js@googlegroups.com](mailto:jasmine-js@googlegroups.com)
Twitter: [@jasminebdd](http://twitter.com/jasminebdd)

Please file issues here at Github

Copyright (c) 2008-2017 Pivotal Labs. This software is licensed under the MIT License.


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fjasmine%2Fjasmine-npm.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fjasmine%2Fjasmine-npm?ref=badge_large)
