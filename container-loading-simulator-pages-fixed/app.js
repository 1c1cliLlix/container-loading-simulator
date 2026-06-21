const hasThree = typeof THREE !== "undefined";
const OrbitControls = hasThree ? THREE.OrbitControls : null;

const containers = {
  "20gp": {
    name: "20 尺标准干柜",
    sourceName: "Hapag-Lloyd 20' Standard",
    length: 5900,
    width: 2352,
    height: 2395,
  },
  "40gp": {
    name: "40 尺标准干柜",
    sourceName: "Hapag-Lloyd 40' Standard",
    length: 12032,
    width: 2352,
    height: 2395,
  },
};

const catalog = [
  { id: "box-7-5", name: "7.5LBS 箱子", length: 197, width: 197, height: 252, color: "#c1874f" },
  { id: "box-10", name: "10LBS 箱子", length: 197, width: 197, height: 297, color: "#c9955b" },
  { id: "box-15", name: "15LBS 箱子", length: 195, width: 195, height: 375, color: "#b77d48" },
  { id: "box-30", name: "30LBS 箱子", length: 247, width: 247, height: 427, color: "#d09a60" },
  { id: "box-50", name: "50LBS 箱子", length: 305, width: 305, height: 452, color: "#bf8550" },
];

const orientations = [
  ["length", "height", "width"],
  ["width", "height", "length"],
  ["length", "width", "height"],
  ["height", "width", "length"],
  ["width", "length", "height"],
  ["height", "length", "width"],
];

const state = {
  containerKey: "20gp",
  container: { ...containers["20gp"] },
  selectedCatalogId: catalog[0].id,
  items: [],
  bulkLoad: null,
  selectedPlanId: null,
  planCandidates: [],
  selectedItemId: null,
  drag: null,
};

const els = {
  mount: document.querySelector("#sceneMount"),
  boxCatalog: document.querySelector("#boxCatalog"),
  addBox: document.querySelector("#addBox"),
  addQuantity: document.querySelector("#addQuantity"),
  autoFillBox: document.querySelector("#autoFillBox"),
  clearLoad: document.querySelector("#clearLoad"),
  packingPlans: document.querySelector("#packingPlans"),
  planSummary: document.querySelector("#planSummary"),
  planDetail: document.querySelector("#planDetail"),
  topMap: document.querySelector("#topMap"),
  sideMap: document.querySelector("#sideMap"),
  meterPercent: document.querySelector("#meterPercent"),
  meterFill: document.querySelector("#meterFill"),
  loadHint: document.querySelector("#loadHint"),
  sceneTitle: document.querySelector("#sceneTitle"),
  containerVolume: document.querySelector("#containerVolume"),
  containerLength: document.querySelector("#containerLength"),
  containerWidth: document.querySelector("#containerWidth"),
  containerHeight: document.querySelector("#containerHeight"),
  usedPercent: document.querySelector("#usedPercent"),
  itemCount: document.querySelector("#itemCount"),
  freeVolume: document.querySelector("#freeVolume"),
  statusLine: document.querySelector("#statusLine"),
  rotateBox: document.querySelector("#rotateBox"),
  deleteBox: document.querySelector("#deleteBox"),
};

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let world = null;
let itemGroup = null;
let bulkGroup = null;
let raycaster = null;
let pointer = null;
let floorPlane = null;
let hitPoint = null;
let containerGroup = null;
let floorMesh = null;
let threeReady = false;
let animationStarted = false;

buildCatalog();
bindUi();
initThreePreview();
applyContainer("20gp");
if (threeReady) {
  resize();
  animate();
}

function mm(value) {
  return value / 1000;
}

function cbm(value) {
  return (value / 1_000_000_000).toFixed(2);
}

function getContainerVolume() {
  const c = state.container;
  return c.length * c.width * c.height;
}

function getDims(item) {
  const keys = orientations[item.orientation];
  return {
    x: item.base[keys[0]],
    y: item.base[keys[1]],
    z: item.base[keys[2]],
  };
}

function initThreePreview() {
  if (!hasThree || !OrbitControls) {
    showThreeFallback("当前浏览器没有完整加载 3D 引擎，装箱数据和装载直观图仍可正常使用。");
    return;
  }

  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#dfe5e1");
    scene.fog = new THREE.Fog("#dfe5e1", 7, 20);

    camera = new THREE.PerspectiveCamera(42, 1, 0.01, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    els.mount.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3.5;
    controls.maxDistance = 20;

    world = new THREE.Group();
    itemGroup = new THREE.Group();
    bulkGroup = new THREE.Group();
    scene.add(world, itemGroup, bulkGroup);

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    hitPoint = new THREE.Vector3();
    threeReady = true;
    initLights();
    bindThreeUi();
  } catch (error) {
    console.warn("3D preview unavailable:", error);
    threeReady = false;
    showThreeFallback("当前浏览器无法启动 3D 预览，装箱方案和装载直观图仍可正常使用。");
  }
}

function showThreeFallback(message) {
  els.mount.innerHTML = `<div class="scene-fallback">${message}</div>`;
  els.rotateBox.disabled = true;
  els.deleteBox.disabled = true;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.disabled = true;
  });
}

function initLights() {
  const hemi = new THREE.HemisphereLight("#ffffff", "#7b7568", 2.4);
  scene.add(hemi);

  const key = new THREE.DirectionalLight("#fff5e6", 3.8);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  scene.add(key);

  const rim = new THREE.DirectionalLight("#b9f7ff", 1.2);
  rim.position.set(5, 4, -3);
  scene.add(rim);
}

function buildCatalog() {
  els.boxCatalog.innerHTML = "";
  catalog.forEach((box) => {
    const button = document.createElement("button");
    button.className = `catalog-item ${box.id === state.selectedCatalogId ? "active" : ""}`;
    button.type = "button";
    button.dataset.box = box.id;
    button.innerHTML = `
      <span>
        <strong>${box.name}</strong>
        <span>${box.length} × ${box.width} × ${box.height} mm</span>
      </span>
      <em>${cbm(box.length * box.width * box.height)}m³</em>
    `;
    els.boxCatalog.appendChild(button);
  });
}

