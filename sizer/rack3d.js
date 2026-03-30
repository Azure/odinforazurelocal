/* ============================================
   3D Rack Visualization — rack3d.js
   Uses Three.js (MIT) to render server cabinets
   ============================================ */

// Module-scoped state
var _rack3d = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    animId: null,
    canvas: null,
    initialized: false,
    azureLogoTexture: null
};

// ── Constants ────────────────────────────────
var RACK = {
    U_HEIGHT: 0.04445,    // 1U = 44.45 mm → 0.04445 m
    TOTAL_U: 42,
    WIDTH: 0.6,           // 600 mm standard rack width
    DEPTH: 1.0,           // 1000 mm standard depth
    POST_SIZE: 0.03,      // Rail post cross-section
    RAIL_DEPTH: 0.015,
    GAP_BETWEEN: 0.3      // Gap between two racks (rack-aware)
};

RACK.INNER_HEIGHT = RACK.TOTAL_U * RACK.U_HEIGHT;  // ~1.867 m
RACK.OUTER_HEIGHT = RACK.INNER_HEIGHT + 0.12;       // top/bottom frame

// Colors
var COLORS = {
    RACK_FRAME:  0x2a2a2a,
    RACK_RAIL:   0x3a3a3a,
    EMPTY_SLOT:  0x1a1a1a,
    SERVER:      0x0065b8,  // Azure blue
    SERVER_GPU:  0xd97706,  // Amber for GPU nodes
    TOR_SWITCH:  0x059669,  // Green
    LABEL_COLOR: '#ffffff',
    FLOOR:       0x111111
};

// ── Helpers ──────────────────────────────────

function disposeMesh(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(function(m) { m.dispose(); });
        } else {
            obj.material.dispose();
        }
    }
}

function clearScene(scene) {
    while (scene.children.length > 0) {
        var child = scene.children[0];
        if (child.traverse) {
            child.traverse(function(c) { if (c.isMesh) disposeMesh(c); });
        }
        scene.remove(child);
    }
}

function makeTextSprite(text, fontSize, color) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    ctx.font = (fontSize || 24) + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = color || COLORS.LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(material);
    sprite.scale.set(0.4, 0.1, 1);
    return sprite;
}

// ── Build a single 42U rack frame ────────────

function buildRackFrame(scene, offsetX) {
    var group = new THREE.Group();
    group.position.x = offsetX;

    var frameMat = new THREE.MeshStandardMaterial({ color: COLORS.RACK_FRAME, roughness: 0.7, metalness: 0.5 });
    var railMat  = new THREE.MeshStandardMaterial({ color: COLORS.RACK_RAIL, roughness: 0.6, metalness: 0.4 });

    // Four vertical posts
    var postGeo = new THREE.BoxGeometry(RACK.POST_SIZE, RACK.OUTER_HEIGHT, RACK.POST_SIZE);
    var postPositions = [
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2],
        [ RACK.WIDTH / 2 - RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2],
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2,  RACK.DEPTH / 2 - RACK.POST_SIZE / 2],
        [ RACK.WIDTH / 2 - RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2,  RACK.DEPTH / 2 - RACK.POST_SIZE / 2]
    ];
    postPositions.forEach(function(pos) {
        var post = new THREE.Mesh(postGeo, frameMat);
        post.position.set(pos[0], pos[1], pos[2]);
        group.add(post);
    });

    // Top and bottom horizontal cross-bars (front and back)
    var crossGeoFB = new THREE.BoxGeometry(RACK.WIDTH, RACK.POST_SIZE, RACK.POST_SIZE);
    var crossGeoSide = new THREE.BoxGeometry(RACK.POST_SIZE, RACK.POST_SIZE, RACK.DEPTH);
    [0, RACK.OUTER_HEIGHT].forEach(function(y) {
        // Front + Back
        [-RACK.DEPTH / 2 + RACK.POST_SIZE / 2, RACK.DEPTH / 2 - RACK.POST_SIZE / 2].forEach(function(z) {
            var bar = new THREE.Mesh(crossGeoFB, frameMat);
            bar.position.set(0, y + RACK.POST_SIZE / 2, z);
            group.add(bar);
        });
        // Left + Right
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.WIDTH / 2 - RACK.POST_SIZE / 2].forEach(function(x) {
            var bar = new THREE.Mesh(crossGeoSide, frameMat);
            bar.position.set(x, y + RACK.POST_SIZE / 2, 0);
            group.add(bar);
        });
    });

    // U-slot rail markers (thin horizontal lines on front posts)
    var railGeo = new THREE.BoxGeometry(RACK.RAIL_DEPTH, 0.002, RACK.POST_SIZE);
    var baseY = 0.06; // bottom offset inside frame
    for (var u = 0; u <= RACK.TOTAL_U; u++) {
        var y = baseY + u * RACK.U_HEIGHT;
        [-RACK.WIDTH / 2 + RACK.POST_SIZE + RACK.RAIL_DEPTH / 2,
         RACK.WIDTH / 2 - RACK.POST_SIZE - RACK.RAIL_DEPTH / 2].forEach(function(x) {
            var rail = new THREE.Mesh(railGeo, railMat);
            rail.position.set(x, y, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2);
            group.add(rail);
        });
    }

    scene.add(group);
    return { group: group, baseY: baseY };
}

