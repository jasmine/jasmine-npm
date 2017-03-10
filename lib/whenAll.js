function whenAll(items, handler, done){
  var queueLength = items.length;
  if(queueLength === 0) {
    done();
    return;
  }

  var completed = 0;
  
  var queueableFnDone = function(){
    if(++completed  >= queueLength){
      done();
    }
  };

  if(handler.length > 1){
    items.forEach(function(item) {
      attempAsync(item, handler, queueableFnDone);
    }, this);
  } else  {
    items.forEach(function(item) {
      attempSync(item, handler, queueableFnDone);
    }, this);
  }
}

function attempAsync(argument, handler, queueableFnDone) {
    handler.call(null, argument, queueableFnDone);
}

function attempSync(argument, handler, queueableFnDone) {
    handler.call(null, argument);
    queueableFnDone();
}

module.exports = whenAll;
