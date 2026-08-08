import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PlayerSettings } from './PlayerSettings.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        if (this.game && this.game.input) {
            this.game.input.uiManager = this;
        }

        // PERAN DEFAULT OTOMATIS: PLAYER
        this.currentRole = 'player';
        this.isEditorMode = false;
        this.activeEditorTool = 1;
        this.editorBrushSize = 5.0;
        this.draggedAsset = null;
        this.isCursorOnlyMode = false;

        this.assetCategories = { alam: [], rumah: [], kendaraan: [], senjata: [] };
        this.activeCategory = 'alam';

        this.savedAssetsData = {};
        this.savedAssetsThumbnails = {};
        this.hotbarAssetNames = [];
        this.activeHotbarIndex = -1; 

        this.savedTexturesList = [];
        this.activeTextureIndex = -1;
        this.currentCustomTextureImage = null;

        this.hotbarScrollOffset = 0;
        this.textureScrollOffset = 0;

        this.brushMinScale = 0.8;
        this.brushMaxScale = 1.5;
        this.brushDensity = 5;
        this.selectedBrushAssets = []; 

        this.thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.thumbRenderer.setSize(80, 80);

        this.playerSettings = new PlayerSettings(this.game, this);

        this.initLoadingScreenUI();
        this.initFPSCompassUI();
        this.initBrushMarker();
        this.initUIEvents();
        this.initEditorHotkeys();
        this.initDropZones();
        this.initDefaultTextures();
        
        // UPDATE: Inisialisasi UI Stamina
        this.initStaminaHUD();

        this.autoLoadCategoryModels();

        setTimeout(() => {
            if (this.game && this.game.input && this.game.input.controlType === 'mobile' && this.game.input.mobileController) {
                this.game.input.mobileController.layoutEditor.applyLayout();
            }
        }, 100);
    }

    initStaminaHUD() {
        const container = document.createElement('div');
        container.id = 'stamina-container';
        container.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            width: 250px; height: 10px; background: rgba(0,0,0,0.6);
            border-radius: 5px; border: 2px solid #222; z-index: 8000;
            transition: opacity 0.3s; opacity: 0; pointer-events: none;
        `;

        const fill = document.createElement('div');
        fill.id = 'stamina-fill';
        fill.style.cssText = `
            width: 100%; height: 100%; background: linear-gradient(90deg, #f59e0b, #facc15);
            border-radius: 3px; transition: width 0.1s linear;
        `;

        container.appendChild(fill);
        document.body.appendChild(container);
    }

    initLoadingScreenUI() {
        this.loadingScreen = document.getElementById('game-loading-screen');
        this.loadingTaskName = document.getElementById('loading-task-name');
        this.loadingPercentText = document.getElementById('loading-percent-text');
        this.loadingBarFill = document.getElementById('loading-bar-fill');
        this.loadingTips = document.getElementById('loading-tips');

        const tipsList = [
            "Tips: Buka menu Pengaturan > Pengembangan untuk mengakses fitur World Editor!",
            "Tips: Tekan tombol [ ~ ] untuk melepaskan kursor mouse secara instan.",
            "Tips: Tahan tombol SHIFT saat berlari untuk berpindah posisi lebih cepat!",
            "Tips: Tekan tombol [ TAB ] untuk melihat Peta Kota Luas (Expanded Map)."
        ];

        let tipIndex = 0;
        setInterval(() => {
            if (this.loadingTips) {
                tipIndex = (tipIndex + 1) % tipsList.length;
                this.loadingTips.innerText = tipsList[tipIndex];
            }
        }, 4000);
    }

    updateLoadingProgress(percent, rawUrlOrName = "") {
        let cleanText = "Memuat Aset Dunia...";
        const lower = rawUrlOrName.toLowerCase();

        if (lower.includes("main_map") || lower.includes("map")) {
            cleanText = "Memuat: Map Utama...";
        } else if (lower.includes("karakter") || lower.includes("gensin")) {
            cleanText = "Memuat: Karakter Pemain...";
        } else if (lower.includes("texture") || lower.includes("png") || lower.includes("jpg")) {
            cleanText = "Memuat: Tekstur...";
        } else if (rawUrlOrName.length > 0) {
            cleanText = "Memuat: Aset Dunia...";
        }

        if (this.loadingTaskName) this.loadingTaskName.innerText = cleanText;
        if (this.loadingPercentText) this.loadingPercentText.innerText = `${Math.round(percent)}%`;
        if (this.loadingBarFill) this.loadingBarFill.style.width = `${percent}%`;
    }

    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.updateLoadingProgress(100, "Siap Dimulai!");
            setTimeout(() => {
                this.loadingScreen.classList.add('fade-out');
                this.showAnnouncementModal();
            }, 600);
        }
    }

    showAnnouncementModal() {
        const annModal = document.getElementById('announcement-modal');
        if (annModal) {
            annModal.style.display = 'flex';
        }
    }

    initFPSCompassUI() {
        const style = document.createElement('style');
        style.innerHTML = `
            #hud-coords { display: none !important; }
            .minimap-compass, .compass-label, .minimap-dir, 
            #compass-n, #compass-e, #compass-s, #compass-w { display: none !important; }
        `;
        document.head.appendChild(style);
        
        const oldCoords = document.getElementById('hud-coords');
        if (oldCoords) oldCoords.style.display = 'none';

        this.compassContainer = document.createElement('div');
        this.compassContainer.id = 'fps-compass-hud';
        this.compassContainer.style.cssText = `
            position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
            display: flex; flex-direction: column; align-items: center; gap: 2px;
            z-index: 9000; pointer-events: none; font-family: 'Segoe UI', Roboto, monospace;
        `;

        this.compassCanvas = document.createElement('canvas');
        this.compassCanvas.width = 700;
        this.compassCanvas.height = 30;
        this.compassCtx = this.compassCanvas.getContext('2d');

        this.coordsDisplay = document.createElement('div');
        this.coordsDisplay.style.cssText = `
            font-size: 12px; font-weight: 800; color: #e2e8f0; letter-spacing: 1.5px;
            text-shadow: 0px 1px 2px rgba(0, 0, 0, 1), 0px 0px 4px rgba(0, 0, 0, 0.8);
        `;
        this.coordsDisplay.innerText = 'X: 0   Y: 0   Z: 0';

        this.compassContainer.appendChild(this.compassCanvas);
        this.compassContainer.appendChild(this.coordsDisplay);
        document.body.appendChild(this.compassContainer);
    }

    updateFPSCompass(cameraAngle, px, py, pz) {
        if (!this.compassCtx) return;
        if (this.coordsDisplay) this.coordsDisplay.innerText = `X: ${px}   Y: ${py}   Z: ${pz}`;

        const ctx = this.compassCtx;
        const width = this.compassCanvas.width;
        const height = this.compassCanvas.height;
        const centerX = width / 2;

        ctx.clearRect(0, 0, width, height);

        let headingDeg = (-cameraAngle * (180 / Math.PI)) % 360;
        if (headingDeg < 0) headingDeg += 360;

        const fovDegrees = 90; 
        const pixelsPerDegree = width / fovDegrees;
        const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

        const startDeg = Math.floor((headingDeg - fovDegrees / 2) / 5) * 5;
        const endDeg = Math.ceil((headingDeg + fovDegrees / 2) / 5) * 5;

        for (let deg = startDeg; deg <= endDeg; deg += 5) {
            let normalizedDeg = ((deg % 360) + 360) % 360;
            let diff = deg - headingDeg;
            let x = centerX + diff * pixelsPerDegree;

            if (x >= 0 && x <= width) {
                const isMajor = (normalizedDeg % 45 === 0);
                const isMedium = (normalizedDeg % 15 === 0) && !isMajor;
                
                let tickHeight = 3, strokeAlpha = 0.3, lineWidth = 1;

                if (isMajor) { tickHeight = 8; strokeAlpha = 1.0; lineWidth = 2; } 
                else if (isMedium) { tickHeight = 5; strokeAlpha = 0.6; lineWidth = 1.5; }

                ctx.shadowColor = 'rgba(0, 0, 0, 1)';
                ctx.shadowBlur = 3;
                
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${strokeAlpha})`;
                ctx.lineWidth = lineWidth;
                ctx.moveTo(x, height - 2 - tickHeight);
                ctx.lineTo(x, height - 2);
                ctx.stroke();

                if (isMajor) {
                    const label = labels[normalizedDeg] || `${normalizedDeg}°`;
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = (label === 'N') ? '#ef4444' : '#f8fafc';
                    ctx.fillText(label, x, height - 2 - tickHeight - 4);
                }
            }
        }

        ctx.beginPath();
        ctx.shadowColor = 'rgba(0, 0, 0, 1)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#f59e0b';
        ctx.moveTo(centerX - 5, height);
        ctx.lineTo(centerX + 5, height);
        ctx.lineTo(centerX, height - 5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0; 
    }

    async autoLoadCategoryModels() {
        const modelModules = import.meta.glob([
            '/src/models/**/*.{glb,gltf,fbx}', '/src/assets/models/**/*.{glb,gltf,fbx}', '/public/assets/models/**/*.{glb,gltf,fbx}'
        ], { eager: true, query: '?url', import: 'default' });

        const queue = [];
        for (const path in modelModules) {
            const url = modelModules[path];
            const parts = path.split('/');
            const fileName = parts.pop();
            const category = parts.pop().toLowerCase();
            if (!this.assetCategories[category]) this.assetCategories[category] = [];
            queue.push({ url, fileName, category });
        }

        if (queue.length > 0) {
            let loadedCount = 0;
            for (const item of queue) {
                await this.loadModelFromUrlAsync(item.url, item.fileName, item.category);
                loadedCount++;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            console.log(`[AssetLoader] Sistem berhasil memindai dan memuat ${loadedCount} file model 3D.`);
        }
    }

    loadModelFromUrlAsync(url, fileName, category) {
        return new Promise((resolve) => {
            const ext = fileName.split('.').pop().toLowerCase();
            if (ext === 'fbx') {
                const loader = new FBXLoader();
                loader.load(url, (fbx) => { this.saveAssetToCategory(fbx, fileName, category); resolve(); }, undefined, (err) => { console.error(err); resolve(); });
            } else {
                const loader = new GLTFLoader();
                loader.load(url, (gltf) => { this.saveAssetToCategory(gltf.scene, fileName, category); resolve(); }, undefined, (err) => { console.error(err); resolve(); });
            }
        });
    }

    saveAssetToCategory(modelScene, fileName, category) {
        modelScene.updateMatrixWorld(true);
        if (this.game && this.game.player) this.game.player.applyMaterialFixes(modelScene, fileName);

        const boxScale = new THREE.Box3().setFromObject(modelScene);
        if (!boxScale.isEmpty()) {
            const size = boxScale.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 50 || (maxDim < 0.2 && maxDim > 0)) {
                const normScale = 3.0 / maxDim;
                modelScene.scale.multiplyScalar(normScale);
                modelScene.updateMatrixWorld(true);
            }
        }

        const boxPivot = new THREE.Box3().setFromObject(modelScene);
        if (!boxPivot.isEmpty()) {
            const center = boxPivot.getCenter(new THREE.Vector3());
            const bottomY = boxPivot.min.y;
            modelScene.position.set(-center.x, -bottomY, -center.z);
            modelScene.updateMatrixWorld(true);
        }

        const wrapper = new THREE.Group();
        wrapper.name = fileName; 
        wrapper.add(modelScene);

        this.savedAssetsData[fileName] = wrapper;
        this.savedAssetsThumbnails[fileName] = this.generateThumbnail(wrapper);

        if (!this.assetCategories[category]) this.assetCategories[category] = [];
        if (!this.assetCategories[category].includes(fileName)) this.assetCategories[category].push(fileName);
        if (!this.assetCategories[this.activeCategory] || this.assetCategories[this.activeCategory].length === 0) this.activeCategory = category;

        this.syncHotbarAssetNames();
        this.renderHotbar();
    }

    syncHotbarAssetNames() {
        this.hotbarAssetNames = this.assetCategories[this.activeCategory] || [];
        this.hotbarScrollOffset = 0; 
    }

    renderCategoryBar() {
        const bar = document.getElementById('category-bar');
        if (!bar) return;
        bar.innerHTML = '';
        const categories = Object.keys(this.assetCategories).filter(cat => this.assetCategories[cat].length > 0);
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn' + (this.activeCategory === cat ? ' active' : '');
            btn.innerText = cat;
            btn.onclick = (e) => { e.stopPropagation(); this.activeCategory = cat; this.syncHotbarAssetNames(); this.renderCategoryBar(); this.renderHotbar(); };
            bar.appendChild(btn);
        });
    }

    initDefaultTextures() {
        const defaultTextures = [{ name: 'Tekstur Batu', path: '/assets/textures/rock_texture.png' }, { name: 'Rumput Dasar', path: '/assets/textures/ground_base.png' }];
        defaultTextures.forEach((tex) => {
            const img = new Image();
            img.src = tex.path;
            img.onload = () => {
                if (!this.savedTexturesList.some(item => item.url === tex.path)) this.savedTexturesList.push({ name: tex.name, url: tex.path, image: img });
                if (!this.currentCustomTextureImage) { this.currentCustomTextureImage = img; this.activeTextureIndex = -1; }
                this.renderTextureGallery();
                this.renderHotbar();
            };
        });
    }

    initBrushMarker() {
        const ringGeo = new THREE.RingGeometry(0.8, 1, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
        this.brushRingMesh = new THREE.Mesh(ringGeo, ringMat);
        this.brushRingMesh.visible = false;
        this.game.engine.scene.add(this.brushRingMesh);
    }

    pauseGame() {
        const blocker = document.getElementById('blocker');
        const btnToggleMode = document.getElementById('btn-toggle-mode');
        const editorHud = document.getElementById('editor-hud');
        const hotbar = document.getElementById('hotbar-container');
        const categoryBar = document.getElementById('category-bar');

        if (blocker) {
            blocker.style.display = 'flex';
            blocker.style.zIndex = '99999'; 
        }

        if (this.game && this.game.input && this.game.input.mobileController && this.game.input.controlType === 'mobile') {
            this.game.input.mobileController.uiContainer.style.display = 'none';
        }

        if (btnToggleMode) btnToggleMode.style.display = (this.currentRole === 'developer') ? 'block' : 'none';
        if (editorHud) editorHud.style.display = 'none';
        if (hotbar) hotbar.style.display = 'none';
        if (categoryBar) categoryBar.style.display = 'none';
        if (this.brushRingMesh) this.brushRingMesh.visible = false;

        this.playerSettings.updateUIMode();
        this.playerSettings.modal.style.display = 'flex';
    }

    resumeGame() {
        this.isCursorOnlyMode = false;

        const annModal = document.getElementById('announcement-modal');
        if (annModal) annModal.style.display = 'none';
        
        if (this.game && this.game.input && this.game.input.controlType === 'mobile') {
            document.getElementById('blocker').style.display = 'none';
            document.getElementById('btn-toggle-mode').style.display = 'none';
            this.playerSettings.modal.style.display = 'none';
            
            this.game.input.mobileController.uiContainer.style.display = 'block';
            
            if (this.isEditorMode && this.currentRole === 'developer') {
                const hud = document.getElementById('editor-hud');
                if (hud) hud.style.display = 'block';
            }
            this.updateEditorHudColors();
            this.renderHotbar();
        } else {
            const blocker = document.getElementById('blocker');
            if (blocker) blocker.style.display = 'none';
            this.playerSettings.modal.style.display = 'none';
            document.body.requestPointerLock().catch(() => {});
        }
    }

    initUIEvents() {
        const blocker = document.getElementById('blocker');
        this.playerSettings.mount(blocker);

        const btnToggleMode = document.getElementById('btn-toggle-mode');
        const editorHud = document.getElementById('editor-hud');
        const hotbar = document.getElementById('hotbar-container');
        const categoryBar = document.getElementById('category-bar');

        const btnCloseAnn = document.getElementById('btn-close-announcement');
        if (btnCloseAnn) {
            btnCloseAnn.onclick = (e) => {
                e.stopPropagation();
                this.resumeGame();
            };
        }

        const selTimeCycle = document.getElementById('sel-time-cycle');
        if (selTimeCycle) {
            selTimeCycle.onchange = (e) => {
                if (this.game && this.game.timeCycle) {
                    this.game.timeCycle.timeMode = e.target.value;
                }
            };
        }

        const selControlType = document.getElementById('sel-control-type');
        if (selControlType) {
            selControlType.onchange = (e) => {
                if (this.game && this.game.input) {
                    this.game.input.setControlType(e.target.value);
                }
            };
        }

        if (editorHud && !document.getElementById('info-tool-6')) {
            const hr = editorHud.querySelector('hr');
            const tool6 = document.createElement('p');
            tool6.className = 'tool-info';
            tool6.id = 'info-tool-6';
            tool6.innerHTML = '[ 6 ] Kuas Vegetasi <span class="hint-text">Tahan Kiri: Sebar acak asset di area kuas.</span>';
            editorHud.insertBefore(tool6, hr);

            const tool6Config = document.createElement('div');
            tool6Config.id = 'tool-6-config';
            tool6Config.style.cssText = 'display:none; margin-top:10px; font-size:11px; background:rgba(0,0,0,0.6); padding:10px; border-radius:5px; border:1px solid #4CAF50; pointer-events:auto;';
            tool6Config.innerHTML = `
                <div style="color:#4CAF50; margin-bottom:5px; font-weight:bold;">⚙️ Setting Kuas Vegetasi</div>
                <label style="display:block; margin-bottom:4px;">Skala Min: <span id="val-smin">${this.brushMinScale}</span><input type="range" id="b-smin" min="0.1" max="4.0" step="0.1" value="${this.brushMinScale}" style="width:100%;"></label>
                <label style="display:block; margin-bottom:4px;">Skala Max: <span id="val-smax">${this.brushMaxScale}</span><input type="range" id="b-smax" min="0.1" max="4.0" step="0.1" value="${this.brushMaxScale}" style="width:100%;"></label>
                <label style="display:block; margin-bottom:4px;">Kepadatan Rumput: <span id="val-den">${this.brushDensity}</span><input type="range" id="b-den" min="1" max="50" step="1" value="${this.brushDensity}" style="width:100%;"></label>
                <div style="color:#ffcc00; font-size:9px; margin-top:5px; line-height:1.2;">*Pencet ( \` ) buat lepas kursor.<br>*Klik di Hotbar buat Multi-Select!</div>
            `;
            editorHud.appendChild(tool6Config);

            document.getElementById('b-smin').oninput = (e) => { this.brushMinScale = parseFloat(e.target.value); document.getElementById('val-smin').innerText = e.target.value; };
            document.getElementById('b-smax').oninput = (e) => { this.brushMaxScale = parseFloat(e.target.value); document.getElementById('val-smax').innerText = e.target.value; };
            document.getElementById('b-den').oninput = (e) => { this.brushDensity = parseInt(e.target.value); document.getElementById('val-den').innerText = e.target.value; };
        }

        document.addEventListener('openMobileMenu', () => {
            this.pauseGame();
        });

        if (btnToggleMode) {
            btnToggleMode.onclick = () => {
                this.isEditorMode = !this.isEditorMode;
                if (this.isEditorMode) {
                    btnToggleMode.innerHTML = "🛠️ MODE: EDITOR (Klik untuk ubah)";
                    btnToggleMode.classList.add('editor-active');
                } else {
                    btnToggleMode.innerHTML = "🎮 MODE: BERMAIN (Klik untuk ubah)";
                    btnToggleMode.classList.remove('editor-active');
                    editorHud.style.display = 'none';
                    hotbar.style.display = 'none';
                    if (categoryBar) categoryBar.style.display = 'none';
                    this.brushRingMesh.visible = false;
                }
                this.updateEditorHudColors();
                this.renderHotbar();
            };
        }

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote' || e.key === '`') {
                if (document.pointerLockElement === document.body) {
                    this.isCursorOnlyMode = true;
                    document.exitPointerLock();
                } else {
                    this.isCursorOnlyMode = false;
                    document.body.requestPointerLock().catch(() => {});
                }
            }
        });

        if (blocker) {
            blocker.onclick = (e) => {
                const annModal = document.getElementById('announcement-modal');
                if ((annModal && annModal.contains(e.target)) || this.playerSettings.modal.contains(e.target)) return;
                this.resumeGame();
            };
        }

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                this.isCursorOnlyMode = false;
                if (blocker) blocker.style.display = 'none';
                if (btnToggleMode) btnToggleMode.style.display = 'none';
                
                this.playerSettings.modal.style.display = 'none';

                if (this.isEditorMode && this.currentRole === 'developer') editorHud.style.display = 'block';
                this.updateEditorHudColors();
                this.renderHotbar();
            } else {
                if (this.isCursorOnlyMode) {
                    if (blocker) blocker.style.display = 'none';
                    if (btnToggleMode) btnToggleMode.style.display = (this.currentRole === 'developer') ? 'block' : 'none';
                } else {
                    const annModal = document.getElementById('announcement-modal');
                    if (!annModal || annModal.style.display !== 'flex') {
                        this.pauseGame();
                    }
                }
            }
        });
    }

    closeSettings() {
        this.resumeGame(); 
    }

    initEditorHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (!this.isEditorMode || this.currentRole !== 'developer') return;
            const key = e.key.toLowerCase();

            if (['1', '2', '3', '4', '5', '6'].includes(key)) {
                this.activeEditorTool = parseInt(key);
                this.updateEditorHudColors();
                this.renderHotbar();
            }

            if (key === '[' || e.key === '[') this.editorBrushSize = Math.max(1.0, this.editorBrushSize - 1.0);
            if (key === ']' || e.key === ']') this.editorBrushSize = Math.min(20.0, this.editorBrushSize + 1.0);

            if (key === 'q') {
                if ((this.activeEditorTool === 3 || this.activeEditorTool === 6) && this.hotbarAssetNames.length > 0) {
                    let maxScroll = Math.max(0, this.hotbarAssetNames.length - 10);
                    this.hotbarScrollOffset--;
                    if (this.hotbarScrollOffset < 0) this.hotbarScrollOffset = maxScroll;
                    this.renderHotbar();
                } else if (this.activeEditorTool === 5 && this.savedTexturesList.length > 0) {
                    let maxScroll = Math.max(0, this.savedTexturesList.length - 10);
                    this.textureScrollOffset--;
                    if (this.textureScrollOffset < 0) this.textureScrollOffset = maxScroll;
                    this.renderHotbar();
                }
            }

            if (key === 'e') {
                if ((this.activeEditorTool === 3 || this.activeEditorTool === 6) && this.hotbarAssetNames.length > 0) {
                    let maxScroll = Math.max(0, this.hotbarAssetNames.length - 10);
                    this.hotbarScrollOffset++;
                    if (this.hotbarScrollOffset > maxScroll) this.hotbarScrollOffset = 0;
                    this.renderHotbar();
                } else if (this.activeEditorTool === 5 && this.savedTexturesList.length > 0) {
                    let maxScroll = Math.max(0, this.savedTexturesList.length - 10);
                    this.textureScrollOffset++;
                    if (this.textureScrollOffset > maxScroll) this.textureScrollOffset = 0;
                    this.renderHotbar();
                }
            }
        });
    }

    updateEditorHudColors() {
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById('info-tool-' + i);
            if (el) el.className = (this.activeEditorTool === i) ? 'tool-active' : 'tool-info';
        }

        const categoryBar = document.getElementById('category-bar');
        if (categoryBar) categoryBar.style.display = ((this.activeEditorTool === 3 || this.activeEditorTool === 6) && this.isEditorMode && (document.pointerLockElement === document.body || this.isCursorOnlyMode)) ? 'flex' : 'none';

        const t6Config = document.getElementById('tool-6-config');
        if (t6Config) t6Config.style.display = (this.activeEditorTool === 6 && this.isEditorMode) ? 'block' : 'none';
    }

    setRole(role) {
        this.currentRole = role;
        const btnToggleMode = document.getElementById('btn-toggle-mode');

        if (role === 'player') {
            if (btnToggleMode) btnToggleMode.style.display = 'none';
            this.isEditorMode = false;
        } else {
            if (btnToggleMode) btnToggleMode.style.display = 'block';
        }

        this.updateEditorHudColors();
        this.renderHotbar();
    }

    initDropZones() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => document.body.addEventListener(evt, (e) => e.preventDefault()));
        this.setupDropZone('drop-zone-karakter', 'karakter', '.glb,.gltf');
        this.setupDropZone('drop-zone-assets', 'asset-gltf', '.glb,.gltf');
        this.setupDropZone('drop-zone-fbx', 'asset-fbx', '.fbx');
        this.setupDropZoneTexture();
    }

    setupDropZone(zoneId, type, acceptFormat) {
        const dropZone = document.getElementById(zoneId);
        if (!dropZone) return;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = acceptFormat;
        fileInput.style.display = 'none';
        dropZone.appendChild(fileInput);

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleModelFilesUpload(Array.from(e.target.files), type);

        ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); }));
        dropZone.addEventListener('drop', (e) => this.handleModelFilesUpload(Array.from(e.dataTransfer.files), type));
    }

    handleModelFilesUpload(files, type) {
        if (!files || files.length === 0) return;
        let mainFile = files.find(f => f.name.toLowerCase().match(/\.(glb|gltf|fbx)$/));
        if (!mainFile) return;

        const fileMap = new Map();
        files.forEach(f => fileMap.set(f.name.toLowerCase(), URL.createObjectURL(f)));

        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
            if (url.startsWith('blob:') || url.startsWith('data:')) return url;
            let cleanUrl = url.replace(/\\/g, '/').split('?')[0];
            const fileName = cleanUrl.split('/').pop().toLowerCase();
            return fileMap.has(fileName) ? fileMap.get(fileName) : url;
        });

        if (mainFile.name.toLowerCase().endsWith('.fbx')) {
            const loader = new FBXLoader(manager);
            loader.load(fileMap.get(mainFile.name.toLowerCase()), (fbx) => this.saveAssetToCategory(fbx, mainFile.name, this.activeCategory));
        } else {
            const loader = new GLTFLoader(manager);
            loader.load(fileMap.get(mainFile.name.toLowerCase()), (gltf) => {
                if (type === 'karakter') this.game.player.loadCustomCharacter(gltf, mainFile.name);
                else this.saveAssetToCategory(gltf.scene, mainFile.name, this.activeCategory);
            });
        }
    }

    setupDropZoneTexture() {
        const dropZone = document.getElementById('drop-zone-texture');
        if (!dropZone) return;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.png,.jpg,.jpeg';
        fileInput.style.display = 'none';
        dropZone.appendChild(fileInput);

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleTextureFileUpload(e.target.files[0]);

        ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); }));
        dropZone.addEventListener('drop', (e) => this.handleTextureFileUpload(e.dataTransfer.files[0]));
    }

    handleTextureFileUpload(file) {
        if (!file || !file.name.match(/\.(png|jpe?g)$/i)) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
            const name = file.name.split('.')[0];
            this.savedTexturesList.push({ name: name, url: url, image: img });
            this.activeTextureIndex = this.savedTexturesList.length - 1;
            this.currentCustomTextureImage = img;
            this.activeEditorTool = 5;
            this.updateEditorHudColors();
            this.renderTextureGallery();
            this.renderHotbar();
        };
    }

    renderTextureGallery() {
        const gallery = document.getElementById('texture-gallery');
        if (!gallery) return;
        gallery.innerHTML = '';

        if (this.savedTexturesList.length === 0) {
            gallery.innerHTML = '<span style="color:#aaa; font-size:11px;">Belum ada tekstur.</span>';
            return;
        }

        this.savedTexturesList.forEach((item, index) => {
            const img = document.createElement('img');
            img.src = item.url;
            img.className = 'texture-thumb';
            if (this.activeTextureIndex === index) img.classList.add('active');

            img.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.texture-thumb').forEach(el => el.classList.remove('active'));
                img.classList.add('active');
                this.activeTextureIndex = index;
                this.currentCustomTextureImage = item.image;
                this.activeEditorTool = 5;
                this.updateEditorHudColors();
                this.renderHotbar();
            };
            gallery.appendChild(img);
        });
    }

    generateThumbnail(modelWrapper) {
        const tScene = new THREE.Scene();
        const tCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        tScene.add(new THREE.AmbientLight(0xffffff, 2.0));
        const dl = new THREE.DirectionalLight(0xffffff, 2.0);
        dl.position.set(5, 10, 7);
        tScene.add(dl);

        const clone = SkeletonUtils.clone(modelWrapper);
        tScene.add(clone);

        const box = new THREE.Box3().setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

        tCam.position.set(center.x, center.y + (maxDim * 0.2), center.z + (maxDim * 1.8));
        tCam.lookAt(center);

        this.thumbRenderer.render(tScene, tCam);
        return this.thumbRenderer.domElement.toDataURL('image/png');
    }

    renderHotbar() {
        const container = document.getElementById('hotbar-container');
        const categoryBar = document.getElementById('category-bar');
        if (!container) return;

        if (this.activeEditorTool !== 3 && this.activeEditorTool !== 5 && this.activeEditorTool !== 6) {
            container.style.display = 'none';
            if (categoryBar) categoryBar.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const isLocked = document.pointerLockElement === document.body;
        if (this.isEditorMode && this.currentRole === 'developer' && (isLocked || this.isCursorOnlyMode)) {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
            if (categoryBar) categoryBar.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        const MAX_SLOTS = 10;

        if (this.activeEditorTool === 3 || this.activeEditorTool === 6) {
            this.renderCategoryBar();
            const totalItems = this.hotbarAssetNames.length;
            let maxScroll = Math.max(0, totalItems - MAX_SLOTS);
            this.hotbarScrollOffset = Math.max(0, Math.min(this.hotbarScrollOffset, maxScroll));
            
            let startIdx = this.hotbarScrollOffset;
            const endIdx = Math.min(startIdx + MAX_SLOTS, totalItems);

            for (let i = startIdx; i < endIdx; i++) {
                const name = this.hotbarAssetNames[i];
                const slot = document.createElement('div');
                
                let isActive = false;
                if (this.activeEditorTool === 6) isActive = this.selectedBrushAssets.includes(name);
                else isActive = (i === this.activeHotbarIndex);
                
                slot.className = 'hotbar-slot' + (isActive ? ' active' : '');
                slot.style.pointerEvents = 'auto';
                slot.onclick = (e) => {
                    e.stopPropagation();
                    if (this.activeEditorTool === 6) {
                        if (this.selectedBrushAssets.includes(name)) this.selectedBrushAssets = this.selectedBrushAssets.filter(n => n !== name);
                        else this.selectedBrushAssets.push(name);
                    } else {
                        this.activeHotbarIndex = (this.activeHotbarIndex === i) ? -1 : i;
                    }
                    this.renderHotbar();
                };
                
                if (this.savedAssetsThumbnails[name]) {
                    slot.style.backgroundImage = `url(${this.savedAssetsThumbnails[name]})`;
                    slot.style.backgroundSize = 'contain';
                    slot.style.backgroundPosition = 'center';
                    slot.style.backgroundRepeat = 'no-repeat';
                }
                
                let displayName = name.split('.')[0];
                slot.innerHTML = `<span style="position:absolute; bottom:2px; left:2px; right:2px; font-size:8px; background:rgba(0,0,0,0.7); padding:1px 2px; border-radius:3px; pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>`;
                container.appendChild(slot);
            }
        }
        else if (this.activeEditorTool === 5) {
            if (categoryBar) categoryBar.style.display = 'none';
            const totalItems = this.savedTexturesList.length;
            let maxScroll = Math.max(0, totalItems - MAX_SLOTS);
            this.textureScrollOffset = Math.max(0, Math.min(this.textureScrollOffset, maxScroll));
            
            let startIdx = this.textureScrollOffset;
            const endIdx = Math.min(startIdx + MAX_SLOTS, totalItems);

            for (let i = startIdx; i < endIdx; i++) {
                const item = this.savedTexturesList[i];
                const slot = document.createElement('div');
                
                let isActive = (i === this.activeTextureIndex);
                slot.className = 'hotbar-slot' + (isActive ? ' active' : '');
                slot.style.backgroundImage = `url(${item.url})`;
                slot.style.backgroundSize = 'cover';
                slot.style.backgroundPosition = 'center';
                
                slot.style.pointerEvents = 'auto';
                slot.onclick = (e) => {
                    e.stopPropagation();
                    this.activeTextureIndex = (this.activeTextureIndex === i) ? -1 : i;
                    this.currentCustomTextureImage = (this.activeTextureIndex !== -1) ? item.image : null;
                    this.renderHotbar();
                };

                let displayName = item.name || `Tekstur ${i + 1}`;
                slot.innerHTML = `<span style="position:absolute; bottom:2px; left:2px; right:2px; font-size:8px; background:rgba(0,0,0,0.7); padding:1px 2px; border-radius:3px; pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>`;
                container.appendChild(slot);
            }
        }
    }
}