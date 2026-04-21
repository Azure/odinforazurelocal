/* ============================================
   3D Rack Visualization — rack3d.js
   Uses Three.js (MIT) to render server cabinets
   ============================================ */

// Module-scoped state (attach to globalThis to survive re-evaluation)
var _rack3d = ((typeof window !== 'undefined' ? window : globalThis)._rack3d) || {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    animId: null,
    canvas: null,
    initialized: false,
    azureLogoTexture: null,
    lastConfig: null,
    visible: true,
    intersectionObserver: null
};
(typeof window !== 'undefined' ? window : globalThis)._rack3d = _rack3d;

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
    SERVER:      0xaaaaaa,  // Light grey
    SERVER_GPU:  0xd97706,  // Amber for GPU nodes
    TOR_SWITCH:  0x444444,  // Dark grey
    BMC_SWITCH:  0xe0e0e0,  // White / light grey
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
    canvas.width = 512;
    canvas.height = 64;
    ctx.font = (fontSize || 24) + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = color || COLORS.LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    var sprite = new THREE.Sprite(material);
    sprite.scale.set(0.4, 0.1, 1);
    return sprite;
}

// Create a text label as a flat plane fixed to a face (not billboarded)
// facing: 'front' (negative Z) or 'back' (positive Z)
function makeFaceLabel(text, fontSize, color, facing) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 64;
    ctx.font = (fontSize || 24) + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = color || COLORS.LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, side: THREE.FrontSide });
    var geo = new THREE.PlaneGeometry(0.5, 0.065);
    var mesh = new THREE.Mesh(geo, mat);
    if (facing === 'front') {
        mesh.rotation.y = Math.PI; // rotate so normal faces -Z (towards camera)
    }
    // facing === 'back' keeps default normal facing +Z (rear of rack)
    return mesh;
}

// ── Build a single 42U rack frame ────────────

