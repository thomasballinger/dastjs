;(function() {
  'use strict';
  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var Immutable = require('./Immutable.js');

  function MouseTracker(canvasId){
    var self = this;
    this.canvas = document.getElementById(canvasId);
    var mouse = this.mouse = {x: 0, y: 0};
    var mousedown = this.mousedown = [false];

    Object.defineProperty(this, '_is_nondeterministic', {
      enumerable: false,
      value: true
    });

    this.canvas.addEventListener('mousemove', function(e){
      var rect = self.canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, false);
    this.canvas.addEventListener('mousedown', function(e){
      mousedown[0] = true;
    }, false);
    this.canvas.addEventListener('mouseup', function(e){
      mousedown[0] = false;
    }, false);
    this.canvas.addEventListener('touchstart', function(e){
      mousedown[0] = true;
    }, false);
    this.canvas.addEventListener('touchend', function(e){
      mousedown[0] = false;
    }, false);
  }
  //TODO save and restore mouse position for rewinds
  MouseTracker.prototype.mousepos = function(){
    return Immutable.List([this.mouse.x, this.mouse.y]);
  };
  MouseTracker.prototype.mousex = function(){
    return this.mouse.x;
  };
  MouseTracker.prototype.mousey = function(){
    return this.mouse.y;
  };
  MouseTracker.prototype.clicked = function(){
    return this.mousedown[0];
  };

  MouseTracker.MouseTracker = MouseTracker;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = MouseTracker;
    }
  } else {
    window.MouseTracker = MouseTracker;
  }
})();