// ── Place a 2U server node with detailed front/back ──

function placeServer(scene, rackGroup, baseY, uStart, color, label, isGpu, diskCount) {
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = 2 * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    var cx = rackGroup.position.x;

    var bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.3 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
    var metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.6 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // ── Front face details ──

    // Front bezel (dark panel)
    var bezelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.006, 0.003);
    var bezel = new THREE.Mesh(bezelGeo, darkMat);
    bezel.position.set(cx, y, frontZ - 0.002);
    scene.add(bezel);

    // Disk bay area — row of drive slots (left half of front panel)
    var numDisks = diskCount || 8;
    var diskAreaWidth = deviceWidth * 0.55;
    var diskStartX = cx - deviceWidth / 2 + 0.02;
    var diskSlotW = Math.min(0.02, (diskAreaWidth - 0.005) / numDisks - 0.003);
    var diskSlotH = deviceHeight * 0.55;
    var diskSlotGeo = new THREE.BoxGeometry(diskSlotW, diskSlotH, 0.002);
    var diskMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
    var diskHandleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });

    for (var d = 0; d < Math.min(numDisks, 12); d++) {
        var dx = diskStartX + d * (diskSlotW + 0.003) + diskSlotW / 2;
        // Disk slot
        var slot = new THREE.Mesh(diskSlotGeo, diskMat);
        slot.position.set(dx, y, frontZ - 0.004);
        scene.add(slot);
        // Disk handle (tiny bar at top of each slot)
        var handleGeo = new THREE.BoxGeometry(diskSlotW - 0.002, 0.004, 0.001);
        var handle = new THREE.Mesh(handleGeo, diskHandleMat);
        handle.position.set(dx, y + diskSlotH / 2 + 0.003, frontZ - 0.005);
        scene.add(handle);
    }

    // Status LEDs (right side of front panel)
    var ledX = cx + deviceWidth / 2 - 0.03;
    var ledGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    var led1 = new THREE.Mesh(ledGeo, ledGreen);
    led1.position.set(ledX, y + deviceHeight * 0.2, frontZ - 0.004);
    scene.add(led1);
    var ledBlue = new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x3399ff, emissiveIntensity: 0.4 });
    var led2 = new THREE.Mesh(ledGeo, ledBlue);
    led2.position.set(ledX + 0.01, y + deviceHeight * 0.2, frontZ - 0.004);
    scene.add(led2);

    // Power button (small circle-like square, right side)
    var pwrBtnGeo = new THREE.BoxGeometry(0.008, 0.008, 0.001);
    var pwrBtn = new THREE.Mesh(pwrBtnGeo, metalMat);
    pwrBtn.position.set(ledX + 0.005, y - deviceHeight * 0.15, frontZ - 0.004);
    scene.add(pwrBtn);

    // Azure logo on front face (right of disks, center area)
    if (_rack3d.azureLogoTexture) {
        var logoSize = deviceHeight * 0.5;
        var logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
        var logoMat = new THREE.MeshBasicMaterial({
            map: _rack3d.azureLogoTexture,
            transparent: true,
            depthWrite: false
        });
        var logoMesh = new THREE.Mesh(logoGeo, logoMat);
        logoMesh.position.set(cx + deviceWidth * 0.12, y, frontZ - 0.006);
        scene.add(logoMesh);
    }

    // GPU accent stripe
    if (isGpu) {
        var stripeGeo = new THREE.BoxGeometry(deviceWidth - 0.01, 0.005, 0.002);
        var stripeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 });
        var stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(cx, y + deviceHeight / 2 - 0.004, frontZ - 0.005);
        scene.add(stripe);
    }

    // ── Back face details ──

    // Back panel (dark)
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.006, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // Dual PSU modules (two rectangles at bottom-right of back)
    var psuW = deviceWidth * 0.18;
    var psuH = deviceHeight * 0.7;
    var psuGeo = new THREE.BoxGeometry(psuW, psuH, 0.006);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    for (var p = 0; p < 2; p++) {
        var psuX = cx + deviceWidth / 2 - 0.02 - p * (psuW + 0.008) - psuW / 2;
        var psu = new THREE.Mesh(psuGeo, psuMat);
        psu.position.set(psuX, y - deviceHeight * 0.05, backZ + 0.005);
        scene.add(psu);
        // PSU handle
        var psuHandleGeo = new THREE.BoxGeometry(psuW * 0.6, 0.006, 0.003);
        var psuHandle = new THREE.Mesh(psuHandleGeo, metalMat);
        psuHandle.position.set(psuX, y + psuH / 2 - 0.01, backZ + 0.009);
        scene.add(psuHandle);
    }

    // Network ports (row of small rectangles on back, left side)
    var portW = 0.012;
    var portH = 0.01;
    var portGeo = new THREE.BoxGeometry(portW, portH, 0.004);
    var portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var numPorts = 4;
    var portStartX = cx - deviceWidth / 2 + 0.03;
    for (var pt = 0; pt < numPorts; pt++) {
        var port = new THREE.Mesh(portGeo, portMat);
        port.position.set(portStartX + pt * (portW + 0.006), y + deviceHeight * 0.15, backZ + 0.005);
        scene.add(port);
    }

    // BMC / management port (single port, slightly offset)
    var bmcPort = new THREE.Mesh(portGeo, new THREE.MeshStandardMaterial({ color: 0x0078d4, roughness: 0.5, metalness: 0.4 }));
    bmcPort.position.set(portStartX + numPorts * (portW + 0.006) + 0.01, y + deviceHeight * 0.15, backZ + 0.005);
    scene.add(bmcPort);

    // Ventilation grille (series of thin horizontal lines, center-left of back)
    var ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (var v = 0; v < 6; v++) {
        var ventGeo = new THREE.BoxGeometry(deviceWidth * 0.25, 0.002, 0.002);
        var vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(cx - deviceWidth * 0.05, y - deviceHeight * 0.2 + v * 0.008, backZ + 0.004);
        scene.add(vent);
    }

    // Label
    if (label) {
        var sprite = makeTextSprite(label, 20, '#ffffff');
        sprite.position.set(cx, y, frontZ - 0.06);
        scene.add(sprite);
    }

    return body;
}

