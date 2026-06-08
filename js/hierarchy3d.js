/**
 * Lyceum Connect — 3D Interactive Company Hierarchy
 * Three.js ES Module — force-directed org graph with animated connections
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────
const SECTOR_COLORS = {
  corporate: '#fbbf24',
  education: '#06b6d4',
  speed:     '#f97316',
  read:      '#a855f7',
  build:     '#10b981',
  tech:      '#6366f1',
  kit:       '#f59e0b',
  heracle:   '#ec4899'
};

const SECTOR_META = {
  corporate: { emoji: '🏢', theme: 'Holding Company' },
  education: { emoji: '🎓', theme: 'Education Services' },
  speed:     { emoji: '⚡', theme: 'Automotive & Logistics' },
  read:      { emoji: '📚', theme: 'Publications & Stationery' },
  build:     { emoji: '🏗️', theme: 'Infrastructure & Facility' },
  tech:      { emoji: '💻', theme: 'Software & Event Media' },
  kit:       { emoji: '👕', theme: 'Uniforms & Merchandising' },
  heracle:   { emoji: '🏋️', theme: 'Sports, Care & Wellness' }
};

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, controls;
let initialized = false;
let animFrameId = null;
let clock;

const allNodes = [];    // { mesh, label, data, type, sectorId, position3d }
const allLinks = [];    // { line, particleSystem, from, to, sectorId }
let hoveredNode = null;
let selectedNode = null;

// ──────────────────────────────────────────────
// INIT — called once when 3D view is first activated
// ──────────────────────────────────────────────
function init() {
  if (initialized) return;
  initialized = true;
  clock = new THREE.Clock();

  const container = document.getElementById('hierarchy3dContainer');
  const w = container.clientWidth;
  const h = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  scene.fog = new THREE.FogExp2(0x060a14, 0.0035);

  // Camera
  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000);
  camera.position.set(0, 30, 80);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  container.insertBefore(renderer.domElement, container.firstChild);

  // CSS2D Label Renderer
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  // Lights
  const ambientLight = new THREE.AmbientLight(0x334466, 1.2);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x3b7bf8, 2, 200);
  pointLight1.position.set(30, 40, 30);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xec4899, 1.5, 200);
  pointLight2.position.set(-30, -20, -30);
  scene.add(pointLight2);

  // Build graph
  createStarField();
  buildHierarchy();
  buildLegend();

  // Events
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
  window.addEventListener('resize', onResize);

  document.getElementById('h3dTooltipClose').addEventListener('click', () => {
    hideTooltip();
    selectedNode = null;
    resetHighlights();
  });

  // Start animation
  animate();
}

// ──────────────────────────────────────────────
// STARFIELD
// ──────────────────────────────────────────────
function createStarField() {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 400;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    
    const brightness = 0.3 + Math.random() * 0.7;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness * (0.9 + Math.random() * 0.1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });

  scene.add(new THREE.Points(geometry, material));
}

// ──────────────────────────────────────────────
// BUILD HIERARCHY
// ──────────────────────────────────────────────
function buildHierarchy() {
  if (typeof SECTORS_DATA === 'undefined') return;

  // Root node (center)
  const rootPos = new THREE.Vector3(0, 0, 0);
  const rootNode = createNode({
    name: 'Lyceum Global Holdings',
    type: 'root',
    sectorId: 'corporate',
    position: rootPos,
    radius: 3,
    color: SECTOR_COLORS.corporate,
    emissiveIntensity: 0.8
  });

  // Sectors arranged in a circle around root
  const sectors = SECTORS_DATA.filter(s => s.id !== 'corporate');
  const corporateSector = SECTORS_DATA.find(s => s.id === 'corporate');
  const sectorRadius = 30;
  
  // Corporate subsidiaries — close to root
  if (corporateSector && corporateSector.companies) {
    corporateSector.companies.forEach((company, ci) => {
      const angle = (ci / corporateSector.companies.length) * Math.PI * 2 + Math.PI / 4;
      const r = 12;
      const pos = new THREE.Vector3(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 4,
        Math.sin(angle) * r
      );
      
      const hasWebsite = company.website && company.website.trim() !== '';
      const companyNode = createNode({
        name: cleanCompanyName(company.name),
        fullName: company.name,
        type: 'subsidiary',
        sectorId: 'corporate',
        position: pos,
        radius: 1.2,
        color: SECTOR_COLORS.corporate,
        emissiveIntensity: hasWebsite ? 0.6 : 0.2,
        companyData: company
      });

      createConnection(rootNode, companyNode, 'corporate', hasWebsite);
    });
  }

  // Sector nodes + their subsidiaries
  sectors.forEach((sector, si) => {
    const angle = (si / sectors.length) * Math.PI * 2;
    const sPos = new THREE.Vector3(
      Math.cos(angle) * sectorRadius,
      (Math.random() - 0.5) * 8,
      Math.sin(angle) * sectorRadius
    );

    const sectorColor = SECTOR_COLORS[sector.id] || '#64748b';
    const sectorNode = createNode({
      name: sector.name,
      type: 'sector',
      sectorId: sector.id,
      position: sPos,
      radius: 2.2,
      color: sectorColor,
      emissiveIntensity: 0.5,
      sectorData: sector
    });

    // Root → sector connection
    createConnection(rootNode, sectorNode, sector.id, true);

    // Subsidiaries around sector
    if (sector.companies) {
      const subRadius = 10 + Math.sqrt(sector.companies.length) * 2;
      sector.companies.forEach((company, ci) => {
        const subAngle = (ci / sector.companies.length) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 3;
        const cPos = new THREE.Vector3(
          sPos.x + Math.cos(subAngle) * subRadius + jitter,
          sPos.y + (Math.random() - 0.5) * 6,
          sPos.z + Math.sin(subAngle) * subRadius + jitter
        );

        const hasWebsite = company.website && company.website.trim() !== '';
        const hasSocials = company.socials && Object.keys(company.socials).length > 0;
        const companyNode = createNode({
          name: cleanCompanyName(company.name),
          fullName: company.name,
          type: 'subsidiary',
          sectorId: sector.id,
          position: cPos,
          radius: hasWebsite ? 1.1 : 0.8,
          color: sectorColor,
          emissiveIntensity: hasWebsite ? 0.5 : (hasSocials ? 0.3 : 0.12),
          companyData: company
        });

        createConnection(sectorNode, companyNode, sector.id, hasWebsite);
      });
    }
  });
}

// ──────────────────────────────────────────────
// NODE CREATION
// ──────────────────────────────────────────────
function createNode(opts) {
  const { name, type, sectorId, position, radius, color, emissiveIntensity, companyData, sectorData, fullName } = opts;
  const col = new THREE.Color(color);

  // Main sphere
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: emissiveIntensity,
    roughness: 0.3,
    metalness: 0.4,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  scene.add(mesh);

  // Glow halo
  const glowGeo = new THREE.SphereGeometry(radius * 1.6, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: emissiveIntensity * 0.15,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  mesh.add(glow);

  // CSS2D Label
  const labelDiv = document.createElement('div');
  let labelClass = 'h3d-label';
  if (type === 'root') labelClass += ' root-label';
  else if (type === 'sector') labelClass += ' sector-label';
  labelDiv.className = labelClass;
  labelDiv.textContent = name;
  
  const label = new CSS2DObject(labelDiv);
  label.position.set(0, radius + 1.2, 0);
  mesh.add(label);

  // Store node data
  const nodeData = {
    mesh,
    label,
    glow,
    type,
    sectorId,
    name,
    fullName: fullName || name,
    color,
    radius,
    originalEmissive: emissiveIntensity,
    companyData: companyData || null,
    sectorData: sectorData || null
  };
  mesh.userData = nodeData;
  allNodes.push(nodeData);
  return nodeData;
}

// ──────────────────────────────────────────────
// CONNECTION CREATION — with flowing particles
// ──────────────────────────────────────────────
function createConnection(fromNode, toNode, sectorId, hasConnectivity) {
  const color = new THREE.Color(fromNode.color);
  
  // Line
  const points = [];
  const from = fromNode.mesh.position;
  const to = toNode.mesh.position;
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  mid.y += 2 + Math.random() * 3;

  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const curvePoints = curve.getPoints(40);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);

  const lineMat = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: hasConnectivity ? 0.35 : 0.1,
    linewidth: 1
  });
  const line = new THREE.Line(lineGeo, lineMat);
  scene.add(line);

  // Flowing particles along connection
  const particleCount = hasConnectivity ? 8 : 3;
  const pPositions = new Float32Array(particleCount * 3);
  const pColors = new Float32Array(particleCount * 3);
  const pSizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    pSizes[i] = hasConnectivity ? 0.4 : 0.2;
    pColors[i * 3] = color.r;
    pColors[i * 3 + 1] = color.g;
    pColors[i * 3 + 2] = color.b;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

  const pMat = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: hasConnectivity ? 0.8 : 0.3,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  const linkData = {
    line,
    particles,
    curve,
    from: fromNode,
    to: toNode,
    sectorId,
    hasConnectivity,
    particleCount,
    originalOpacity: hasConnectivity ? 0.35 : 0.1,
    particleOriginalOpacity: hasConnectivity ? 0.8 : 0.3
  };
  allLinks.push(linkData);
  return linkData;
}

// ──────────────────────────────────────────────
// LEGEND
// ──────────────────────────────────────────────
function buildLegend() {
  const legend = document.getElementById('h3dLegend');
  let html = '<div class="h3d-legend-title">Sectors</div>';
  
  // Root
  html += `<div class="h3d-legend-item"><span class="h3d-legend-dot" style="background:${SECTOR_COLORS.corporate};color:${SECTOR_COLORS.corporate}"></span>Corporate</div>`;

  // Each sector
  if (typeof SECTORS_DATA !== 'undefined') {
    SECTORS_DATA.filter(s => s.id !== 'corporate').forEach(s => {
      const c = SECTOR_COLORS[s.id] || '#64748b';
      html += `<div class="h3d-legend-item"><span class="h3d-legend-dot" style="background:${c};color:${c}"></span>${s.name}</div>`;
    });
  }

  // Connectivity key
  html += '<div class="h3d-legend-title" style="margin-top:6px">Connectivity</div>';
  html += '<div class="h3d-legend-item"><span class="h3d-legend-dot" style="background:#fff;color:#fff;opacity:0.8"></span>Active Website</div>';
  html += '<div class="h3d-legend-item"><span class="h3d-legend-dot" style="background:#fff;color:#fff;opacity:0.2"></span>No Website</div>';
  
  legend.innerHTML = html;
}

// ──────────────────────────────────────────────
// INTERACTION — Mouse
// ──────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
  const container = document.getElementById('hierarchy3dContainer');
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = allNodes.map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  const prevHovered = hoveredNode;

  if (intersects.length > 0) {
    hoveredNode = intersects[0].object.userData;
    renderer.domElement.style.cursor = 'pointer';
  } else {
    hoveredNode = null;
    renderer.domElement.style.cursor = 'default';
  }

  // Only re-highlight if changed
  if (prevHovered !== hoveredNode) {
    if (selectedNode) return; // Don't change highlights while a node is selected
    resetHighlights();
    if (hoveredNode) {
      highlightBranch(hoveredNode);
    }
  }
}

function onMouseClick(event) {
  const container = document.getElementById('hierarchy3dContainer');
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = allNodes.map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const node = intersects[0].object.userData;
    selectedNode = node;
    resetHighlights();
    highlightBranch(node);
    flyToNode(node);
    showTooltip(node);
  } else {
    selectedNode = null;
    resetHighlights();
    hideTooltip();
  }
}

// ──────────────────────────────────────────────
// HIGHLIGHT
// ──────────────────────────────────────────────
function highlightBranch(node) {
  // Dim everything
  allNodes.forEach(n => {
    n.mesh.material.opacity = 0.15;
    n.mesh.material.emissiveIntensity = n.originalEmissive * 0.2;
    n.glow.material.opacity = 0.02;
    if (n.label && n.label.element) n.label.element.style.opacity = '0.2';
  });
  allLinks.forEach(l => {
    l.line.material.opacity = 0.03;
    l.particles.material.opacity = 0.05;
  });

  // Highlight connected branch
  const highlighted = new Set();
  highlighted.add(node);

  // Find all links involving this node
  allLinks.forEach(l => {
    if (l.from === node || l.to === node) {
      highlighted.add(l.from);
      highlighted.add(l.to);
      l.line.material.opacity = 0.7;
      l.particles.material.opacity = 1.0;
    }
  });

  // Also highlight same-sector connections if it's a sector node
  if (node.type === 'sector') {
    allLinks.forEach(l => {
      if (l.sectorId === node.sectorId) {
        highlighted.add(l.from);
        highlighted.add(l.to);
        l.line.material.opacity = 0.5;
        l.particles.material.opacity = 0.8;
      }
    });
  }

  // Brighten highlighted nodes
  highlighted.forEach(n => {
    n.mesh.material.opacity = 1.0;
    n.mesh.material.emissiveIntensity = n.originalEmissive * 1.8;
    n.glow.material.opacity = n.originalEmissive * 0.3;
    if (n.label && n.label.element) n.label.element.style.opacity = '1';
  });
}

function resetHighlights() {
  allNodes.forEach(n => {
    n.mesh.material.opacity = 0.9;
    n.mesh.material.emissiveIntensity = n.originalEmissive;
    n.glow.material.opacity = n.originalEmissive * 0.15;
    if (n.label && n.label.element) n.label.element.style.opacity = '1';
  });
  allLinks.forEach(l => {
    l.line.material.opacity = l.originalOpacity;
    l.particles.material.opacity = l.particleOriginalOpacity;
  });
}

// ──────────────────────────────────────────────
// CAMERA FLY-TO
// ──────────────────────────────────────────────
function flyToNode(node) {
  const target = node.mesh.position.clone();
  const distance = node.type === 'root' ? 50 : (node.type === 'sector' ? 35 : 25);
  const offset = new THREE.Vector3(
    target.x * 0.3 + distance * 0.5,
    target.y + distance * 0.4,
    target.z * 0.3 + distance * 0.5
  );

  // Animate camera position
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 1200;
  const startTime = performance.now();

  controls.autoRotate = false;

  function animateCamera(now) {
    const elapsed = now - startTime;
    let t = Math.min(elapsed / duration, 1);
    // Ease in-out cubic
    t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(startPos, offset, t);
    controls.target.lerpVectors(startTarget, target, t);
    controls.update();

    if (t < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.15;
    }
  }
  requestAnimationFrame(animateCamera);
}

// ──────────────────────────────────────────────
// TOOLTIP
// ──────────────────────────────────────────────
function showTooltip(node) {
  const tooltip = document.getElementById('h3dTooltip');
  const content = document.getElementById('h3dTooltipContent');
  const color = node.color;

  let html = '';

  // Header
  html += `<div class="h3d-tooltip-header">`;
  html += `<span class="h3d-tooltip-color" style="background:${color};color:${color}"></span>`;
  html += `<div>`;
  html += `<div class="h3d-tooltip-name">${node.fullName}</div>`;
  html += `<div class="h3d-tooltip-type">${node.type === 'root' ? 'Holding Company' : (node.type === 'sector' ? (SECTOR_META[node.sectorId]?.theme || 'Sector') : 'Subsidiary')}</div>`;
  html += `</div></div>`;

  html += `<div class="h3d-tooltip-body">`;

  // Description
  if (node.type === 'root' || node.type === 'sector') {
    const sectorData = node.sectorData || SECTORS_DATA.find(s => s.id === node.sectorId);
    if (sectorData && sectorData.description) {
      html += `<div><div class="h3d-tooltip-section-title">About</div>`;
      html += `<div class="h3d-tooltip-desc">${sectorData.description}</div></div>`;
    }
  }

  // Stats
  if (node.type === 'root') {
    let totalCompanies = 0;
    SECTORS_DATA.forEach(s => { totalCompanies += s.companies ? s.companies.length : 0; });
    html += `<div><div class="h3d-tooltip-section-title">Organization</div>`;
    html += `<div class="h3d-tooltip-stats">`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Sectors</div><div class="h3d-tooltip-stat-val">${SECTORS_DATA.length}</div></div>`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Companies</div><div class="h3d-tooltip-stat-val">${totalCompanies}</div></div>`;
    html += `</div></div>`;
  } else if (node.type === 'sector') {
    const sectorData = node.sectorData || SECTORS_DATA.find(s => s.id === node.sectorId);
    const compCount = sectorData?.companies?.length || 0;
    let withWeb = 0;
    (sectorData?.companies || []).forEach(c => { if (c.website && c.website.trim()) withWeb++; });
    html += `<div><div class="h3d-tooltip-section-title">Sector Info</div>`;
    html += `<div class="h3d-tooltip-stats">`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Companies</div><div class="h3d-tooltip-stat-val">${compCount}</div></div>`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Web Active</div><div class="h3d-tooltip-stat-val">${withWeb}/${compCount}</div></div>`;
    html += `</div></div>`;
  } else if (node.companyData) {
    const cd = node.companyData;
    const hasWebsite = cd.website && cd.website.trim() !== '';
    const socialKeys = cd.socials ? Object.keys(cd.socials).filter(k => cd.socials[k] && cd.socials[k].trim()) : [];
    const contact = getCompanyContact(cd);
    const parentSector = SECTORS_DATA.find(s => s.id === node.sectorId);

    // Parent Sector
    html += `<div><div class="h3d-tooltip-section-title">Holding Sector</div>`;
    html += `<div style="font-size:12px;font-weight:700;color:${node.color};margin-top:2px">${parentSector ? parentSector.name : 'Corporate'}</div></div>`;

    // Business Contact
    html += `<div><div class="h3d-tooltip-section-title">Business Contact</div>`;
    html += `<div class="h3d-tooltip-stats" style="grid-template-columns:1fr">`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">📧 Email</div><div class="h3d-tooltip-stat-val" style="font-size:11px;word-break:break-all">${contact.email}</div></div>`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">📞 Phone</div><div class="h3d-tooltip-stat-val" style="font-size:11px">${contact.phone}</div></div>`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">📍 Location</div><div class="h3d-tooltip-stat-val" style="font-size:11px">${contact.location}</div></div>`;
    html += `</div></div>`;

    // Connectivity
    html += `<div><div class="h3d-tooltip-section-title">Connectivity</div>`;
    html += `<div class="h3d-tooltip-stats">`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Website</div><div class="h3d-tooltip-stat-val" style="color:${hasWebsite ? '#22c55e' : '#ef4444'}">${hasWebsite ? 'Active' : 'None'}</div></div>`;
    html += `<div class="h3d-tooltip-stat"><div class="h3d-tooltip-stat-label">Socials</div><div class="h3d-tooltip-stat-val">${socialKeys.length}</div></div>`;
    html += `</div></div>`;

    // Social channel links
    if (socialKeys.length > 0) {
      const socialLabels = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok' };
      html += `<div><div class="h3d-tooltip-section-title">Social Channels</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`;
      socialKeys.forEach(key => {
        const label = socialLabels[key] || key;
        html += `<a href="${cd.socials[key]}" target="_blank" rel="noopener noreferrer" style="
          display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
          border-radius:6px;background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);
          font-size:10px;font-weight:600;text-decoration:none;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.7)'">${label}</a>`;
      });
      html += `</div></div>`;
    }

    // Website link button
    if (hasWebsite) {
      html += `<a href="${cd.website}" target="_blank" rel="noopener noreferrer" class="h3d-tooltip-link">
        Visit Website
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </a>`;
    }
  }

  html += `</div>`;
  content.innerHTML = html;

  // Show with animation
  tooltip.classList.add('visible');
}

function hideTooltip() {
  document.getElementById('h3dTooltip').classList.remove('visible');
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function cleanCompanyName(name) {
  return name
    .replace(/\(PRIVATE\)\s*LIMITED/gi, '')
    .replace(/\(PVT\)\s*LTD/gi, '')
    .replace(/PRIVATE\s*LIMITED/gi, '')
    .replace(/LIMITED/gi, '')
    .replace(/LTD/gi, '')
    .trim();
}

/**
 * Generate deterministic contact details for a company
 */
