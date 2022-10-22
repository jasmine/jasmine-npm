# How to work on a Jasmine Release

## Prepare the release
When ready to release - specs are all green and the stories are done:

1. If this is a major or minor release, publish the corresponding release of
   `jasmine-core` as described in that repo's `RELEASE.md`.
2. Create release notes using the Anchorman gem.
3. In `package.json`, update both the package version and the `jasmine-core`
   dependency version. This package should depend on the same major and minor
   version of `jasmine-core`. For instance, 4.1.1 should depend on
   `"jasmine-core": "^4.1.0"`.
4. Commit and push.
5. Wait for Circle CI to go green again.

## Publish the NPM package

1. Create a tag for the version, e.g. `git tag v4.4.0`.
2. Push the tag: `git push --tags`
3. Publish the NPM package: `npm publish`.

### Publish the GitHub release

1. Visit the GitHub releases page and find the tag just published.
2. Paste in a link to the correct release notes for this release.
3. If it is a pre-release, mark it as such.
4. Publish the release.