function buildRackFrame(scene, offsetX, offsetZ, facing) {
    var group = new THREE.Group();
    group.position.x = offsetX;
    group.position.z = offsetZ || 0;
    // facing: +1 = default (front of rack faces -Z, viewer/camera side);
    //         -1 = rotated 180° so the rack's rear points at -Z. Used for the
    //         far row in a two-row hot-aisle layout so both rows' rears meet
    //         in the hot aisle between them.
    if (facing === -1) {
        group.rotation.y = Math.PI;
    }
    group.userData.facing = (facing === -1) ? -1 : 1;

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
    for (let u = 0; u <= RACK.TOTAL_U; u++) {
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

function placeServer(scene, rackGroup, baseY, uStart, color, label, isGpu, diskCount, portCount) {
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = 2 * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    // Add meshes to the rack group (local coords) so rack rotation/position propagates.
    scene = rackGroup;
    var cx = 0;

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

    // Disk bay area — all drive slots on front panel
    var numDisks = diskCount || 8;
    var frontDisks = numDisks;
    var diskAreaWidth = deviceWidth * 0.55;
    var diskStartX = cx - deviceWidth / 2 + 0.02;
    var diskSlotW = Math.min(0.02, (diskAreaWidth - 0.005) / frontDisks - 0.003);
    var diskSlotH = deviceHeight * 0.55;
    var diskSlotGeo = new THREE.BoxGeometry(diskSlotW, diskSlotH, 0.002);
    var diskMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
    var diskHandleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });

    for (let d = 0; d < frontDisks; d++) {
        var dx = diskStartX + d * (diskSlotW + 0.003) + diskSlotW / 2;
        var slot = new THREE.Mesh(diskSlotGeo, diskMat);
        slot.position.set(dx, y, frontZ - 0.004);
        scene.add(slot);
        var handleGeo = new THREE.BoxGeometry(diskSlotW - 0.002, 0.003, 0.001);
        var handle = new THREE.Mesh(handleGeo, diskHandleMat);
        handle.position.set(dx, y + diskSlotH / 2 + 0.002, frontZ - 0.005);
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

    // Azure logo on front face (right-hand side)
    if (_rack3d.azureLogoTexture) {
        var logoSize = deviceHeight * 0.5;
        var logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
        var logoMat = new THREE.MeshBasicMaterial({
            map: _rack3d.azureLogoTexture,
            transparent: true,
            depthWrite: false
        });
        var logoMesh = new THREE.Mesh(logoGeo, logoMat);
        logoMesh.rotation.y = Math.PI; // face front (-Z)
        logoMesh.position.set(cx + deviceWidth / 2 - 0.045, y, frontZ - 0.006);
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
    for (let p = 0; p < 2; p++) {
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
    var numPorts = portCount || 4;
    var portStartX = cx - deviceWidth / 2 + 0.03;
    for (let pt = 0; pt < numPorts; pt++) {
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
    for (let v = 0; v < 6; v++) {
        var ventGeo = new THREE.BoxGeometry(deviceWidth * 0.25, 0.002, 0.002);
        var vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(cx - deviceWidth * 0.05, y - deviceHeight * 0.2 + v * 0.008, backZ + 0.004);
        scene.add(vent);
    }

    // Labels — fixed to front and rear faces
    if (label) {
        var frontLabel = makeFaceLabel(label, 28, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        var rearLabel = makeFaceLabel(label + ' (Rear)', 28, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.012);
        scene.add(rearLabel);
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
    scene = rackGroup;
    var cx = 0;

    var switchMat = new THREE.MeshStandardMaterial({ color: COLORS.TOR_SWITCH, roughness: 0.45, metalness: 0.35 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.5 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, switchMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // ── Front face — clean panel with status LEDs (ports face rear) ──
    var frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs on front (right side)
    var ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 3; li++) {
        var led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // ── Back face (rear) — ethernet ports, uplinks, PSU ──
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // Ethernet ports — two rows of RJ45-like rectangles (rear-facing)
    var ethW = 0.008;
    var ethH = 0.006;
    var ethGeo = new THREE.BoxGeometry(ethW, ethH, 0.003);
    var ethInnerGeo = new THREE.BoxGeometry(ethW - 0.002, ethH - 0.002, 0.001);
    var ethInnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    var portsPerRow = 24;
    var portSpacing = (deviceWidth - 0.08) / portsPerRow;
    var rowStartX = cx - deviceWidth / 2 + 0.04;

    for (let row = 0; row < 2; row++) {
        var rowY = y + (row === 0 ? 0.006 : -0.006);
        for (let ep = 0; ep < portsPerRow; ep++) {
            var epx = rowStartX + ep * portSpacing;
            // Port housing
            var ethPort = new THREE.Mesh(ethGeo, portMat);
            ethPort.position.set(epx, rowY, backZ + 0.004);
            scene.add(ethPort);
            // Port inner (dark hole)
            var ethInner = new THREE.Mesh(ethInnerGeo, ethInnerMat);
            ethInner.position.set(epx, rowY, backZ + 0.006);
            scene.add(ethInner);
        }
    }

    // Uplink ports (4× QSFP — larger rectangles, rear)
    var qsfpW = 0.016;
    var qsfpH = 0.012;
    var qsfpGeo = new THREE.BoxGeometry(qsfpW, qsfpH, 0.004);
    var qsfpMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });
    for (let q = 0; q < 4; q++) {
        var qsfp = new THREE.Mesh(qsfpGeo, qsfpMat);
        qsfp.position.set(cx - deviceWidth / 2 + 0.04 + q * (qsfpW + 0.008), y - deviceHeight * 0.2, backZ + 0.005);
        scene.add(qsfp);
    }

    // PSU (single module, right side of rear)
    var psuGeo = new THREE.BoxGeometry(deviceWidth * 0.15, deviceHeight * 0.7, 0.006);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    var psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(cx + deviceWidth / 2 - 0.06, y, backZ + 0.005);
    scene.add(psu);

    // Fan vents (center of rear)
    var ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (let fv = 0; fv < 4; fv++) {
        var ventLineGeo = new THREE.BoxGeometry(deviceWidth * 0.15, 0.002, 0.002);
        var ventLine = new THREE.Mesh(ventLineGeo, ventMat);
        ventLine.position.set(cx + 0.05, y - deviceHeight * 0.15 + fv * 0.006, backZ + 0.004);
        scene.add(ventLine);
    }

    // Labels — fixed to front and rear faces
    if (label) {
        var frontLabel = makeFaceLabel(label, 24, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        var rearLabel = makeFaceLabel(label + ' (Rear)', 24, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.008);
        scene.add(rearLabel);
    }

    return body;
}

// ── Place a 1U BMC switch ──

function placeBmcSwitch(scene, rackGroup, baseY, uStart, label) {
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    scene = rackGroup;
    var cx = 0;

    var bmcMat = new THREE.MeshStandardMaterial({ color: COLORS.BMC_SWITCH, roughness: 0.4, metalness: 0.3 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.5 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, bmcMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front face — clean panel with status LEDs
    var frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs
    var ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 2; li++) {
        var led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // Back face — ethernet ports (fewer than ToR, single row of RJ45)
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    var ethW = 0.008;
    var ethH = 0.006;
    var ethGeo = new THREE.BoxGeometry(ethW, ethH, 0.003);
    var ethInnerGeo = new THREE.BoxGeometry(ethW - 0.002, ethH - 0.002, 0.001);
    var ethInnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    var portsPerRow = 16;
    var portSpacing = (deviceWidth - 0.08) / portsPerRow;
    var rowStartX = cx - deviceWidth / 2 + 0.04;

    for (let ep = 0; ep < portsPerRow; ep++) {
        var epx = rowStartX + ep * portSpacing;
        var ethPort = new THREE.Mesh(ethGeo, portMat);
        ethPort.position.set(epx, y, backZ + 0.004);
        scene.add(ethPort);
        var ethInner = new THREE.Mesh(ethInnerGeo, ethInnerMat);
        ethInner.position.set(epx, y, backZ + 0.006);
        scene.add(ethInner);
    }

    // PSU (single module, right side of rear)
    var psuGeo = new THREE.BoxGeometry(deviceWidth * 0.12, deviceHeight * 0.6, 0.006);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    var psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(cx + deviceWidth / 2 - 0.05, y, backZ + 0.005);
    scene.add(psu);

    // Labels
    if (label) {
        var frontLabel = makeFaceLabel(label, 24, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        var rearLabel = makeFaceLabel(label + ' (Rear)', 24, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.008);
        scene.add(rearLabel);
    }

    return body;
}

// ── FC Switch — 1U Fibre Channel switch in purple ──

function placeFcSwitch(scene, rackGroup, baseY, uStart, label) {
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    scene = rackGroup;
    var cx = 0;

    var fcMat = new THREE.MeshStandardMaterial({ color: 0x9933cc, roughness: 0.4, metalness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, fcMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front face
    var frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs
    var ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 3; li++) {
        var led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // Back face
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // FC ports (SFP style, smaller than ethernet)
    var sfpW = 0.010;
    var sfpH = 0.006;
    var sfpGeo = new THREE.BoxGeometry(sfpW, sfpH, 0.003);
    var portsPerRow = 16;
    var portSpacing = (deviceWidth - 0.08) / portsPerRow;
    var rowStartX = cx - deviceWidth / 2 + 0.04;
    for (let fp = 0; fp < portsPerRow; fp++) {
        var fpx = rowStartX + fp * portSpacing;
        var sfp = new THREE.Mesh(sfpGeo, portMat);
        sfp.position.set(fpx, y, backZ + 0.004);
        scene.add(sfp);
    }

    // Labels
    if (label) {
        var frontLabel = makeFaceLabel(label, 22, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
    }

    return body;
}

// ── SAN Appliance — 5U storage appliance in purple ──

function placeSanAppliance(scene, rackGroup, baseY, uStart, label) {
    var heightU = 5;
    var deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var deviceHeight = heightU * RACK.U_HEIGHT - 0.004;
    var deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var frontZ = -deviceDepth / 2;
    var backZ = deviceDepth / 2;
    var y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    scene = rackGroup;
    var cx = 0;

    var sanMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.3, metalness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });
    var ledBlue = new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x3399ff, emissiveIntensity: 0.4 });

    // Main chassis
    var bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    var body = new THREE.Mesh(bodyGeo, sanMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front panel
    var frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Drive bays on front (2 rows of 12 — typical SAN array appearance)
    var bayW = 0.008;
    var bayH = deviceHeight * 0.3;
    var bayRows = 2;
    var baysPerRow = 12;
    for (let row = 0; row < bayRows; row++) {
        var bayY = y + deviceHeight * 0.15 - row * (bayH + 0.004);
        for (let b = 0; b < baysPerRow; b++) {
            var bayX = cx - deviceWidth / 2 + 0.02 + b * (bayW + 0.002);
            var bayGeo = new THREE.BoxGeometry(bayW, bayH, 0.002);
            var bayMesh = new THREE.Mesh(bayGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }));
            bayMesh.position.set(bayX, bayY, frontZ - 0.003);
            scene.add(bayMesh);
            // Drive LED
            if (b % 3 === 0) {
                var dLedGeo = new THREE.BoxGeometry(0.003, 0.003, 0.001);
                var dLed = new THREE.Mesh(dLedGeo, ledGreen);
                dLed.position.set(bayX, bayY + bayH / 2 + 0.003, frontZ - 0.004);
                scene.add(dLed);
            }
        }
    }

    // Status LEDs (top-right of front)
    var ledGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    for (let li = 0; li < 4; li++) {
        var led = new THREE.Mesh(ledGeo, li < 2 ? ledGreen : ledBlue);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.01, y + deviceHeight / 2 - 0.008, frontZ - 0.004);
        scene.add(led);
    }

    // Back panel
    var backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // FC ports on back (2 rows of 8)
    var fcPortW = 0.010;
    var fcPortH = 0.008;
    var fcPortGeo = new THREE.BoxGeometry(fcPortW, fcPortH, 0.003);
    for (let pr = 0; pr < 2; pr++) {
        var portY = y + deviceHeight * 0.15 - pr * (fcPortH + 0.012);
        for (let fp = 0; fp < 8; fp++) {
            var fpx = cx - deviceWidth / 2 + 0.04 + fp * (fcPortW + 0.008);
            var sfp = new THREE.Mesh(fcPortGeo, portMat);
            sfp.position.set(fpx, portY, backZ + 0.004);
            scene.add(sfp);
        }
    }

    // Dual PSU modules
    var psuW = deviceWidth * 0.15;
    var psuH = deviceHeight * 0.5;
    var psuGeo = new THREE.BoxGeometry(psuW, psuH, 0.006);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    for (let p = 0; p < 2; p++) {
        var psuX = cx + deviceWidth / 2 - 0.02 - p * (psuW + 0.008) - psuW / 2;
        var psu = new THREE.Mesh(psuGeo, psuMat);
        psu.position.set(psuX, y - deviceHeight * 0.1, backZ + 0.005);
        scene.add(psu);
    }

    // Labels
    if (label) {
        var frontLabel = makeFaceLabel(label, 28, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        var rearLabel = makeFaceLabel(label + ' (Rear)', 28, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.012);
        scene.add(rearLabel);
    }

    return body;
}

// ── Core network for rack-aware and disaggregated topologies ──

function placeCoreNetwork(scene, rack1X, rack2X, spineCount, allRackCount, rackStartX, isDisaggLayout, rackPositions) {
    spineCount = spineCount || 2;
    allRackCount = allRackCount || 2;
    rackStartX = rackStartX || rack1X;
    var routerX = (rack1X + rack2X) / 2;
    var routerZ = 0;

    // Blue core switch material
    var routerMat = new THREE.MeshStandardMaterial({ color: 0x1a6fc4, roughness: 0.4, metalness: 0.5 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var blueMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
    var pinkMat = new THREE.MeshBasicMaterial({ color: 0xff66bb, transparent: true, opacity: 0.7 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // ── Spine switches — stack vertically above the racks ──
    var rWidth = RACK.WIDTH * 1.2;
    var rHeight = RACK.U_HEIGHT * 1.5;
    var rDepth = RACK.DEPTH * 0.6;
    var spineGap = rHeight * 0.4; // vertical gap between stacked spine switches
    var baseY = RACK.OUTER_HEIGHT + 0.35;

    for (let si = 0; si < spineCount; si++) {
        var spineY = baseY + si * (rHeight + spineGap);

        var routerGeo = new THREE.BoxGeometry(rWidth, rHeight, rDepth);
        var router = new THREE.Mesh(routerGeo, routerMat);
        router.position.set(routerX, spineY, routerZ);
        scene.add(router);

        // Front panel
        var frontZ = routerZ - rDepth / 2;
        var backRZ = routerZ + rDepth / 2;
        var rpGeo = new THREE.BoxGeometry(rWidth - 0.004, rHeight - 0.004, 0.003);
        var rPanelFront = new THREE.Mesh(rpGeo, darkMat);
        rPanelFront.position.set(routerX, spineY, frontZ - 0.002);
        scene.add(rPanelFront);

        // Status LEDs on front
        var rLedGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
        for (let rl = 0; rl < 3; rl++) {
            var rLed = new THREE.Mesh(rLedGeo, ledGreen);
            rLed.position.set(routerX + rWidth / 2 - 0.02 - rl * 0.01, spineY + rHeight / 2 - 0.006, frontZ - 0.003);
            scene.add(rLed);
        }

        // Rear panel
        var rPanelBack = new THREE.Mesh(rpGeo.clone(), darkMat);
        rPanelBack.position.set(routerX, spineY, backRZ + 0.002);
        scene.add(rPanelBack);

        // Router ports (rear — 8 ports)
        var rpW = 0.014;
        var rpH = 0.012;
        var rpGeoPort = new THREE.BoxGeometry(rpW, rpH, 0.003);
        for (let rp = 0; rp < 8; rp++) {
            var rpx = routerX - rWidth / 2 + 0.04 + rp * (rpW + 0.008);
            var port = new THREE.Mesh(rpGeoPort, portMat);
            port.position.set(rpx, spineY, backRZ + 0.004);
            scene.add(port);
        }

        // Label
        var spineLabel = spineCount > 1 ? 'Spine ' + (si + 1) : 'Core Switch / Router / Firewall';
        var routerLabel = makeFaceLabel(spineLabel, 28, '#ffffff', 'front');
        routerLabel.position.set(routerX, spineY, frontZ - 0.008);
        scene.add(routerLabel);

        // Small shelf/platform under spine switch
        var shelfGeo = new THREE.BoxGeometry(rWidth + 0.06, 0.01, rDepth + 0.06);
        var shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.4 });
        var shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.set(routerX, spineY - rHeight / 2 - 0.005, routerZ);
        scene.add(shelf);
    }

    // Use the bottom spine switch for cable attachment
    var routerY = baseY;

    // ── Cable runs ──
    var cableRadius = 0.004;

    // Helper: create a right-angle cable between two points (up, across, down)
    function makeCable(startPos, endPos, color, arcHeight) {
        var topY = Math.max(startPos.y, endPos.y) + (arcHeight || 0.15);
        var midZ = (startPos.z + endPos.z) / 2;
        // Path: start → up → across at top → down → end
        var points = [
            new THREE.Vector3(startPos.x, startPos.y, startPos.z),
            new THREE.Vector3(startPos.x, topY, startPos.z),
            new THREE.Vector3(startPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, endPos.z),
            new THREE.Vector3(endPos.x, endPos.y, endPos.z)
        ];
        // Use LineCurve segments joined together for sharp 90° bends
        for (let i = 0; i < points.length - 1; i++) {
            var segGeo = new THREE.TubeGeometry(
                new THREE.LineCurve3(points[i], points[i + 1]),
                2, cableRadius, 6, false
            );
            var segMesh = new THREE.Mesh(segGeo, color);
            scene.add(segMesh);
        }
    }

    // ToR QSFP uplink port positions (rear of switch)
    var torDeviceH = 1 * RACK.U_HEIGHT - 0.004;
    var torDeviceW = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var torSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var torQsfpZ = torSwitchDepth / 2 + 0.005;
    var qsfpW = 0.016;
    // ToR 1 (U42) and ToR 2 (U41) center Y
    var tor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002;
    var tor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002;
    var tor1QsfpY = tor1Y - torDeviceH * 0.2;
    var tor2QsfpY = tor2Y - torDeviceH * 0.2;
    var routerBottomY = routerY - rHeight / 2;
    var routerRearZ = backRZ;
    var routerFrontZ = backRZ - rDepth;

    // QSFP port X offset helper (port index 0-3)
    function qsfpX(rackCx, portIdx) {
        return rackCx - torDeviceW / 2 + 0.04 + portIdx * (qsfpW + 0.008);
    }

    // ── Blue cables: Management/Compute Trunks (each rack's ToRs → Spine) ──
    // Connect every rack's ToR to the bottom spine switch. All racks (in
    // either single-row or two-row disaggregated layouts) land on the
    // spine's rear face.
    for (let ri = 0; ri < allRackCount; ri++) {
        var rackX_i, rackZ_i, rackFacing_i;
        if (rackPositions && rackPositions[ri]) {
            rackX_i = rackPositions[ri].x;
            rackZ_i = rackPositions[ri].z;
            rackFacing_i = rackPositions[ri].facing || 1;
        } else {
            rackX_i = rackStartX + ri * (RACK.WIDTH + RACK.GAP_BETWEEN);
            rackZ_i = 0;
            rackFacing_i = 1;
        }
        // Rear-of-ToR port face in world Z (no aisle exit yet)
        var rearPortZ = rackZ_i + torQsfpZ * rackFacing_i;
        // Horizontal exit point pushed into the hot aisle so the cable
        // clearly leaves the rear of the ToR before rising up.
        var AISLE_EXIT = 0.06;
        var exitZ = rackZ_i + (torQsfpZ + AISLE_EXIT) * rackFacing_i;
        // Terminate all uplink cables on the spine's rear face (classic
        // top-of-row cabling) regardless of single-row or two-row layout.
        // In two-row mode the cables still exit the rear of each rack's ToR
        // into the hot aisle and rise up, but they all converge onto the
        // rear of Spine 1 / Spine 2 rather than splitting across both
        // spine faces.
        var spineCableZ = routerRearZ;
        var routerSlot = (ri - (allRackCount - 1) / 2) / Math.max(allRackCount - 1, 1);

        // Build a 5-segment path that emerges horizontally from the rear of
        // the ToR before rising, then crosses over and drops onto the spine.
        // Path: port → exit (horizontal out the rear) → up → across in X →
        // across in Z → down to spine.
        function makeUplinkCable(portX, portY, endX, endYPos, arcH) {
            var topY = Math.max(portY, endYPos) + arcH;
            var midZ = (exitZ + spineCableZ) / 2;
            var pts = [
                new THREE.Vector3(portX, portY, rearPortZ),   // at rear port
                new THREE.Vector3(portX, portY, exitZ),       // straight out the rear
                new THREE.Vector3(portX, topY, exitZ),        // up to top
                new THREE.Vector3(endX, topY, midZ),          // across (diagonal run at top)
                new THREE.Vector3(endX, topY, spineCableZ),   // align Z to spine
                new THREE.Vector3(endX, endYPos, spineCableZ) // down to spine face
            ];
            for (let pi = 0; pi < pts.length - 1; pi++) {
                var segGeo = new THREE.TubeGeometry(
                    new THREE.LineCurve3(pts[pi], pts[pi + 1]),
                    2, cableRadius, 6, false
                );
                scene.add(new THREE.Mesh(segGeo, blueMat));
            }
        }

        makeUplinkCable(qsfpX(rackX_i, 2), tor1QsfpY,
            routerX + routerSlot * rWidth * 0.4, routerBottomY, 0.12 + ri * 0.02);
        makeUplinkCable(qsfpX(rackX_i, 3), tor2QsfpY,
            routerX + routerSlot * rWidth * 0.2, routerBottomY, 0.10 + ri * 0.02);
    }

    // ── Pink/Magenta cables: SMB Storage Trunks — rack-aware only (not disaggregated) ──
    if (!isDisaggLayout) {
    // Calculate actual TOR switch center Y positions (reuse torDeviceH from above)
    var tor1CenterY = 0.06 + (42 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002; // U42
    var tor2CenterY = 0.06 + (41 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002; // U41
    var torSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var torBackZ = torSwitchDepth / 2 + 0.006;
    // Start/end Y at TOR center so vertical legs reach the ports
    var smbUpperY = tor1CenterY;
    var smbLowerY = tor2CenterY;
    var smbArcHeight = 0.03;
    var smbCableR = 0.004;

    // Helper: build a clean 4-point up-across-down cable (no zero-length segments)
    function makeHCable(startX, endX, portY, arcH, z, mat) {
        var topY = portY + arcH;
        var pts = [
            new THREE.Vector3(startX, portY, z),
            new THREE.Vector3(startX, topY, z),
            new THREE.Vector3(endX, topY, z),
            new THREE.Vector3(endX, portY, z)
        ];
        for (let i = 0; i < pts.length - 1; i++) {
            var seg = new THREE.TubeGeometry(
                new THREE.LineCurve3(pts[i], pts[i + 1]),
                2, smbCableR, 6, false
            );
            scene.add(new THREE.Mesh(seg, mat));
        }
    }

    // SMB1 Trunk: TOR 1 (Rack 1) ↔ TOR 3 (Rack 2) — upper cable, left side of switches
    makeHCable(rack1X - 0.12, rack2X - 0.12, smbUpperY, smbArcHeight, torBackZ, pinkMat);
    // SMB2 Trunk: TOR 2 (Rack 1) ↔ TOR 4 (Rack 2) — lower cable, right side of switches
    makeHCable(rack1X + 0.15, rack2X + 0.15, smbLowerY, -smbArcHeight, torBackZ, pinkMat);

    // ── LAG cables between paired ToRs in each rack (rear port-to-port, 2 per pair) ──
    var lagCableMat = new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.8 });
    var lagCableRadius = 0.003;

    // Rack 1 LAG: two cables from TOR 1 rear down to TOR 2 rear
    var lag1aGeo = new THREE.TubeGeometry(
        new THREE.LineCurve3(
            new THREE.Vector3(rack1X + 0.10, tor1CenterY, torBackZ),
            new THREE.Vector3(rack1X + 0.10, tor2CenterY, torBackZ)
        ), 2, lagCableRadius, 6, false
    );
    scene.add(new THREE.Mesh(lag1aGeo, lagCableMat));
    var lag1bGeo = new THREE.TubeGeometry(
        new THREE.LineCurve3(
            new THREE.Vector3(rack1X + 0.13, tor1CenterY, torBackZ),
            new THREE.Vector3(rack1X + 0.13, tor2CenterY, torBackZ)
        ), 2, lagCableRadius, 6, false
    );
    scene.add(new THREE.Mesh(lag1bGeo, lagCableMat));
    var lag1Label = makeTextSprite('LAG', 12, '#ff9933');
    lag1Label.position.set(rack1X + 0.115, (tor1CenterY + tor2CenterY) / 2, torBackZ + 0.03);
    lag1Label.scale.set(0.14, 0.04, 1);
    scene.add(lag1Label);

    // Rack 2 LAG: two cables from TOR 3 rear down to TOR 4 rear
    var lag2aGeo = new THREE.TubeGeometry(
        new THREE.LineCurve3(
            new THREE.Vector3(rack2X + 0.10, tor1CenterY, torBackZ),
            new THREE.Vector3(rack2X + 0.10, tor2CenterY, torBackZ)
        ), 2, lagCableRadius, 6, false
    );
    scene.add(new THREE.Mesh(lag2aGeo, lagCableMat));
    var lag2bGeo = new THREE.TubeGeometry(
        new THREE.LineCurve3(
            new THREE.Vector3(rack2X + 0.13, tor1CenterY, torBackZ),
            new THREE.Vector3(rack2X + 0.13, tor2CenterY, torBackZ)
        ), 2, lagCableRadius, 6, false
    );
    scene.add(new THREE.Mesh(lag2bGeo, lagCableMat));
    var lag2Label = makeTextSprite('LAG', 12, '#ff9933');
    lag2Label.position.set(rack2X + 0.115, (tor1CenterY + tor2CenterY) / 2, torBackZ + 0.03);
    lag2Label.scale.set(0.14, 0.04, 1);
    scene.add(lag2Label);
    } // end if (!isDisaggLayout)
}

// ── Core Switch/Router for standard (single-rack) clusters ──

function placeStandardCoreNetwork(scene, rackX, torCount, nodeCount) {
    var routerY = RACK.OUTER_HEIGHT + 0.35;
    var routerX = rackX;
    var routerZ = 0;

    var routerMat = new THREE.MeshStandardMaterial({ color: 0x1a6fc4, roughness: 0.4, metalness: 0.5 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    var portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var blueMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    var rWidth = RACK.WIDTH * 1.0;
    var rHeight = RACK.U_HEIGHT * 1.5;
    var rDepth = RACK.DEPTH * 0.6;

    var routerGeo = new THREE.BoxGeometry(rWidth, rHeight, rDepth);
    var router = new THREE.Mesh(routerGeo, routerMat);
    router.position.set(routerX, routerY, routerZ);
    scene.add(router);

    // Front panel
    var frontZ = routerZ - rDepth / 2;
    var backRZ = routerZ + rDepth / 2;
    var rpGeo = new THREE.BoxGeometry(rWidth - 0.004, rHeight - 0.004, 0.003);
    var rPanelFront = new THREE.Mesh(rpGeo, darkMat);
    rPanelFront.position.set(routerX, routerY, frontZ - 0.002);
    scene.add(rPanelFront);

    // Status LEDs on front
    var rLedGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    for (let rl = 0; rl < 3; rl++) {
        var rLed = new THREE.Mesh(rLedGeo, ledGreen);
        rLed.position.set(routerX + rWidth / 2 - 0.02 - rl * 0.01, routerY + rHeight / 2 - 0.006, frontZ - 0.003);
        scene.add(rLed);
    }

    // Rear panel
    var rPanelBack = new THREE.Mesh(rpGeo.clone(), darkMat);
    rPanelBack.position.set(routerX, routerY, backRZ + 0.002);
    scene.add(rPanelBack);

    // Router ports (rear)
    var rpW = 0.014;
    var rpH = 0.012;
    var rpGeoPort = new THREE.BoxGeometry(rpW, rpH, 0.003);
    for (let rp = 0; rp < 8; rp++) {
        var rpx = routerX - rWidth / 2 + 0.04 + rp * (rpW + 0.008);
        var port = new THREE.Mesh(rpGeoPort, portMat);
        port.position.set(rpx, routerY, backRZ + 0.004);
        scene.add(port);
    }

    // Label
    var routerLabel = makeFaceLabel('Core Switch / Router / Firewall', 28, '#ffffff', 'front');
    routerLabel.position.set(routerX, routerY, frontZ - 0.008);
    scene.add(routerLabel);

    // Shelf
    var shelfGeo = new THREE.BoxGeometry(rWidth + 0.06, 0.01, rDepth + 0.06);
    var shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.4 });
    var shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(routerX, routerY - rHeight / 2 - 0.005, routerZ);
    scene.add(shelf);

    // Cable runs — uplinks from each ToR QSFP port to router
    var cableRadius = 0.004;
    var stdTorDeviceH = 1 * RACK.U_HEIGHT - 0.004;
    var stdTorDeviceW = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    var stdTorSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    var stdQsfpZ = stdTorSwitchDepth / 2 + 0.005;
    var stdQsfpW = 0.016;
    var stdTor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
    var stdTor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
    var stdTor1QsfpY = stdTor1Y - stdTorDeviceH * 0.2;
    var stdTor2QsfpY = stdTor2Y - stdTorDeviceH * 0.2;
    var routerBottomY = routerY - rHeight / 2;
    var routerRearZ = backRZ;

    function stdQsfpX(portIdx) {
        return rackX - stdTorDeviceW / 2 + 0.04 + portIdx * (stdQsfpW + 0.008);
    }

    function makeStdCable(startPos, endPos, color, arcHeight) {
        var topY = Math.max(startPos.y, endPos.y) + (arcHeight || 0.15);
        var midZ = (startPos.z + endPos.z) / 2;
        var points = [
            new THREE.Vector3(startPos.x, startPos.y, startPos.z),
            new THREE.Vector3(startPos.x, topY, startPos.z),
            new THREE.Vector3(startPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, endPos.z),
            new THREE.Vector3(endPos.x, endPos.y, endPos.z)
        ];
        for (let i = 0; i < points.length - 1; i++) {
            var segGeo = new THREE.TubeGeometry(
                new THREE.LineCurve3(points[i], points[i + 1]),
                2, cableRadius, 6, false
            );
            scene.add(new THREE.Mesh(segGeo, color));
        }
    }

    if (nodeCount === 1) {
        // Single node: 1 ToR — cable from ToR QSFP uplink to router
        makeStdCable(
            { x: stdQsfpX(2), y: stdTor1QsfpY, z: stdQsfpZ },
            { x: routerX, y: routerBottomY, z: routerRearZ },
            blueMat, 0.12
        );
    } else {
        // ToR 1 → Router (QSFP port 2)
        makeStdCable(
            { x: stdQsfpX(2), y: stdTor1QsfpY, z: stdQsfpZ },
            { x: routerX - rWidth / 4, y: routerBottomY, z: routerRearZ },
            blueMat, 0.12
        );
        // ToR 2 → Router (QSFP port 3, if present)
        if (torCount >= 2) {
            makeStdCable(
                { x: stdQsfpX(3), y: stdTor2QsfpY, z: stdQsfpZ },
                { x: routerX + rWidth / 4, y: routerBottomY, z: routerRearZ },
                blueMat, 0.10
            );
        }
    }
}

// ── Build an edge/tabletop surface for Low Capacity deployments ──

function buildEdgeSurface(scene, nodeCount) {
    var group = new THREE.Group();

    // Surface dimensions scale with node count
    var surfaceW = 0.25 + nodeCount * 0.35;
    var surfaceD = 0.45;
    var surfaceH = 0.02;
    var legH = 0.30;

    var surfaceMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.3 });
    var legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.4 });

    // Tabletop surface
    var topGeo = new THREE.BoxGeometry(surfaceW, surfaceH, surfaceD);
    var top = new THREE.Mesh(topGeo, surfaceMat);
    top.position.set(0, legH + surfaceH / 2, 0);
    group.add(top);

    // Four legs
    var legSize = 0.018;
    var legGeo = new THREE.BoxGeometry(legSize, legH, legSize);
    var legPositions = [
        [-surfaceW / 2 + legSize, legH / 2, -surfaceD / 2 + legSize],
        [ surfaceW / 2 - legSize, legH / 2, -surfaceD / 2 + legSize],
        [-surfaceW / 2 + legSize, legH / 2,  surfaceD / 2 - legSize],
        [ surfaceW / 2 - legSize, legH / 2,  surfaceD / 2 - legSize]
    ];
    legPositions.forEach(function(pos) {
        var leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(pos[0], pos[1], pos[2]);
        group.add(leg);
    });

    // Subtle edge trim on surface front
    var trimGeo = new THREE.BoxGeometry(surfaceW, 0.003, 0.003);
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, legH + surfaceH, -surfaceD / 2);
    group.add(trim);

    scene.add(group);
    return { group: group, surfaceY: legH + surfaceH, surfaceW: surfaceW, surfaceD: surfaceD };
}

// ── Place a compact edge appliance (Low Capacity node) ──

function placeEdgeAppliance(scene, surfaceY, posX, label, isGpu, diskCount, portCount) {
    var appW = 0.14;
    var appH = 0.028;
    var appD = 0.15;
    var y = surfaceY + appH / 2 + 0.001;
    var frontZ = -appD / 2;
    var backZ = appD / 2;

    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
    var metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.7 });
    var ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.6 });
    var ledBlue = new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x3399ff, emissiveIntensity: 0.4 });
    var accentMat = new THREE.MeshStandardMaterial({ color: 0x0078d4, roughness: 0.5, metalness: 0.3 });

    // Main chassis — rounded edges via chamfer simulation (slightly smaller box + top plate)
    var bodyGeo = new THREE.BoxGeometry(appW, appH, appD);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(posX, y, 0);
    scene.add(body);

    // Top accent stripe (Azure blue thin line across front edge of top)
    var topStripeGeo = new THREE.BoxGeometry(appW - 0.005, 0.001, 0.008);
    var topStripe = new THREE.Mesh(topStripeGeo, accentMat);
    topStripe.position.set(posX, y + appH / 2 + 0.0005, frontZ + 0.008);
    scene.add(topStripe);

    // ── Front face ──

    // Front bezel
    var bezelGeo = new THREE.BoxGeometry(appW - 0.002, appH - 0.004, 0.002);
    var bezel = new THREE.Mesh(bezelGeo, darkMat);
    bezel.position.set(posX, y, frontZ - 0.001);
    scene.add(bezel);

    // Drive bays (1–2 compact slots)
    var numDisks = diskCount || 1;
    var diskSlotW = 0.015;
    var diskSlotH = appH * 0.5;
    var diskSlotGeo = new THREE.BoxGeometry(diskSlotW, diskSlotH, 0.001);
    var diskMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
    var diskHandleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });
    var diskStartX = posX - appW / 2 + 0.01;
    for (let d = 0; d < numDisks; d++) {
        var dx = diskStartX + d * (diskSlotW + 0.004) + diskSlotW / 2;
        var slot = new THREE.Mesh(diskSlotGeo, diskMat);
        slot.position.set(dx, y, frontZ - 0.002);
        scene.add(slot);
        var handleGeo = new THREE.BoxGeometry(diskSlotW - 0.002, 0.002, 0.001);
        var handle = new THREE.Mesh(handleGeo, diskHandleMat);
        handle.position.set(dx, y + diskSlotH / 2 + 0.002, frontZ - 0.003);
        scene.add(handle);
    }

    // Status LEDs (right side)
    var ledX = posX + appW / 2 - 0.013;
    var ledGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.001, 8);
    var led1 = new THREE.Mesh(ledGeo, ledGreen);
    led1.rotation.x = Math.PI / 2;
    led1.position.set(ledX, y + appH * 0.15, frontZ - 0.002);
    scene.add(led1);
    var led2 = new THREE.Mesh(ledGeo, ledBlue);
    led2.rotation.x = Math.PI / 2;
    led2.position.set(ledX + 0.005, y + appH * 0.15, frontZ - 0.002);
    scene.add(led2);

    // Power button (small circle)
    var pwrGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.001, 12);
    var pwrBtn = new THREE.Mesh(pwrGeo, metalMat);
    pwrBtn.rotation.x = Math.PI / 2;
    pwrBtn.position.set(ledX + 0.0025, y - appH * 0.15, frontZ - 0.002);
    scene.add(pwrBtn);

    // Azure logo on front
    if (_rack3d.azureLogoTexture) {
        var logoSize = appH * 0.55;
        var logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
        var logoMat = new THREE.MeshBasicMaterial({
            map: _rack3d.azureLogoTexture,
            transparent: true,
            depthWrite: false
        });
        var logoMesh = new THREE.Mesh(logoGeo, logoMat);
        logoMesh.rotation.y = Math.PI;
        logoMesh.position.set(posX + appW / 2 - 0.025, y, frontZ - 0.003);
        scene.add(logoMesh);
    }

    // GPU accent stripe
    if (isGpu) {
        var gpuStripeGeo = new THREE.BoxGeometry(appW - 0.005, 0.002, 0.001);
        var gpuStripeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 });
        var gpuStripe = new THREE.Mesh(gpuStripeGeo, gpuStripeMat);
        gpuStripe.position.set(posX, y + appH / 2 - 0.002, frontZ - 0.003);
        scene.add(gpuStripe);
    }

    // ── Back face ──

    var backPanelGeo = new THREE.BoxGeometry(appW - 0.002, appH - 0.004, 0.002);
    var backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(posX, y, backZ + 0.001);
    scene.add(backPanel);

    // Single compact PSU (right side)
    var psuW = appW * 0.22;
    var psuH = appH * 0.6;
    var psuGeo = new THREE.BoxGeometry(psuW, psuH, 0.003);
    var psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    var psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(posX + appW / 2 - psuW / 2 - 0.005, y, backZ + 0.003);
    scene.add(psu);

    // Network ports (2–4 small ports on back)
    var portW = 0.005;
    var portH = 0.004;
    var portGeo = new THREE.BoxGeometry(portW, portH, 0.002);
    var portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var numPorts = portCount || 2;
    var portStartX = posX - appW / 2 + 0.013;
    for (let pt = 0; pt < numPorts; pt++) {
        var port = new THREE.Mesh(portGeo, portMat);
        port.position.set(portStartX + pt * (portW + 0.003), y + appH * 0.1, backZ + 0.003);
        scene.add(port);
    }

    // BMC port
    var bmcPortMat = new THREE.MeshStandardMaterial({ color: 0x0078d4, roughness: 0.5, metalness: 0.4 });
    var bmcPort = new THREE.Mesh(portGeo, bmcPortMat);
    bmcPort.position.set(portStartX + numPorts * (portW + 0.003) + 0.004, y + appH * 0.1, backZ + 0.003);
    scene.add(bmcPort);

    // Ventilation grille (3 thin slots on back)
    var ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (let v = 0; v < 3; v++) {
        var ventGeo = new THREE.BoxGeometry(appW * 0.2, 0.001, 0.001);
        var vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(posX - appW * 0.05, y - appH * 0.15 + v * 0.004, backZ + 0.002);
        scene.add(vent);
    }

    // Labels
    if (label) {
        var frontLabel = makeFaceLabel(label, 28, '#ffffff', 'front');
        frontLabel.position.set(posX, y, frontZ - 0.004);
        frontLabel.scale.set(0.18, 0.025, 1);
        scene.add(frontLabel);
        var rearLabel = makeFaceLabel(label + ' (Rear)', 28, '#ffffff', 'back');
        rearLabel.position.set(posX, y, backZ + 0.006);
        rearLabel.scale.set(0.18, 0.025, 1);
        scene.add(rearLabel);
    }

    return body;
}

