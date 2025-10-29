import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Send, Trash2 } from 'lucide-react';
import * as THREE from 'three';
import { styles } from './NetworkVisualizer.styles';


const ServiceType = {
  VOICE: 1, VIDEO: 2, DATA: 3, IOT: 4,
  STREAMING: 5, BULK_TRANSFER: 6, CONTROL: 7, EMERGENCY: 8
};

const ServiceNames = {
  1: 'Voice', 2: 'Video', 3: 'Data', 4: 'IoT',
  5: 'Streaming', 6: 'Bulk Transfer', 7: 'Control', 8: 'Emergency'
};

const QoSProfiles = {
  [ServiceType.VOICE]: { bandwidth: [0.1, 0.5], latency: [20, 100], reliability: [0.95, 0.99], priority: [2, 4], cpu: [1, 4], power: [2, 6] },
  [ServiceType.VIDEO]: { bandwidth: [2, 10], latency: [50, 150], reliability: [0.90, 0.98], priority: [3, 6], cpu: [10, 30], power: [20, 50] },
  [ServiceType.DATA]: { bandwidth: [1, 20], latency: [50, 200], reliability: [0.90, 0.97], priority: [4, 7], cpu: [5, 20], power: [10, 40] },
  [ServiceType.IOT]: { bandwidth: [0.05, 0.5], latency: [10, 100], reliability: [0.97, 0.999], priority: [2, 5], cpu: [1, 3], power: [1, 5] },
  [ServiceType.STREAMING]: { bandwidth: [3, 15], latency: [50, 150], reliability: [0.90, 0.97], priority: [3, 6], cpu: [15, 40], power: [20, 60] },
  [ServiceType.BULK_TRANSFER]: { bandwidth: [10, 100], latency: [100, 500], reliability: [0.85, 0.95], priority: [7, 10], cpu: [20, 50], power: [40, 80] },
  [ServiceType.CONTROL]: { bandwidth: [0.1, 1], latency: [5, 50], reliability: [0.99, 0.999], priority: [1, 3], cpu: [2, 6], power: [5, 10] },
  [ServiceType.EMERGENCY]: { bandwidth: [0.5, 2], latency: [1, 20], reliability: [0.999, 1.0], priority: [1, 1], cpu: [5, 15], power: [10, 20] }
};

const INITIAL_NODES = [
  { id: 'GS-NYC', type: 'ground', lat: 40.7128, lon: -74.0060, name: 'New York Ground' },
  { id: 'GS-LON', type: 'ground', lat: 51.5074, lon: -0.1278, name: 'London Ground' },
  { id: 'GS-TKY', type: 'ground', lat: 35.6762, lon: 139.6503, name: 'Tokyo Ground' },
  { id: 'GS-SYD', type: 'ground', lat: -33.8688, lon: 151.2093, name: 'Sydney Ground' },
  { 
    id: 'LEO-41', 
    type: 'satellite',
    sat_type: 'LEO',
    name: 'Beijing',
    position: { lat: 39.9, lon: 116.4, alt: 525000 },
    orbit: { inclination: 87.5, raan: 130, period: 5400, eccentricity: 0.0006 },
    velocity: { vx: -5120, vy: 2950, vz: 400 },
    orbit_state: { last_theta: 0.93 }
  },
  { 
    id: 'SAT-02', 
    type: 'satellite',
    sat_type: 'LEO',
    name: 'Satellite Beta',
    position: { lat: 30.0, lon: 20.0, alt: 550000 },
    orbit: { inclination: 53.0, raan: 45, period: 5700, eccentricity: 0.0005 },
    velocity: { vx: -4800, vy: 3200, vz: 350 },
    orbit_state: { last_theta: 1.2 }
  },
  { 
    id: 'SAT-03', 
    type: 'satellite',
    sat_type: 'LEO',
    name: 'Satellite Gamma',
    position: { lat: -10.0, lon: 140.0, alt: 580000 },
    orbit: { inclination: 97.8, raan: 200, period: 5850, eccentricity: 0.0007 },
    velocity: { vx: -5300, vy: 2700, vz: 420 },
    orbit_state: { last_theta: 0.5 }
  },
  { id: 'SEA-ATL', type: 'sea', lat: 28.0, lon: -45.0, name: 'Atlantic Station' },
  { id: 'SEA-PAC', type: 'sea', lat: 15.0, lon: -160.0, name: 'Pacific Station' }
];

