import React, { useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import {
  TextureLoader,
  AdditiveBlending,
  BackSide,
  ShaderMaterial,
} from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// 🌍 Earth + Clouds
function Earth() {
  const earthRef = useRef();
  const cloudsRef = useRef();

  const [earthMap, cloudMap] = useLoader(TextureLoader, [
    "/textures/earth_daymap.jpg",
    "/textures/earth_clouds.png",
  ]);

  // Slowly rotate Earth and clouds
  useFrame(() => {
    earthRef.current.rotation.y += 0.0005;
    cloudsRef.current.rotation.y += 0.0006;
  });

  return (
    <>
      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial map={earthMap} />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.01, 64, 64]} />
        <meshPhongMaterial
          map={cloudMap}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// 💫 Atmosphere glow shader
function Atmosphere() {
  const material = new ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
        gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
      }
    `,
    blending: AdditiveBlending,
    side: BackSide,
  });

  return (
    <mesh>
      <sphereGeometry args={[1.05, 64, 64]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

// 🌌 Main Scene
export default function SimpleEarth() {
  return (
    <Canvas
      camera={{ position: [2, 0, 2] }}
      style={{ width: "100%", height: "100vh", background: "black" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 2, 5]} intensity={1.2} />

      {/* Objects */}
      <Earth />
      <Atmosphere />
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        fade
        saturation={0}
      />

      {/* Bloom glow */}
      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.2} />
      </EffectComposer>

      {/* Controls */}
      <OrbitControls enablePan={false} enableZoom={true} />
    </Canvas>
  );
}
