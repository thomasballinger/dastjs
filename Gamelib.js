;(function() {
  'use strict';

  function numToHex(n){
    var s = n.toString(16);
    if (s.length == 1){
      s = '0' + s;
    }
    return s;
  }

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
    this.toRender = [];
    var mouse = this.mouse = {x: 0, y: 0};
    var mousedown = this.mousedown = [false];

    this.canvas.addEventListener('mousemove', function(e){
      var rect = canvas.getBoundingClientRect();
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
  Gamelib.prototype = new Builtin();
  Gamelib.prototype.mousepos = function(){
    return [this.mouse.x, this.mouse.y];
  };
  Gamelib.prototype.mousex = function(){
    return this.mouse.x;
  };
  Gamelib.prototype.mousey = function(){
    return this.mouse.y;
  };
  Gamelib.prototype.clicked = function(){
    return this.mousedown[0];
  };
  Gamelib.prototype.width = function(){
    return this.canvas.width;
  };
  Gamelib.prototype.height = function(){
    return this.canvas.height;
  };
  Gamelib.prototype.drawRect = function(x, y, width, height){
    var doIt = function(x, y, width, height){
      this.ctx.fillRect(x, y, width, height);
    };
    this.toRender.push([doIt, x, y, width, height]);
  };
  Gamelib.prototype.drawInverseCircle = function(x, y, r){
    var doIt = function(x, y, r){
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, 2 * Math.PI);
      this.ctx.rect(this.canvas.width, 0, -(this.canvas.width), this.canvas.height);
      this.ctx.fill();
    };
    this.toRender.push([doIt, x, y, r])
  };
  Gamelib.prototype.drawArc = function(x, y, r, start, end){
    if (start === undefined){
      start = 0;
    }
    if (end === undefined){
      end = 2 * Math.PI;
    }
    var doIt = function(x, y, r, start, end){
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, start * Math.PI / 180, end * Math.PI / 180, true);
      this.ctx.closePath();
      this.ctx.fill();
    };
    this.toRender.push([doIt, x, y, r, start, end]);
  };
  Gamelib.prototype.drawPoly = function(x, y, points, h){
    var doIt = function(x, y, points, h){
      points = points.map(function(arr){
        var dx = arr[0], dy = arr[1];
        return [x + dx * Math.cos(h * Math.PI / 180) - dy * Math.sin(h * Math.PI / 180),
                y + dx * Math.sin(h * Math.PI / 180) + dy * Math.cos(h * Math.PI / 180)];
      });
      this.ctx.beginPath();
      this.ctx.moveTo(points[0][0], points[0][1]);
      for (var i = 1; i < points.length; i++){
        this.ctx.lineTo(points[i][0], points[i][1]);
      }
      this.ctx.closePath();
      this.ctx.fill();
    };
    this.toRender.push([doIt, x, y, points, h]);
  };
  Gamelib.prototype.drawText = function(x, y){
    var args = Array.prototype.slice.call(arguments, 2);
    var text = args.join(" ");
    var oldFill = this.ctx.fillStyle;
    this.ctx.fillStyle = '#808080';
    this.ctx.font="30px Verdana";
    this.ctx.fillText(text, x, y);
    this.ctx.fillStyle = oldFill;
  };
  Gamelib.prototype.color = function(r, g, b){
    if (r === undefined || g === undefined || b === undefined){
      throw new Error("not enough arguments to color");
    }
    var doIt = function(r, g, b){
      var color = "#" + numToHex(r) + numToHex(g) + numToHex(b);
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = color;
    };
    this.toRender.push([doIt, r, g, b]);
  };
  Gamelib.prototype.render = function(r, g, b){
    if (r === undefined || g === undefined || b === undefined){
      if (r === undefined && g === undefined && b === undefined){
        r = 0; g = 0; b = 0; // use black as default bg
      } else {
        throw Error("Render takes three argument for color or none");
      }
    }
    var oldFill = this.ctx.fillStyle;
    this.ctx.fillStyle = "#" + numToHex(r) + numToHex(g) + numToHex(b);
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = oldFill;
    try {
      for (var i = 0; i < this.toRender.length; i++){
        var func = this.toRender[i][0];
        var args = this.toRender[i].slice(1);
        func.apply(this, args);
      }
    } finally {
      this.toRender = [];
    }
  };
  Gamelib.prototype.renderNoClear = function(){
    try {
      for (var i = 0; i < this.toRender.length; i++){
        var func = this.toRender[i][0];
        var args = this.toRender[i].slice(1);
        func.apply(this, args);
      }
    } finally {
      this.toRender = [];
    }
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