export default function Reporter() {}

Reporter.prototype.jasmineDone = function() {
    console.log('customReporter.mjs jasmineDone');
};

Reporter.prototype.isCustomReporterDotMjs = true;