// ── Place a small edge switch for Low Capacity deployments ──

function placeEdgeSwitch(scene, surfaceY, posX, posZ, label) {
    var swW = 0.11;
    var swH = 0.015;
    var swD = 0.09;
    var y = surfaceY + swH / 2 + 0.001;

    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });

    // Switch body
    var bodyGeo = new THREE.BoxGeometry(swW, swH, swD);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(posX, y, posZ);
    scene.add(body);

    // Front panel
    var faceGeo = new THREE.BoxGeometry(swW - 0.001, swH - 0.002, 0.001);
    var face = new THREE.Mesh(faceGeo, darkMat);
    face.position.set(posX, y, posZ - swD / 2 - 0.001);
    scene.add(face);

    // Small port row (8 ports)
    var portGeo = new THREE.BoxGeometry(0.003, 0.003, 0.001);
    var portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    var portStartX = posX - swW / 2 + 0.01;
    for (let p = 0; p < 8; p++) {
        var port = new THREE.Mesh(portGeo, portMat);
        port.position.set(portStartX + p * 0.006, y, posZ - swD / 2 - 0.001);
        scene.add(port);
    }

    // Status LED
    var ledGeo = new THREE.CylinderGeometry(0.001, 0.001, 0.001, 8);
    var ledMat = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.6 });
    var led = new THREE.Mesh(ledGeo, ledMat);
    led.rotation.x = Math.PI / 2;
    led.position.set(posX + swW / 2 - 0.008, y + swH * 0.1, posZ - swD / 2 - 0.001);
    scene.add(led);

    // Label
    if (label) {
        var swLabel = makeFaceLabel(label, 24, '#ffffff', 'front');
        swLabel.position.set(posX, y, posZ - swD / 2 - 0.003);
        swLabel.scale.set(0.12, 0.018, 1);
        scene.add(swLabel);
    }

    return body;
}

