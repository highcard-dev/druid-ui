;; Minimal deterministic DSP fixture, not an application guest. Output starts at byte 0.
(module
  (memory (export "memory") 1)
  (func (export "process") (param $frames i32) (param $channels i32) (param $rate f32)
    (local $offset i32) (local $end i32)
    local.get $frames local.get $channels i32.mul i32.const 4 i32.mul local.set $end
    (loop $samples
      local.get $offset f32.const 0.02 f32.store
      local.get $offset i32.const 4 i32.add local.tee $offset
      local.get $end i32.lt_u br_if $samples)))
