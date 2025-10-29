import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { styles } from './NetworkVisualizer.styles';
import { io } from "socket.io-client";
import { RequestDetailModal } from './RequestDetailModal';
import { Globe, Send, Trash2, X, Info } from 'lucide-react';
const socket = io("http://localhost:4000");

const NODES_URL = "http://localhost:8000/allnodes";

const ServiceType = {
  VOICE: 1, VIDEO: 2, DATA: 3, IOT: 4,
  STREAMING: 5, BULK_TRANSFER: 6, CONTROL: 7, EMERGENCY: 8
};

const ServiceNames = {
  1: 'Voice', 2: 'Video', 3: 'Data', 4: 'IoT',
  5: 'Streaming', 6: 'Bulk Transfer', 7: 'Control', 8: 'Emergency'
};

const QoSProfiles = {
  [ServiceType.VOICE]: { uplink: [0.1, 0.3], downlink: [0.2, 0.5], latency: [20, 100], reliability: [0.95, 0.99], priority: [2, 4], cpu: [1, 4], power: [2, 6] },
  [ServiceType.VIDEO]: { uplink: [1, 3], downlink: [5, 10], latency: [50, 150], reliability: [0.90, 0.98], priority: [3, 6], cpu: [10, 30], power: [20, 50] },
  [ServiceType.DATA]: { uplink: [1, 5], downlink: [5, 20], latency: [50, 200], reliability: [0.90, 0.97], priority: [4, 7], cpu: [5, 20], power: [10, 40] },
  [ServiceType.IOT]: { uplink: [0.05, 0.3], downlink: [0.05, 0.2], latency: [10, 100], reliability: [0.97, 0.999], priority: [2, 5], cpu: [1, 3], power: [1, 5] },
  [ServiceType.STREAMING]: { uplink: [1, 3], downlink: [8, 15], latency: [50, 150], reliability: [0.90, 0.97], priority: [3, 6], cpu: [15, 40], power: [20, 60] },
  [ServiceType.BULK_TRANSFER]: { uplink: [5, 20], downlink: [20, 100], latency: [100, 500], reliability: [0.85, 0.95], priority: [7, 10], cpu: [20, 50], power: [40, 80] },
  [ServiceType.CONTROL]: { uplink: [0.1, 0.5], downlink: [0.1, 0.5], latency: [5, 50], reliability: [0.99, 0.999], priority: [1, 3], cpu: [2, 6], power: [5, 10] },
  [ServiceType.EMERGENCY]: { uplink: [0.5, 2], downlink: [0.5, 2], latency: [1, 20], reliability: [0.999, 1.0], priority: [1, 1], cpu: [5, 15], power: [10, 20] }
};

const MOCK_PATHS = [
  // { id: 'path1', nodes: ['GS_Beijing', 'LEO-41', 'GS_HCM'], color: 0x00ff88, active: true },
  // {id: 'path2', nodes: ['LEO-08', 'LEO-41', 'GS_SaoPaulo'], color: 0xffaa00, active: true },
  // {id: 'path3', nodes: ['LEO-25', 'GEO-02', 'GS_Sydney'], color: 0x3388ff, active: true },
];

const EARTH_RADIUS = 6371;
const SCALE_FACTOR = 1.0 / 6371;