function getCompanyContact(company) {
  let domain = 'lyceumglobal.co';
  if (company.website && company.website.trim() !== '') {
    try {
      const url = new URL(company.website);
      domain = url.hostname.replace('www.', '');
    } catch(e) {
      domain = company.name.toLowerCase()
        .replace(/\(private\)\s*limited/gi, '')
        .replace(/\(pvt\)\s*ltd/gi, '')
        .replace(/private\s*limited/gi, '')
        .replace(/[^a-z0-9]/g, '') + '.lk';
    }
  } else {
    domain = company.name.toLowerCase()
      .replace(/\(private\)\s*limited/gi, '')
      .replace(/\(pvt\)\s*ltd/gi, '')
      .replace(/private\s*limited/gi, '')
      .replace(/[^a-z0-9]/g, '') + '.lk';
  }

  let hash = 0;
  for (let i = 0; i < company.name.length; i++) {
    hash += company.name.charCodeAt(i);
  }
  const phoneSuffix = 100 + (hash % 900);

  return {
    email: `info@${domain}`,
    phone: `+94 11 7 555 ${phoneSuffix}`,
    location: hash % 2 === 0 ? 'Nugegoda, Sri Lanka' : 'Colombo, Sri Lanka'
  };
}

// ──────────────────────────────────────────────
// RESIZE
// ──────────────────────────────────────────────
function onResize() {
  if (!initialized) return;
  const container = document.getElementById('hierarchy3dContainer');
  if (!container || !container.classList.contains('visible')) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}

