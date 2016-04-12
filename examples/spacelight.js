// vim: set ft=scheme:
window.spaceLightProgram = `; That headlight looks a little underpowered!
; Try changing the last two arguments to draw-black
; on line 74, or delete that line altogether.
; Then make more changes to see how the game works!
; Language documentation:
; https://github.com/thomasballinger/dalsegno#user-content-language

(defn init-world ()
  (map (lambda (i)
         (list
           (list (randint 200) (randint 200))
           (list (randint -5 6) (randint -5 6))))
       (range 10)))

(defn wrap-obj (obj)
  (list
    (list (% (first (first obj)) width)
          (% (last (first obj)) height))
    (last obj)))

(defn step-obj (obj)
  (list
    (list (+ (first (first obj)) (first (last obj)))
          (+ (last (first obj)) (last (last obj))))
    (last obj)))

(defn render-obj (obj)
  (color 110 45 2)
  (define radius 20)
  (drawArc (first (first obj))
            (nth 1 (first obj))
            radius))

(defn draw-black (x y h d angle)
    (color 0 0 0)
    (drawArc x y 1000 (+ h 180 angle) (+ h angle))
    (drawArc x y 1000 (- h angle) (- (+ h 180) angle))
    (drawInverseCircle x y d))

(defn game ()
  (define x 300)
  (define y 300)
  (define vx 1)
  (define vy 1)
  (display "game started")
  (define world (init-world))
  (defn nearby (obj)
    (< (dist x y (first (first obj)) (nth 1 (first obj))) 300))
  (defn collide (obj)
    (< (dist x y (first (first obj)) (nth 1 (first obj))) 23))
  (defn any-collide () (reduce or (map collide world) 0))
  (defn to-render () world)
  (define counter 0)
  (defn on-click ()
    (define towards-mouse (towards x y (mousex) (mousey)))
    (set! vx (+ vx (* (x_comp towards-mouse) .5)))
    (set! vy (+ vy (* (y_comp towards-mouse) .5)))
    (color 200 150 0)
    (drawPoly x y
      (list (list -13 -10)
            (list -9 -10)
            (list -9 10)
            (list -13 10))
      (towards x y (mousex) (mousey))))

  (defn main ()
    (define h (towards x y (mousex) (mousey)))
    (color 200 200 30)
    (fillRect 0 0 width height)
    (color 40 40 100)
    (map render-obj (to-render))

    (draw-black x y h 100 25)  ;change this line!

    (color 30 100 200)
    (drawPoly x y
      (list (list 15 0) (list -10 -12) (list -10 12))
      (towards x y (mousex) (mousey)))

    (set! world (map step-obj world))
    (set! world (map wrap-obj world))
    (if (clicked) (on-click))
    (set! x (+ x vx))
    (set! y (+ y vy))
    (if (> x width) (set! x 0))
    (if (> y height) (set! y 0))
    (if (< x 0) (set! x width))
    (if (< y 0) (set! y height))
    (render 200 200 1)
    (if (not (any-collide))
        (do
          (set! counter (+ counter 1))
          (main))
        (do
          (map render-obj (to-render))
          (drawText 100 100 "your score:" counter)
          (display "your score:" counter)
          (render)
          )))
  (main))

(defn wait-for-unclick ()
  (if (clicked)
      (wait-for-unclick)))
(defn wait-for-click ()
  (if (not (clicked))
      (wait-for-click)))
(defn play-forever ()
  (game)
  (wait-for-unclick)
  (wait-for-click)
  (play-forever))
(play-forever)`;
