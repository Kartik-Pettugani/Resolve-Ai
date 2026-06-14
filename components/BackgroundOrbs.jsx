"use client";

import { useEffect, useRef } from "react";

const VS = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FS = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;

  vec3 base    = vec3(0.020, 0.020, 0.020);
  vec3 surface = vec3(0.074, 0.074, 0.074);
  vec3 blue    = vec3(0.341, 0.553, 1.000);
  vec3 purple  = vec3(0.816, 0.737, 1.000);

  float n1 = sin(uv.x * 2.8 + u_time * 0.25) * cos(uv.y * 2.4 + u_time * 0.20);
  float n2 = sin(uv.x * 1.6 + u_time * 0.18 + 1.2) * cos(uv.y * 3.1 + u_time * 0.14);

  float blueGlow   = smoothstep(0.55, 0.85, n1) * 0.045;
  float purpleGlow = smoothstep(0.60, 0.90, n2) * 0.030;

  vec3 color = mix(base, surface, uv.y + n1 * 0.08);
  color += blue   * blueGlow;
  color += purple * purpleGlow;

  gl_FragColor = vec4(color, 1.0);
}`;

function makeShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export default function BackgroundOrbs() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, makeShader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, makeShader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes  = gl.getUniformLocation(prog, "u_resolution");

    function sync() {
      const w = canvas.clientWidth  || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }
    }

    let raf;
    function render(t) {
      sync();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    const ro = new ResizeObserver(sync);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="shader-layer" aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
