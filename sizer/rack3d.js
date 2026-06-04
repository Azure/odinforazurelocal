/* ============================================
   3D Rack Visualization — rack3d.js
   Uses Three.js (MIT) to render server cabinets
   ============================================ */

// Module-scoped state (attach to globalThis to survive re-evaluation)
const _rack3d = ((typeof window !== 'undefined' ? window : globalThis)._rack3d) || {
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
const RACK = {
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
const COLORS = {
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
        const child = scene.children[0];
        if (child.traverse) {
            child.traverse(function(c) { if (c.isMesh) disposeMesh(c); });
        }
        scene.remove(child);
    }
}

function makeTextSprite(text, fontSize, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 64;
    ctx.font = (fontSize || 24) + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = color || COLORS.LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.4, 0.1, 1);
    return sprite;
}

// Create a text label as a flat plane fixed to a face (not billboarded)
// facing: 'front' (negative Z) or 'back' (positive Z)
function makeFaceLabel(text, fontSize, color, facing) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 64;
    ctx.font = (fontSize || 24) + 'px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = color || COLORS.LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, side: THREE.FrontSide });
    const geo = new THREE.PlaneGeometry(0.5, 0.065);
    const mesh = new THREE.Mesh(geo, mat);
    if (facing === 'front') {
        mesh.rotation.y = Math.PI; // rotate so normal faces -Z (towards camera)
    }
    // facing === 'back' keeps default normal facing +Z (rear of rack)
    return mesh;
}

// ── Build a single 42U rack frame ────────────

function buildRackFrame(scene, offsetX, offsetZ, facing) {
    const group = new THREE.Group();
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

    const frameMat = new THREE.MeshStandardMaterial({ color: COLORS.RACK_FRAME, roughness: 0.7, metalness: 0.5 });
    const railMat  = new THREE.MeshStandardMaterial({ color: COLORS.RACK_RAIL, roughness: 0.6, metalness: 0.4 });

    // Four vertical posts
    const postGeo = new THREE.BoxGeometry(RACK.POST_SIZE, RACK.OUTER_HEIGHT, RACK.POST_SIZE);
    const postPositions = [
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2],
        [RACK.WIDTH / 2 - RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2],
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2,  RACK.DEPTH / 2 - RACK.POST_SIZE / 2],
        [RACK.WIDTH / 2 - RACK.POST_SIZE / 2, RACK.OUTER_HEIGHT / 2,  RACK.DEPTH / 2 - RACK.POST_SIZE / 2]
    ];
    postPositions.forEach(function(pos) {
        const post = new THREE.Mesh(postGeo, frameMat);
        post.position.set(pos[0], pos[1], pos[2]);
        group.add(post);
    });

    // Top and bottom horizontal cross-bars (front and back)
    const crossGeoFB = new THREE.BoxGeometry(RACK.WIDTH, RACK.POST_SIZE, RACK.POST_SIZE);
    const crossGeoSide = new THREE.BoxGeometry(RACK.POST_SIZE, RACK.POST_SIZE, RACK.DEPTH);
    [0, RACK.OUTER_HEIGHT].forEach(function(y) {
        // Front + Back
        [-RACK.DEPTH / 2 + RACK.POST_SIZE / 2, RACK.DEPTH / 2 - RACK.POST_SIZE / 2].forEach(function(z) {
            const bar = new THREE.Mesh(crossGeoFB, frameMat);
            bar.position.set(0, y + RACK.POST_SIZE / 2, z);
            group.add(bar);
        });
        // Left + Right
        [-RACK.WIDTH / 2 + RACK.POST_SIZE / 2, RACK.WIDTH / 2 - RACK.POST_SIZE / 2].forEach(function(x) {
            const bar = new THREE.Mesh(crossGeoSide, frameMat);
            bar.position.set(x, y + RACK.POST_SIZE / 2, 0);
            group.add(bar);
        });
    });

    // U-slot rail markers (thin horizontal lines on front posts)
    const railGeo = new THREE.BoxGeometry(RACK.RAIL_DEPTH, 0.002, RACK.POST_SIZE);
    const baseY = 0.06; // bottom offset inside frame
    for (let u = 0; u <= RACK.TOTAL_U; u++) {
        const y = baseY + u * RACK.U_HEIGHT;
        [-RACK.WIDTH / 2 + RACK.POST_SIZE + RACK.RAIL_DEPTH / 2,
            RACK.WIDTH / 2 - RACK.POST_SIZE - RACK.RAIL_DEPTH / 2].forEach(function(x) {
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.set(x, y, -RACK.DEPTH / 2 + RACK.POST_SIZE / 2);
            group.add(rail);
        });
    }

    scene.add(group);
    return { group: group, baseY: baseY };
}

// ── Place a 2U server node with detailed front/back ──

