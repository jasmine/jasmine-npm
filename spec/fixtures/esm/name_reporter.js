console.log('name_reporter');

beforeAll(function() {
  jasmine.getEnv().addReporter({
    specStarted: function (event) {
      console.log('Spec:', event.fullName);
    }
  });
});
