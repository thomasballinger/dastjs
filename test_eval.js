'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var run = require('./run');
var Environment = run.Environment;
var evalGen = run.evalGen;
var Runner = run.Runner;

// environment with just an arity-2 sum function for testing
var justSum = new Environment([{'+': function(a, b){return a + b}}]);

describe('run.js', function(){
  describe('Environment', function(){
    it('should do lookup through scopes from right to left', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {});
      assert.deepEqual(env.lookup('a'), 2);
    });
    it('should use functions if not found in scopes', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {b:3});
      assert.deepEqual(env.lookup('b'), new run.NamedFunctionPlaceholder('b'));
    });
    it('should create new environments with scopes', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {});
      var newEnv = env.newWithScopeAndFuns({a:3}, {});
      assert.deepEqual(newEnv.lookup('a'), 3);
      assert.deepEqual(env.lookup('a'), 2);
    });
  });
  describe('evalGen', function(){
    it('should return an evaluation object', function(){
      var e = evalGen(1);
      assert(e.isEvalGen);
      assert.equal(e.ast, 1);
      var e = evalGen(parse('(+ 1 2)'), justSum);
      assert(e.isEvalGen);
      assert.deepEqual(e.ast, ['+', 1, 2]);
    });
  });
  describe('Invocation', function(){
    it('should be iterable', function(){
      var e = evalGen(parse('(+ 1 2)'), justSum);
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: 3, finished: true});
      assert.deepEqual(e.next(), {value: 3, finished: true});
    });
  });
  describe('Lambda', function(){
    it('should work', function(){
      assert.deepEqual(run('((lambda 1))'), 1);
      assert.deepEqual(run('((lambda a b (+ a b)) 1 2)', justSum), 3);
    });
  });
  describe('NamedFunction', function(){
    it('should work', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b}}]);
      run('(defn foo x y (+ x y))', tmpEnv);
      assert.isDefined(tmpEnv.funs.foo);
      assert.deepEqual(run('(foo 1 2)', tmpEnv), 3);
    });
  });
  describe('Set', function(){
    it('should change the rightmost occurence', function(){
      var tmpEnv = new Environment([{a: 1}, {a: 2}]);
      run('(set! a 3)', tmpEnv)
      assert.deepEqual(tmpEnv.scopes, [{a: 1}, {a: 3}]);
    });
  });
  describe('If', function(){
    it('should not evaluate the wrong case', function(){
      assert.deepEqual(run('(if 1 2 a)'), 2);
    });
  });
  describe('Begin', function(){
    it('should run stuff in order', function(){
      var tmpEnv = new Environment([{a: 2}]);
      run('(begin (set! a 3) (set! a 4))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes, [{a: 4}]);
    });
    it('should run all statements', function(){
      var tmpEnv = new Environment([{a: 2}]);
      run('(begin (define b 3) (define c 4) (define d 5))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes, [{a: 2, b: 3, c: 4, d: 5}]);
    });
    it('should run each statement once', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
      run('(begin (set! a (+ a 1)) (set! b (+ b 1)) (set! c (+ c 1)))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes[1], {a: 2, b: 2, c: 2});
    });
  });
  describe('define', function(){
    it('should create new variables in the local scope', function(){
      var tmpEnv = new Environment([{a: 2}, {a: 3}]);
      run('(define b 10)', tmpEnv)
      assert.deepEqual(tmpEnv.scopes, [{a: 2}, {a: 3, b: 10}]);
    });
  });
  describe('Runner', function(){
    it('should be iterable', function(){
      var e = new Runner('1');
      assert.deepEqual(e.next(), {value: 1, finished: true});
      var e = new Runner('(+ 1 2)');
      assert.deepEqual(e.next(), {value: null, finished: false});
    });
  });
  describe('run', function(){
    assert.deepEqual(run('1'), 1);
    assert.deepEqual(run('"a"'), "a");
    assert.deepEqual(run('(+ 1 2)', justSum), 3);
  });
});