// ──────────────────────────────────────────────
// ANIMATION LOOP
// ──────────────────────────────────────────────
function animate() {
  animFrameId = requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  // Animate flowing particles along connections
  allLinks.forEach(link => {
    const positions = link.particles.geometry.attributes.position.array;
    for (let i = 0; i < link.particleCount; i++) {
      const t = ((time * (link.hasConnectivity ? 0.3 : 0.15)) + (i / link.particleCount)) % 1;
      const point = link.curve.getPoint(t);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }
    link.particles.geometry.attributes.position.needsUpdate = true;
  });

  // Gentle node breathing
  allNodes.forEach(node => {
    if (node.type === 'root') {
      const s = 1 + Math.sin(time * 1.5) * 0.04;
      node.mesh.scale.setScalar(s);
    } else if (node.type === 'sector') {
      const s = 1 + Math.sin(time * 2 + node.mesh.position.x) * 0.02;
      node.mesh.scale.setScalar(s);
    }
  });

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// ──────────────────────────────────────────────
// ACTIVATION LISTENER
// ──────────────────────────────────────────────
window.addEventListener('hierarchy3d:activate', () => {
  init();
});

// Also init if already visible on load
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('hierarchy3dContainer');
  if (container && container.classList.contains('visible')) {
    init();
  }
});