function getSelectedCatalogBox() {
  return catalog.find((item) => item.id === state.selectedCatalogId) ?? catalog[0];
}

function buildPackingPlans() {
  const box = getSelectedCatalogBox();
  const plans = [
    buildUniformPlan("upright", "正常直立", box, { x: box.length, y: box.height, z: box.width }),
    buildUniformPlan("lying", "正常躺立", box, { x: box.height, y: box.length, z: box.width }),
    buildOptimizedPlan(box),
  ].filter(Boolean);
  state.planCandidates = plans;
  if (!plans.some((plan) => plan.id === state.selectedPlanId)) {
    state.selectedPlanId = plans[0]?.id ?? null;
  }
  renderPackingPlans();
}

function getFillRate(count, box) {
  return (count * box.length * box.width * box.height) / getContainerVolume();
}

function buildUniformPlan(id, name, box, dims) {
  const columns = Math.floor(state.container.length / dims.x);
  const rows = Math.floor(state.container.width / dims.z);
  const layers = Math.floor(state.container.height / dims.y);
  const count = Math.max(0, columns * rows * layers);
  if (!count) return null;
  return {
    id,
    type: "uniform",
    name,
    count,
    practicalCount: count,
    fillRate: getFillRate(count, box),
    segments: [{ dims, columns, rows, layers, yOffset: 0, theoreticalCount: count, renderCount: count }],
    detail: `${columns}列 × ${rows}排 × ${layers}层 = ${count}箱；占地 ${dims.x}×${dims.z}mm，高 ${dims.y}mm。`,
  };
}

function buildOptimizedPlan(box) {
  const layerTypes = getUniqueLayerTypes(box);
  const maxHeight = state.container.height;
  const dp = Array.from({ length: maxHeight + 1 }, () => ({ count: -Infinity, prev: null }));
  dp[0] = { count: 0, prev: null };
  for (let h = 0; h <= maxHeight; h += 1) {
    if (dp[h].count < 0) continue;
    layerTypes.forEach((layer) => {
      const nextHeight = h + layer.dims.y;
      if (nextHeight > maxHeight) return;
      const nextCount = dp[h].count + layer.perLayer;
      if (nextCount > dp[nextHeight].count) {
        dp[nextHeight] = { count: nextCount, prev: { height: h, layer } };
      }
    });
  }
  let bestHeight = 0;
  for (let h = 1; h <= maxHeight; h += 1) {
    if (dp[h].count > dp[bestHeight].count) bestHeight = h;
  }
  if (dp[bestHeight].count <= 0) return null;

  const layers = [];
  let cursor = bestHeight;
  while (cursor > 0 && dp[cursor].prev) {
    layers.push(dp[cursor].prev.layer);
    cursor = dp[cursor].prev.height;
  }
  layers.reverse();
  layers.sort((a, b) => b.dims.y - a.dims.y || b.perLayer - a.perLayer);
  const count = dp[bestHeight].count;
  const practicalCount = count;
  const segments = applyPracticalCounts(compressLayers(layers), practicalCount);
  const layerSummary = segments
    .map((segment) => `${segment.columns}列×${segment.rows}排×${segment.layers}层，${segment.renderCount}箱`)
    .join(" + ");
  return {
    id: "optimized",
    type: "optimized",
    name: "最多装箱",
    count,
    practicalCount,
    fillRate: getFillRate(practicalCount, box),
    segments,
    detail: `${layerSummary} = ${count}箱。`,
  };
}

function applyPracticalCounts(segments, practicalCount) {
  let remaining = practicalCount;
  return segments
    .map((segment) => {
      const theoreticalCount = segment.columns * segment.rows * segment.layers;
      const renderCount = Math.max(0, Math.min(theoreticalCount, remaining));
      remaining -= renderCount;
      return { ...segment, theoreticalCount, renderCount };
    })
    .filter((segment) => segment.renderCount > 0);
}

function getUniqueLayerTypes(box) {
  const unique = new Map();
  orientations.forEach((keys) => {
    const dims = { x: box[keys[0]], y: box[keys[1]], z: box[keys[2]] };
    const columns = Math.floor(state.container.length / dims.x);
    const rows = Math.floor(state.container.width / dims.z);
    const perLayer = columns * rows;
    if (!perLayer) return;
    const key = `${dims.x}-${dims.y}-${dims.z}`;
    if (!unique.has(key) || unique.get(key).perLayer < perLayer) {
      unique.set(key, { dims, columns, rows, perLayer });
    }
  });
  return [...unique.values()].sort((a, b) => b.perLayer / b.dims.y - a.perLayer / a.dims.y);
}

function compressLayers(layers) {
  const segments = [];
  let yOffset = 0;
  layers.forEach((layer) => {
    const last = segments[segments.length - 1];
    const sameAsLast =
      last &&
      last.dims.x === layer.dims.x &&
      last.dims.y === layer.dims.y &&
      last.dims.z === layer.dims.z;
    if (sameAsLast) {
      last.layers += 1;
    } else {
      segments.push({
        dims: layer.dims,
        columns: layer.columns,
        rows: layer.rows,
        perLayer: layer.perLayer,
        layers: 1,
        yOffset,
      });
    }
    yOffset += layer.dims.y;
  });
  return segments;
}

function renderPackingPlans() {
  els.packingPlans.innerHTML = "";
  state.planCandidates.forEach((plan) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.plan = plan.id;
    button.className = `plan-card ${plan.id === state.selectedPlanId ? "active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${plan.name}</strong>
        <span>${plan.detail}</span>
      </span>
      <em>${plan.practicalCount}</em>
    `;
    els.packingPlans.appendChild(button);
  });
  const selected = getSelectedPlan();
  els.planSummary.textContent = selected ? `${selected.practicalCount} 箱` : "无方案";
  els.planDetail.textContent = selected
    ? `当前方案体积利用率 ${Math.min(selected.fillRate * 100, 100).toFixed(2)}%。`
    : "当前尺寸无法形成装箱方案。";
}