function placeServer(rackGroup, baseY, uStart, color, label, isGpu, diskCount, portCount) {
    const deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const deviceHeight = 2 * RACK.U_HEIGHT - 0.004;
    const deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const frontZ = -deviceDepth / 2;
    const backZ = deviceDepth / 2;
    const y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    // Add meshes to the rack group (local coords) so rack rotation/position propagates.
    const scene = rackGroup;
    const cx = 0;

    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.6 });

    // Main chassis
    const bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // ── Front face details ──

    // Front bezel (dark panel)
    const bezelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.006, 0.003);
    const bezel = new THREE.Mesh(bezelGeo, darkMat);
    bezel.position.set(cx, y, frontZ - 0.002);
    scene.add(bezel);

    // Disk bay area — all drive slots on front panel
    const numDisks = diskCount || 8;
    const frontDisks = numDisks;
    const diskAreaWidth = deviceWidth * 0.55;
    const diskStartX = cx - deviceWidth / 2 + 0.02;
    const diskSlotW = Math.min(0.02, (diskAreaWidth - 0.005) / frontDisks - 0.003);
    const diskSlotH = deviceHeight * 0.55;
    const diskSlotGeo = new THREE.BoxGeometry(diskSlotW, diskSlotH, 0.002);
    const diskMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 });
    const diskHandleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });

    for (let d = 0; d < frontDisks; d++) {
        const dx = diskStartX + d * (diskSlotW + 0.003) + diskSlotW / 2;
        const slot = new THREE.Mesh(diskSlotGeo, diskMat);
        slot.position.set(dx, y, frontZ - 0.004);
        scene.add(slot);
        const handleGeo = new THREE.BoxGeometry(diskSlotW - 0.002, 0.003, 0.001);
        const handle = new THREE.Mesh(handleGeo, diskHandleMat);
        handle.position.set(dx, y + diskSlotH / 2 + 0.002, frontZ - 0.005);
        scene.add(handle);
    }

    // Status LEDs (right side of front panel)
    const ledX = cx + deviceWidth / 2 - 0.03;
    const ledGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    const led1 = new THREE.Mesh(ledGeo, ledGreen);
    led1.position.set(ledX, y + deviceHeight * 0.2, frontZ - 0.004);
    scene.add(led1);
    const ledBlue = new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x3399ff, emissiveIntensity: 0.4 });
    const led2 = new THREE.Mesh(ledGeo, ledBlue);
    led2.position.set(ledX + 0.01, y + deviceHeight * 0.2, frontZ - 0.004);
    scene.add(led2);

    // Power button (small circle-like square, right side)
    const pwrBtnGeo = new THREE.BoxGeometry(0.008, 0.008, 0.001);
    const pwrBtn = new THREE.Mesh(pwrBtnGeo, metalMat);
    pwrBtn.position.set(ledX + 0.005, y - deviceHeight * 0.15, frontZ - 0.004);
    scene.add(pwrBtn);

    // Azure logo on front face (right-hand side)
    if (_rack3d.azureLogoTexture) {
        const logoSize = deviceHeight * 0.5;
        const logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
        const logoMat = new THREE.MeshBasicMaterial({
            map: _rack3d.azureLogoTexture,
            transparent: true,
            depthWrite: false
        });
        const logoMesh = new THREE.Mesh(logoGeo, logoMat);
        logoMesh.rotation.y = Math.PI; // face front (-Z)
        logoMesh.position.set(cx + deviceWidth / 2 - 0.045, y, frontZ - 0.006);
        scene.add(logoMesh);
    }

    // GPU accent stripe
    if (isGpu) {
        const stripeGeo = new THREE.BoxGeometry(deviceWidth - 0.01, 0.005, 0.002);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(cx, y + deviceHeight / 2 - 0.004, frontZ - 0.005);
        scene.add(stripe);
    }

    // ── Back face details ──

    // Back panel (dark)
    const backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.006, 0.003);
    const backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // Dual PSU modules (two rectangles at bottom-right of back)
    const psuW = deviceWidth * 0.18;
    const psuH = deviceHeight * 0.7;
    const psuGeo = new THREE.BoxGeometry(psuW, psuH, 0.006);
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    for (let p = 0; p < 2; p++) {
        const psuX = cx + deviceWidth / 2 - 0.02 - p * (psuW + 0.008) - psuW / 2;
        const psu = new THREE.Mesh(psuGeo, psuMat);
        psu.position.set(psuX, y - deviceHeight * 0.05, backZ + 0.005);
        scene.add(psu);
        // PSU handle
        const psuHandleGeo = new THREE.BoxGeometry(psuW * 0.6, 0.006, 0.003);
        const psuHandle = new THREE.Mesh(psuHandleGeo, metalMat);
        psuHandle.position.set(psuX, y + psuH / 2 - 0.01, backZ + 0.009);
        scene.add(psuHandle);
    }

    // Network ports (row of small rectangles on back, left side)
    const portW = 0.012;
    const portH = 0.01;
    const portGeo = new THREE.BoxGeometry(portW, portH, 0.004);
    const portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    const numPorts = portCount || 4;
    const portStartX = cx - deviceWidth / 2 + 0.03;
    for (let pt = 0; pt < numPorts; pt++) {
        const port = new THREE.Mesh(portGeo, portMat);
        port.position.set(portStartX + pt * (portW + 0.006), y + deviceHeight * 0.15, backZ + 0.005);
        scene.add(port);
    }

    // BMC / management port (single port, slightly offset)
    const bmcPort = new THREE.Mesh(portGeo, new THREE.MeshStandardMaterial({ color: 0x0078d4, roughness: 0.5, metalness: 0.4 }));
    bmcPort.position.set(portStartX + numPorts * (portW + 0.006) + 0.01, y + deviceHeight * 0.15, backZ + 0.005);
    scene.add(bmcPort);

    // Ventilation grille (series of thin horizontal lines, center-left of back)
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (let v = 0; v < 6; v++) {
        const ventGeo = new THREE.BoxGeometry(deviceWidth * 0.25, 0.002, 0.002);
        const vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(cx - deviceWidth * 0.05, y - deviceHeight * 0.2 + v * 0.008, backZ + 0.004);
        scene.add(vent);
    }

    // Labels — fixed to front and rear faces
    if (label) {
        const frontLabel = makeFaceLabel(label, 28, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        const rearLabel = makeFaceLabel(label + ' (Rear)', 28, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.012);
        scene.add(rearLabel);
    }

    return body;
}

// ── Place a 1U ToR switch with ethernet ports ──