// Fix the updateSatellitePosition function to properly handle time
function updateSatellitePosition(satellite, deltaTime) {
  if (satellite.type !== 'satellite' || satellite.sat_type === 'GEO') {
    return satellite;
  }

  const orbit = satellite.orbit;
  // Initialize orbit_state if it doesn't exist
  const state = satellite.orbit_state || { last_theta: 0 };
  const angularVelocity = (2 * Math.PI) / orbit.period;
  
  let newTheta = state.last_theta + angularVelocity * deltaTime;
  newTheta = newTheta % (2 * Math.PI);
  
  const altitudeKm = satellite.position.alt / 1000;
  const orbitalRadius = EARTH_RADIUS + altitudeKm;
  const semiMajorAxis = orbitalRadius * SCALE_FACTOR;
  
  const r = semiMajorAxis * (1 - orbit.eccentricity * orbit.eccentricity) / 
            (1 + orbit.eccentricity * Math.cos(newTheta));
  
  const xOrbit = r * Math.cos(newTheta);
  const yOrbit = r * Math.sin(newTheta);
  
  const inclinationRad = orbit.inclination * Math.PI / 180;
  const raanRad = orbit.raan * Math.PI / 180;
  
  const x1 = xOrbit;
  const y1 = yOrbit * Math.cos(inclinationRad);
  const z1 = yOrbit * Math.sin(inclinationRad);
  
  const x = x1 * Math.cos(raanRad) - y1 * Math.sin(raanRad);
  const y = x1 * Math.sin(raanRad) + y1 * Math.cos(raanRad);
  const z = z1;

  const distance = Math.sqrt(x*x + y*y + z*z);
  const lat = Math.asin(z / distance) * 180 / Math.PI;
  const lon = Math.atan2(y, x) * 180 / Math.PI;

  const vector = new THREE.Vector3(x, y, z);

  return {
    ...satellite,
    position: { ...satellite.position, lat, lon },
    vector,
    orbit_state: { last_theta: newTheta }
  };
}
function NetworkVisualizer() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [paths, setPaths] = useState(MOCK_PATHS);
  const [selectedService, setSelectedService] = useState(ServiceType.DATA);
  const [manualMode, setManualMode] = useState(false);
  const [formData, setFormData] = useState({
    type: 0, lat: 10.8231, lon: 106.6297, alt: 0,
    uplink: 1.5, downlink: 5, latency: 50, reliability: 0.98,
    cpu: 15, power: 25, priority: 4, support5G: true, timeout: 100
  });
  const [autoGen, setAutoGen] = useState(false);
  const [clickedLocation, setClickedLocation] = useState(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const SPEED_UP = 1; // Simulation speed-up factor
  const lastVisualizationUpdateRef = useRef(0);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const globeRef = useRef(null);
  const nodeMarkersRef = useRef([]);
  const pathLinesRef = useRef([]);
  const labelsRef = useRef([]);
  const atmosphereRef = useRef(null);
  const nodeGroupRef = useRef(null);
  
  // Optimized: Reusable geometries and materials
  const sharedGeometriesRef = useRef({});
  const sharedMaterialsRef = useRef({});

  const createDetailedEarthTexture = useCallback(() => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      "/textures/earth_daymap.jpg",
      () => { texture.needsUpdate = true; },
      undefined,
      (err) => { console.error("Failed to load Earth texture:", err); }
    );
    return texture;
  }, []);

  const latLonToVector3 = useCallback((lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  }, []);

  const vector3ToLatLon = useCallback((vector) => {
    // vector must be in the globe's local/object space (not world space)
    const x = vector.x;
    const y = vector.y;
    const z = vector.z;

    const radius = Math.sqrt(x * x + y * y + z * z);
    if (radius === 0) return { lat: 0, lon: 0 };

    // phi is colatitude (0 at north pole)
    const phi = Math.acos(y / radius); // 0..PI
    const lat = 90 - (phi * 180 / Math.PI);

    // forward used: x = -A*cos(theta), z = A*sin(theta)
    // so theta = atan2(z, -x)
    let thetaDeg = Math.atan2(z, -x) * (180 / Math.PI); // -180..180
    let lon = thetaDeg - 180;

    // normalize to -180..180
    if (lon < -180) lon += 360;
    if (lon > 180) lon -= 360;

    return { lat, lon };
  }, []);



  const createLabel = useCallback((text, position) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // More transparent background
    ctx.fillRect(0, 0, 256, 64);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Transparent white text
    ctx.font = '14px Arial'; // Smaller, non-bold font
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.2, 0.05, 1); // Smaller scale
    
    return sprite;
  }, []);

  // Optimized: Initialize shared geometries and materials once
  const initializeSharedResources = useCallback(() => {
    if (!sharedGeometriesRef.current.satellite) {
      // Reduced geometry segments for better performance
      sharedGeometriesRef.current.satellite = new THREE.SphereGeometry(0.025, 8, 8); // Reduced from 16,16
      sharedGeometriesRef.current.ground = new THREE.SphereGeometry(0.015, 8, 8);
      sharedGeometriesRef.current.glowSat = new THREE.SphereGeometry(0.04, 8, 8);
      sharedGeometriesRef.current.glowGround = new THREE.SphereGeometry(0.025, 8, 8);
    }

    if (!sharedMaterialsRef.current.satellite) {
      sharedMaterialsRef.current.satellite = new THREE.MeshBasicMaterial({ color: 0xff3366 });
      sharedMaterialsRef.current.ground = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
      sharedMaterialsRef.current.sea = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
      sharedMaterialsRef.current.glowRequest = new THREE.MeshBasicMaterial({
        color: 0xab1da2, transparent: true, opacity: 0.3
      });
      sharedMaterialsRef.current.glowSat = new THREE.MeshBasicMaterial({ 
        color: 0xff3366, transparent: true, opacity: 0.3 
      });
      sharedMaterialsRef.current.glowGround = new THREE.MeshBasicMaterial({ 
        color: 0x00ffaa, transparent: true, opacity: 0.3 
      });
      sharedMaterialsRef.current.glowSea = new THREE.MeshBasicMaterial({ 
        color: 0xffdd00, transparent: true, opacity: 0.3 
      });
    }
  }, []);

  // Optimized: Batch dispose and clear
  const clearVisualization = useCallback(() => {
    nodeMarkersRef.current.forEach(marker => {
      if (nodeGroupRef.current) {
        nodeGroupRef.current.remove(marker);
      }
    });
    nodeMarkersRef.current = [];

    pathLinesRef.current.forEach(line => {
      if (line.geometry && !sharedGeometriesRef.current[line.geometry.uuid]) {
        line.geometry.dispose();
      }
      if (line.material && !Object.values(sharedMaterialsRef.current).includes(line.material)) {
        line.material.dispose();
      }
      if (nodeGroupRef.current) {
        nodeGroupRef.current.remove(line);
      }
    });
    pathLinesRef.current = [];

    labelsRef.current.forEach(label => {
      if (label.material?.map) label.material.map.dispose();
      if (label.material) label.material.dispose();
      if (nodeGroupRef.current) {
        nodeGroupRef.current.remove(label);
      }
    });
    labelsRef.current = [];
  }, []);

  // Optimized: Update visualization with reused resources
  const updateVisualization = useCallback(() => {
    if (!sceneRef.current || !nodeGroupRef.current) return;

    initializeSharedResources();
    clearVisualization();

    nodes.forEach(node => {
      const lat = node.position.lat;
      const lon = node.position.lon;
      
      let radius = 1.03;
      if (node.type === 'satellite') {
        const altitudeKm = node.position.alt / 1000;
        radius = 1 + (altitudeKm / EARTH_RADIUS);
      }
      
      const position = latLonToVector3(lat, lon, radius);
      
      // Use shared geometries and materials
      const isSat = node.type === 'satellite';
      const geometry = isSat ? sharedGeometriesRef.current.satellite : sharedGeometriesRef.current.ground;
      const material =
      isSat
        ? sharedMaterialsRef.current.satellite
        : node.type === 'groundstation'
        ? sharedMaterialsRef.current.ground
        : node.type === 'request'
        ? sharedMaterialsRef.current.request
        : sharedMaterialsRef.current.sea;
      
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(position);
      
      const glowGeometry = isSat ? sharedGeometriesRef.current.glowSat : sharedGeometriesRef.current.glowGround;
      const glowMaterial =
      isSat
        ? sharedMaterialsRef.current.glowSat
        : node.type === 'groundstation'
        ? sharedMaterialsRef.current.glowGround
        : node.type === 'request'
        ? sharedMaterialsRef.current.glowRequest
        : sharedMaterialsRef.current.glowSea;
      
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(position);
      nodeGroupRef.current.add(glow);
      nodeMarkersRef.current.push(glow);
      
      nodeGroupRef.current.add(marker);
      nodeMarkersRef.current.push(marker);

      const labelDistance = node.type === 'satellite' ? 1.2 : 1.15;
      const labelPos = position.clone().normalize().multiplyScalar(radius * labelDistance);
      const label = createLabel(node.id, labelPos);
      nodeGroupRef.current.add(label);
      labelsRef.current.push(label);
    });

    // Optimized: Reduced path curve points
    paths.filter(p => p.active).forEach(path => {
      for (let i = 0; i < path.nodes.length - 1; i++) {
        const node1 = nodes.find(n => n.id === path.nodes[i]);
        const node2 = nodes.find(n => n.id === path.nodes[i + 1]);
        if (!node1 || !node2) continue;
        
        const lat1 = node1.position.lat;
        const lon1 = node1.position.lon;
        const lat2 = node2.position.lat;
        const lon2 = node2.position.lon;

        let r1 = 1.03;
        if (node1.type === 'satellite') {
          const altitudeKm1 = node1.position.alt / 1000;
          r1 = 1 + (altitudeKm1 / EARTH_RADIUS);
        }
        
        let r2 = 1.03;
        if (node2.type === 'satellite') {
          const altitudeKm2 = node2.position.alt / 1000;
          r2 = 1 + (altitudeKm2 / EARTH_RADIUS);
        }
        
        const pos1 = latLonToVector3(lat1, lon1, r1);
        const pos2 = latLonToVector3(lat2, lon2, r2);

        const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
        const distance = pos1.distanceTo(pos2);
        midPoint.normalize().multiplyScalar(1 + distance * 0.3);

        const curve = new THREE.QuadraticBezierCurve3(pos1, midPoint, pos2);
        const points = curve.getPoints(30); // Reduced from 100
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const material = new THREE.LineBasicMaterial({ 
          color: path.color,
          linewidth: 2,
          transparent: true,
          opacity: 0.8
        });
        const line = new THREE.Line(geometry, material);
        nodeGroupRef.current.add(line);
        pathLinesRef.current.push(line);

        // Reduced particles from 5 to 3
        for (let j = 0; j < 3; j++) {
          const particlePos = points[Math.floor(j * points.length / 3)];
          const particleGeom = new THREE.SphereGeometry(0.008, 6, 6); // Reduced segments
          const particleMat = new THREE.MeshBasicMaterial({ 
            color: path.color,
            transparent: true,
            opacity: 0.9
          });
          const particle = new THREE.Mesh(particleGeom, particleMat);
          particle.position.copy(particlePos);
          nodeGroupRef.current.add(particle);
          pathLinesRef.current.push(particle);
        }
      }
    });
  }, [nodes, paths, latLonToVector3, createLabel, initializeSharedResources, clearVisualization]);

  // Fetch nodes
  useEffect(() => {
    async function fetchNodes() {
      setLoadingNodes(true);
      try {
        const res = await fetch(NODES_URL);
        if (!res.ok) throw new Error(`Failed to load nodes: ${res.status}`);
        const data = await res.json();
        // console.log("Fetched nodes from server:", data);
        setNodes(data);
      } catch (err) {
        console.error("Error fetching node data:", err);
      } finally {
        setLoadingNodes(false);
      }
    }
    fetchNodes();
  }, []);

  // Three.js setup - Optimized
  useEffect(() => {
    if (!mountRef.current) return;
    
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.z = 2.8;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Optimized: Reduced globe geometry segments
    const earthTexture = createDetailedEarthTexture();
    const loader = new THREE.TextureLoader();

    const bumpTexture = loader.load("/textures/earth_bump.jpg");          // Terrain height
    const specularTexture = loader.load("/textures/earth_specular.jpg");  // Reflectivity

    // === Earth Material ===
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.08, // Slightly more prominent terrain
      specularMap: specularTexture,
      specular: new THREE.Color(0x444444), // Brighter specular for better water reflection
      shininess: 25, // Increased shininess for more pronounced water reflections
      transparent: true,
      opacity: 1.0,
    });

    // === Earth Geometry ===
    const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    // === Optional: Rotate for realism (in your animation loop) ===
    // globe.rotation.y += 0.0005;
    // cloudMesh.rotation.y += 0.0006;

    globeRef.current = globe;

    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);
    nodeGroupRef.current = nodeGroup;

    // Optimized: Reduced atmosphere geometry
    const atmosphereGeometry = new THREE.SphereGeometry(1.05, 32, 32); // Reduced from 64
    const atmosphereMaterial = new THREE.ShaderMaterial({
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
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);
    atmosphereRef.current = atmosphere;

    // Optimized: Reduced stars count
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const starsVertices = [];
    for (let i = 0; i < 3000; i++) { // Reduced from 10000
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    backLight.position.set(-5, -3, -5);
    scene.add(backLight);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    let hasDragged = false;

    const handleMouseDown = (e) => {
      isDragging = true;
      hasDragged = false;
      prevMouse = { x: e.clientX, y: e.clientY };
      rotationVelocity = { x: 0, y: 0 };
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasDragged = true;
      }
      
      globe.rotation.y += deltaX * 0.005;
      globe.rotation.x += deltaY * 0.005;
      atmosphere.rotation.copy(globe.rotation);
      nodeGroup.rotation.copy(globe.rotation);
      rotationVelocity = { x: deltaY * 0.005, y: deltaX * 0.005 };
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e) => {
      if (!hasDragged && manualMode) {
        // This was a click, not a drag - calculate clicked location
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObject(globe);
        // inside handleMouseUp (or your click handler), when you get intersects:
        if (intersects.length > 0) {
          // get world intersection point
          const worldPoint = intersects[0].point.clone();

          // transform into the globe mesh local coordinates (undo globe rotation/transform)
          const localPoint = globe.worldToLocal(worldPoint);

          // convert using the corrected function
          const location = vector3ToLatLon(localPoint);

          setClickedLocation(location);
          setFormData(prev => ({
            ...prev,
            lat: parseFloat(location.lat.toFixed(4)),
            lon: parseFloat(location.lon.toFixed(4))
          }));

          // optional: add a persistent marker at the selected location (local coords -> place above globe)
          if (nodeGroupRef.current) {
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(0.02, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xab1da2 })
            );
            // place marker in local coordinates on surface
            const markerPos = latLonToVector3(location.lat, location.lon, 1.03);
            marker.position.copy(markerPos);
            nodeGroupRef.current.add(marker);
            // remove after a short while (or keep if you prefer persistent)
            setTimeout(() => nodeGroupRef.current.remove(marker), 3000);
          }
        }
      }
      isDragging = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(1.5, Math.min(5, camera.position.z + e.deltaY * 0.001));
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);

    // Optimized: Throttled satellite updates
    let accumulatedTime = 0;
    const UPDATE_INTERVAL = 0.2; // Update satellites every 200ms instead of every frame

    const animate = () => {
      requestAnimationFrame(animate);
      
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = currentTime;
      
      // Fixed: Proper accumulated time logic with speed-up
      accumulatedTime += deltaTime;
      
      // Only update satellites when we have enough accumulated real time
      if (accumulatedTime >= UPDATE_INTERVAL) {
        const simulationDeltaTime = accumulatedTime * SPEED_UP;
        
        setNodes(prevNodes => {
          const updatedNodes = prevNodes.map(node => 
            updateSatellitePosition(node, simulationDeltaTime)
          );
          
          // Log LEO-41 position from the updated nodes
          // const leo41 = updatedNodes.find(n => n.id === 'LEO-41');
          // if (leo41) {
          //   console.log(`LEO-41 Position - Lat: ${leo41.position.lat.toFixed(4)}, Lon: ${leo41.position.lon.toFixed(4)}, Alt: ${leo41.position.alt.toFixed(1)} m`);
          // }
          
          return updatedNodes;
        });
        
        accumulatedTime = 0; // Reset accumulated time
      }
      
      if (!isDragging) {
        globe.rotation.y += 0.0005 + rotationVelocity.y * 0.95;
        globe.rotation.x += rotationVelocity.x * 0.95;
        atmosphere.rotation.copy(globe.rotation);
        nodeGroup.rotation.copy(globe.rotation);
        rotationVelocity.x *= 0.95;
        rotationVelocity.y *= 0.95;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      
      // Cleanup shared resources
      Object.values(sharedGeometriesRef.current).forEach(geo => geo.dispose());
      Object.values(sharedMaterialsRef.current).forEach(mat => mat.dispose());
      
      if (currentMount && renderer.domElement.parentNode === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [createDetailedEarthTexture, vector3ToLatLon, manualMode]);

  // Optimized: Throttled visualization updates
  useEffect(() => {
    const currentTime = Date.now();
    if (currentTime - lastVisualizationUpdateRef.current > 200) { // Update visualization max 5 times per second
      updateVisualization();
      lastVisualizationUpdateRef.current = currentTime;
    }
  }, [nodes, paths, updateVisualization]);

  // useEffect(() => {
  //   const timer = setInterval(() => setRequests(r => [...r]), 1000);
  //   return () => clearInterval(timer);
  // }, []);


  // Remove the high-frequency interval update
  // The visualization now updates only when nodes or paths change

  const randRange = ([min, max], decimals = 2) => {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  };

  const generateRandomRequest = useCallback(() => {
    const regions = [
      { name: "China", latRange: [18, 54], lonRange: [73, 135], weight: 20 },
      { name: "India", latRange: [8, 37], lonRange: [68, 97], weight: 18 },
      { name: "Europe", latRange: [35, 60], lonRange: [-10, 40], weight: 15 },
      { name: "USA", latRange: [25, 50], lonRange: [-125, -66], weight: 15 },
      { name: "Brazil", latRange: [-35, 5], lonRange: [-74, -34], weight: 7 },
      { name: "Nigeria", latRange: [4, 14], lonRange: [3, 15], weight: 5 },
      { name: "Japan", latRange: [30, 45], lonRange: [129, 146], weight: 5 },
      { name: "SoutheastAsia", latRange: [-10, 20], lonRange: [95, 120], weight: 5 },
      { name: "Other", latRange: [-90, 90], lonRange: [-180, 180], weight: 10 },
    ];

    const totalWeight = regions.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedRegion;
    for (const r of regions) {
      if (rand < r.weight) {
        selectedRegion = r;
        break;
      }
      rand -= r.weight;
    }

    const lat = parseFloat((Math.random() * (selectedRegion.latRange[1] - selectedRegion.latRange[0]) + selectedRegion.latRange[0]).toFixed(4));
    const lon = parseFloat((Math.random() * (selectedRegion.lonRange[1] - selectedRegion.lonRange[0]) + selectedRegion.lonRange[0]).toFixed(4));
    const alt = 0;

    const serviceTypes = Object.values(ServiceType);
    const serviceType = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
    const profile = QoSProfiles[serviceType];

    const uplink = parseFloat((Math.random() * (profile.uplink[1] - profile.uplink[0]) + profile.uplink[0]).toFixed(2));
    const downlink = parseFloat((Math.random() * (profile.downlink[1] - profile.downlink[0]) + profile.downlink[0]).toFixed(2));
    const latency = parseFloat((Math.random() * (profile.latency[1] - profile.latency[0]) + profile.latency[0]).toFixed(2));
    const reliability = parseFloat((Math.random() * (profile.reliability[1] - profile.reliability[0]) + profile.reliability[0]).toFixed(4));
    const cpu = Math.floor(Math.random() * (profile.cpu[1] - profile.cpu[0] + 1) + profile.cpu[0]);
    const power = Math.floor(Math.random() * (profile.power[1] - profile.power[0] + 1) + profile.power[0]);
    const packet_size = Math.floor(Math.random() * 100) + 1;
    const priority = Math.floor(Math.random() * (profile.priority[1] - profile.priority[0] + 1) + profile.priority[0]);
    const demand_timeout = Math.floor(Math.random() * (1000 - 100 + 1) + 100);

    return {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      type: serviceType,
      lat,
      lon,
      alt,
      uplink,
      downlink,
      latency,
      reliability,
      cpu,
      power,
      packet_size,
      priority,
      demand_timeout,
      support5G: true,
      status: 'pending'
    };
  }, []);

  const handleGenerateRequest = useCallback(async () => {
    let request;

    if (manualMode) {
      const profile = QoSProfiles[selectedService];
      const uplink = randRange(profile.uplink);
      const downlink = randRange(profile.downlink);
      const latency = randRange(profile.latency);
      const reliability = randRange(profile.reliability, 4);
      const cpu = Math.floor(Math.random() * (profile.cpu[1] - profile.cpu[0] + 1) + profile.cpu[0]);
      const power = Math.floor(Math.random() * (profile.power[1] - profile.power[0] + 1) + profile.power[0]);
      const priority = Math.floor(Math.random() * (profile.priority[1] - profile.priority[0] + 1) + profile.priority[0]);
      const packet_size = Math.floor(Math.random() * 100) + 1;

      request = {
        id: 'req_' + Math.random().toString(36).substr(2, 9),
        type: selectedService,
        lat: formData.lat,
        lon: formData.lon,
        alt: formData.alt,
        demand_timeout: formData.timeout,
        support5G: true,
        uplink,
        downlink,
        latency,
        reliability,
        cpu,
        power,
        priority,
        packet_size,
        status: 'pending'
      };
    } else {
      request = generateRandomRequest();
    }

    setRequests(prev => [...prev, request]);
    //Generate a node represent the request location
    const requestNode = {
      id: request.id,
      type: 'request',
      position: { lat: request.lat, lon: request.lon, alt: request.alt || 0 }
    };
    setNodes(prev => [...prev, requestNode]);

    try {
      // When a request happens
      socket.emit("requestAI", request);
    } catch (err) {
      console.error("Request to server failed:", err);
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'failed' } : r));
    }
  }, [manualMode, selectedService, formData, generateRandomRequest]);

  useEffect(() => {
    const handleResponse = (data) => {
      if (data.result !== "success") {
        setRequests(prev =>
          prev.map(r => r.id === data.id ? { ...r, status: "failed" } : r)
        );
        return;
      }

      // Mark request as connected and record start time
      setRequests(prev =>
        prev.map(r =>
          r.id === data.id ? { ...r, status: "connected", connectedAt: Date.now() } : r
        )
      );

      // Add active path if available
      if (data.path) {
        setPaths(prev => [
          ...prev,
          { id: data.id, nodes: [data.id, ...data.path], color: 0x00ff88, active: true }
        ]);
      }

      // Find this request's timeout (in seconds) and set allocated
      setRequests(prev => {
        const req = prev.find(r => r.id === data.id);
        if (!req) return prev;

        //Add allocated field from data
        req.allocated = data.allocated || {};

        const timeoutSec = req.demand_timeout || req.timeout || 30; // seconds
        const timeoutMs = timeoutSec * 1000;

        // Schedule auto-clear when timeout expires
        setTimeout(() => {
          handleClearRequest(req.id);
        }, timeoutMs);

        return prev;
      });
    };

    socket.on("responseAI", handleResponse);

    return () => {
      socket.off("responseAI", handleResponse);
    };
  }, []);


  const togglePath = (pathId) => {
    setPaths(prev => prev.map(p => 
      p.id === pathId ? { ...p, active: !p.active } : p
    ));
  };

  const handleClearRequest = (reqId) => {
    setRequests(prev => prev.filter(r => r.id !== reqId));
    //Delete the node and path associated with the request
    setNodes(prev => prev.filter(n => n.id !== reqId));
    setPaths(prev => prev.filter(p => p.id !== reqId));
  };

  useEffect(() => {
    let interval;
    if (autoGen) {
      interval = setInterval(() => {
        handleGenerateRequest();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoGen, handleGenerateRequest]);

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h1 style={styles.header}>
          <Globe style={{ width: '24px', height: '24px' }} />
          Network Control
        </h1>

        <div style={styles.checkboxContainer}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={manualMode}
              onChange={(e) => setManualMode(e.target.checked)}
              style={styles.checkbox}
            />
            <span>Manual Mode</span>
          </label>
          
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoGen}
              onChange={(e) => setAutoGen(e.target.checked)}
              style={styles.checkbox}
            />
            <span>Auto Generate</span>
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={styles.label}>Service Type</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(Number(e.target.value))}
            style={styles.select}
          >
            {Object.entries(ServiceNames).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
        </div>

        {manualMode && (
          <>
            <div style={{ 
              padding: '12px', 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '6px',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                💡 Click on the globe to select a location
              </div>
              {clickedLocation && (
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '500' }}>
                  Selected: {clickedLocation.lat.toFixed(4)}°, {clickedLocation.lon.toFixed(4)}°
                </div>
              )}
            </div>
            <div style={styles.inputGroup}>
              <input 
                type="number" 
                placeholder="Latitude" 
                value={formData.lat} 
                onChange={(e) => setFormData({...formData, lat: parseFloat(e.target.value)})}
                style={styles.input}
                required
              />
              <input 
                type="number" 
                placeholder="Longitude" 
                value={formData.lon}
                onChange={(e) => setFormData({...formData, lon: parseFloat(e.target.value)})}
                style={styles.input}
                required
              />
              <input 
                type="number" 
                placeholder="Altitude (m)" 
                value={formData.alt}
                onChange={(e) => setFormData({...formData, alt: parseFloat(e.target.value) || 0})}
                style={styles.input}
              />
              <input 
                type="number" 
                placeholder="Timeout (seconds)" 
                value={formData.timeout}
                onChange={(e) => setFormData({...formData, timeout: parseFloat(e.target.value) || 0})}
                style={styles.input}
              />
            </div>
          </>
        )}

        <button
          onClick={handleGenerateRequest}
          style={styles.button}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)'}
        >
          <Send style={{ width: '16px', height: '16px' }} />
          Generate Request
        </button>

        <div style={styles.pathsSection}>
          <h2 style={styles.sectionTitle}>Active Paths</h2>
          {paths.map(path => (
            <div key={path.id} style={styles.pathCard}>
              <div style={styles.pathHeader}>
                <div>
                  <div style={{...styles.pathId, color: `#${path.color.toString(16).padStart(6, '0')}`}}>
                    {path.id}
                  </div>
                  <div style={styles.pathNodes}>
                    {path.nodes.join(' → ')}
                  </div>
                </div>
                <button
                  onClick={() => togglePath(path.id)}
                  style={{
                    ...styles.pathButton,
                    ...(path.active ? styles.pathButtonActive : styles.pathButtonInactive)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = path.active ? '#047857' : '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = path.active ? '#059669' : '#4b5563';
                  }}
                >
                  {path.active ? 'Active' : 'Hidden'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.requestsSection}>
          <h2 style={styles.sectionTitle}>Requests ({requests.length})</h2>
          {requests.map(req => {
            const timeRemaining = req.connectedAt 
              ? Math.max(0, req.demand_timeout - (Date.now() - req.connectedAt) / 1000)
              : req.demand_timeout;

            return (
              <div key={req.id} style={styles.requestCard}>
                <div style={styles.requestHeader}>
                  <div>
                    <div style={styles.requestType}>{ServiceNames[req.type]} : {req.id}</div>
                    {/* <div style={styles.requestCoords}>
                      {req.lat.toFixed(2)}, {req.lon.toFixed(2)}
                    </div> */}
                  </div>
                  <span style={{
                    ...styles.statusBadge,
                    ...(req.status === 'connected' ? styles.statusConnected : styles.statusPending)
                  }}>
                    {req.status}
                  </span>
                </div>
                {/* <div style={styles.requestInfo}>
                  BW: {req.uplink}/{req.downlink} Mbps | Lat: {req.latency}ms
                </div> */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setSelectedRequest(req)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)'}
                  >
                    <Info size={12} />
                    Info
                  </button>
                  <button
                    onClick={() => handleClearRequest(req.id)}
                    style={styles.clearButton}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                    Clear
                  </button>
                  {req.status === 'connected' && req.connectedAt && (
                    <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {timeRemaining.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.visualizerContainer}>
        <div ref={mountRef} style={styles.canvas} />
        <div style={styles.legend}>
          <h3 style={styles.legendTitle}>Legend</h3>
          <div style={styles.legendItems}>
            <div style={styles.legendItem}>
              <div style={{...styles.legendDot, background: '#ff6699'}}></div>
              <span>Satellite</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{...styles.legendDot, background: '#00ffaa'}}></div>
              <span>Ground Station</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{...styles.legendDot, background: '#ffdd00'}}></div>
              <span>Sea Station</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{...styles.legendDot, background: '#ab1da2ff'}}></div>
              <span>Request Location</span>
            </div>
          </div>
        </div>
        <div style={styles.controls}>
          <div>🖱️ Drag to rotate</div>
          <div>🔍 Scroll to zoom</div>
          {manualMode && <div>👆 Click to select location</div>}
        </div>
      </div>
      <RequestDetailModal 
        request={selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
      />
    </div>
  );
}

export default NetworkVisualizer;