function getSelectedPlan() {
  return state.planCandidates.find((plan) => plan.id === state.selectedPlanId) ?? state.planCandidates[0] ?? null;
}

function bindUi() {
  document.querySelectorAll("[data-container]").forEach((button) => {
    button.addEventListener("click", () => applyContainer(button.dataset.container));
  });

  els.boxCatalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-box]");
    if (!button) return;
    state.selectedCatalogId = button.dataset.box;
    buildCatalog();
    buildPackingPlans();
  });

  els.packingPlans.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan]");
    if (!button) return;
    state.selectedPlanId = button.dataset.plan;
    renderPackingPlans();
  });

  els.addBox.addEventListener("click", addSelectedBoxes);
  els.autoFillBox.addEventListener("click", autoFillSelectedBox);
  els.clearLoad.addEventListener("click", clearLoad);
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  [els.containerLength, els.containerWidth, els.containerHeight].forEach((input) => {
    input.addEventListener("change", () => {
      state.container.length = Number(els.containerLength.value);
      state.container.width = Number(els.containerWidth.value);
      state.container.height = Number(els.containerHeight.value);
      rebuildContainer();
      if (threeReady) fitCamera();
      buildPackingPlans();
      validateAndRender();
    });
  });
}

function bindThreeUi() {
  els.rotateBox.addEventListener("click", rotateSelected);
  els.deleteBox.addEventListener("click", deleteSelected);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("dblclick", rotateSelected);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resize);
}

function applyContainer(key) {
  state.containerKey = key;
  state.container = { ...containers[key] };
  document.querySelectorAll("[data-container]").forEach((button) => {
    button.classList.toggle("active", button.dataset.container === key);
  });
  rebuildContainer();
  if (threeReady) fitCamera();
  buildPackingPlans();
  validateAndRender();
}

function rebuildContainer() {
  const c = state.container;
  els.containerLength.value = c.length;
  els.containerWidth.value = c.width;
  els.containerHeight.value = c.height;
  els.sceneTitle.textContent = containers[state.containerKey]?.name ?? "自定义集装箱";
  els.containerVolume.textContent = `${cbm(getContainerVolume())} cbm`;

  if (!threeReady) return;

  if (containerGroup) {
    world.remove(containerGroup);
  }

  containerGroup = new THREE.Group();
  const L = mm(c.length);
  const W = mm(c.width);
  const H = mm(c.height);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createFloorTexture(),
    roughness: 0.78,
    metalness: 0.05,
  });
  floorMesh = new THREE.Mesh(new THREE.BoxGeometry(L, 0.035, W), floorMaterial);
  floorMesh.position.y = -0.017;
  floorMesh.receiveShadow = true;
  containerGroup.add(floorMesh);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#9aa7ad",
    roughness: 0.42,
    metalness: 0.28,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: "#2e3b42",
    roughness: 0.42,
    metalness: 0.7,
  });

  addWall(containerGroup, L, H, 0.04, 0, H / 2, -W / 2, wallMaterial, "back");
  addWall(containerGroup, L, H, 0.04, 0, H / 2, W / 2, wallMaterial, "front");
  addWall(containerGroup, W, H, 0.04, -L / 2, H / 2, 0, wallMaterial, "left");
  addWall(containerGroup, W, H, 0.04, L / 2, H / 2, 0, wallMaterial, "right");

  addRail(containerGroup, L, 0.08, 0.08, 0, H + 0.04, -W / 2, railMaterial);
  addRail(containerGroup, L, 0.08, 0.08, 0, H + 0.04, W / 2, railMaterial);
  addRail(containerGroup, 0.08, H, 0.08, -L / 2, H / 2, -W / 2, railMaterial);
  addRail(containerGroup, 0.08, H, 0.08, -L / 2, H / 2, W / 2, railMaterial);
  addRail(containerGroup, 0.08, H, 0.08, L / 2, H / 2, -W / 2, railMaterial);
  addRail(containerGroup, 0.08, H, 0.08, L / 2, H / 2, W / 2, railMaterial);

  world.add(containerGroup);
}

function addWall(group, a, h, t, x, y, z, material, side) {
  const isLong = side === "front" || side === "back";
  const geometry = isLong ? new THREE.BoxGeometry(a, h, t) : new THREE.BoxGeometry(t, h, a);
  const wall = new THREE.Mesh(geometry, material);
  wall.position.set(x, y, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const ribMaterial = material.clone();
  ribMaterial.opacity = 0.2;
  const count = Math.max(10, Math.floor(a / 0.32));
  for (let i = 0; i <= count; i += 1) {
    const offset = -a / 2 + (a / count) * i;
    const ribGeo = isLong ? new THREE.BoxGeometry(0.018, h * 0.96, 0.035) : new THREE.BoxGeometry(0.035, h * 0.96, 0.018);
    const rib = new THREE.Mesh(ribGeo, ribMaterial);
    rib.position.set(isLong ? offset : x, h / 2, isLong ? z : offset);
    if (!isLong) rib.position.z = offset;
    if (isLong) rib.position.x = offset;
    group.add(rib);
  }
}

function addRail(group, xSize, ySize, zSize, x, y, z, material) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(xSize, ySize, zSize), material);
  rail.position.set(x, y, z);
  rail.castShadow = true;
  group.add(rail);
}