// ── Main render function ─────────────────────

function renderRack3D(config) {
    if (typeof THREE === 'undefined') {
        console.warn('rack3d: Three.js not loaded');
        return;
    }
    _rack3d.lastConfig = config;

    var container = document.getElementById('rack-viz-container');
    var canvasEl = document.getElementById('rack-3d-canvas');
    if (!container || !canvasEl) return;

    // Show the section — only when there's something to render
    var section = document.getElementById('rack-viz-section');
    if (section) section.style.display = 'block';

    // Determine rack layout
    var isRackAware = config.clusterType === 'rack-aware';
    var isDisaggregated = config.clusterType === 'disaggregated';
    var rackCount;
    if (isDisaggregated) {
        rackCount = config.disaggRackCount || 2;
    } else {
        rackCount = isRackAware ? 2 : 1;
    }
    var nodeCount = config.nodeCount || 2;
    var torPerRack = nodeCount > 1 ? 2 : 1;  // 2 ToRs for multi-node, 1 ToR for single

    // Distribute nodes across racks
    var racks = [];
    if (isDisaggregated) {
        var nodesPerRack = Math.ceil(nodeCount / rackCount);
        var remaining = nodeCount;
        for (let dr = 0; dr < rackCount; dr++) {
            var rackNodes = Math.min(nodesPerRack, remaining);
            racks.push({ nodes: rackNodes, tor: rackNodes > 1 ? 2 : 1 });
            remaining -= rackNodes;
        }
    } else if (isRackAware) {
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

        // Load Azure Local logo texture from SVG (render to canvas for Three.js)
        var svgImg = new Image();
        svgImg.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(svgImg, 0, 0, 256, 256);
            var tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            _rack3d.azureLogoTexture = tex;
            // Re-render so logos appear on initial load
            if (_rack3d.lastConfig) {
                renderRack3D(_rack3d.lastConfig);
            }
        };
        svgImg.onerror = function(err) {
            console.error('Failed to load Azure Local logo texture from ../images/azurelocal-machine.svg', err);
        };
        svgImg.src = '../images/azurelocal-machine.svg';

        // OrbitControls
        _rack3d.controls = new THREE.OrbitControls(_rack3d.camera, canvasEl);
        _rack3d.controls.enableDamping = true;
        _rack3d.controls.dampingFactor = 0.08;
        _rack3d.controls.minDistance = 0.5;
        _rack3d.controls.maxDistance = 6;
        _rack3d.controls.maxPolarAngle = Math.PI / 2 + 0.1; // slight below-horizon

        // Resize observer (debounced to avoid excessive updates)
        var resizeTimeout;
        var ro = new ResizeObserver(function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                var w = canvasEl.clientWidth;
                var h = canvasEl.clientHeight;
                if (w === 0 || h === 0) return;
                _rack3d.camera.aspect = w / h;
                _rack3d.camera.updateProjectionMatrix();
                _rack3d.renderer.setSize(w, h);
            }, 50);
        });
        ro.observe(canvasEl);

        // Visibility observer — pause rendering when canvas is not visible
        _rack3d.visible = true;
        if ('IntersectionObserver' in window && !_rack3d.intersectionObserver) {
            _rack3d.intersectionObserver = new IntersectionObserver(function(entries) {
                var entry = entries[0];
                if (!entry) return;
                _rack3d.visible = !!entry.isIntersecting;
                if (_rack3d.visible && _rack3d.animId === null) {
                    animate();
                }
            }, { threshold: 0.01 });
            _rack3d.intersectionObserver.observe(canvasEl);
        }

        // Animation loop (pauses when not visible)
        function animate() {
            if (!_rack3d.visible) {
                _rack3d.animId = null;
                return;
            }
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

    // Floor plane — scale for multi-rack disaggregated layouts.
    // Two-row layouts (5+ racks) use ceil(N/2) racks per row and need a
    // larger, more square floor so both rows fit with margin on all sides.
    var floorSize;
    if (config.clusterType === 'disaggregated' && rackCount > 4) {
        var perRow = Math.ceil(rackCount / 2);
        floorSize = Math.max(4 + perRow * 2, 4 + rackCount); // accommodate both rows
    } else {
        floorSize = rackCount > 2 ? 4 + rackCount * 2 : (rackCount === 2 ? 8 : 6);
    }
    var floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    var floorMat = new THREE.MeshStandardMaterial({ color: COLORS.FLOOR, roughness: 1 });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    _rack3d.scene.add(floor);

    // ── Low Capacity: edge appliance tabletop scene ──
    var isLowCapacity = config.clusterType === 'low-capacity';
    if (isLowCapacity) {
        // Build tabletop surface
        var surface = buildEdgeSurface(_rack3d.scene, nodeCount);

        // Place edge appliances on the surface
        var appSpacing = 0.28;
        var totalAppWidth = nodeCount * appSpacing;
        var appStartX = -totalAppWidth / 2 + appSpacing / 2;

        for (let ea = 0; ea < nodeCount; ea++) {
            var appX = appStartX + ea * appSpacing;
            var appLabel = 'Node ' + (ea + 1);
            placeEdgeAppliance(_rack3d.scene, surface.surfaceY, appX, appLabel,
                config.hasGpu || false, config.diskCount || 1, config.portCount || 2);
        }

        // Place a small edge switch behind the appliances (if multi-node)
        if (nodeCount > 1) {
            placeEdgeSwitch(_rack3d.scene, surface.surfaceY, 0, 0.14, 'Switch');

            // Ethernet cables from each appliance to the switch (route along table surface)
            var cableMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
            var switchZ = 0.14;
            var cableY = surface.surfaceY + 0.004; // just above table surface
            for (let ec = 0; ec < nodeCount; ec++) {
                var ecX = appStartX + ec * appSpacing;
                // Cable: exits back of appliance, drops to table, routes to switch
                var cableGeo = new THREE.TubeGeometry(
                    new THREE.CatmullRomCurve3([
                        new THREE.Vector3(ecX - 0.01, surface.surfaceY + 0.015, 0.08),
                        new THREE.Vector3(ecX - 0.01, cableY, 0.12),
                        new THREE.Vector3(ecX * 0.3, cableY, 0.16),
                        new THREE.Vector3(0, cableY, 0.15),
                        new THREE.Vector3(0, surface.surfaceY + 0.01, switchZ + 0.045)
                    ]),
                    20, 0.001, 6, false
                );
                _rack3d.scene.add(new THREE.Mesh(cableGeo, cableMat));
            }
        }

        // Scene label
        var sceneLabel = makeTextSprite('Low Capacity Deployment', 24, '#aaaaaa');
        sceneLabel.position.set(0, surface.surfaceY + 0.18, -surface.surfaceD / 2 + 0.05);
        sceneLabel.scale.set(0.4, 0.08, 1);
        _rack3d.scene.add(sceneLabel);

        // Camera — front-elevated view of the tabletop
        _rack3d.camera.position.set(0.3, surface.surfaceY + 0.30, -0.65);
        _rack3d.controls.target.set(0, surface.surfaceY + 0.015, 0);
        _rack3d.controls.update();

        // Update legend text for edge layout
        var usedUEdge = document.getElementById('rack-viz-used-u');
        var totalUEdge = document.getElementById('rack-viz-total-u');
        if (usedUEdge && totalUEdge) {
            usedUEdge.textContent = nodeCount + (nodeCount === 1 ? ' appliance' : ' appliances');
            totalUEdge.textContent = (nodeCount > 1 ? '1 switch' : 'standalone');
        }

        // Toggle legend items for edge layout
        var legendItems = {
            'legend-server-node': false,
            'legend-edge-appliance': true,
            'legend-tor-switch': false,
            'legend-edge-switch': (nodeCount > 1),
            'legend-bmc-switch': false,
            'legend-core-router': false,
            'legend-mgmt-compute': (nodeCount > 1),
            'legend-smb-trunk': false,
            'legend-lag': false,
            'legend-fc-switch': false,
            'legend-san-appliance': false
        };
        Object.keys(legendItems).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = legendItems[id] ? '' : 'none';
        });
        var rackAwareNote = document.getElementById('rack-viz-rackaware-note');
        if (rackAwareNote) rackAwareNote.style.display = 'none';

        // Update info text for edge layout
        var infoText = document.getElementById('rack-viz-info-text');
        if (infoText) {
            infoText.innerHTML = 'Interactive 3D preview of a Low Capacity edge deployment. Compact appliance nodes are shown on a tabletop surface' +
                (nodeCount > 1 ? ' with a small network switch.' : ' in a standalone configuration.') +
                '<br>⚠️ This is an approximate representation only. Low Capacity hardware varies by OEM — contact your preferred hardware partner for actual device specifications and form factors.';
        }

        return; // Skip standard rack rendering
    }

    // Build racks
    // Two-row layout for disaggregated when rackCount > 4. Back row gets the
    // larger half (ceil(N/2)), front row gets the rest. Hot aisle runs between.
    var useTwoRows = isDisaggregated && rackCount > 4;
    var ROW_Z_GAP = RACK.DEPTH * 1.6; // distance between row centers (hot aisle)
    var rackPositions = [];
    var startX; // Used by standard/rack-aware single-row helpers below
    if (useTwoRows) {
        var backCount = Math.ceil(rackCount / 2);
        var frontCount = rackCount - backCount;
        var backWidth = backCount * RACK.WIDTH + (backCount - 1) * RACK.GAP_BETWEEN;
        var frontWidth = frontCount * RACK.WIDTH + (frontCount - 1) * RACK.GAP_BETWEEN;
        var backStartX = -backWidth / 2 + RACK.WIDTH / 2;
        var frontStartX = -frontWidth / 2 + RACK.WIDTH / 2;
        var backZ = -ROW_Z_GAP / 2;
        var frontZ = ROW_Z_GAP / 2;
        // The camera sits at (+X, Y, -Z) looking at origin, so higher world X
        // renders on the viewer's LEFT and the -Z row (named backZ above) is
        // actually the viewer's FRONT row (closer to camera). We want Rack 1
        // on the front row, left-hand side, so assign rackIndex in reverse
        // across X in each row (highest X = lowest rackIndex).
        // Front row (near camera): Racks 1..backCount, Rack 1 on viewer's left.
        // Facing = +1 (default): rack fronts face -Z (toward camera, cold aisle).
        for (let bi = 0; bi < backCount; bi++) {
            rackPositions.push({
                x: backStartX + bi * (RACK.WIDTH + RACK.GAP_BETWEEN),
                z: backZ,
                rackIndex: backCount - 1 - bi,
                facing: 1
            });
        }
        // Back row (far from camera): Racks backCount+1..rackCount, lowest
        // number on viewer's left (highest X).
        // Facing = -1: rack is rotated 180° so its front faces +Z (outward
        // away from the hot aisle) and its rear faces -Z (into the hot aisle
        // between rows). This gives a real hot-aisle / cold-aisle layout.
        for (let fi = 0; fi < frontCount; fi++) {
            rackPositions.push({
                x: frontStartX + fi * (RACK.WIDTH + RACK.GAP_BETWEEN),
                z: frontZ,
                rackIndex: backCount + (frontCount - 1 - fi),
                facing: -1
            });
        }
        startX = Math.min(backStartX, frontStartX);
    } else {
        var totalWidth = rackCount * RACK.WIDTH + (rackCount - 1) * RACK.GAP_BETWEEN;
        startX = -totalWidth / 2 + RACK.WIDTH / 2;
        for (let si = 0; si < rackCount; si++) {
            // Keep original reverse-build convention so Rack 1 appears on viewer's left
            var rackIndex = (isRackAware || isDisaggregated) ? (rackCount - 1 - si) : si;
            rackPositions.push({
                x: startX + si * (RACK.WIDTH + RACK.GAP_BETWEEN),
                z: 0,
                rackIndex: rackIndex,
                facing: 1
            });
        }
    }

    // Reset legend items to standard rack view
    var stdLegendReset = {
        'legend-server-node': true,
        'legend-edge-appliance': false,
        'legend-tor-switch': true,
        'legend-edge-switch': false,
        'legend-bmc-switch': true,
        'legend-core-router': true,
        'legend-mgmt-compute': true
    };
    Object.keys(stdLegendReset).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = stdLegendReset[id] ? '' : 'none';
    });

    // Restore standard info text
    var infoText = document.getElementById('rack-viz-info-text');
    if (infoText) {
        var twoRowNote = useTwoRows
            ? '<br><span style="color: var(--accent-blue);">Multi-row layout: racks are arranged in two rows for 5+ rack deployments, with the back row rotated 180° so server exhausts from both rows face each other into a shared hot aisle (hot-aisle / cold-aisle orientation).</span>'
            : '';
        var disaggSanNote = isDisaggregated
            ? '<br><br>Note: Each rack has a \'SAN appliance\' shown for graphical representation, in practice your SAN array will be consolidated in a separate rack(s), this is for illustration purposes only.'
            : '';
        infoText.innerHTML = 'Interactive 3D preview of the estimated rack layout. Each server node occupies 2U, ToR switches occupy 1U each. The cables from each node to the ToR switches are not shown.<br><span id="rack-viz-rackaware-note" style="display:none;">Rack-aware deployments show balanced distribution of nodes across two cabinets, in real deployments these can be in separate rooms or datacenter locations.<br></span>' + twoRowNote + disaggSanNote + '<br>⚠️ This is an approximate representation only, contact your preferred hardware OEM partner for detailed physical space requirements for their Azure Local solutions.';
    }

    for (let r = 0; r < rackCount; r++) {
        var pos = rackPositions[r];
        var rackIndex = pos.rackIndex;
        var offsetX = pos.x;
        var offsetZ = pos.z;
        var facing = pos.facing || 1;
        var rack = buildRackFrame(_rack3d.scene, offsetX, offsetZ, facing);
        var rackInfo = racks[rackIndex];

        // Place ToR switches at top of rack (U41, U42)
        for (let t = 0; t < rackInfo.tor; t++) {
            var torU = RACK.TOTAL_U - t; // 42, 41
            var torNum = (isRackAware || isDisaggregated) ? (rackIndex * 2 + t + 1) : (t + 1);
            var torLabel = 'ToR ' + torNum;
            placeSwitch(_rack3d.scene, rack.group, rack.baseY, torU, torLabel);
        }

        // Place BMC switch below ToR switches (1U)
        var bmcU = RACK.TOTAL_U - rackInfo.tor;
        var bmcNum = (isRackAware || isDisaggregated) ? (rackIndex + 1) : 1;
        var bmcLabel = 'BMC ' + bmcNum;
        placeBmcSwitch(_rack3d.scene, rack.group, rack.baseY, bmcU, bmcLabel);

        // Place FC switches for disaggregated + Fibre Channel (2 per rack, below BMC)
        var fcSwitchCount = 0;
        if (isDisaggregated && config.disaggStorageType === 'fc_san') {
            fcSwitchCount = 2;
            var fcBaseU = bmcU - 1;
            for (let fc = 0; fc < fcSwitchCount; fc++) {
                var fcU = fcBaseU - fc;
                var fcNum = (rackIndex * 2) + fc + 1;
                var fcLabel = 'Fibre Channel ' + fcNum;
                placeFcSwitch(_rack3d.scene, rack.group, rack.baseY, fcU, fcLabel);
            }
        }

        // Place SAN Appliance at bottom of rack for disaggregated (5U, positions U1-U5)
        var sanApplianceU = 0;
        if (isDisaggregated) {
            sanApplianceU = 5;
            placeSanAppliance(_rack3d.scene, rack.group, rack.baseY, 1, 'SAN Appliance');
        }

        // Place server nodes below switches, from top down
        var topServerU = RACK.TOTAL_U - rackInfo.tor - 1 - fcSwitchCount; // first available U below switches + BMC + FC
        var bottomLimit = sanApplianceU + 1; // don't overlap SAN appliance at bottom
        var nodeOffset = 0;
        for (let pr = 0; pr < rackIndex; pr++) { nodeOffset += racks[pr].nodes; }
        for (let n = 0; n < rackInfo.nodes; n++) {
            var serverStartU = topServerU - (n * 2); // 2U per server, top-down
            if (serverStartU < bottomLimit) break;
            var color = COLORS.SERVER;
            var nodeLabel = 'Node ' + (nodeOffset + n + 1);
            placeServer(_rack3d.scene, rack.group, rack.baseY, serverStartU - 1, color,
                nodeLabel, false, config.diskCount || 8, config.portCount || 4);
        }

        // Rack label above (just above the rack frame, below the core router).
        // Always place on the camera-facing (-Z) side of the rack so viewers
        // can see the label for both rows in the two-row hot-aisle layout.
        var rackLabel = (isRackAware || isDisaggregated) ? 'Rack ' + (rackIndex + 1) : '42U Rack';
        var labelY = RACK.OUTER_HEIGHT + 0.08;
        var rackSprite = makeTextSprite(rackLabel, 28, '#ffffff');
        rackSprite.position.set(offsetX - RACK.WIDTH / 2, labelY, offsetZ - RACK.DEPTH / 2);
        rackSprite.scale.set(0.5, 0.12, 1);
        _rack3d.scene.add(rackSprite);
    }

    // Core network for rack-aware and disaggregated topologies
    if (isRackAware || isDisaggregated) {
        // For two-row layouts: center the spine over the hot aisle by using the
        // min/max X across all rack positions so the spine sits above the centroid.
        var minRackX = rackPositions[0].x;
        var maxRackX = rackPositions[0].x;
        for (let rp = 1; rp < rackPositions.length; rp++) {
            if (rackPositions[rp].x < minRackX) minRackX = rackPositions[rp].x;
            if (rackPositions[rp].x > maxRackX) maxRackX = rackPositions[rp].x;
        }
        var spineCount = config.spineCount || 2;
        placeCoreNetwork(_rack3d.scene, minRackX, maxRackX, spineCount, rackCount, startX, isDisaggregated, rackPositions);
    } else {
        // Core switch/router for standard (single-rack) clusters
        placeStandardCoreNetwork(_rack3d.scene, startX, torPerRack, nodeCount);
    }

    // LAG cables for standard (non-rack-aware, non-disaggregated) clusters with 2 ToRs
    if (!isRackAware && !isDisaggregated && torPerRack >= 2) {
        var stdTorDeviceH = 1 * RACK.U_HEIGHT - 0.004;
        var stdTor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
        var stdTor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
        var stdSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
        var stdTorBackZ = stdSwitchDepth / 2 + 0.006;
        var stdLagMat = new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.8 });
        var stdRackX = startX;
        var stdLag1Geo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(stdRackX + 0.10, stdTor1Y, stdTorBackZ),
                new THREE.Vector3(stdRackX + 0.10, stdTor2Y, stdTorBackZ)
            ), 2, 0.003, 6, false
        );
        _rack3d.scene.add(new THREE.Mesh(stdLag1Geo, stdLagMat));
        var stdLag2Geo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(stdRackX + 0.13, stdTor1Y, stdTorBackZ),
                new THREE.Vector3(stdRackX + 0.13, stdTor2Y, stdTorBackZ)
            ), 2, 0.003, 6, false
        );
        _rack3d.scene.add(new THREE.Mesh(stdLag2Geo, stdLagMat));
        var stdLagLabel = makeTextSprite('LAG', 12, '#ff9933');
        stdLagLabel.position.set(stdRackX + 0.115, (stdTor1Y + stdTor2Y) / 2, stdTorBackZ + 0.03);
        stdLagLabel.scale.set(0.14, 0.04, 1);
        _rack3d.scene.add(stdLagLabel);
    }

    // Camera position — front-left, tight on rack body (minimal floor)
    var camDist, camTargetY;
    if (isRackAware || isDisaggregated) {
        // Front view, slightly elevated — scale camera distance with rack count
        var spCount = config.spineCount || 2;
        var spineH = RACK.U_HEIGHT * 1.5;
        var spineGapH = spineH * 0.4;
        var routerTopY = RACK.OUTER_HEIGHT + 0.35 + (spCount - 1) * (spineH + spineGapH) + spineH / 2 + 0.05;
        if (useTwoRows) {
            // 5–8 racks in two rows: pull camera back and up, square-ish floor
            var perRowCam = Math.ceil(rackCount / 2);
            camDist = 3.2 + perRowCam * 0.25;
            camTargetY = RACK.OUTER_HEIGHT * 0.45;
            _rack3d.camera.position.set(2.2 + perRowCam * 0.15, routerTopY * 1.2, -camDist);
        } else if (rackCount >= 4) {
            // 4 racks: right-front perspective, moderately elevated, closer zoom
            camDist = 3.2;
            camTargetY = RACK.OUTER_HEIGHT * 0.5;
            _rack3d.camera.position.set(2.0, routerTopY * 1.1, -camDist);
        } else if (rackCount >= 3) {
            camDist = 3.2;
            camTargetY = RACK.OUTER_HEIGHT * 0.6;
            _rack3d.camera.position.set(1.2, routerTopY * 0.8, -camDist);
        } else {
            camDist = 1.95;
            camTargetY = RACK.OUTER_HEIGHT * 0.85;
            _rack3d.camera.position.set(0.65, routerTopY * 1.1, -camDist);
        }
        // Bump camera distance for 4-spine to fit the taller stack
        if (spCount >= 4) camDist += 0.3;
    } else {
        // Auto-zoom based on node count — more nodes need wider view
        var stdRouterTopY = RACK.OUTER_HEIGHT + 0.35 + 0.05;
        if (nodeCount >= 16) {
            camDist = 4.8;
        } else if (nodeCount >= 13) {
            camDist = 4.3;
        } else if (nodeCount >= 10) {
            camDist = 3.8;
        } else if (nodeCount >= 6) {
            camDist = 3.4;
        } else {
            camDist = 3.0;
        }
        camTargetY = RACK.OUTER_HEIGHT * 0.8;
        _rack3d.camera.position.set(0.55, stdRouterTopY * 1.05, -camDist * 0.65);
    }
    _rack3d.controls.target.set(0, camTargetY, 0);
    _rack3d.controls.update();

    // Update legend text
    var usedU = document.getElementById('rack-viz-used-u');
    var totalU = document.getElementById('rack-viz-total-u');
    if (usedU && totalU) {
        var nodesU = nodeCount * 2;
        var switchesU = torPerRack * rackCount;
        var bmcU_count = rackCount; // 1 BMC switch per rack
        usedU.textContent = (nodesU + switchesU + bmcU_count) + 'U used';
        totalU.textContent = (RACK.TOTAL_U * rackCount) + 'U total';
    }

    // Toggle rack-aware note visibility
    var rackAwareNote = document.getElementById('rack-viz-rackaware-note');
    if (rackAwareNote) {
        rackAwareNote.style.display = (isRackAware || isDisaggregated) ? 'inline' : 'none';
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
