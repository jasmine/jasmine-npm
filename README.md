# The Jasmine Package

The `jasmine` package is a command line interface and supporting code for running
[Jasmine](https://github.com/jasmine/jasmine) specs under Node.

The core of jasmine lives at https://github.com/jasmine/jasmine and is `jasmine-core` in npm.

## Contents

This package allows you to run Jasmine specs for your Node.js code. The output will be displayed in your terminal by default.

## Documentation

https://jasmine.github.io/setup/nodejs.html

## Quick Start

Installation:

```sh
npm install --save-dev jasmine
```

To initialize a project for Jasmine:

```sh
npx jasmine init
````

To seed your project with some examples:

```sh
npx jasmine examples
````

To run your test suite:

```sh
npx jasmine
````

## ES and CommonJS module compatibility

Jasmine is compatible with both ES modules and CommonJS modules. See the 
[setup guide](https://jasmine.github.io/setup/nodejs.html) for more information.


## Node version compatibility

Jasmine supports Node 20, 22, and 24.

\* Environments that are past end of life are supported on a best-effort basis.
They may be dropped in a future minor release of Jasmine if continued support
becomes impractical.

## Support

Documentation: [jasmine.github.io](https://jasmine.github.io)<br>
Please file issues here at GitHub.

Copyright (c) 2014-2019 Pivotal Labs<br>
Copyright (c) 2014-2025 The Jasmine developers<br>
This software is licensed under the MIT License.