function placeSwitch(rackGroup, baseY, uStart, label) {
    const deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    const deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const frontZ = -deviceDepth / 2;
    const backZ = deviceDepth / 2;
    const y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    const scene = rackGroup;
    const cx = 0;

    const switchMat = new THREE.MeshStandardMaterial({ color: COLORS.TOR_SWITCH, roughness: 0.45, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.5 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    const bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    const body = new THREE.Mesh(bodyGeo, switchMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // ── Front face — clean panel with status LEDs (ports face rear) ──
    const frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs on front (right side)
    const ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 3; li++) {
        const led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // ── Back face (rear) — ethernet ports, uplinks, PSU ──
    const backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // Ethernet ports — two rows of RJ45-like rectangles (rear-facing)
    const ethW = 0.008;
    const ethH = 0.006;
    const ethGeo = new THREE.BoxGeometry(ethW, ethH, 0.003);
    const ethInnerGeo = new THREE.BoxGeometry(ethW - 0.002, ethH - 0.002, 0.001);
    const ethInnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    const portsPerRow = 24;
    const portSpacing = (deviceWidth - 0.08) / portsPerRow;
    const rowStartX = cx - deviceWidth / 2 + 0.04;

    for (let row = 0; row < 2; row++) {
        const rowY = y + (row === 0 ? 0.006 : -0.006);
        for (let ep = 0; ep < portsPerRow; ep++) {
            const epx = rowStartX + ep * portSpacing;
            // Port housing
            const ethPort = new THREE.Mesh(ethGeo, portMat);
            ethPort.position.set(epx, rowY, backZ + 0.004);
            scene.add(ethPort);
            // Port inner (dark hole)
            const ethInner = new THREE.Mesh(ethInnerGeo, ethInnerMat);
            ethInner.position.set(epx, rowY, backZ + 0.006);
            scene.add(ethInner);
        }
    }

    // Uplink ports (4× QSFP — larger rectangles, rear)
    const qsfpW = 0.016;
    const qsfpH = 0.012;
    const qsfpGeo = new THREE.BoxGeometry(qsfpW, qsfpH, 0.004);
    const qsfpMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 });
    for (let q = 0; q < 4; q++) {
        const qsfp = new THREE.Mesh(qsfpGeo, qsfpMat);
        qsfp.position.set(cx - deviceWidth / 2 + 0.04 + q * (qsfpW + 0.008), y - deviceHeight * 0.2, backZ + 0.005);
        scene.add(qsfp);
    }

    // PSU (single module, right side of rear)
    const psuGeo = new THREE.BoxGeometry(deviceWidth * 0.15, deviceHeight * 0.7, 0.006);
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    const psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(cx + deviceWidth / 2 - 0.06, y, backZ + 0.005);
    scene.add(psu);

    // Fan vents (center of rear)
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
    for (let fv = 0; fv < 4; fv++) {
        const ventLineGeo = new THREE.BoxGeometry(deviceWidth * 0.15, 0.002, 0.002);
        const ventLine = new THREE.Mesh(ventLineGeo, ventMat);
        ventLine.position.set(cx + 0.05, y - deviceHeight * 0.15 + fv * 0.006, backZ + 0.004);
        scene.add(ventLine);
    }

    // Labels — fixed to front and rear faces
    if (label) {
        const frontLabel = makeFaceLabel(label, 24, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        const rearLabel = makeFaceLabel(label + ' (Rear)', 24, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.008);
        scene.add(rearLabel);
    }

    return body;
}

// ── Place a 1U BMC switch ──

function placeBmcSwitch(rackGroup, baseY, uStart, label) {
    const deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    const deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const frontZ = -deviceDepth / 2;
    const backZ = deviceDepth / 2;
    const y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    const scene = rackGroup;
    const cx = 0;

    const bmcMat = new THREE.MeshStandardMaterial({ color: COLORS.BMC_SWITCH, roughness: 0.4, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.5 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    const bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    const body = new THREE.Mesh(bodyGeo, bmcMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front face — clean panel with status LEDs
    const frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs
    const ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 2; li++) {
        const led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // Back face — ethernet ports (fewer than ToR, single row of RJ45)
    const backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    const ethW = 0.008;
    const ethH = 0.006;
    const ethGeo = new THREE.BoxGeometry(ethW, ethH, 0.003);
    const ethInnerGeo = new THREE.BoxGeometry(ethW - 0.002, ethH - 0.002, 0.001);
    const ethInnerMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    const portsPerRow = 16;
    const portSpacing = (deviceWidth - 0.08) / portsPerRow;
    const rowStartX = cx - deviceWidth / 2 + 0.04;

    for (let ep = 0; ep < portsPerRow; ep++) {
        const epx = rowStartX + ep * portSpacing;
        const ethPort = new THREE.Mesh(ethGeo, portMat);
        ethPort.position.set(epx, y, backZ + 0.004);
        scene.add(ethPort);
        const ethInner = new THREE.Mesh(ethInnerGeo, ethInnerMat);
        ethInner.position.set(epx, y, backZ + 0.006);
        scene.add(ethInner);
    }

    // PSU (single module, right side of rear)
    const psuGeo = new THREE.BoxGeometry(deviceWidth * 0.12, deviceHeight * 0.6, 0.006);
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    const psu = new THREE.Mesh(psuGeo, psuMat);
    psu.position.set(cx + deviceWidth / 2 - 0.05, y, backZ + 0.005);
    scene.add(psu);

    // Labels
    if (label) {
        const frontLabel = makeFaceLabel(label, 24, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        const rearLabel = makeFaceLabel(label + ' (Rear)', 24, '#ffffff', 'back');
        rearLabel.position.set(cx, y, backZ + 0.008);
        scene.add(rearLabel);
    }

    return body;
}

// ── FC Switch — 1U Fibre Channel switch in purple ──

function placeFcSwitch(rackGroup, baseY, uStart, label) {
    const deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const deviceHeight = 1 * RACK.U_HEIGHT - 0.004;
    const deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const frontZ = -deviceDepth / 2;
    const backZ = deviceDepth / 2;
    const y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    const scene = rackGroup;
    const cx = 0;

    const fcMat = new THREE.MeshStandardMaterial({ color: 0x9933cc, roughness: 0.4, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // Main chassis
    const bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    const body = new THREE.Mesh(bodyGeo, fcMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front face
    const frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Status LEDs
    const ledGeo = new THREE.BoxGeometry(0.004, 0.004, 0.001);
    for (let li = 0; li < 3; li++) {
        const led = new THREE.Mesh(ledGeo, ledGreen);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.008, y + deviceHeight / 2 - 0.005, frontZ - 0.004);
        scene.add(led);
    }

    // Back face
    const backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // FC ports (SFP style, smaller than ethernet)
    const sfpW = 0.010;
    const sfpH = 0.006;
    const sfpGeo = new THREE.BoxGeometry(sfpW, sfpH, 0.003);
    const portsPerRow = 16;
    const portSpacing = (deviceWidth - 0.08) / portsPerRow;
    const rowStartX = cx - deviceWidth / 2 + 0.04;
    for (let fp = 0; fp < portsPerRow; fp++) {
        const fpx = rowStartX + fp * portSpacing;
        const sfp = new THREE.Mesh(sfpGeo, portMat);
        sfp.position.set(fpx, y, backZ + 0.004);
        scene.add(sfp);
    }

    // Labels
    if (label) {
        const frontLabel = makeFaceLabel(label, 22, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
    }

    return body;
}

// ── SAN Appliance — 5U storage appliance in purple ──

function placeSanAppliance(rackGroup, baseY, uStart, label) {
    const heightU = 5;
    const deviceWidth = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const deviceHeight = heightU * RACK.U_HEIGHT - 0.004;
    const deviceDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const frontZ = -deviceDepth / 2;
    const backZ = deviceDepth / 2;
    const y = baseY + (uStart - 1) * RACK.U_HEIGHT + deviceHeight / 2 + 0.002;
    const scene = rackGroup;
    const cx = 0;

    const sanMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.3, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.5 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });
    const ledBlue = new THREE.MeshStandardMaterial({ color: 0x3399ff, emissive: 0x3399ff, emissiveIntensity: 0.4 });

    // Main chassis
    const bodyGeo = new THREE.BoxGeometry(deviceWidth, deviceHeight, deviceDepth);
    const body = new THREE.Mesh(bodyGeo, sanMat);
    body.position.set(cx, y, 0);
    scene.add(body);

    // Front panel
    const frontPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const frontPanel = new THREE.Mesh(frontPanelGeo, darkMat);
    frontPanel.position.set(cx, y, frontZ - 0.002);
    scene.add(frontPanel);

    // Drive bays on front (2 rows of 12 — typical SAN array appearance)
    const bayW = 0.008;
    const bayH = deviceHeight * 0.3;
    const bayRows = 2;
    const baysPerRow = 12;
    for (let row = 0; row < bayRows; row++) {
        const bayY = y + deviceHeight * 0.15 - row * (bayH + 0.004);
        for (let b = 0; b < baysPerRow; b++) {
            const bayX = cx - deviceWidth / 2 + 0.02 + b * (bayW + 0.002);
            const bayGeo = new THREE.BoxGeometry(bayW, bayH, 0.002);
            const bayMesh = new THREE.Mesh(bayGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }));
            bayMesh.position.set(bayX, bayY, frontZ - 0.003);
            scene.add(bayMesh);
            // Drive LED
            if (b % 3 === 0) {
                const dLedGeo = new THREE.BoxGeometry(0.003, 0.003, 0.001);
                const dLed = new THREE.Mesh(dLedGeo, ledGreen);
                dLed.position.set(bayX, bayY + bayH / 2 + 0.003, frontZ - 0.004);
                scene.add(dLed);
            }
        }
    }

    // Status LEDs (top-right of front)
    const ledGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    for (let li = 0; li < 4; li++) {
        const led = new THREE.Mesh(ledGeo, li < 2 ? ledGreen : ledBlue);
        led.position.set(cx + deviceWidth / 2 - 0.02 - li * 0.01, y + deviceHeight / 2 - 0.008, frontZ - 0.004);
        scene.add(led);
    }

    // Back panel
    const backPanelGeo = new THREE.BoxGeometry(deviceWidth - 0.004, deviceHeight - 0.004, 0.003);
    const backPanel = new THREE.Mesh(backPanelGeo, darkMat);
    backPanel.position.set(cx, y, backZ + 0.002);
    scene.add(backPanel);

    // FC ports on back (2 rows of 8)
    const fcPortW = 0.010;
    const fcPortH = 0.008;
    const fcPortGeo = new THREE.BoxGeometry(fcPortW, fcPortH, 0.003);
    for (let pr = 0; pr < 2; pr++) {
        const portY = y + deviceHeight * 0.15 - pr * (fcPortH + 0.012);
        for (let fp = 0; fp < 8; fp++) {
            const fpx = cx - deviceWidth / 2 + 0.04 + fp * (fcPortW + 0.008);
            const sfp = new THREE.Mesh(fcPortGeo, portMat);
            sfp.position.set(fpx, portY, backZ + 0.004);
            scene.add(sfp);
        }
    }

    // Dual PSU modules
    const psuW = deviceWidth * 0.15;
    const psuH = deviceHeight * 0.5;
    const psuGeo = new THREE.BoxGeometry(psuW, psuH, 0.006);
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });
    for (let p = 0; p < 2; p++) {
        const psuX = cx + deviceWidth / 2 - 0.02 - p * (psuW + 0.008) - psuW / 2;
        const psu = new THREE.Mesh(psuGeo, psuMat);
        psu.position.set(psuX, y - deviceHeight * 0.1, backZ + 0.005);
        scene.add(psu);
    }

    // Labels
    if (label) {
        const frontLabel = makeFaceLabel(label, 28, '#ffffff', 'front');
        frontLabel.position.set(cx, y, frontZ - 0.008);
        scene.add(frontLabel);
        const rearLabel = makeFaceLabel(label + ' (Rear)', 28, '#ffffff', 'back');
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
    const routerX = (rack1X + rack2X) / 2;
    const routerZ = 0;

    // Blue core switch material
    const routerMat = new THREE.MeshStandardMaterial({ color: 0x1a6fc4, roughness: 0.4, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
    const pinkMat = new THREE.MeshBasicMaterial({ color: 0xff66bb, transparent: true, opacity: 0.7 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    // ── Spine switches — stack vertically above the racks ──
    const rWidth = RACK.WIDTH * 1.2;
    const rHeight = RACK.U_HEIGHT * 1.5;
    const rDepth = RACK.DEPTH * 0.6;
    const spineGap = rHeight * 0.4; // vertical gap between stacked spine switches
    const baseY = RACK.OUTER_HEIGHT + 0.35;
    // Spine front/rear face Z — invariant across the spine stack (every
    // spine shares routerZ and rDepth), so hoist out of the loop rather
    // than rely on `var` leakage when read further below.
    const frontZ = routerZ - rDepth / 2;
    const backRZ = routerZ + rDepth / 2;

    for (let si = 0; si < spineCount; si++) {
        const spineY = baseY + si * (rHeight + spineGap);

        const routerGeo = new THREE.BoxGeometry(rWidth, rHeight, rDepth);
        const router = new THREE.Mesh(routerGeo, routerMat);
        router.position.set(routerX, spineY, routerZ);
        scene.add(router);

        // Front panel
        const rpGeo = new THREE.BoxGeometry(rWidth - 0.004, rHeight - 0.004, 0.003);
        const rPanelFront = new THREE.Mesh(rpGeo, darkMat);
        rPanelFront.position.set(routerX, spineY, frontZ - 0.002);
        scene.add(rPanelFront);

        // Status LEDs on front
        const rLedGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
        for (let rl = 0; rl < 3; rl++) {
            const rLed = new THREE.Mesh(rLedGeo, ledGreen);
            rLed.position.set(routerX + rWidth / 2 - 0.02 - rl * 0.01, spineY + rHeight / 2 - 0.006, frontZ - 0.003);
            scene.add(rLed);
        }

        // Rear panel
        const rPanelBack = new THREE.Mesh(rpGeo.clone(), darkMat);
        rPanelBack.position.set(routerX, spineY, backRZ + 0.002);
        scene.add(rPanelBack);

        // Router ports (rear — 8 ports)
        const rpW = 0.014;
        const rpH = 0.012;
        const rpGeoPort = new THREE.BoxGeometry(rpW, rpH, 0.003);
        for (let rp = 0; rp < 8; rp++) {
            const rpx = routerX - rWidth / 2 + 0.04 + rp * (rpW + 0.008);
            const port = new THREE.Mesh(rpGeoPort, portMat);
            port.position.set(rpx, spineY, backRZ + 0.004);
            scene.add(port);
        }

        // Label
        const spineLabel = spineCount > 1 ? 'Spine ' + (si + 1) : 'Core Switch / Router / Firewall';
        const routerLabel = makeFaceLabel(spineLabel, 28, '#ffffff', 'front');
        routerLabel.position.set(routerX, spineY, frontZ - 0.008);
        scene.add(routerLabel);

        // Small shelf/platform under spine switch
        const shelfGeo = new THREE.BoxGeometry(rWidth + 0.06, 0.01, rDepth + 0.06);
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.4 });
        const shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.set(routerX, spineY - rHeight / 2 - 0.005, routerZ);
        scene.add(shelf);
    }

    // Use the bottom spine switch for cable attachment
    const routerY = baseY;

    // ── Cable runs ──
    const cableRadius = 0.004;

    // ToR QSFP uplink port positions (rear of switch)
    const torDeviceH = 1 * RACK.U_HEIGHT - 0.004;
    const torDeviceW = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const torSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const torQsfpZ = torSwitchDepth / 2 + 0.005;
    const qsfpW = 0.016;
    // ToR 1 (U42) and ToR 2 (U41) center Y
    const tor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002;
    const tor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002;
    const tor1QsfpY = tor1Y - torDeviceH * 0.2;
    const tor2QsfpY = tor2Y - torDeviceH * 0.2;
    const routerBottomY = routerY - rHeight / 2;
    const routerRearZ = backRZ;
    // Top face of the highest spine in the stack — cables route above this
    // on the horizontal traversal so they never clip through any spine body.
    const spineStackTopY = baseY + (spineCount - 1) * (rHeight + spineGap) + rHeight / 2;

    // QSFP port X offset helper (port index 0-3)
    function qsfpX(rackCx, portIdx) {
        return rackCx - torDeviceW / 2 + 0.04 + portIdx * (qsfpW + 0.008);
    }

    // Hoisted out of the per-rack loop so each helper is created once per
    // placeCoreNetwork call instead of once per rack. Closures still capture
    // the per-call invariants (routerX, rWidth, spineStackTopY, cableRadius,
    // scene, blueMat); per-iteration values are passed as parameters.
    //
    // sideLandingX: keep the landing X on the same side as the drop so the
    // final horizontal segment never crosses through the spine body.
    // rackSide < 0 → land in the left half of the rear face; > 0 → right half.
    // offsetFrac in 0..0.45 controls how far into the rear face the cable
    // terminates (0 = at the side, 0.45 = near the centreline).
    function sideLandingX(rackSide, offsetFrac) {
        return routerX + rackSide * (rWidth * (0.45 - offsetFrac));
    }
    // makeUplinkCable: route above the top of the entire spine stack so the
    // horizontal traversal never passes through any spine body. Per-cable
    // stagger (ri) spreads the bundle vertically at the top.
    function makeUplinkCable(ri, spineSideX, rearPortZ, exitZ, spineCableZ,
        portX, portY, landingX, landingY) {
        const topY = spineStackTopY + 0.12 + ri * 0.015;
        const pts = [
            new THREE.Vector3(portX, portY, rearPortZ),       // at rear port
            new THREE.Vector3(portX, portY, exitZ),           // out the rear of the ToR
            new THREE.Vector3(portX, topY, exitZ),            // up to top
            new THREE.Vector3(spineSideX, topY, exitZ),       // across in X to spine's side
            new THREE.Vector3(spineSideX, topY, spineCableZ), // align Z to spine rear face
            new THREE.Vector3(spineSideX, landingY, spineCableZ), // drop down the side of the spine
            new THREE.Vector3(landingX, landingY, spineCableZ)    // into the rear face
        ];
        for (let pi = 0; pi < pts.length - 1; pi++) {
            const segGeo = new THREE.TubeGeometry(
                new THREE.LineCurve3(pts[pi], pts[pi + 1]),
                2, cableRadius, 6, false
            );
            scene.add(new THREE.Mesh(segGeo, blueMat));
        }
    }

    // ── Blue cables: Management/Compute Trunks (each rack's ToRs → Spine) ──
    // Connect every rack's ToR to the bottom spine switch. All racks (in
    // either single-row or two-row disaggregated layouts) land on the
    // spine's rear face.
    for (let ri = 0; ri < allRackCount; ri++) {
        let rackX_i, rackZ_i, rackFacing_i;
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
        const rearPortZ = rackZ_i + torQsfpZ * rackFacing_i;
        // Horizontal exit point pushed into the hot aisle so the cable
        // clearly leaves the rear of the ToR before rising up.
        const AISLE_EXIT = 0.06;
        const exitZ = rackZ_i + (torQsfpZ + AISLE_EXIT) * rackFacing_i;
        // Terminate all uplink cables on the spine's rear face (classic
        // top-of-row cabling) regardless of single-row or two-row layout.
        // In two-row mode the cables still exit the rear of each rack's ToR
        // into the hot aisle and rise up, but they all converge onto the
        // rear of Spine 1 / Spine 2 rather than splitting across both
        // spine faces.
        const spineCableZ = routerRearZ;

        // Build a path that emerges horizontally from the rear of the ToR,
        // rises, crosses over, then drops down the SIDE of the spine (just
        // past its left or right face) before turning in to land on the
        // rear face. This avoids cables visibly passing through the spine body.
        const rackSide = rackX_i < routerX ? -1 : 1;          // -1 = drop on spine left, +1 = right
        const spineSideX = routerX + rackSide * (rWidth / 2 + 0.09); // well past the spine side face

        // Give each of the two cables a slightly different landing X within
        // the rack's side of the spine rear face (so they don't overlap).
        makeUplinkCable(ri, spineSideX, rearPortZ, exitZ, spineCableZ,
            qsfpX(rackX_i, 2), tor1QsfpY, sideLandingX(rackSide, 0.15), routerBottomY);
        makeUplinkCable(ri, spineSideX, rearPortZ, exitZ, spineCableZ,
            qsfpX(rackX_i, 3), tor2QsfpY, sideLandingX(rackSide, 0.25), routerBottomY);
    }

    // ── Pink/Magenta cables: SMB Storage Trunks — rack-aware only (not disaggregated) ──
    if (!isDisaggLayout) {
    // Calculate actual TOR switch center Y positions (reuse torDeviceH from above)
        const tor1CenterY = 0.06 + (42 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002; // U42
        const tor2CenterY = 0.06 + (41 - 1) * RACK.U_HEIGHT + torDeviceH / 2 + 0.002; // U41
        const torBackZ = torSwitchDepth / 2 + 0.006;
        // Start/end Y at TOR center so vertical legs reach the ports
        const smbUpperY = tor1CenterY;
        const smbLowerY = tor2CenterY;
        const smbArcHeight = 0.03;
        const smbCableR = 0.004;

        // Helper: build a clean 4-point up-across-down cable (no zero-length segments)
        const makeHCable = function(startX, endX, portY, arcH, z, mat) {
            const topY = portY + arcH;
            const pts = [
                new THREE.Vector3(startX, portY, z),
                new THREE.Vector3(startX, topY, z),
                new THREE.Vector3(endX, topY, z),
                new THREE.Vector3(endX, portY, z)
            ];
            for (let i = 0; i < pts.length - 1; i++) {
                const seg = new THREE.TubeGeometry(
                    new THREE.LineCurve3(pts[i], pts[i + 1]),
                    2, smbCableR, 6, false
                );
                scene.add(new THREE.Mesh(seg, mat));
            }
        };

        // SMB1 Trunk: TOR 1 (Rack 1) ↔ TOR 3 (Rack 2) — upper cable, left side of switches
        makeHCable(rack1X - 0.12, rack2X - 0.12, smbUpperY, smbArcHeight, torBackZ, pinkMat);
        // SMB2 Trunk: TOR 2 (Rack 1) ↔ TOR 4 (Rack 2) — lower cable, right side of switches
        makeHCable(rack1X + 0.15, rack2X + 0.15, smbLowerY, -smbArcHeight, torBackZ, pinkMat);

        // ── LAG cables between paired ToRs in each rack (rear port-to-port, 2 per pair) ──
        const lagCableMat = new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.8 });
        const lagCableRadius = 0.003;

        // Rack 1 LAG: two cables from TOR 1 rear down to TOR 2 rear
        const lag1aGeo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(rack1X + 0.10, tor1CenterY, torBackZ),
                new THREE.Vector3(rack1X + 0.10, tor2CenterY, torBackZ)
            ), 2, lagCableRadius, 6, false
        );
        scene.add(new THREE.Mesh(lag1aGeo, lagCableMat));
        const lag1bGeo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(rack1X + 0.13, tor1CenterY, torBackZ),
                new THREE.Vector3(rack1X + 0.13, tor2CenterY, torBackZ)
            ), 2, lagCableRadius, 6, false
        );
        scene.add(new THREE.Mesh(lag1bGeo, lagCableMat));
        const lag1Label = makeTextSprite('LAG', 12, '#ff9933');
        lag1Label.position.set(rack1X + 0.115, (tor1CenterY + tor2CenterY) / 2, torBackZ + 0.03);
        lag1Label.scale.set(0.14, 0.04, 1);
        scene.add(lag1Label);

        // Rack 2 LAG: two cables from TOR 3 rear down to TOR 4 rear
        const lag2aGeo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(rack2X + 0.10, tor1CenterY, torBackZ),
                new THREE.Vector3(rack2X + 0.10, tor2CenterY, torBackZ)
            ), 2, lagCableRadius, 6, false
        );
        scene.add(new THREE.Mesh(lag2aGeo, lagCableMat));
        const lag2bGeo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(rack2X + 0.13, tor1CenterY, torBackZ),
                new THREE.Vector3(rack2X + 0.13, tor2CenterY, torBackZ)
            ), 2, lagCableRadius, 6, false
        );
        scene.add(new THREE.Mesh(lag2bGeo, lagCableMat));
        const lag2Label = makeTextSprite('LAG', 12, '#ff9933');
        lag2Label.position.set(rack2X + 0.115, (tor1CenterY + tor2CenterY) / 2, torBackZ + 0.03);
        lag2Label.scale.set(0.14, 0.04, 1);
        scene.add(lag2Label);
    } // end if (!isDisaggLayout)
}

