'use client'

import { useEffect, useRef } from 'react'

const VERTEX = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

// Slow, domain-warped value noise mapped onto black → deep teal → teal, with
// occasional yellow streaks from an independent noise channel. Rendered
// small and blurred by CSS, so it reads as soft light moving behind the page.
const FRAGMENT = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  // Leaves the peaks alone but pushes the lows towards black, so most of
  // the screen stays dark and the colour gathers in a few blobs.
  float darkenLows(float x) {
    float cutoff = 0.55;
    float t = clamp(x / cutoff, 0.0, 1.0);
    return x > cutoff ? x : cutoff * pow(t, 2.4);
  }

  void main() {
    vec2 p = gl_FragCoord.xy / u_resolution.xy;
    p.x *= u_resolution.x / u_resolution.y;
    float angle = radians(-24.0);
    p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;

    float t = u_time * 0.05;
    vec2 warp = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t * 0.8));
    float n = fbm(p * 1.6 + warp * 1.1 + t * 0.5);
    float n2 = fbm(p * 0.8 - t * 0.3 + 5.2);
    float accent = fbm(p * 1.1 + warp * 0.6 - t * 0.4 + 12.3);

    float level = darkenLows(clamp(n * 0.65 + n2 * 0.35, 0.0, 1.0));

    vec3 black = vec3(0.0);
    vec3 deepTeal = vec3(0.012, 0.165, 0.200);  // #032a33
    vec3 teal = vec3(0.055, 0.455, 0.565);      // #0e7490, the app's light-mode accent
    vec3 brightTeal = vec3(0.090, 0.700, 0.760);
    vec3 yellow = vec3(0.980, 0.800, 0.082);    // #facc15, the app's dark-mode accent

    vec3 color = mix(black, deepTeal, smoothstep(0.22, 0.42, level));
    color = mix(color, teal, smoothstep(0.40, 0.60, level));
    color = mix(color, brightTeal, smoothstep(0.60, 0.82, level) * 0.7);
    // Yellow only in narrow bands of the accent channel, and only in the
    // darker gaps between teal blobs: over black it glows gold, whereas
    // mixed into teal it would turn green.
    float band = smoothstep(0.56, 0.68, accent) * (1.0 - smoothstep(0.72, 0.86, accent));
    float gap = 1.0 - smoothstep(0.38, 0.58, level);
    color = mix(color, yellow * 0.9, band * gap * 0.6);

    gl_FragColor = vec4(color, 1.0);
  }
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

// Render at 40% resolution: the CSS blur hides it, and it's far cheaper.
const SCALE = 0.4
// Start a few seconds in so the first frame already looks settled.
const TIME_OFFSET_MS = 7000

function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl')
    if (!canvas || !gl) return
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vs || !fs) return
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    // One oversized triangle covers the viewport.
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uTime = gl.getUniformLocation(program, 'u_time')

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 1
    let height = 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width * SCALE))
      height = Math.max(1, Math.round(rect.height * SCALE))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
    resize()
    window.addEventListener('resize', resize)

    const start = performance.now() - TIME_OFFSET_MS
    let frame = 0
    const draw = (now: number) => {
      gl.uniform2f(uResolution, width, height)
      gl.uniform1f(uTime, (reduceMotion ? TIME_OFFSET_MS : now - start) / 500)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduceMotion) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full scale-110 blur-[48px]" />
}

// Fixed behind everything. Static gradients underneath are the fallback when
// WebGL isn't available; a fade to black at the bottom keeps text readable.
export function BlobBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_15%,#0e749055,transparent),radial-gradient(40%_35%_at_85%_30%,#facc1514,transparent)]" />
      <Canvas />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/25 to-black/80" />
    </div>
  )
}