const MOCK_PATHS = [
  { id: 'path1', nodes: ['GS-NYC', 'LEO-41', 'GS-TKY'], color: 0x00ff88, active: true },
  { id: 'path2', nodes: ['GS-TKY', 'SAT-03', 'GS-SYD'], color: 0xff6b9d, active: true },
  { id: 'path3', nodes: ['GS-LON', 'SAT-02', 'SEA-ATL', 'LEO-41', 'GS-NYC'], color: 0x4db8ff, active: false }
];

const EARTH_RADIUS = 6371;
const SCALE_FACTOR = 1.0 / 6371;

function updateSatellitePosition(satellite, deltaTime) {
  if (satellite.type !== 'satellite') return satellite;
  
  const orbit = satellite.orbit;
  const state = satellite.orbit_state;
  
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
  
  const distance = Math.sqrt(x * x + y * y + z * z);
  const lat = Math.asin(z / distance) * 180 / Math.PI;
  const lon = Math.atan2(y, x) * 180 / Math.PI;
  
  return {
    ...satellite,
    position: {
      ...satellite.position,
      lat,
      lon
    },
    orbit_state: {
      last_theta: newTheta
    }
  };
}

function NetworkVisualizer() {
  const [requests, setRequests] = useState([]);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [paths, setPaths] = useState(MOCK_PATHS);
  const [selectedService, setSelectedService] = useState(ServiceType.DATA);
  const [manualMode, setManualMode] = useState(false);
  const [formData, setFormData] = useState({
    lat: 10.8231, lon: 106.6297, bandwidth: 5, latency: 100,
    reliability: 0.95, cpu: 10, power: 20, priority: 5, support5G: true, timeout: 30
  });
  const [autoGen, setAutoGen] = useState(false);
  const [timeSpeedup, setTimeSpeedup] = useState(1);
  const lastUpdateTimeRef = useRef(Date.now());

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

  const speedupOptions = [
    { value: 1, label: '1x (Real-time)' },
    { value: 10, label: '10x' },
    { value: 60, label: '60x (1 min = 1 sec)' },
    { value: 300, label: '300x (5 min = 1 sec)' },
    { value: 900, label: '900x (15 min = 1 sec)' },
    { value: 3600, label: '3600x (1 hour = 1 sec)' }
  ];

  const createDetailedEarthTexture = () => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      "/textures/earth_daymap.jpg", // your image path
      () => {
        texture.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.error("Failed to load Earth texture:", err);
      }
    );
    return texture;
  };


  const createBumpTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 2048, 1024);
    
    // Add more pronounced terrain variation
    const imageData = ctx.getImageData(0, 0, 2048, 1024);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = Math.random() * 80 - 40;
      imageData.data[i] = Math.max(0, Math.min(255, 128 + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, 128 + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, 128 + noise));
    }
    ctx.putImageData(imageData, 0, 0);
    
    return new THREE.CanvasTexture(canvas);
  };

  const latLonToVector3 = (lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
  };

  const createLabel = (text, position) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 64);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.3, 0.075, 1);
    
    return sprite;
  };

  const updateVisualization = useCallback(() => {
    if (!sceneRef.current || !nodeGroupRef.current) return;

    nodeMarkersRef.current.forEach(marker => nodeGroupRef.current.remove(marker));
    nodeMarkersRef.current = [];

    pathLinesRef.current.forEach(line => nodeGroupRef.current.remove(line));
    pathLinesRef.current = [];

    labelsRef.current.forEach(label => nodeGroupRef.current.remove(label));
    labelsRef.current = [];

    nodes.forEach(node => {
      const isGroundOrSea = node.type === 'ground' || node.type === 'sea';
      const lat = isGroundOrSea ? node.lat : node.position.lat;
      const lon = isGroundOrSea ? node.lon : node.position.lon;
      
      let radius = 1.03;
      if (node.type === 'satellite') {
        const altitudeKm = node.position.alt / 1000;
        radius = 1 + (altitudeKm / EARTH_RADIUS);
      }
      
      const position = latLonToVector3(lat, lon, radius);
      
      const markerSize = node.type === 'satellite' ? 0.025 : 0.015;
      const geometry = new THREE.SphereGeometry(markerSize, 16, 16);
      const color = node.type === 'satellite' ? 0xff3366 : 
                   node.type === 'ground' ? 0x00ffaa : 0xffdd00;
      const material = new THREE.MeshBasicMaterial({ color });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(position);
      
      const glowSize = node.type === 'satellite' ? 0.04 : 0.025;
      const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3
      });
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

    paths.filter(p => p.active).forEach(path => {
      for (let i = 0; i < path.nodes.length - 1; i++) {
        const node1 = nodes.find(n => n.id === path.nodes[i]);
        const node2 = nodes.find(n => n.id === path.nodes[i + 1]);
        if (!node1 || !node2) continue;

        const isGroundOrSea1 = node1.type === 'ground' || node1.type === 'sea';
        const isGroundOrSea2 = node2.type === 'ground' || node2.type === 'sea';
        
        const lat1 = isGroundOrSea1 ? node1.lat : node1.position.lat;
        const lon1 = isGroundOrSea1 ? node1.lon : node1.position.lon;
        
        const lat2 = isGroundOrSea2 ? node2.lat : node2.position.lat;
        const lon2 = isGroundOrSea2 ? node2.lon : node2.position.lon;

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
        const points = curve.getPoints(100);
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

        for (let j = 0; j < 5; j++) {
          const particlePos = points[Math.floor(j * points.length / 5)];
          const particleGeom = new THREE.SphereGeometry(0.008, 8, 8);
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
  }, [nodes, paths]);

  useEffect(() => {
    if (!mountRef.current) return;
    
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.z = 2.8;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const globeGeometry = new THREE.SphereGeometry(1, 128, 128);
    
    const earthTexture = createDetailedEarthTexture();
    const bumpTexture = createBumpTexture();
    
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.003,
      specular: new THREE.Color(0x222222),
      shininess: 8,
      specularMap: earthTexture
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);
    nodeGroupRef.current = nodeGroup;

    const atmosphereGeometry = new THREE.SphereGeometry(1.05, 64, 64);
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

    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
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

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      rotationVelocity = { x: 0, y: 0 };
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      globe.rotation.y += deltaX * 0.005;
      globe.rotation.x += deltaY * 0.005;
      atmosphere.rotation.copy(globe.rotation);
      nodeGroup.rotation.copy(globe.rotation);
      rotationVelocity = { x: deltaY * 0.005, y: deltaX * 0.005 };
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
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

    const animate = () => {
      requestAnimationFrame(animate);
      
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = currentTime;
      
      // Use current timeSpeedup value directly from state
      const acceleratedDeltaTime = deltaTime * timeSpeedup;
      
      setNodes(prevNodes => prevNodes.map(node => updateSatellitePosition(node, acceleratedDeltaTime)));
      
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
      if (currentMount && renderer.domElement.parentNode === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, [timeSpeedup]);

  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (sceneRef.current && nodeGroupRef.current) {
        updateVisualization();
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [updateVisualization]);

  const randRange = ([min, max], decimals = 2) => {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  };

  const generateRandomRequest = useCallback(() => {
    const profile = QoSProfiles[selectedService];
    const regions = [
      { latRange: [18, 54], lonRange: [73, 135] },
      { latRange: [8, 37], lonRange: [68, 97] },
      { latRange: [35, 60], lonRange: [-10, 40] },
      { latRange: [25, 50], lonRange: [-125, -66] }
    ];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const lat = randRange(region.latRange, 4);
    const lon = randRange(region.lonRange, 4);

    return {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      type: selectedService,
      lat, lon,
      bandwidth: randRange(profile.bandwidth, 2),
      latency: randRange(profile.latency, 0),
      reliability: randRange(profile.reliability, 3),
      cpu: Math.floor(randRange(profile.cpu, 0)),
      power: Math.floor(randRange(profile.power, 0)),
      priority: Math.floor(randRange(profile.priority, 0)),
      support5G: Math.random() < 0.6,
      status: 'pending'
    };
  }, [selectedService]);

  const handleGenerateRequest = useCallback(() => {
    const request = manualMode ? {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      type: selectedService,
      ...formData,
      status: 'pending'
    } : generateRandomRequest();
    
    setRequests(prev => [...prev, request]);
  }, [manualMode, selectedService, formData, generateRandomRequest]);

  const togglePath = (pathId) => {
    setPaths(prev => prev.map(p => 
      p.id === pathId ? { ...p, active: !p.active } : p
    ));
  };

  const handleClearRequest = (reqId) => {
    setRequests(prev => prev.filter(r => r.id !== reqId));
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

        <div style={styles.speedupSection}>
          <label style={styles.label}>Time Speedup</label>
          <select
            value={timeSpeedup}
            onChange={(e) => setTimeSpeedup(Number(e.target.value))}
            style={styles.select}
          >
            {speedupOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={styles.smallText}>
            Current: {timeSpeedup}x speed
          </div>
        </div>

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
          <div style={styles.inputGroup}>
            <input 
              type="number" 
              placeholder="Latitude" 
              value={formData.lat} 
              onChange={(e) => setFormData({...formData, lat: parseFloat(e.target.value)})}
              style={styles.input}
            />
            <input 
              type="number" 
              placeholder="Longitude" 
              value={formData.lon}
              onChange={(e) => setFormData({...formData, lon: parseFloat(e.target.value)})}
              style={styles.input}
            />
            <input 
              type="number" 
              placeholder="Bandwidth (Mbps)" 
              value={formData.bandwidth}
              onChange={(e) => setFormData({...formData, bandwidth: parseFloat(e.target.value)})}
              style={styles.input}
            />
            <input 
              type="number" 
              placeholder="Latency (ms)" 
              value={formData.latency}
              onChange={(e) => setFormData({...formData, latency: parseFloat(e.target.value)})}
              style={styles.input}
            />
            <input 
              type="number" 
              placeholder="Timeout (seconds)" 
              value={formData.timeout}
              onChange={(e) => setFormData({...formData, timeout: parseFloat(e.target.value)})}
              style={styles.input}
            />
          </div>
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
          {requests.map(req => (
            <div key={req.id} style={styles.requestCard}>
              <div style={styles.requestHeader}>
                <div>
                  <div style={styles.requestType}>{ServiceNames[req.type]}</div>
                  <div style={styles.requestCoords}>
                    {req.lat.toFixed(2)}, {req.lon.toFixed(2)}
                  </div>
                </div>
                <span style={{
                  ...styles.statusBadge,
                  ...(req.status === 'connected' ? styles.statusConnected : styles.statusPending)
                }}>
                  {req.status}
                </span>
              </div>
              <div style={styles.requestInfo}>
                BW: {req.bandwidth}Mbps | Lat: {req.latency}ms
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleClearRequest(req.id)}
                  style={styles.clearButton}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} />
                  Clear
                </button>
              </div>
            </div>
          ))}
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
          </div>
        </div>
        <div style={styles.controls}>
          <div>🖱️ Drag to rotate</div>
          <div>🔍 Scroll to zoom</div>
          <div style={styles.controlsTitle}>
            Time: {timeSpeedup}x
          </div>
          <div style={styles.controlsTime}>
            {timeSpeedup === 1 && '90 min orbit = 90 min real'}
            {timeSpeedup === 10 && '90 min orbit = 9 min real'}
            {timeSpeedup === 60 && '90 min orbit = 90 sec real'}
            {timeSpeedup === 300 && '90 min orbit = 18 sec real'}
            {timeSpeedup === 900 && '90 min orbit = 6 sec real'}
            {timeSpeedup === 3600 && '90 min orbit = 1.5 sec real'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetworkVisualizer;