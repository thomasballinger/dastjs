'use strict';

function TrimmableSlider(sliderId){
  this.id = sliderId;
  this.slider = document.getElementById(sliderId);

  this.slider.min = 0;
  this.slider.max = 100;
  this.slider.value = 40;
  this.slider.addEventListener('input', ()=> this.onInput() );

  this.coverer = this.makeCoverer();
  this.cover(0);

  this.prevValue = parseInt(this.slider.value);
}
/** Make current value the max with an animation */
TrimmableSlider.prototype.dropBeyond = function(cb){
  if (this.slider.value === this.slider.max){ return; }

  this.slider.disabled = true;
  var spot = parseInt(this.slider.value);
  console.log('cutting beyond', spot);
  this.cover(1 - spot / parseInt(this.slider.max));
  this.disappear(()=>{
    this.expand(()=>{
      cb();
      this.slider.disabled = false;
    });
  });
};
/** called by input handler */
TrimmableSlider.prototype.onInput = function(e){
  console.log('changed to', this.slider.value);
};
TrimmableSlider.prototype.makeCoverer = function(){
  var c = document.createElement('div');
  c.style.background = '#fff';
  var els = window.getComputedStyle(this.slider);
  c.style.position = els.position=='fixed' ? 'fixed':'absolute';
  c.style.zIndex = parseInt(els.zIndex)+1;
  document.body.appendChild(c);
  c.style.width = this.slider.offsetWidth;
  c.style.height = this.slider.offsetHeight;
  c.style.left = this.slider.offsetLeft;
  c.style.top = this.slider.offsetTop;
  this.origSliderWidth = parseInt(this.slider.offsetWidth);
  this.origSliderLeft = parseInt(this.slider.offsetLeft);
  return c;
};
TrimmableSlider.prototype.cover = function(fraction){
  var radius = 7.5; // magic number
  this.coverer.style.width = (this.origSliderWidth - 2*radius) * fraction;
  this.coverer.style.left = this.origSliderLeft + (this.origSliderWidth - 2*radius) * (1 - fraction) + 2*radius;
};
TrimmableSlider.prototype.disappear = function(cb){
  this.coverer.style.opacity = 0;
  this._disappear(cb);
};
TrimmableSlider.prototype._disappear = function(cb){
  var opacity = parseFloat(this.coverer.style.opacity);
  if (opacity === 1){
    return cb();
  } else {
    this.coverer.style.opacity = Math.min(1, opacity + 0.01);
    setTimeout(()=>this._disappear(cb), 10);
  }
};
TrimmableSlider.prototype.expand = function(cb){
  var delta = 1;
  if (this.slider.max === this.slider.value){
    return cb();
  } else {
    var dest = Math.max(parseInt(this.slider.value), parseInt(this.slider.max) - delta);
    this.slider.max = dest;
    this.cover(1 - parseInt(this.slider.value) / dest);
    setTimeout(()=>this.expand(cb), 10);
  }
};

TrimmableSlider.TrimmableSlider = TrimmableSlider;


if (typeof __webpack_require__ === 'function'){
  module.exports = TrimmableSlider;
} else {
  // fine, global TrimmableSlider is the only exported thing
}