function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#806a4c";
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 52) {
    ctx.fillStyle = x % 104 === 0 ? "#9a7d56" : "#725f45";
    ctx.fillRect(x, 0, 48, 512);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 6, 0, 2, 512);
    ctx.fillStyle = "rgba(30,20,10,0.16)";
    ctx.fillRect(x + 47, 0, 2, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCartonTexture(box, variant = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const base = variant % 2 === 0 ? "#c9955b" : "#d4a56c";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2800; i += 1) {
    const alpha = 0.035 + Math.random() * 0.035;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(75,48,27,${alpha})` : `rgba(255,244,214,${alpha})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.fillStyle = "rgba(106,68,34,0.24)";
  ctx.fillRect(236, 0, 40, 512);
  ctx.fillRect(0, 235, 512, 42);
  ctx.fillStyle = "rgba(255,235,184,0.22)";
  ctx.fillRect(248, 0, 7, 512);
  ctx.fillRect(0, 248, 512, 7);

  ctx.strokeStyle = "rgba(69,43,24,0.32)";
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, 476, 476);
  ctx.lineWidth = 2;
  for (let x = 44; x < 512; x += 58) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x + 16, 492);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,246,0.9)";
  roundRect(ctx, 52, 58, 408, 132, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(58,38,24,0.28)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#2b2119";
  ctx.font = "900 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(box.name.replace(" 箱子", ""), 256, 104);
  ctx.font = "700 22px Arial";
  ctx.fillText(`${box.length} × ${box.width} × ${box.height} mm`, 256, 154);

  ctx.strokeStyle = "#2b2119";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(164, 354);
  ctx.lineTo(164, 288);
  ctx.moveTo(164, 288);
  ctx.lineTo(138, 318);
  ctx.moveTo(164, 288);
  ctx.lineTo(190, 318);
  ctx.moveTo(348, 354);
  ctx.lineTo(348, 288);
  ctx.moveTo(348, 288);
  ctx.lineTo(322, 318);
  ctx.moveTo(348, 288);
  ctx.lineTo(374, 318);
  ctx.stroke();

  ctx.fillStyle = "rgba(43,33,25,0.85)";
  ctx.font = "900 28px Arial";
  ctx.fillText("THIS SIDE UP", 256, 406);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function addSelectedBoxes() {
  removeBulkLoad();
  const quantity = clamp(Number(els.addQuantity.value) || 1, 1, 999);
  let lastId = null;
  for (let i = 0; i < quantity; i += 1) {
    lastId = addBox(null, null, false);
  }
  if (lastId) selectItem(lastId);
  validateAndRender();
}

function autoFillSelectedBox() {
  const box = getSelectedCatalogBox();
  const plan = getSelectedPlan();
  if (!box || !plan) return;
  clearLoad(false);
  const meshes = threeReady
    ? plan.segments.flatMap((segment, segmentIndex) => createBulkSegmentMesh(box, segment, segmentIndex))
    : [];
  state.bulkLoad = {
    meshes,
    base: box,
    planId: plan.id,
    name: plan.name,
    count: plan.count,
    practicalCount: plan.practicalCount,
    segments: plan.segments,
  };
  state.selectedItemId = null;
  if (threeReady) setView("door");
  validateAndRender();
}

function createBulkSegmentMesh(box, segment, segmentIndex) {
  const visualGap = 24;
  const geometry = new THREE.BoxGeometry(
    mm(Math.max(1, segment.dims.x - visualGap)),
    mm(Math.max(1, segment.dims.y - visualGap)),
    mm(Math.max(1, segment.dims.z - visualGap))
  );
  const material = new THREE.MeshStandardMaterial({
    map: createCartonTexture(box, segmentIndex),
    color: "#ffffff",
    roughness: 0.84,
    metalness: 0.02,
  });
  const count = segment.renderCount ?? segment.columns * segment.rows * segment.layers;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const wire = new THREE.InstancedMesh(
    geometry.clone(),
    new THREE.MeshBasicMaterial({
      color: "#1d120a",
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    }),
    count
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let y = 0; y < segment.layers; y += 1) {
    for (let z = 0; z < segment.rows; z += 1) {
      for (let x = 0; x < segment.columns; x += 1) {
        if (index >= count) break;
        const px = -state.container.length / 2 + segment.dims.x / 2 + x * segment.dims.x;
        const py = segment.yOffset + segment.dims.y / 2 + y * segment.dims.y;
        const pz = -state.container.width / 2 + segment.dims.z / 2 + z * segment.dims.z;
        matrix.setPosition(mm(px), mm(py), mm(pz));
        mesh.setMatrixAt(index, matrix);
        wire.setMatrixAt(index, matrix);
        index += 1;
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  wire.instanceMatrix.needsUpdate = true;
  bulkGroup.add(mesh);
  bulkGroup.add(wire);
  return [mesh, wire];
}

function clearLoad(shouldRender = true) {
  state.items.forEach((item) => {
    if (threeReady && item.mesh && itemGroup) itemGroup.remove(item.mesh);
  });
  state.items = [];
  state.selectedItemId = null;
  removeBulkLoad();
  if (shouldRender) validateAndRender();
}

function removeBulkLoad() {
  if (!state.bulkLoad) return;
  state.bulkLoad.meshes.forEach((mesh) => {
    if (bulkGroup) bulkGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  state.bulkLoad = null;
}

function addBox(sourceItem, position, shouldSelect = true) {
  const box = sourceItem ?? catalog.find((item) => item.id === state.selectedCatalogId);
  if (!box) return null;
  const id = `item-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const item = {
    id,
    base: { ...box },
    orientation: 0,
    position: position ?? findPlacement(box),
    mesh: null,
    helper: null,
    invalid: false,
  };
  state.items.push(item);
  if (threeReady) createItemMesh(item);
  if (shouldSelect) {
    selectItem(id);
    validateAndRender();
  }
  return id;
}

function findPlacement(box) {
  const dims = { x: box.length, y: box.height, z: box.width };
  const c = state.container;
  const padding = 25;
  for (let z = -c.width / 2 + dims.z / 2 + padding; z <= c.width / 2 - dims.z / 2; z += dims.z + padding) {
    for (let x = -c.length / 2 + dims.x / 2 + padding; x <= c.length / 2 - dims.x / 2; x += dims.x + padding) {
      const candidate = { x, y: dims.y / 2, z };
      const ghost = { id: "ghost", position: candidate, orientation: 0, base: box };
      if (!state.items.some((item) => intersects(ghost, item))) {
        return candidate;
      }
    }
  }
  return { x: 0, y: dims.y / 2, z: 0 };
}

function createItemMesh(item) {
  const dims = getDims(item);
  const material = new THREE.MeshStandardMaterial({
    map: createCartonTexture(item.base),
    color: "#ffffff",
    roughness: 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(mm(dims.x), mm(dims.y), mm(dims.z)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.itemId = item.id;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: "#5a351d", transparent: true, opacity: 0.75 })
  );
  mesh.add(edges);

  const label = createLabel(item.base.name);
  label.position.set(0, mm(dims.y) / 2 + 0.008, 0);
  mesh.add(label);

  item.mesh = mesh;
  item.edges = edges;
  item.label = label;
  itemGroup.add(mesh);
  syncMesh(item);
}

function createLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#3b2b1d";
  ctx.font = "800 46px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), material);
  plane.rotation.x = -Math.PI / 2;
  return plane;
}

function syncMesh(item) {
  const dims = getDims(item);
  if (!item.mesh) return;
  item.mesh.position.set(mm(item.position.x), mm(item.position.y), mm(item.position.z));
  item.mesh.scale.set(1, 1, 1);
  item.mesh.geometry.dispose();
  item.mesh.geometry = new THREE.BoxGeometry(mm(dims.x), mm(dims.y), mm(dims.z));
  if (item.edges) {
    item.edges.geometry.dispose();
    item.edges.geometry = new THREE.EdgesGeometry(item.mesh.geometry);
  }
  if (item.label) {
    item.label.position.set(0, mm(dims.y) / 2 + 0.008, 0);
  }
  item.mesh.material.color.set(item.invalid ? "#e07070" : "#ffffff");
  item.mesh.material.emissive = new THREE.Color(item.id === state.selectedItemId ? "#4d2600" : "#000000");
  item.mesh.material.emissiveIntensity = item.id === state.selectedItemId ? 0.16 : 0;
}

function rotateSelected() {
  if (!threeReady) return;
  const item = getSelectedItem();
  if (!item) return;
  item.orientation = (item.orientation + 1) % orientations.length;
  keepInside(item);
  syncMesh(item);
  validateAndRender();
}

function deleteSelected() {
  const item = getSelectedItem();
  if (!item) return;
  if (threeReady && item.mesh && itemGroup) itemGroup.remove(item.mesh);
  state.items = state.items.filter((candidate) => candidate.id !== item.id);
  state.selectedItemId = state.items.at(-1)?.id ?? null;
  validateAndRender();
}

function keepInside(item) {
  const dims = getDims(item);
  const c = state.container;
  item.position.x = clamp(item.position.x, -c.length / 2 + dims.x / 2, c.length / 2 - dims.x / 2);
  item.position.z = clamp(item.position.z, -c.width / 2 + dims.z / 2, c.width / 2 - dims.z / 2);
  item.position.y = clamp(item.position.y, dims.y / 2, c.height - dims.y / 2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSelectedItem() {
  return state.items.find((item) => item.id === state.selectedItemId) ?? null;
}

function selectItem(id) {
  state.selectedItemId = id;
  validateAndRender();
}

function validateAndRender() {
  state.items.forEach((item) => {
    item.invalid = isOutOfBounds(item) || state.items.some((other) => other.id !== item.id && intersects(item, other));
    if (threeReady) syncMesh(item);
  });
  updateStats();
}

function isOutOfBounds(item) {
  const dims = getDims(item);
  const c = state.container;
  return (
    item.position.x - dims.x / 2 < -c.length / 2 ||
    item.position.x + dims.x / 2 > c.length / 2 ||
    item.position.z - dims.z / 2 < -c.width / 2 ||
    item.position.z + dims.z / 2 > c.width / 2 ||
    item.position.y - dims.y / 2 < 0 ||
    item.position.y + dims.y / 2 > c.height
  );
}

function intersects(a, b) {
  const ad = getDims(a);
  const bd = getDims(b);
  return (
    Math.abs(a.position.x - b.position.x) < (ad.x + bd.x) / 2 &&
    Math.abs(a.position.y - b.position.y) < (ad.y + bd.y) / 2 &&
    Math.abs(a.position.z - b.position.z) < (ad.z + bd.z) / 2
  );
}

function updateStats() {
  const used = getUsedVolume();
  const total = getContainerVolume();
  const invalidCount = state.items.filter((item) => item.invalid).length;
  const percent = Math.min((used / total) * 100, 100);
  const itemCount = state.items.length + (state.bulkLoad?.practicalCount ?? 0);
  els.usedPercent.textContent = `${percent.toFixed(2)}%`;
  els.meterPercent.textContent = `${percent.toFixed(2)}%`;
  els.meterFill.style.width = `${percent}%`;
  els.itemCount.textContent = String(itemCount);
  els.freeVolume.textContent = `${cbm(Math.max(total - used, 0))}m³`;
  els.loadHint.textContent = state.bulkLoad
    ? `${state.bulkLoad.practicalCount} 件 ${state.bulkLoad.name}`
    : itemCount
      ? `${itemCount} 件手动摆放`
      : "空柜";
  els.statusLine.textContent = invalidCount
    ? `${invalidCount} 个物件重叠或超出边界，已标红。`
    : state.bulkLoad
      ? `已应用方案：${state.bulkLoad.name}。${getSelectedPlan()?.detail ?? ""}`
      : state.items.length
      ? "当前摆放有效。"
      : "添加一个箱子开始摆放。";
  els.statusLine.classList.toggle("warning", invalidCount > 0);
  drawLoadMaps();
}

function getUsedVolume() {
  const manual = state.items.reduce((sum, item) => sum + item.base.length * item.base.width * item.base.height, 0);
  const bulk = state.bulkLoad
    ? state.bulkLoad.practicalCount * state.bulkLoad.base.length * state.bulkLoad.base.width * state.bulkLoad.base.height
    : 0;
  return manual + bulk;
}

function drawLoadMaps() {
  drawTopMap();
  drawSideMap();
}

function drawTopMap() {
  const canvas = els.topMap;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#f6f7f3";
  ctx.fillRect(0, 0, w, h);
  const segments = state.bulkLoad?.segments ?? [];
  if (!segments.length) {
    drawEmptyMap(ctx, w, h);
    return;
  }
  drawTrueTopProjection(ctx, { x: 46, y: 42, width: w - 92, height: h - 84 }, segments);
}

function drawTrueTopProjection(ctx, rect, segments) {
  const labelTop = 58;
  const labelLeft = 48;
  const labelRight = 70;
  const titleH = 38;
  const gridBox = {
    x: rect.x + labelLeft,
    y: rect.y + titleH + labelTop,
    width: rect.width - labelLeft - labelRight,
    height: rect.height - titleH - labelTop - 28,
  };
  const scale = Math.min(gridBox.width / state.container.length, gridBox.height / state.container.width);
  const drawW = state.container.length * scale;
  const drawH = state.container.width * scale;
  const ox = gridBox.x + (gridBox.width - drawW) / 2;
  const oy = gridBox.y + (gridBox.height - drawH) / 2;

  ctx.save();
  ctx.fillStyle = "#5f6871";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("俯视：真实顶部视图", rect.x, rect.y + 18);
  ctx.strokeStyle = "#26333b";
  ctx.lineWidth = 4;
  ctx.strokeRect(ox, oy, drawW, drawH);

  segments.forEach((segment, index) => {
    const width = segment.columns * segment.dims.x * scale;
    const height = segment.rows * segment.dims.z * scale;
    const x = ox;
    const y = oy + (state.container.width - segment.rows * segment.dims.z) * scale;
    drawGrid(ctx, x, y, segment.columns, segment.rows, 1, getMapColor(index === 0 ? "base" : "top"), {
      cellW: segment.dims.x * scale,
      cellH: segment.dims.z * scale,
    });
    if (index > 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    }
  });

  const base = segments[0];
  const top = getTopMapSegment();
  drawNumberRow(ctx, ox, oy + drawH + 28, base.columns, base.dims.x * scale);
  drawNumberColumn(ctx, ox - 14, oy + (state.container.width - base.rows * base.dims.z) * scale, base.rows, base.dims.z * scale);
  if (top && top !== base) {
    drawNumberRow(ctx, ox, oy - 26, top.columns, top.dims.x * scale);
    ctx.fillStyle = "#26333b";
    ctx.font = "900 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText("顶部列", ox + top.columns * top.dims.x * scale + 12, oy - 26);
    ctx.fillText("底部列", ox + drawW + 12, oy + drawH + 28);
  } else {
    ctx.fillStyle = "#26333b";
    ctx.font = "900 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText("列", ox + drawW + 12, oy + drawH + 28);
  }
  ctx.fillText("排", ox + drawW + 12, oy + 22);
  ctx.restore();
}

function drawSideMap() {
  const canvas = els.sideMap;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#f6f7f3";
  ctx.fillRect(0, 0, w, h);
  const segments = state.bulkLoad?.segments ?? [];
  if (!segments.length) {
    drawEmptyMap(ctx, w, h);
    return;
  }
  drawSideElevation(ctx, { x: 58, y: 44, width: w - 116, height: h - 88 }, segments);
}

function drawPlanPanel(ctx, rect, title, segment, mode, colorKey) {
  const labelTop = 58;
  const labelLeft = 48;
  const labelRight = 18;
  const titleH = 38;
  const gridBox = {
    x: rect.x + labelLeft,
    y: rect.y + titleH + labelTop,
    width: rect.width - labelLeft - labelRight,
    height: rect.height - titleH - labelTop - 28,
  };
  const cols = segment.columns;
  const rows = mode === "top" ? segment.rows : segment.layers;
  const gridW = gridBox.width;
  const gridH = gridBox.height;
  const cell = Math.min(gridW / cols, gridH / rows);
  const drawW = cell * cols;
  const drawH = cell * rows;
  const x = gridBox.x + (gridW - drawW) / 2;
  const y = gridBox.y + (gridH - drawH) / 2;

  ctx.save();
  ctx.fillStyle = "#5f6871";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, rect.x, rect.y + 18);
  drawNumberRow(ctx, x, y - 24, cols, cell);
  drawNumberColumn(ctx, x - 15, y, rows, cell);
  drawGrid(ctx, x, y, cols, rows, cell, getMapColor(colorKey));
  ctx.fillStyle = "#26333b";
  ctx.font = "900 20px Arial";
  ctx.textAlign = "left";
  ctx.fillText("列", x + drawW + 12, y - 24);
  ctx.fillText(mode === "top" ? "排" : "层", x + drawW + 12, y + 20);
  ctx.restore();
}

function drawSideElevation(ctx, rect, segments) {
  const leftPad = 58;
  const rightPad = 64;
  const topPad = 72;
  const bottomPad = 70;
  const scale = Math.min(
    (rect.width - leftPad - rightPad) / state.container.length,
    (rect.height - topPad - bottomPad) / state.container.height
  );
  const containerW = state.container.length * scale;
  const containerH = state.container.height * scale;
  const ox = rect.x + leftPad + (rect.width - leftPad - rightPad - containerW) / 2;
  const oy = rect.y + topPad + (rect.height - topPad - bottomPad - containerH) / 2;

  ctx.save();
  ctx.strokeStyle = "#26333b";
  ctx.lineWidth = 4;
  ctx.strokeRect(ox, oy, containerW, containerH);

  segments.forEach((segment, index) => {
    const x = ox;
    const y = oy + (state.container.height - segment.yOffset - segment.layers * segment.dims.y) * scale;
    const cellW = segment.dims.x * scale;
    const cellH = segment.dims.y * scale;
    drawGrid(ctx, x, y, segment.columns, segment.layers, Math.min(cellW, cellH), getMapColor(index === 0 ? "base" : "top"), {
      cellW,
      cellH,
    });
  });

  const base = segments[0];
  const top = segments[segments.length - 1];
  drawNumberRow(ctx, ox, oy + containerH + 28, base.columns, base.dims.x * scale);
  if (top && top !== base) {
    drawNumberRow(ctx, ox, oy - 26, top.columns, top.dims.x * scale);
  }
  let layerNo = 1;
  ctx.fillStyle = "#26333b";
  ctx.font = "900 18px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  segments.forEach((segment) => {
    for (let i = 1; i <= segment.layers; i += 1) {
      const centerHeight = segment.yOffset + (i - 0.5) * segment.dims.y;
      const y = oy + (state.container.height - centerHeight) * scale;
      ctx.fillText(String(layerNo), ox - 14, y);
      layerNo += 1;
    }
  });
  ctx.textAlign = "left";
  ctx.font = "900 22px Arial";
  ctx.fillText("顶部列", ox + Math.min(top?.columns ?? base.columns, 13) * (top?.dims.x ?? base.dims.x) * scale + 12, oy - 26);
  ctx.fillText("底部列", ox + containerW + 12, oy + containerH + 28);
  ctx.fillText("层", ox - 46, oy - 18);
  ctx.restore();
}

function drawGrid(ctx, x, y, cols, rows, cell, fill, override = {}) {
  const cellW = override.cellW ?? cell;
  const cellH = override.cellH ?? cell;
  const width = cols * cellW;
  const height = rows * cellH;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#26333b";
  ctx.lineWidth = 4;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.strokeStyle = "rgba(38,51,59,0.88)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 1; i < cols; i += 1) {
    const lx = x + i * cellW;
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + height);
  }
  for (let j = 1; j < rows; j += 1) {
    const ly = y + j * cellH;
    ctx.moveTo(x, ly);
    ctx.lineTo(x + width, ly);
  }
  ctx.stroke();
  ctx.restore();
}

function drawNumberRow(ctx, x, y, count, cellW) {
  ctx.save();
  ctx.fillStyle = "#26333b";
  ctx.font = "900 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= count; i += 1) {
    ctx.fillText(String(i), x + (i - 0.5) * cellW, y);
  }
  ctx.restore();
}

function drawNumberColumn(ctx, x, y, count, cellH) {
  ctx.save();
  ctx.fillStyle = "#26333b";
  ctx.font = "900 18px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= count; i += 1) {
    ctx.fillText(String(i), x, y + (i - 0.5) * cellH);
  }
  ctx.restore();
}

function getMapColor(key) {
  return key === "top" ? "rgba(15, 124, 131, 0.78)" : "rgba(201, 103, 45, 0.82)";
}

function drawEmptyMap(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "#69717a";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("应用装箱方案后显示", w / 2, h / 2);
  ctx.restore();
}

function drawMapGrid(ctx, x, y, width, height) {
  ctx.save();
  ctx.restore();
}

function paintRectangles(ctx, scale, ox, oy, mode) {
  ctx.fillStyle = "rgba(201, 103, 45, 0.82)";
  ctx.strokeStyle = "rgba(43, 31, 22, 0.82)";
  ctx.lineWidth = 2;
  if (state.bulkLoad) {
    state.bulkLoad.segments.forEach((segment, segmentIndex) => {
      const width = segment.columns * segment.dims.x;
      const height = mode === "top" ? segment.rows * segment.dims.z : segment.layers * segment.dims.y;
      const yBase = mode === "top" ? state.container.width : state.container.height;
      const x = ox;
      const y =
        mode === "top"
          ? oy + (yBase - height) * scale
          : oy + (state.container.height - segment.yOffset - height) * scale;
      ctx.fillStyle = segmentIndex === 0 ? "rgba(201, 103, 45, 0.86)" : "rgba(15, 124, 131, 0.78)";
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        ox,
        oy,
        state.container.length * scale,
        (mode === "top" ? state.container.width : state.container.height) * scale
      );
      ctx.clip();
      ctx.fillRect(x, y, width * scale, height * scale);
      drawUnusedSpace(ctx, scale, ox, oy, mode, segment);
      ctx.strokeStyle = "rgba(43, 31, 22, 0.92)";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width * scale, height * scale);
      const verticalCount = segment.columns;
      const horizontalCount = mode === "top" ? segment.rows : segment.layers;
      const cellW = segment.dims.x * scale;
      const cellH = (mode === "top" ? segment.dims.z : segment.dims.y) * scale;
      ctx.strokeStyle = "rgba(41,29,20,0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < verticalCount; i += 1) {
        const lx = x + i * cellW;
        if (lx <= x + width * scale) {
          ctx.moveTo(lx, y);
          ctx.lineTo(lx, y + height * scale);
        }
      }
      for (let j = 1; j < horizontalCount; j += 1) {
        const ly = y + j * cellH;
        if (ly <= y + height * scale) {
          ctx.moveTo(x, ly);
          ctx.lineTo(x + width * scale, ly);
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }
  state.items.forEach((item) => {
    const dims = getDims(item);
    const x = ox + (item.position.x + state.container.length / 2 - dims.x / 2) * scale;
    const y =
      mode === "top"
        ? oy + (item.position.z + state.container.width / 2 - dims.z / 2) * scale
        : oy + (state.container.height - item.position.y - dims.y / 2) * scale;
    const rw = dims.x * scale;
    const rh = mode === "top" ? dims.z * scale : dims.y * scale;
    ctx.fillStyle = item.invalid ? "rgba(184,50,50,0.75)" : "rgba(201,103,45,0.72)";
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeRect(x, y, rw, rh);
  });
}

function drawEdgeLabels(ctx, scale, ox, oy, mode) {
  if (!state.bulkLoad?.segments?.length) return;
  const segment = mode === "top" ? getTopMapSegment() : getMaxColumnSegment();
  if (!segment) return;
  const cellW = segment.dims.x * scale;
  const cellH = (mode === "top" ? segment.dims.z : segment.dims.y) * scale;
  const labelCountX = segment.columns;
  const mapHeight = (mode === "top" ? state.container.width : state.container.height) * scale;
  const startY = mode === "top"
    ? oy + (state.container.width - segment.rows * segment.dims.z) * scale
    : oy + (state.container.height - segment.yOffset - segment.layers * segment.dims.y) * scale;

  ctx.save();
  ctx.fillStyle = "#26333b";
  ctx.font = "900 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= labelCountX; i += 1) {
    if (!shouldShowTick(i, labelCountX)) continue;
    const lx = ox + (i - 0.5) * cellW;
    if (lx <= ox + state.container.length * scale) {
      ctx.fillText(String(i), lx, oy - 18);
    }
  }

  ctx.textAlign = "right";
  if (mode === "top") {
    for (let j = 1; j <= segment.rows; j += 1) {
      if (!shouldShowTick(j, segment.rows)) continue;
      const ly = startY + (j - 0.5) * cellH;
      if (ly >= oy && ly <= oy + mapHeight) {
        ctx.fillText(String(j), ox - 12, ly);
      }
    }
  } else {
    let layerNo = 1;
    state.bulkLoad.segments.forEach((seg) => {
      for (let j = 1; j <= seg.layers; j += 1) {
        const centerHeight = seg.yOffset + (j - 0.5) * seg.dims.y;
        const ly = oy + (state.container.height - centerHeight) * scale;
        if (ly >= oy && ly <= oy + mapHeight) {
          ctx.fillText(String(layerNo), ox - 12, ly);
        }
        layerNo += 1;
      }
    });
  }

  ctx.textAlign = "left";
  ctx.font = "900 20px Arial";
  ctx.fillText("列", ox + state.container.length * scale + 10, oy - 18);
  ctx.fillText(mode === "top" ? "排" : "层", ox + state.container.length * scale + 10, startY + 18);
  ctx.restore();
}

function shouldShowTick(index, total) {
  if (total <= 14) return true;
  return index === 1 || index === total || index % 5 === 0;
}

function getTopMapSegment() {
  if (!state.bulkLoad?.segments?.length) return null;
  return state.bulkLoad.segments.reduce((top, segment) => {
    const topHeight = top.yOffset + top.layers * top.dims.y;
    const segmentHeight = segment.yOffset + segment.layers * segment.dims.y;
    return segmentHeight > topHeight ? segment : top;
  }, state.bulkLoad.segments[0]);
}

function getMaxColumnSegment() {
  if (!state.bulkLoad?.segments?.length) return null;
  return state.bulkLoad.segments.reduce((best, segment) => {
    return segment.columns > best.columns ? segment : best;
  }, state.bulkLoad.segments[0]);
}

function drawUnusedSpace(ctx, scale, ox, oy, mode, segment) {
  const usedWidth = segment.columns * segment.dims.x;
  const usedHeight = mode === "top" ? segment.rows * segment.dims.z : segment.yOffset + segment.layers * segment.dims.y;
  const containerW = state.container.length;
  const containerH = mode === "top" ? state.container.width : state.container.height;
  const rightGap = containerW - usedWidth;
  const topGap = containerH - usedHeight;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.strokeStyle = "rgba(96,104,108,0.55)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  if (rightGap > 8) {
    const x = ox + usedWidth * scale;
    const y = oy;
    const w = rightGap * scale;
    const h = containerH * scale;
    ctx.strokeRect(x, y, w, h);
  }
  if (topGap > 8 && mode === "top") {
    const x = ox;
    const y = oy;
    const w = usedWidth * scale;
    const h = topGap * scale;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHatch(ctx, x, y, width, height) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 3;
  for (let offset = -height; offset < width; offset += 22) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y + height);
    ctx.lineTo(x + offset + height, y);
    ctx.stroke();
  }
  ctx.restore();
}

function onPointerDown(event) {
  updatePointer(event);
  const hits = raycaster.intersectObjects(itemGroup.children, true);
  const hit = hits.find((candidate) => candidate.object.parent?.userData.itemId || candidate.object.userData.itemId);
  if (!hit) return;
  const mesh = hit.object.userData.itemId ? hit.object : hit.object.parent;
  const item = state.items.find((candidate) => candidate.id === mesh.userData.itemId);
  if (!item) return;
  selectItem(item.id);
  floorPlane.constant = -mm(item.position.y);
  raycaster.ray.intersectPlane(floorPlane, hitPoint);
  state.drag = {
    id: item.id,
    offsetX: hitPoint.x - mm(item.position.x),
    offsetZ: hitPoint.z - mm(item.position.z),
  };
  controls.enabled = false;
  renderer.domElement.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  updatePointer(event);
  if (!state.drag) return;
  const item = state.items.find((candidate) => candidate.id === state.drag.id);
  if (!item) return;
  if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
    item.position.x = (hitPoint.x - state.drag.offsetX) * 1000;
    item.position.z = (hitPoint.z - state.drag.offsetZ) * 1000;
    keepInside(item);
    syncMesh(item);
    validateAndRender();
  }
}

function onPointerUp(event) {
  if (!state.drag) return;
  state.drag = null;
  controls.enabled = true;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}

function onKeyDown(event) {
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelected();
  }
  if (event.key.toLowerCase() === "r") {
    rotateSelected();
  }
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function fitCamera() {
  if (!threeReady) return;
  const c = state.container;
  const L = mm(c.length);
  const W = mm(c.width);
  const H = mm(c.height);
  camera.position.set(L * 0.52, Math.max(3.5, H * 1.3), Math.max(3.8, W * 2.15));
  controls.target.set(0, H * 0.45, 0);
  controls.update();
}

function setView(view) {
  if (!threeReady) return;
  const c = state.container;
  const L = mm(c.length);
  const W = mm(c.width);
  const H = mm(c.height);
  if (view === "top") {
    camera.position.set(0, Math.max(7, L * 0.9), 0.001);
    controls.target.set(0, 0, 0);
  } else if (view === "side") {
    camera.position.set(0, H * 0.92, Math.max(5, W * 3.2));
    controls.target.set(0, H * 0.42, 0);
  } else if (view === "door") {
    camera.position.set(L * 0.62, H * 0.56, W * 0.26);
    controls.target.set(0, H * 0.38, 0);
  } else {
    camera.position.set(L * 0.28, H * 0.6, W * 0.88);
    controls.target.set(-L * 0.12, H * 0.32, 0);
  }
  controls.update();
}

function resize() {
  if (!threeReady) return;
  const rect = els.mount.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(420, rect.height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  if (!threeReady || animationStarted) return;
  animationStarted = true;
  renderFrame();
}

function renderFrame() {
  if (!threeReady) return;
  requestAnimationFrame(renderFrame);
  controls.update();
  renderer.render(scene, camera);
}
