// vim: set ft=scheme:
window.breakoutProgram = `
(define paddle-x 100)
(define paddle-y (- height 20))
(define ball-x 100)
(define ball-y (- height 50))
(define dx 1)
(define dy 1)
(define paddle-w 100)
(defn move (speed)
  (set! paddle-x (mousex))
  (set! ball-x (+ ball-x (* dx speed)))
  (set! ball-y (+ ball-y (* dy speed)))

  (if (or (< ball-x 10) (> ball-x (- width 10)))
    (set! dx (- 0 dx)))
  (if (< ball-y 0)
    (set! dy (- 0 dy)))
  (if (and (> ball-y paddle-y) (< (abs (- paddle-x ball-x)) (/ paddle-w 2)))
      (bounce))
  (if (> ball-y height)
    (do
      (display "restart")
      (set! ball-x 100)
      (set! ball-y 100))))
(defn bounce ()
  (set! dy (- 0 dy)))
(defn draw ()
  (color 200 200 30)
  (fillRect 0 0 width height)
  (color 200 0 100)
  (fillRect (- paddle-x (/ paddle-w 2))
            paddle-y paddle-w 10)
  (color 40 40 100)
  (fillRect (- ball-x 5) (- ball-y 5) 10 10)
  (render))

(defn main ()
  (move 1)
  (draw)
  (main))
(main)`;
