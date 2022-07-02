# Contributing to Jasmine

## Bug reports

Bug reports are welcome, but please help us help you by:

* Searching for existing issues (including closed issues) that are similar to
  yours
* Reading the [FAQ](https://jasmine.github.io/pages/faq.html)
* Providing enough information for someone else to to understand and reproduce
  the problem. In most cases that includes a clear description of what you're
  trying to do, the version of each Jasmine package that you're using, the Node
  version, and a minimal but complete code sample that demonstrates the problem.

## Contributing documentation

We welcome efforts to improve Jasmine's documentation. The source code for the
documentation site is at <https://github.com/jasmine/jasmine.github.io/>.

## Contributing code

Contributions are welcome, but we don't say yes to every idea. We recommend
opening an issue to propose your idea before starting work, to reduce the risk
of getting a "no" at the pull request stage.

Don't have an idea of your own but want to help solve problems for other
people? That's great! Have a look at the list of
[issues tagged "help needed"](https://github.com/issues?q=is%3Aopen+is%3Aissue+org%3Ajasmine+sort%3Aupdated-desc).

### The nuts and bolts of preparing a pull request

Jasmine is mature software that's downloaded millions of times a week and
supported by a tiny group of people in their free time. Anything that breaks
things for existing users or makes Jasmine harder to maintain is a tough sell.

Before submitting a PR, please check that:

* You aren't introducing any breaking changes
* `npm test` succeeds: tests pass, there are no eslint or prettier errors,
   and the exit status is 0
* Your change is well tested: you're reasonably confident that the tests will
  fail if somebody breaks your new functionality in the future
* Your code matches the style of the surrounding code


We use Circle CI to test pull requests against a variety of operating systems
and Node versions. Please check back after submitting your PR and make sure
that the build succeeded.
