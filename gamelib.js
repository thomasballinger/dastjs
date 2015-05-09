;(function() {
  'use strict';

  function Builtin(){}
  Builtin.prototype.getFunctions = function(){
    var self = this;
    var bind = (function(methodName){
      return (function(){
        var args = Array.prototype.slice.call(arguments);
        return self[methodName].apply(self, args);
      });
    });
    var methods = {};
    for (var m in this) {
      if (typeof this[m] == "function") {
        methods[m] = bind(m);
      }
    }
    return methods;
  };
  function Gamelib(canvasId){
    this.canvas = document.getElementById(canvasId);
    this.ctx = canvas.getContext('2d');
  }
  Gamelib.prototype = new Builtin();
  Gamelib.prototype.width = function(){
    return this.canvas.width;
  };
  Gamelib.prototype.height = function(){
    return this.canvas.height;
  };
  Gamelib.prototype.drawRect = function(x, y, width, height){
    this.ctx.fillRect(x, y, width, height);
  };
  Gamelib.prototype.drawCircle = function(x, y, r){
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI*2, true); 
    this.ctx.closePath();
    this.ctx.fill();
  };
  Gamelib.prototype.clear = function(){
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };
  Gamelib.prototype.clearDrawRect = function(x, y, width, height){
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillRect(x, y, width, height);
  };

  Gamelib.Gamelib = Gamelib;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Gamelib;
    }
  } else {
    window.Gamelib = Gamelib;
  }
})();