// ── Core Switch/Router for standard (single-rack) clusters ──

function placeStandardCoreNetwork(scene, rackX, torCount, nodeCount) {
    const routerY = RACK.OUTER_HEIGHT + 0.35;
    const routerX = rackX;
    const routerZ = 0;

    const routerMat = new THREE.MeshStandardMaterial({ color: 0x1a6fc4, roughness: 0.4, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
    const ledGreen = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.5 });

    const rWidth = RACK.WIDTH * 1.0;
    const rHeight = RACK.U_HEIGHT * 1.5;
    const rDepth = RACK.DEPTH * 0.6;

    const routerGeo = new THREE.BoxGeometry(rWidth, rHeight, rDepth);
    const router = new THREE.Mesh(routerGeo, routerMat);
    router.position.set(routerX, routerY, routerZ);
    scene.add(router);

    // Front panel
    const frontZ = routerZ - rDepth / 2;
    const backRZ = routerZ + rDepth / 2;
    const rpGeo = new THREE.BoxGeometry(rWidth - 0.004, rHeight - 0.004, 0.003);
    const rPanelFront = new THREE.Mesh(rpGeo, darkMat);
    rPanelFront.position.set(routerX, routerY, frontZ - 0.002);
    scene.add(rPanelFront);

    // Status LEDs on front
    const rLedGeo = new THREE.BoxGeometry(0.005, 0.005, 0.001);
    for (let rl = 0; rl < 3; rl++) {
        const rLed = new THREE.Mesh(rLedGeo, ledGreen);
        rLed.position.set(routerX + rWidth / 2 - 0.02 - rl * 0.01, routerY + rHeight / 2 - 0.006, frontZ - 0.003);
        scene.add(rLed);
    }

    // Rear panel
    const rPanelBack = new THREE.Mesh(rpGeo.clone(), darkMat);
    rPanelBack.position.set(routerX, routerY, backRZ + 0.002);
    scene.add(rPanelBack);

    // Router ports (rear)
    const rpW = 0.014;
    const rpH = 0.012;
    const rpGeoPort = new THREE.BoxGeometry(rpW, rpH, 0.003);
    for (let rp = 0; rp < 8; rp++) {
        const rpx = routerX - rWidth / 2 + 0.04 + rp * (rpW + 0.008);
        const port = new THREE.Mesh(rpGeoPort, portMat);
        port.position.set(rpx, routerY, backRZ + 0.004);
        scene.add(port);
    }

    // Label
    const routerLabel = makeFaceLabel('Core Switch / Router / Firewall', 28, '#ffffff', 'front');
    routerLabel.position.set(routerX, routerY, frontZ - 0.008);
    scene.add(routerLabel);

    // Shelf
    const shelfGeo = new THREE.BoxGeometry(rWidth + 0.06, 0.01, rDepth + 0.06);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.4 });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(routerX, routerY - rHeight / 2 - 0.005, routerZ);
    scene.add(shelf);

    // Cable runs — uplinks from each ToR QSFP port to router
    const cableRadius = 0.004;
    const stdTorDeviceH = 1 * RACK.U_HEIGHT - 0.004;
    const stdTorDeviceW = RACK.WIDTH - RACK.POST_SIZE * 2 - 0.02;
    const stdTorSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
    const stdQsfpZ = stdTorSwitchDepth / 2 + 0.005;
    const stdQsfpW = 0.016;
    const stdTor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
    const stdTor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
    const stdTor1QsfpY = stdTor1Y - stdTorDeviceH * 0.2;
    const stdTor2QsfpY = stdTor2Y - stdTorDeviceH * 0.2;
    const routerBottomY = routerY - rHeight / 2;
    const routerRearZ = backRZ;

    function stdQsfpX(portIdx) {
        return rackX - stdTorDeviceW / 2 + 0.04 + portIdx * (stdQsfpW + 0.008);
    }

    function makeStdCable(startPos, endPos, color, arcHeight) {
        const topY = Math.max(startPos.y, endPos.y) + (arcHeight || 0.15);
        const midZ = (startPos.z + endPos.z) / 2;
        const points = [
            new THREE.Vector3(startPos.x, startPos.y, startPos.z),
            new THREE.Vector3(startPos.x, topY, startPos.z),
            new THREE.Vector3(startPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, midZ),
            new THREE.Vector3(endPos.x, topY, endPos.z),
            new THREE.Vector3(endPos.x, endPos.y, endPos.z)
        ];
        for (let i = 0; i < points.length - 1; i++) {
            const segGeo = new THREE.TubeGeometry(
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

// ── Main render function ─────────────────────

function renderRack3D(config) { // eslint-disable-line no-redeclare, no-unused-vars
    if (typeof THREE === 'undefined') {
        console.warn('rack3d: Three.js not loaded');
        return;
    }
    _rack3d.lastConfig = config;

    const container = document.getElementById('rack-viz-container');
    const canvasEl = document.getElementById('rack-3d-canvas');
    if (!container || !canvasEl) return;

    // Show the section — only when there's something to render
    const section = document.getElementById('rack-viz-section');
    if (section) section.style.display = 'block';

    // Determine rack layout
    const isRackAware = config.clusterType === 'rack-aware';
    const isDisaggregated = config.clusterType === 'disaggregated';
    let rackCount;
    if (isDisaggregated) {
        rackCount = config.disaggRackCount || 2;
    } else {
        rackCount = isRackAware ? 2 : 1;
    }
    const nodeCount = config.nodeCount || 2;
    const torPerRack = nodeCount > 1 ? 2 : 1;  // 2 ToRs for multi-node, 1 ToR for single

    // Distribute nodes across racks
    const racks = [];
    if (isDisaggregated) {
        const nodesPerRack = Math.ceil(nodeCount / rackCount);
        let remaining = nodeCount;
        for (let dr = 0; dr < rackCount; dr++) {
            const rackNodes = Math.min(nodesPerRack, remaining);
            racks.push({ nodes: rackNodes, tor: rackNodes > 1 ? 2 : 1 });
            remaining -= rackNodes;
        }
    } else if (isRackAware) {
        const half = Math.ceil(nodeCount / 2);
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
        const svgImg = new Image();
        svgImg.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(svgImg, 0, 0, 256, 256);
            const tex = new THREE.CanvasTexture(canvas);
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
        let resizeTimeout;
        const ro = new ResizeObserver(function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                const w = canvasEl.clientWidth;
                const h = canvasEl.clientHeight;
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
                const entry = entries[0];
                if (!entry) return;
                _rack3d.visible = !!entry.isIntersecting;
                if (_rack3d.visible && _rack3d.animId === null) {
                    animate();
                }
            }, { threshold: 0.01 });
            _rack3d.intersectionObserver.observe(canvasEl);
        }

        // Animation loop (pauses when not visible)
        const animate = function() {
            if (!_rack3d.visible) {
                _rack3d.animId = null;
                return;
            }
            _rack3d.animId = requestAnimationFrame(animate);
            _rack3d.controls.update();
            _rack3d.renderer.render(_rack3d.scene, _rack3d.camera);
        };
        animate();
        _rack3d.initialized = true;
    }

    // Clear previous scene contents
    clearScene(_rack3d.scene);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    _rack3d.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 2);
    _rack3d.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1, -1);
    _rack3d.scene.add(fillLight);

    // Floor plane — scale for multi-rack disaggregated layouts.
    // Two-row layouts (5+ racks) use ceil(N/2) racks per row and need a
    // larger, more square floor so both rows fit with margin on all sides.
    let floorSize;
    if (config.clusterType === 'disaggregated' && rackCount > 4) {
        const perRow = Math.ceil(rackCount / 2);
        floorSize = Math.max(4 + perRow * 2, 4 + rackCount); // accommodate both rows
    } else {
        floorSize = rackCount > 2 ? 4 + rackCount * 2 : (rackCount === 2 ? 8 : 6);
    }
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.FLOOR, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    _rack3d.scene.add(floor);

    // Build racks
    // Two-row layout for disaggregated when rackCount > 4. Back row gets the
    // larger half (ceil(N/2)), front row gets the rest. Hot aisle runs between.
    const useTwoRows = isDisaggregated && rackCount > 4;
    const ROW_Z_GAP = RACK.DEPTH * 1.6; // distance between row centers (hot aisle)
    const rackPositions = [];
    let startX; // Used by standard/rack-aware single-row helpers below
    if (useTwoRows) {
        const backCount = Math.ceil(rackCount / 2);
        const frontCount = rackCount - backCount;
        const backWidth = backCount * RACK.WIDTH + (backCount - 1) * RACK.GAP_BETWEEN;
        const frontWidth = frontCount * RACK.WIDTH + (frontCount - 1) * RACK.GAP_BETWEEN;
        const backStartX = -backWidth / 2 + RACK.WIDTH / 2;
        const frontStartX = -frontWidth / 2 + RACK.WIDTH / 2;
        const backZ = -ROW_Z_GAP / 2;
        const frontZ = ROW_Z_GAP / 2;
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
        const totalWidth = rackCount * RACK.WIDTH + (rackCount - 1) * RACK.GAP_BETWEEN;
        startX = -totalWidth / 2 + RACK.WIDTH / 2;
        for (let si = 0; si < rackCount; si++) {
            // Keep original reverse-build convention so Rack 1 appears on viewer's left
            const rackIndex = (isRackAware || isDisaggregated) ? (rackCount - 1 - si) : si;
            rackPositions.push({
                x: startX + si * (RACK.WIDTH + RACK.GAP_BETWEEN),
                z: 0,
                rackIndex: rackIndex,
                facing: 1
            });
        }
    }

    // Reset legend items to standard rack view
    const stdLegendReset = {
        'legend-server-node': true,
        'legend-tor-switch': true,
        'legend-bmc-switch': true,
        'legend-core-router': true,
        'legend-mgmt-compute': true
    };
    Object.keys(stdLegendReset).forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = stdLegendReset[id] ? '' : 'none';
    });

    // Restore standard info text
    const infoText = document.getElementById('rack-viz-info-text');
    if (infoText) {
        const twoRowNote = useTwoRows
            ? '<br><span style="color: var(--accent-blue);">Multi-row layout: racks are arranged in two rows for 5+ rack deployments, with the back row rotated 180° so server exhausts from both rows face each other into a shared hot aisle (hot-aisle / cold-aisle orientation).</span>'
            : '';
        const disaggSanNote = isDisaggregated
            ? '<br><br>Note: Each rack has a \'SAN appliance\' shown for graphical representation, in practice your SAN array will be consolidated in a separate rack(s), this is for illustration purposes only.'
            : '';
        infoText.innerHTML = 'Interactive 3D preview of the estimated rack layout. Each server machine occupies 2U, ToR switches occupy 1U each. The cables from each machine to the ToR switches are not shown.<br><span id="rack-viz-rackaware-note" style="display:none;">Rack-aware deployments show balanced distribution of machines across two cabinets, in real deployments these can be in separate rooms or datacenter locations.<br></span>' + twoRowNote + disaggSanNote + '<br>⚠️ This is an approximate representation only, contact your preferred hardware OEM partner for detailed physical space requirements for their Azure Local solutions.';
    }

    for (let r = 0; r < rackCount; r++) {
        const pos = rackPositions[r];
        const rackIndex = pos.rackIndex;
        const offsetX = pos.x;
        const offsetZ = pos.z;
        const facing = pos.facing || 1;
        const rack = buildRackFrame(_rack3d.scene, offsetX, offsetZ, facing);
        const rackInfo = racks[rackIndex];

        // Place ToR switches at top of rack (U41, U42)
        for (let t = 0; t < rackInfo.tor; t++) {
            const torU = RACK.TOTAL_U - t; // 42, 41
            const torNum = (isRackAware || isDisaggregated) ? (rackIndex * 2 + t + 1) : (t + 1);
            const torLabel = 'ToR ' + torNum;
            placeSwitch(rack.group, rack.baseY, torU, torLabel);
        }

        // Place BMC switch below ToR switches (1U)
        const bmcU = RACK.TOTAL_U - rackInfo.tor;
        const bmcNum = (isRackAware || isDisaggregated) ? (rackIndex + 1) : 1;
        const bmcLabel = 'BMC ' + bmcNum;
        placeBmcSwitch(rack.group, rack.baseY, bmcU, bmcLabel);

        // Place FC switches for disaggregated + Fibre Channel (2 per rack, below BMC)
        let fcSwitchCount = 0;
        if (isDisaggregated && config.disaggStorageType === 'fc_san') {
            fcSwitchCount = 2;
            const fcBaseU = bmcU - 1;
            for (let fc = 0; fc < fcSwitchCount; fc++) {
                const fcU = fcBaseU - fc;
                const fcNum = (rackIndex * 2) + fc + 1;
                const fcLabel = 'Fibre Channel ' + fcNum;
                placeFcSwitch(rack.group, rack.baseY, fcU, fcLabel);
            }
        }

        // Place SAN Appliance at bottom of rack for disaggregated (5U, positions U1-U5)
        let sanApplianceU = 0;
        if (isDisaggregated) {
            sanApplianceU = 5;
            placeSanAppliance(rack.group, rack.baseY, 1, 'SAN Appliance');
        }

        // Place server nodes filling the rack bottom-up (datacentre practice —
        // heavy servers low, switches stay at the top). The first node sits at the
        // lowest free U above any SAN appliance and each node stacks upward.
        const topServerU = RACK.TOTAL_U - rackInfo.tor - 1 - fcSwitchCount; // highest U below switches + BMC + FC
        // placeServer() is called with (serverStartU - 1), so a server occupies real
        // U (serverStartU-1)..(serverStartU). When a 5U SAN appliance sits at U1-U5,
        // the first server must start at serverStartU = sanApplianceU + 2 so its
        // bottom (serverStartU-1) lands at U6 — directly on top of the SAN, not
        // overlapping its top U. Standard racks (no SAN) keep the original bottom of 1.
        const bottomLimit = sanApplianceU > 0 ? sanApplianceU + 2 : 1; // don't overlap SAN appliance at bottom
        let nodeOffset = 0;
        for (let pr = 0; pr < rackIndex; pr++) { nodeOffset += racks[pr].nodes; }
        for (let n = 0; n < rackInfo.nodes; n++) {
            const serverStartU = bottomLimit + (n * 2); // 2U per server, bottom-up
            if (serverStartU > topServerU) break;
            const color = COLORS.SERVER;
            const nodeLabel = 'Machine ' + (nodeOffset + n + 1);
            placeServer(rack.group, rack.baseY, serverStartU - 1, color,
                nodeLabel, false, config.diskCount || 8, config.portCount || 4);
        }

        // Rack label above (just above the rack frame, below the core router).
        // Always place on the camera-facing (-Z) side of the rack so viewers
        // can see the label for both rows in the two-row hot-aisle layout.
        const rackLabel = (isRackAware || isDisaggregated) ? 'Rack ' + (rackIndex + 1) : '42U Rack';
        const labelY = RACK.OUTER_HEIGHT + 0.08;
        const rackSprite = makeTextSprite(rackLabel, 28, '#ffffff');
        rackSprite.position.set(offsetX - RACK.WIDTH / 2, labelY, offsetZ - RACK.DEPTH / 2);
        rackSprite.scale.set(0.5, 0.12, 1);
        _rack3d.scene.add(rackSprite);
    }

    // Core network for rack-aware and disaggregated topologies
    if (isRackAware || isDisaggregated) {
        // For two-row layouts: center the spine over the hot aisle by using the
        // min/max X across all rack positions so the spine sits above the centroid.
        let minRackX = rackPositions[0].x;
        let maxRackX = rackPositions[0].x;
        for (let rp = 1; rp < rackPositions.length; rp++) {
            if (rackPositions[rp].x < minRackX) minRackX = rackPositions[rp].x;
            if (rackPositions[rp].x > maxRackX) maxRackX = rackPositions[rp].x;
        }
        const spineCount = config.spineCount || 2;
        placeCoreNetwork(_rack3d.scene, minRackX, maxRackX, spineCount, rackCount, startX, isDisaggregated, rackPositions);
    } else {
        // Core switch/router for standard (single-rack) clusters
        placeStandardCoreNetwork(_rack3d.scene, startX, torPerRack, nodeCount);
    }

    // LAG cables for standard (non-rack-aware, non-disaggregated) clusters with 2 ToRs
    if (!isRackAware && !isDisaggregated && torPerRack >= 2) {
        const stdTorDeviceH = 1 * RACK.U_HEIGHT - 0.004;
        const stdTor1Y = 0.06 + (42 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
        const stdTor2Y = 0.06 + (41 - 1) * RACK.U_HEIGHT + stdTorDeviceH / 2 + 0.002;
        const stdSwitchDepth = RACK.DEPTH - RACK.POST_SIZE * 2 - 0.06;
        const stdTorBackZ = stdSwitchDepth / 2 + 0.006;
        const stdLagMat = new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.8 });
        const stdRackX = startX;
        const stdLag1Geo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(stdRackX + 0.10, stdTor1Y, stdTorBackZ),
                new THREE.Vector3(stdRackX + 0.10, stdTor2Y, stdTorBackZ)
            ), 2, 0.003, 6, false
        );
        _rack3d.scene.add(new THREE.Mesh(stdLag1Geo, stdLagMat));
        const stdLag2Geo = new THREE.TubeGeometry(
            new THREE.LineCurve3(
                new THREE.Vector3(stdRackX + 0.13, stdTor1Y, stdTorBackZ),
                new THREE.Vector3(stdRackX + 0.13, stdTor2Y, stdTorBackZ)
            ), 2, 0.003, 6, false
        );
        _rack3d.scene.add(new THREE.Mesh(stdLag2Geo, stdLagMat));
        const stdLagLabel = makeTextSprite('LAG', 12, '#ff9933');
        stdLagLabel.position.set(stdRackX + 0.115, (stdTor1Y + stdTor2Y) / 2, stdTorBackZ + 0.03);
        stdLagLabel.scale.set(0.14, 0.04, 1);
        _rack3d.scene.add(stdLagLabel);
    }

    // Camera position — front-left, tight on rack body (minimal floor)
    let camDist, camTargetY;
    if (isRackAware || isDisaggregated) {
        // Front view, slightly elevated — scale camera distance with rack count
        const spCount = config.spineCount || 2;
        const spineH = RACK.U_HEIGHT * 1.5;
        const spineGapH = spineH * 0.4;
        const routerTopY = RACK.OUTER_HEIGHT + 0.35 + (spCount - 1) * (spineH + spineGapH) + spineH / 2 + 0.05;
        if (useTwoRows) {
            // 5–8 racks in two rows: pull camera back and up, square-ish floor
            const perRowCam = Math.ceil(rackCount / 2);
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
            // 2 racks (rack-aware). Nodes now fill bottom-up, so zoom out and
            // raise the look-at target so the whole rack — bottom server nodes
            // through the core switch above the rack — sits in frame on load,
            // with a flatter (more eye-level) tilt.
            camDist = 2.9;
            camTargetY = RACK.OUTER_HEIGHT * 0.62;
            _rack3d.camera.position.set(1.5, routerTopY * 1.0, -camDist);
        }
        // Bump camera distance for 4-spine to fit the taller stack
        if (spCount >= 4) camDist += 0.3;
    } else {
        // Single rack: fixed framing so the full 42U rack body (plus core
        // switch above) is always in view on load, regardless of how many
        // server nodes are populated. Users can still scroll to zoom in.
        const stdRouterTopY = RACK.OUTER_HEIGHT + 0.35 + 0.05;
        camDist = 3.2;
        camTargetY = RACK.OUTER_HEIGHT * 0.62;
        _rack3d.camera.position.set(1.4, stdRouterTopY * 1.0, -camDist * 0.92);
    }
    _rack3d.controls.target.set(0, camTargetY, 0);
    _rack3d.controls.update();

    // Update legend text
    const usedU = document.getElementById('rack-viz-used-u');
    const totalU = document.getElementById('rack-viz-total-u');
    if (usedU && totalU) {
        const nodesU = nodeCount * 2;
        const switchesU = torPerRack * rackCount;
        const bmcU_count = rackCount; // 1 BMC switch per rack
        usedU.textContent = (nodesU + switchesU + bmcU_count) + 'U used';
        totalU.textContent = (RACK.TOTAL_U * rackCount) + 'U total';
    }

    // Toggle rack-aware note visibility
    const rackAwareNote = document.getElementById('rack-viz-rackaware-note');
    if (rackAwareNote) {
        rackAwareNote.style.display = (isRackAware || isDisaggregated) ? 'inline' : 'none';
    }
}

// ── Toggle collapse ──────────────────────────

/* exported toggleRackViz */
function toggleRackViz() {
    const container = document.getElementById('rack-viz-container');
    const arrow = document.getElementById('rack-viz-toggle-arrow');
    if (!container) return;
    const isCollapsed = container.classList.toggle('collapsed');
    if (arrow) {
        arrow.classList.toggle('collapsed', isCollapsed);
    }
}