// ── Place a 1U ToR switch with ethernet ports ──

function placeSwitch(scene, rackGroup, baseY, uStart, label) {
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    var cx = rackGroup.position.x;

    var switchMat = new THREE.MeshStandardMaterial({ color: COLORS.TOR_SWITCH, roughness: 0.45, metalness: 0.35 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.5 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, switchMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // ── Front face — row of ethernet ports ──
    var frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Ethernet ports — two rows of RJ45-like rectangles
    var ethW = 0.008;
    var ethH = 0.006;
    var ethGeo = new THREE.BoxGeometry(ethW, ethH, 0.003);
    var ethInnerGeo = new THREE.BoxGeometry(ethW - 0.002, ethH - 0.002, 0.001);
    var ethInnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    var portsPerRow = 24;
    var portSpacing = (deviceWidth - 0.08) / portsPerRow;
    var rowStartX = cx - deviceWidth / 2 + 0.04;

    for (var row = 0; row < 2; row++) {
        var rowY = y + (row === 0 ? 0.006 : -0.006);
        for (var ep = 0; ep < portsPerRow; ep++) {
            var epx = rowStartX + ep * portSpacing;
            // Port housing
            var ethPort = new THREE.Mesh(ethGeo, portMat);
            ethPort.position.set(epx, rowY, frontZ - 0.004);
            scene.add(ethPort);
            // Port inner (dark hole)
            var ethInner = new THREE.Mesh(ethInnerGeo, ethInnerMat);
            ethInner.position.set(epx, rowY, frontZ - 0.006);
            scene.add(ethInner);
        }
    }

    // Status LEDs above port rows (right side)
    var ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (var li = 0; li < 3; li++) {
        var led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // ── Back face — uplink ports and PSU ──
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // Uplink ports (4× QSFP — larger rectangles)
    var qsfpW = 0.016;
    var qsfpH = 0.012;
    var qsfpGeo = new THREE.BoxGeometry(qsfpW, qsfpH, 0.004);
    var qsfpMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });
    for (var q = 0; q < 4; q++) {
        var qsfp = new THREE.Mesh(qsfpGeo, qsfpMat);
        qsfp.position.set(cx - deviceWidth / 2 + 0.04 + q * (qsfpW + 0.008), y, backZ + 0.005);
        scene.add(qsfp);
    }

    // PSU (single module, right side of back)
    var psuGeo = new THREE.BoxGeometry(deviceWidth * 0.15, deviceHeight * 0.7, 0.006);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    var psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(cx + deviceWidth / 2 - 0.06, y, backZ + 0.005);
    scene.add(psu);

    // Fan vents (center of back)
    var ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (var fv = 0; fv < 4; fv++) {
        var ventLineGeo = new THREE.BoxGeometry(deviceWidth * 0.15, 0.002, 0.002);
        var ventLine = new THREE.Mesh(ventLineGeo, ventMat);
        ventLine.position.set(cx + 0.05, y - deviceHeight * 0.15 + fv * 0.006, backZ + 0.004);
        scene.add(ventLine);
    }

    // Label
    if (label) {
        var sprite = makeTextSprite(label, 18, '#ffffff');
        sprite.position.set(cx, y, frontZ - 0.05);
        scene.add(sprite);
    }

    return body;
}

// ── Main render function ─────────────────────

function renderRack3D(config) {
    if (typeof THREE === 'undefined') {
        console.warn('rack3d: Three.js not loaded');
        return;
    }

    var container = document.getElementById('rack-viz-container');
    var canvasEl = document.getElementById('rack-3d-canvas');
    if (!container || !canvasEl) return;

    // Show the section — only when there's something to render
    var section = document.getElementById('rack-viz-section');
    if (section) section.style.display = 'block';

    // Determine rack layout
    var isRackAware = config.clusterType === 'rack-aware';
    var rackCount = isRackAware ? 2 : 1;
    var nodeCount = config.nodeCount || 2;
    var torPerRack = nodeCount > 1 ? 2 : 0;
    var hasGpu = config.hasGpu || false;

    // Distribute nodes across racks
    var racks = [];
    if (isRackAware) {
        var half = Math.ceil(nodeCount / 2);
        racks.push({ nodes: half, tor: torPerRack });
        racks.push({ nodes: nodeCount - half, tor: torPerRack });
    } else {
        racks.push({ nodes: nodeCount, tor: torPerRack });
    }

    // Initialize Three.js (once)
    if (!_rack3d.initialized) {
        _rack3d.scene = new THREE.Scene();
        _rack3d.camera = new THREE.PerspectiveCamera(45, canvasEl.clientWidth / canvasEl.clientHeight, 0.01, 50);
        _rack3d.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false });
        _rack3d.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        _rack3d.renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight);
        _rack3d.renderer.setClearColor(0x0a0a0a);

        // Load Azure logo texture
        var loader = new THREE.TextureLoader();
        loader.load('../images/azure-logo.png', function(tex) {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            _rack3d.azureLogoTexture = tex;
        });

        // OrbitControls
        _rack3d.controls = new THREE.OrbitControls(_rack3d.camera, canvasEl);
        _rack3d.controls.enableDamping = true;
        _rack3d.controls.dampingFactor = 0.08;
        _rack3d.controls.minDistance = 0.5;
        _rack3d.controls.maxDistance = 6;
        _rack3d.controls.maxPolarAngle = Math.PI / 2 + 0.1; // slight below-horizon

        // Resize observer
        var ro = new ResizeObserver(function() {
            var w = canvasEl.clientWidth;
            var h = canvasEl.clientHeight;
            if (w === 0 || h === 0) return;
            _rack3d.camera.aspect = w / h;
            _rack3d.camera.updateProjectionMatrix();
            _rack3d.renderer.setSize(w, h);
        });
        ro.observe(canvasEl);

        // Animation loop
        function animate() {
            _rack3d.animId = requestAnimationFrame(animate);
            _rack3d.controls.update();
            _rack3d.renderer.render(_rack3d.scene, _rack3d.camera);
        }
        animate();
        _rack3d.initialized = true;
    }

    // Clear previous scene contents
    clearScene(_rack3d.scene);

    // Lighting
    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    _rack3d.scene.add(ambient);

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 2);
    _rack3d.scene.add(dirLight);

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1, -1);
    _rack3d.scene.add(fillLight);

    // Floor plane
    var floorGeo = new THREE.PlaneGeometry(6, 6);
    var floorMat = new THREE.MeshStandardMaterial({ color: COLORS.FLOOR, roughness: 1 });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    _rack3d.scene.add(floor);

    // Build racks
    var totalWidth = rackCount * RACK.WIDTH + (rackCount - 1) * RACK.GAP_BETWEEN;
    var startX = -totalWidth / 2 + RACK.WIDTH / 2;

    for (var r = 0; r < rackCount; r++) {
        var offsetX = startX + r * (RACK.WIDTH + RACK.GAP_BETWEEN);
        var rack = buildRackFrame(_rack3d.scene, offsetX);
        var rackInfo = racks[r];

        // Place ToR switches at top of rack (U41, U42)
        for (var t = 0; t < rackInfo.tor; t++) {
            var torU = RACK.TOTAL_U - t; // 42, 41
            placeSwitch(_rack3d.scene, rack.group, rack.baseY, torU,
                'ToR Switch ' + (t + 1));
        }

        // Place server nodes below switches, from top down
        var topServerU = RACK.TOTAL_U - rackInfo.tor; // first available U below switches
        for (var n = 0; n < rackInfo.nodes; n++) {
            var serverStartU = topServerU - (n * 2); // 2U per server, top-down
            if (serverStartU < 1) break;
            var color = hasGpu ? COLORS.SERVER_GPU : COLORS.SERVER;
            var nodeLabel = isRackAware
                ? 'R' + (r + 1) + ' Node ' + (n + 1)
                : 'Node ' + (n + 1);
            placeServer(_rack3d.scene, rack.group, rack.baseY, serverStartU - 1, color,
                nodeLabel, hasGpu, config.diskCount || 8);
        }

        // Rack label above
        var rackLabel = isRackAware ? 'Rack ' + (r + 1) : '42U Rack';
        var rackSprite = makeTextSprite(rackLabel, 28, '#ffffff');
        rackSprite.position.set(offsetX - RACK.WIDTH / 2, RACK.OUTER_HEIGHT + 0.08, -RACK.DEPTH / 2);
        rackSprite.scale.set(0.5, 0.12, 1);
        _rack3d.scene.add(rackSprite);
    }

    // Camera position — front-left (viewer's left), looking down at top-left corner
    var camDist = isRackAware ? 4.2 : 3.5;
    _rack3d.camera.position.set(camDist * 0.35, RACK.OUTER_HEIGHT * 1.3, -camDist * 0.7);
    _rack3d.controls.target.set(0, RACK.OUTER_HEIGHT * 0.38, 0);
    _rack3d.controls.update();

    // Update legend text
    var usedU = document.getElementById('rack-viz-used-u');
    var totalU = document.getElementById('rack-viz-total-u');
    if (usedU && totalU) {
        var nodesU = nodeCount * 2;
        var switchesU = torPerRack * rackCount;
        usedU.textContent = (nodesU + switchesU) + 'U used';
        totalU.textContent = (RACK.TOTAL_U * rackCount) + 'U total';
    }
}

// ── Toggle collapse ──────────────────────────

function toggleRackViz() {
    var container = document.getElementById('rack-viz-container');
    var arrow = document.getElementById('rack-viz-toggle-arrow');
    if (!container) return;
    var isCollapsed = container.classList.toggle('collapsed');
    if (arrow) {
        arrow.classList.toggle('collapsed', isCollapsed);
    }
}
