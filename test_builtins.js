'use strict';
var chai = require('chai');
var assert = chai.assert;

var Immutable = require('./Immutable.js');
var builtins = require('./builtins.js');

function immutableListsEqual(a, b){
  assert(Immutable.List.isList(a));
  assert(Immutable.List.isList(b));
  assert.equal(a.count(), b.count());
    a.toJS().forEach( (_, i) => {
      assert.closeTo(a.get(i), b.get(i), 0.0000001);
    });
}

describe('builtins', function(){
  describe('bounce', function(){
    it('should work with points', function(){
        /*          * (1, 1)
         *          |
         *          V (0, -1)
         *
         *----+ (0, 0) ---> expected (1, 0)
         *    |
         *    |       */
      immutableListsEqual(
        builtins.get('bounce')(1, 1, 0, -1, Immutable.List([0, 0])),
        Immutable.List([1, 0]));
        /*          *(2, 2)
         *         /
         *       |/_ (-1, -1)
         *
         *----+ (0, 0)
         *    |
         *    |       */
      immutableListsEqual(
        builtins.get('bounce')(2, 2, -1, -1, Immutable.List([0, 0])),
        Immutable.List([1, 1]));
    });
    it('should work with lines', function(){
      immutableListsEqual(
        builtins.get('bounce')(123, 456, 0, -1, Immutable.List([
          Immutable.List([0, 1]), Immutable.List([1, 0])])),
          Immutable.List([1, 0]));
    });
  });
});