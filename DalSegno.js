// This module only works in the browser
// (potential TODO: move things out of here so they can be tested with node)
;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    // This require is different that the others, it has an existence check
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      var lib = window[realname];
      if (lib === undefined){
        throw Error('Library '+name+' not loaded - please add it in a script tag');
      }
      return lib;
    };
  }

  var Immutable = require("./Immutable.js");
  var parse = require("./parse.js");
  var Environment = require("./Environment.js");
  var run = require("./run.js");
  var bcexec = require("./bcexec.js");
  var builtins = require("./builtins.js");
  var MouseTracker = require("./MouseTracker.js");
  var KeyboardTracker = require("./KeyboardTracker.js");
  var stdlibcode = require("./stdlibcode.js");
  var LazyCanvasCtx = require("./LazyCanvasCtx.js");
  var DrawHelpers = require("./DrawHelpers.js");


  //Player State enums
  function State(state){ this.state = state; }
  State.prototype.toString = function(){ return this.state + ': '+this.msg; };
  // Always use object identity to compare these (===)
  var PS = {
    Initial: new State('Initial', `mousein to start`),
    Unfinished: new State('Unfinished', `mousein to resume`),
    Finished: new State('Finished', `click to restart`),
    Error: new State('Error', `No handlers needed, editor onChange has got it`),
    History: new State('History', `viewing old history`),

    /* probably also will need:
     *
     * * paused on keyframe <- disable advance to keyframe buttons
     * * paused at end
     * * paused between keyframes
     * * paused at beginning
     */
  };

  // Editor messages
  var EM = {
    SyntaxError: new State('SyntaxError', `the source code is obviously invalid`),
    SyntacticDifference: new State('SyntacticDifference', `the source code has unimportant changes like more whitespace`),
    SemanticDifference: new State('SemanticDifference', ``),
  };

  function DalSegno(editorId, canvasId, errorBarId, consoleId, scrubberId, initialProgramId){
    //These are the four important state properties
    this.playerState = PS.Initial;
    this.runSomeScheduled = false;
    this.editorMessage = null;
    this.mouseMessage = null;
    this.scrubberMessage = null;
    Object.defineProperty(this, "isActive", {
      get: () => DalSegno.activeWidget === this,
      set: (x) => {
        if (x === true){
          DalSegno.activeWidget = this;
        } else if (x === false){
          throw Error("can't unset isActive");
        } else {
          throw Error("bad value for isActive property: "+x); }
      }
    });

    this.lastProgram = '';  // string of the currently running program's AST
                            // or an empty string if the program doesn't parse
    this.lastCleanupFunction = undefined; // cleans up message over canvas
    this.speed = 500;  // number of bytecode steps run per this.startRunning()
    this.highlight = false;  // whether to highlight each time an operation happens
    this.badSpot = undefined;  // currently highlighted ace Range of source code for error
    this.curSpot = undefined;  // currently highlighted ace Range of source code for cur
    this.DEBUGMODE = false;  // throw errors properly so we see tracebacks
    this.onChangeIfValid = function(s){};  // called after valid parse with new program
    this.rewindEffectCleared = true;

    this.editorId = editorId;
    this.canvasId = canvasId;
    this.consoleId = consoleId;
    this.errorBarId = errorBarId;
    this.scrubberId = scrubberId;

    initialProgramId = initialProgramId || editorId;
    this.initialContent = document.getElementById(initialProgramId);
    if (this.initialContent === null){
      this.initialContent = initialProgramId;
    } else {
      this.initialContent = this.initialContent.textContent;
    }
    this.onChangeIfValid(this.initialContent);

    this.runner = new run.Runner({});
    this.runner.setEnvBuilder( () => this.envBuilder() );

    this.initEditor();
    if (this.consoleId){ this.initConsole(); }
    this.initGraphics();
    this.initTrackers();
    if (this.scrubberId){ this.initScrubber(); }

    this.runner.registerStateful(this.lazyCanvasCtx);
    this.runner.registerRenderRequester(this.lazyCanvasCtx);

    this.initWindowWatcher();
    this.setMouseinToPlay();
  }
  DalSegno.activeWidget = undefined;
  DalSegno.windowWatcherSet = false;
  /** User wants to see something */
  DalSegno.prototype.go = function(){
    this.isActive = true;
    this.ensureRunSomeScheduled();
  };
  DalSegno.prototype.link = function(){
    //TODO links to versions without editors or with a console
    var base = 'http://dalsegno.ballingt.com/';
    //var base = './gamelib.html';
    var encoded = encodeURI(this.editor.getValue());
    return base + '?code='+encoded;
  };

  DalSegno.prototype.canvasMessage = function(strings, align){
    align = align || 'center';
    var ctx = this.canvas.getContext("2d");
    ctx.save();

    ctx.fillStyle = 'gray';
    if (align === 'center'){
      ctx.fillRect(
        this.canvas.width/2 - 140,
        this.canvas.height/2 - strings.length*30/2 - 5,
        280,
        strings.length*30+10);
    } else if (align === 'lowerRight') {
      ctx.fillRect(
        this.canvas.width - 280,
        this.canvas.height - strings.length*30 - 10,
        280,
        strings.length*30+10);
    } else {
      throw Error('Bad align value: '+align+' should be "center" or "lowerRight"');
    }
    ctx.font="30px Arial";
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "center";
    if (align === 'center'){
      for (var i=0, heightOffset=-(strings.length-1)/2*30; i < strings.length; i++, heightOffset+=30){
        ctx.fillText(strings[i], this.canvas.width/2, this.canvas.height/2 + heightOffset);
      }
    } else {
      for (var i=0, heightOffset=-(strings.length*2-1)/2*30; i < strings.length; i++, heightOffset+=30){
        ctx.fillText(strings[i], this.canvas.width - 140, this.canvas.height + heightOffset);
      }
    }

    ctx.restore();
  };
  DalSegno.prototype.setMouseinToPlay = function(){
    var ctx = this.canvas.getContext("2d");
    this.savedImage = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    var msg = ['Mouse over canvas', 'or edit source'];
    if (this.playerState === PS.Initial){
      msg.push('to start program.');
    } else if (this.playerState === PS.Finished){
      msg.push('to restart program.');
    } else if (this.playerState === PS.Unfinished){
      msg.push('to resume program.');
    } else {
      throw Error('called in wrong state: '+this.playerState);
    }
    this.canvasMessage(msg);
    var self = this;
    function cleanup(){
      self.effectCanvas.removeEventListener('mouseenter', handler);
      ctx.putImageData(self.savedImage, 0, 0);
      self.lastCleanupFunction = undefined;
    }
    self.lastCleanupFunction = cleanup;
    function handler(){
      self.mouseMessage = true;
      self.ensureRunSomeScheduled();
    }
    this.effectCanvas.addEventListener('mouseenter', handler);
  };
  DalSegno.prototype.setClickToRestart = function(){
    var ctx = this.canvas.getContext("2d");
    if (this.playerState !== PS.Finished){
      throw Error('called in wrong state: '+this.playerState);
    }
    this.canvasMessage(['Program finished.',
                        'Click canvas or',
                        'edit source',
                        'to run it again.'], 'lowerRight');
    var self = this;
    function cleanup(){
      console.log('calling cleanup function set by setClickToRestart');
      self.effectCanvas.removeEventListener('click', handler);
      ctx.clearRect(0, 0, 10000, 10000);
      self.lastCleanupFunction = undefined;
    }
    self.lastCleanupFunction = cleanup;
    function handler(){
      self.mouseMessage = true;
      self.ensureRunSomeScheduled();
    }
    this.effectCanvas.addEventListener('click', handler);
  };

  DalSegno.prototype.ensureRunSomeScheduled = function(){
    if (!this.runSomeScheduled){
      this.runSome();
    }
  };

  /** Advance the state of the program.
   *
   * This function can be scheduled to be run later,
   * so it must inspect the state of the DalSegno object
   * to determine what to do.
   * */
  DalSegno.prototype.runSome = function(){
    var doUpdate = false;
    var seekTo = false;

    // Check Queued Events
    if (this.editorMessage === EM.SyntacticDifference){
      console.log('difference in editor is only syntactic, nothing special to do');
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.editorMessage === EM.SemanticDifference){
      this.clearError();
      doUpdate = true;
      this.playerState = PS.Unfinished;
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.editorMessage === EM.Error){
      this.playerState = PS.Error;
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.mouseMessage){
      if (!this.lastCleanupFunction){
        console.warn('mouse message but no cleanup function');
      }
      this.lastCleanupFunction();
      this.mouseMessage = null;
      this.isActive = true;
    } else if (this.scrubberMessage !== null){
      console.log('scrubber message received:', this.scrubberMessage);
      this.clearError();
      this.isActive = true;
      this.playerState = PS.History;
      seekTo = this.scrubberMessage;
      this.scubberMessage = null;
    }

    // Determine next action based on state
    if (this.playerState === PS.Initial){
      //May not be syntactically valid, so we have to check.
      var safelyParses = false;
      var s = this.editor.getValue();
      try {
        safelyParses = bcexec.safelyParsesAndCompiles(s, this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
      } finally {
        // try/finally so message still sent in debug mode
        if (!safelyParses){
          this.sendMessageFromEditor(EM.SyntaxError);
          return;
        }
      }
      doUpdate = true;
    } else if (this.playerState === PS.Error){
      // nop, and don't schedule this.
      this.runSomeScheduled = false;
      return;
    } else if (this.playerState === PS.Finished){
      this.setClickToRestart();
      this.runSomeScheduled = false;
      return;
    } else if (this.playerState === PS.History){
      if (seekTo !== null){
        if (seekTo === 'first'){
          console.log('special case beginning');
        } else if (seekTo === 'last'){
          console.log('special case end');
        } else {
          this.runner.instantSeekToNthKeyframe(seekTo);
          this.drawRewindEffect();
          this.runSomeScheduled = false;
        }
      }
      return;
    }

    if (!this.isActive){
      console.log("Won't reschedule runSome because this widget is inactive!");
      this.setMouseinToPlay();
      this.runSomeScheduled = false;
      return;
    }
    this.runSomeScheduled = true;

    var run = () => {
      this.clearRewindEffect();
      if (this.highlight){
        this.highlightCurSpot(this.runner.getCurrentAST());
      }
      this.runSomeScheduled = true;
      this.runner.runABit(this.speed,
        (moreToRun)=>{
          if (moreToRun === 'error'){
            this.playerState = PS.Error;
          } else if (moreToRun){
            this.playerState = PS.Unfinished;
          } else {
            this.playerState = PS.Finished;
          }
          // long-running loop, so use setTimeout to allow other JS to run
          setTimeout( () => this.runSome(), 0);
        },
        this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
    };

    if (doUpdate){
      var s = this.editor.getValue();
      this.runner.update(s, (change)=>{
        if (!change){ run(); return; }
        if(this.lazyCanvasCtx){
          setTimeout(()=>{
            run();
          }, 200);
        } else {
          run();
        }
      });
    } else {
      run();
    }
  };

  DalSegno.prototype.stepHistoryToNextKeyframe = function(){
    var dest = this.runner.nextKeyframeIndex(this.runner.counter+1);
    if (dest === null){
      //TODO should go to last playable frame - this isn't
      //even stored anywhere right now I don't think.
      throw Error('Not implemented');
    }
    console.log('current counter:', this.runner.counter);
    console.log('want to step to', dest, this.runner.keyframeNums[dest]);
    this.stepHistoryTo(this.runner.keyframeNums[dest]);
  };
  DalSegno.prototype.stepHistoryToPrevKeyframe = function(){
    var dest = this.runner.prevKeyframeIndex(this.runner.counter-1);
    if (dest === null){
      //TODO should do a reset
      throw Error('Not implemented');
    }
    console.log('current counter:', this.runner.counter);
    console.log('want to step to', dest, this.runner.keyframeNums[dest]);
    this.stepHistoryTo(this.runner.keyframeNums[dest]);
  };
  DalSegno.prototype.withStrictCanvas = function(cb){
    var origLazy, origRewindEffect;
    if (this.lazyCanvasCtx){
      origLazy = this.lazyCanvasCtx.lazy;
      origRewindEffect = this.lazyCanvasCtx.rewindEffect;
      this.lazyCanvasCtx.lazy = false;
    }
    try {
      return cb();
    } finally {
      if (this.lazyCanvasCtx){
        this.lazyCanvasCtx.lazy = origLazy;
      }
    }
  };
  DalSegno.prototype.stepHistoryTo = function(dest){
    if (dest < this.runner.counter){
      this.stepHistoryBackward(this.runner.counter - dest);
    } else if (dest > this.runner.counter){
      this.stepHistoryForward(dest - this.runner.counter);
    }
  };
  DalSegno.prototype.stepHistoryForward = function(n){
    return this.withStrictCanvas(()=>{
      if (this.playerState !== PS.History){
        throw Error('bad player state!');
      }
      if (n === undefined){ n = 1; }
      this.highlightCurSpot(this.runner.getCurrentAST());
      this.drawRewindEffect();
      this.runner.runOneStep(true);

      // this means it's a key frame
      var sliderIndex = this.runner.prevKeyframeIndex();
      this.scrubber.value = sliderIndex;
      if (n > 1){
        setTimeout(()=> this.stepHistoryForward(n-1), 0);
      }
      //TODO check if we've reach a keyframe and if so adjust slider to that point
      //TODO check to see if there are no more history frames left!
      // (needs to be saved somewhere: the last counter ever run)
    });
  };
  DalSegno.prototype.stepHistoryBackward = function(n){
    return this.withStrictCanvas(()=>{
      if (this.playerState !== PS.History){
        throw Error('bad player state!');
      }
      if (n === undefined){ n = 1; }

      // goes one frame at a time
      var togo = this.runner.instantSeekToKeyframeBeforeBack(1);
      for (var i=0; i < togo; i++){
        this.runner.runOneStep(true);
      }

      this.highlightCurSpot(this.runner.getCurrentAST());
      this.drawRewindEffect();
      var sliderIndex = this.runner.prevKeyframeIndex();
      this.scrubber.value = sliderIndex;
      if (n > 1){
        setTimeout(()=> this.stepHistoryBackward(n-1), 0);
      }
      //TODO check if we've reach a keyframe and if so adjust slider to that point
      //TODO check to see if there are no more history frames left!
      // (needs to be saved somewhere: the last counter ever run)
    });
  };

  /** Invoked only by editor change handler */
  DalSegno.prototype.onChange = function(e){
    console.log('onChange running');
    var s = this.editor.getValue();
    var safelyParses = false;
    try {
      safelyParses = bcexec.safelyParsesAndCompiles(s, this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
    } finally {
      // try/finally so message still sent in debug mode
      if (!safelyParses){
        this.sendMessageFromEditor(EM.SyntaxError);
        return;
      }
    }

    this.onChangeIfValid(s);

    if (JSON.stringify(parse(s)) === this.lastProgram){
      this.lastProgram = s;
      this.sendMessageFromEditor(EM.SyntacticDifference);
    } else {
      this.lastProgram = s;
      this.sendMessageFromEditor(EM.SemanticDifference);
    }
  };
  DalSegno.prototype.sendMessageFromEditor = function(msg){
    this.isActive = true;
    this.editorMessage = msg;
    if (this.runSomeScheduled){
      return;
    }
    if (msg === EM.SyntaxError){
      this.playerState = PS.Error;
    }
    this.ensureRunSomeScheduled();
  };
  DalSegno.prototype.initWindowWatcher = function(){
    if (DalSegno.windowWatcherSet){ return; }
    window.addEventListener('blur', function(){
      console.log('tab seems inactive!');
      DalSegno.activeWidget = undefined;
    });
    DalSegno.windowWatcherSet = true;
  };
  DalSegno.prototype.onRuntimeOrSyntaxError = function(e){
    console.log(e.stack);
    this.errorbar.innerText = ''+e;
    this.errorbar.classList.remove('is-hidden');
    if (e.ast){
      Range = ace.require("ace/range").Range;
      //TODO investigate error annotations instead of markers
      if (this.badSpot){
        this.editor.getSession().removeMarker(this.badSpot);
      }
      this.badSpot = this.editor.session.addMarker(new Range(
        e.ast.lineStart-1,
        e.ast.colStart-1,
        e.ast.lineEnd-1,
        e.ast.colEnd), "errorHighlight");
      this.editor.resize(true);  // Ace editor bug requires this before nextline
      this.editor.scrollToLine(e.ast.lineStart-1, true, true, function(){});
      //this.editor.gotoLine(e.ast.lineStart-1, e.ast.colEnd-1);
    }
  };
  DalSegno.prototype.clearError = function(){
    this.errorbar.classList.add('is-hidden');
    if (this.badSpot){
      this.editor.getSession().removeMarker(this.badSpot);
      this.badSpot = undefined;
    }
  };
  DalSegno.prototype.highlightCurSpot = function(spot){
    if (this.curSpot){
      this.editor.getSession().removeMarker(this.curSpot);
    }
    if (!spot){ return; }
    Range = ace.require("ace/range").Range;
    //TODO investigate error annotations instead of markers
    this.curSpot = this.editor.session.addMarker(new Range(
      spot.lineStart-1,
      spot.colStart-2,
      spot.lineEnd-1,
      spot.colEnd), "curSpotHighlight");
  };
  DalSegno.prototype.initEditor = function(){
    this.editor = ace.edit(this.editorId);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.getSession().setMode("ace/mode/scheme");
    this.editor.commands.removeCommand('gotoline'); // bound to command-L which selects the url in osx chrome
    this.editor.getSession().setTabSize(2);
    this.editor.getSession().setUseSoftTabs(true);
    this.editor.$blockScrolling = Infinity;

    var editorContainer = document.getElementById(this.editorId);
    editorContainer.classList.remove('is-hidden');
    editorContainer.classList.add('dalsegno-editor');

    this.editor.setValue(this.initialContent, -1);

    this.editor.getSession().on('change', e => this.onChange(e));

    this.errorbar = document.getElementById(this.errorBarId);
    this.errorbar.classList.add('dalsegno-errorbar');
    this.clearError();
  };
  DalSegno.prototype.initConsole = function(){
    this.consoleElement = document.getElementById(this.consoleId);
    this.consoleElement.classList.add('dalsegno-console');
    this.consoleElement.readOnly = true;

    function preventScrollIfFullyScrolled(e){
      var d = e.wheelDelta || -e.detail,
          dir = d > 0 ? 'up' : 'down',
          stop = (dir == 'up' && this.scrollTop === 0) ||
                 (dir == 'down' && this.scrollTop === this.scrollHeight - this.offsetHeight);
      if (stop){
        e.preventDefault();
      }
    }
    this.consoleElement.addEventListener('mousewheel',
      preventScrollIfFullyScrolled);
    this.consoleElement.addEventListener('DOMMouseScroll',
      preventScrollIfFullyScrolled);

    this.console = new Console(this.consoleId);
  };
  DalSegno.prototype.initScrubber = function(){
    this.scrubber = document.getElementById(this.scrubberId);
    this.scrubber.min = 0;
    this.scrubber.max = 0;
    this.scrubber.value = 0;
    var onRender = (nums) => {
      this.updateScrubber(nums.length, nums.length);
    };
    this.runner.registerRenderCallback(onRender);
    this.scrubber.addEventListener('input', ()=>{
      var num = parseInt(this.scrubber.value);
      if (this.scrubber.value === this.scrubber.min){
        this.scrubberMessage = 'first';
      } else if (this.scrubber.value === this.scrubber.max){
        this.scrubberMessage = 'last';
      } else {
        this.scrubberMessage = num - 1;
      }
      this.ensureRunSomeScheduled();
    });
  };
  DalSegno.prototype.updateScrubber = function(numFrames, curFrame){
      this.scrubber.max = numFrames + 1;
      this.scrubber.value = curFrame + 1;
  };
  DalSegno.prototype.initTrackers = function(){
    this.mouseTracker = new MouseTracker(this.effectCanvasId);
    this.keyboardTracker = new KeyboardTracker(this.effectCanvasId);
  };
  DalSegno.prototype.initGraphics = function(){
    if (!this.canvasId){ throw Error('No canvas id provided'); }
    if (!document.getElementById(this.canvasId)){ throw Error("can't find canvas from id"); }
    this.canvas = document.getElementById(this.canvasId);
    this.canvas.classList.add('dalsegno-canvas');
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.lazyCanvasCtx = new LazyCanvasCtx(this.canvasId, true, false);
    this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));
    this.effectCanvasId = this.canvasId + '-effect';
    this.effectCanvas = document.createElement('canvas');
    this.effectCanvas.width = this.canvas.width
    this.effectCanvas.height = this.canvas.height
    this.effectCanvas.id = this.effectCanvasId;
    this.effectCanvas.style.cssText = document.defaultView.getComputedStyle(this.canvas, "").cssText;
    this.effectCanvas.style.backgroundColor = 'transparent';
    this.effectCanvas.classList.add('dalsegno-canvas');
    this.effectCanvas.classList.add('temp-identifier');
    this.canvas.parentElement.insertBefore(this.effectCanvas, this.canvas.nextSibling);
    this.effectCanvas = document.getElementsByClassName('temp-identifier')[0];
    this.effectCanvas.classList.remove('temp-identifier');
    this.effectCtx = this.effectCanvas.getContext('2d');
    this.effectCtx.clearRect(0, 0, 10000, 10000);
  };
  DalSegno.prototype.drawRewindEffect = function(){
    this.rewindEffectCleared = false;
    var w = this.effectCanvas.width;
    var h = this.effectCanvas.height;
    var fills = ['#666', '#eee', '#888', '#bbb'];
    this.effectCtx.clearRect(0, 0, 10000, 10000);
    for (var i=0; i<10; i++){
      this.effectCtx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
      this.effectCtx.fillRect(0, h/5 + Math.random()*h/12, w, h / 200);
    }
    for (var i=0; i<10; i++){
      this.effectCtx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
      this.effectCtx.fillRect(0, 3*h/5 + Math.random()*h/12, w, h / 200);
    }
  };
  DalSegno.prototype.clearRewindEffect = function(){
    if (this.rewindEffectCleared){ return; }
    this.rewindEffectCleared = true;
    this.effectCtx.clearRect(0, 0, 10000, 10000);
  };
  DalSegno.prototype.envBuilder = function(){
    return run.buildEnv(
      [builtins,
       stdlibcode,
       {}],
      [].concat(
        [window, console],
        this.canvas ? [this.canvas, this.lazyCanvasCtx, this.drawHelpers] : [],
        this.mouseTracker ? [this.mouseTracker] : [],
        this.keyboardTracker ? [this.keyboardTracker] : [],
        this.console ? [this.console] : [backupConsole]),
      this.runner);
  };

  function BackupConsole(){}
  BackupConsole.prototype.display = function(){
    var args = Array.prototype.slice.call(arguments);
    args = args.map( x => Immutable.List.isList(x) ? x.toJS() : x);
    return console.log.apply(console, args);
  };
  var backupConsole = new BackupConsole();

  DalSegno.DalSegno = DalSegno;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = DalSegno;
    }
  } else {
    window.DalSegno = DalSegno;
  }
})();
