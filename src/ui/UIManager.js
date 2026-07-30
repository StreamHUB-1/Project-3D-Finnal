import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.currentRole = null;
        this.isEditorMode = false;
        this.activeEditorTool = 1;
        this.editorBrushSize = 5.0;
        this.draggedAsset = null;
        this.isCursorOnlyMode = false;

        this.assetCategories = {
            alam: [],
            rumah: [],
            kendaraan: [],
            senjata: []
        };
        this.activeCategory = 'alam';

        this.savedAssetsData = {};
        this.savedAssetsThumbnails = {};
        
        // Logika Pilihan Aset
        this.hotbarAssetNames = [];
        this.activeHotbarIndex = -1; 

        this.savedTexturesList = [];
        this.activeTextureIndex = -1;
        this.currentCustomTextureImage = null;

        // Logika Posisi Geser (Scroll) Layar Hotbar dengan Q dan E
        this.hotbarScrollOffset = 0;
        this.textureScrollOffset = 0;

        // Variabel Konfigurasi Kuas Vegetasi (Tool 6)
        this.brushMinScale = 0.8;
        this.brushMaxScale = 1.5;
        this.brushDensity = 5;
        this.selectedBrushAssets = []; 

        this.thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.thumbRenderer.setSize(80, 80);

        this.initLoadingUI();
        this.initBrushMarker();
        this.initUIEvents();
        this.initEditorHotkeys();
        this.initDropZones();
        this.initDefaultTextures();

        this.autoLoadCategoryModels();
    }

    initLoadingUI() {
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #4CAF50;
            color: #4CAF50;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            z-index: 9999;
            display: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
            pointer-events: none;
            letter-spacing: 1px;
        `;
        document.body.appendChild(this.loadingOverlay);
    }

    async autoLoadCategoryModels() {
        const modelModules = import.meta.glob([
            '/src/models/**/*.{glb,gltf,fbx}',
            '/src/assets/models/**/*.{glb,gltf,fbx}',
            '/public/assets/models/**/*.{glb,gltf,fbx}'
        ], { eager: true, query: '?url', import: 'default' });

        const queue = [];

        for (const path in modelModules) {
            const url = modelModules[path];
            const parts = path.split('/');
            const fileName = parts.pop();
            const category = parts.pop().toLowerCase();

            if (!this.assetCategories[category]) {
                this.assetCategories[category] = [];
            }

            queue.push({ url, fileName, category });
        }

        if (queue.length > 0) {
            this.loadingOverlay.style.display = 'block';
            let loadedCount = 0;

            for (const item of queue) {
                this.loadingOverlay.innerText = `⏳ Memuat Asset 3D: ${loadedCount} / ${queue.length} (${item.fileName})`;
                
                await this.loadModelFromUrlAsync(item.url, item.fileName, item.category);
                loadedCount++;

                await new Promise(resolve => setTimeout(resolve, 10));
            }

            this.loadingOverlay.innerText = `✅ Selesai memuat ${loadedCount} assets!`;
            setTimeout(() => {
                this.loadingOverlay.style.display = 'none';
            }, 3000);
            
            console.log(`[AssetLoader] Sistem berhasil memindai dan memuat ${loadedCount} file model 3D.`);
        }
    }

    loadModelFromUrlAsync(url, fileName, category) {
        return new Promise((resolve) => {
            const ext = fileName.split('.').pop().toLowerCase();

            if (ext === 'fbx') {
                const loader = new FBXLoader();
                loader.load(
                    url,
                    (fbx) => {
                        this.saveAssetToCategory(fbx, fileName, category);
                        resolve();
                    },
                    undefined,
                    (err) => {
                        console.error(`[FBXLoader Error] Gagal memuat ${fileName}:`, err);
                        resolve();
                    }
                );
            } else {
                const loader = new GLTFLoader();
                loader.load(
                    url,
                    (gltf) => {
                        this.saveAssetToCategory(gltf.scene, fileName, category);
                        resolve();
                    },
                    undefined,
                    (err) => {
                        console.error(`[GLTFLoader Error] Gagal memuat ${fileName}:`, err);
                        resolve();
                    }
                );
            }
        });
    }

    saveAssetToCategory(modelScene, fileName, category) {
        modelScene.updateMatrixWorld(true);

        if (this.game && this.game.player) {
            this.game.player.applyMaterialFixes(modelScene, fileName);
        }

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

        if (!this.assetCategories[category]) {
            this.assetCategories[category] = [];
        }

        if (!this.assetCategories[category].includes(fileName)) {
            this.assetCategories[category].push(fileName);
        }

        if (!this.assetCategories[this.activeCategory] || this.assetCategories[this.activeCategory].length === 0) {
            this.activeCategory = category;
        }

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
            btn.onclick = (e) => {
                e.stopPropagation();
                this.activeCategory = cat;
                this.syncHotbarAssetNames();
                this.renderCategoryBar();
                this.renderHotbar();
            };
            bar.appendChild(btn);
        });
    }

    initDefaultTextures() {
        const defaultTextures = [
            { name: 'Tekstur Batu', path: '/assets/textures/rock_texture.png' },
            { name: 'Rumput Dasar', path: '/assets/textures/ground_base.png' }
        ];

        defaultTextures.forEach((tex) => {
            const img = new Image();
            img.src = tex.path;
            img.onload = () => {
                if (!this.savedTexturesList.some(item => item.url === tex.path)) {
                    this.savedTexturesList.push({ name: tex.name, url: tex.path, image: img });
                }

                if (!this.currentCustomTextureImage) {
                    this.currentCustomTextureImage = img;
                    this.activeTextureIndex = -1;
                }

                this.renderTextureGallery();
                this.renderHotbar();
            };
            img.onerror = () => {
                console.warn(`File preset ${tex.path} belum ditemukan.`);
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

    initUIEvents() {
        const blocker = document.getElementById('blocker');
        const roleSelection = document.getElementById('role-selection');
        const uiContainer = document.getElementById('ui-container');
        const btnToggleMode = document.getElementById('btn-toggle-mode');
        const editorHud = document.getElementById('editor-hud');
        const hotbar = document.getElementById('hotbar-container');
        const categoryBar = document.getElementById('category-bar');

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
            
            // PERBARUAN: MAX RANGE KEPADATAN RUMPUT DINAIKKAN MENJADI 50
            tool6Config.innerHTML = `
                <div style="color:#4CAF50; margin-bottom:5px; font-weight:bold;">⚙️ Setting Kuas Vegetasi</div>
                <label style="display:block; margin-bottom:4px;">Skala Min: <span id="val-smin">${this.brushMinScale}</span>
                    <input type="range" id="b-smin" min="0.1" max="4.0" step="0.1" value="${this.brushMinScale}" style="width:100%;">
                </label>
                <label style="display:block; margin-bottom:4px;">Skala Max: <span id="val-smax">${this.brushMaxScale}</span>
                    <input type="range" id="b-smax" min="0.1" max="4.0" step="0.1" value="${this.brushMaxScale}" style="width:100%;">
                </label>
                <label style="display:block; margin-bottom:4px;">Kepadatan Rumput: <span id="val-den">${this.brushDensity}</span>
                    <input type="range" id="b-den" min="1" max="50" step="1" value="${this.brushDensity}" style="width:100%;">
                </label>
                <div style="color:#ffcc00; font-size:9px; margin-top:5px; line-height:1.2;">
                    *Pencet ( \` ) buat lepas kursor.<br>
                    *Klik langsung di Hotbar untuk Multi-Select aset!
                </div>
            `;
            editorHud.appendChild(tool6Config);

            document.getElementById('b-smin').oninput = (e) => { this.brushMinScale = parseFloat(e.target.value); document.getElementById('val-smin').innerText = e.target.value; };
            document.getElementById('b-smax').oninput = (e) => { this.brushMaxScale = parseFloat(e.target.value); document.getElementById('val-smax').innerText = e.target.value; };
            document.getElementById('b-den').oninput = (e) => { this.brushDensity = parseInt(e.target.value); document.getElementById('val-den').innerText = e.target.value; };
        }

        document.getElementById('role-player').onclick = () => this.setRole('player');
        document.getElementById('role-developer').onclick = () => this.setRole('developer');

        document.getElementById('btn-logout').onclick = () => {
            this.currentRole = null;
            this.isEditorMode = false;
            this.isCursorOnlyMode = false;
            btnToggleMode.style.display = 'none';
            editorHud.style.display = 'none';
            hotbar.style.display = 'none';
            if (categoryBar) categoryBar.style.display = 'none';
            uiContainer.style.display = 'none';
            roleSelection.style.display = 'flex';
            document.querySelector('.pause-title').innerText = "Pilih Peran Anda:";
        };

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

        blocker.onclick = (e) => {
            if (uiContainer.contains(e.target) || roleSelection.contains(e.target) || !this.currentRole) return;
            this.isCursorOnlyMode = false;
            document.body.requestPointerLock().catch(() => {});
        };

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                this.isCursorOnlyMode = false;
                blocker.style.display = 'none';
                btnToggleMode.style.display = 'none';
                if (this.isEditorMode && this.currentRole === 'developer') {
                    editorHud.style.display = 'block';
                }
                this.updateEditorHudColors();
                this.renderHotbar();
            } else {
                if (this.isCursorOnlyMode) {
                    blocker.style.display = 'none';
                    btnToggleMode.style.display = (this.currentRole === 'developer') ? 'block' : 'none';
                } else {
                    blocker.style.display = 'flex';
                    btnToggleMode.style.display = (this.currentRole === 'developer') ? 'block' : 'none';
                    editorHud.style.display = 'none';
                    hotbar.style.display = 'none';
                    if (categoryBar) categoryBar.style.display = 'none';
                    this.brushRingMesh.visible = false;
                }
            }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.getAttribute('data-target')).classList.add('active');

                if (btn.getAttribute('data-target') === 'tab-environment') {
                    this.renderTextureGallery();
                }
            };
        });
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
        if (categoryBar) {
            categoryBar.style.display = ((this.activeEditorTool === 3 || this.activeEditorTool === 6) && this.isEditorMode && (document.pointerLockElement === document.body || this.isCursorOnlyMode)) ? 'flex' : 'none';
        }

        const t6Config = document.getElementById('tool-6-config');
        if (t6Config) {
            t6Config.style.display = (this.activeEditorTool === 6 && this.isEditorMode) ? 'block' : 'none';
        }
    }

    setRole(role) {
        this.currentRole = role;
        document.getElementById('role-selection').style.display = 'none';
        document.getElementById('ui-container').style.display = 'flex';
        document.querySelector('.pause-title').innerText = "Klik layar gelap di luar kotak kaca untuk melanjutkan";

        if (role === 'player') {
            document.getElementById('btn-toggle-mode').style.display = 'none';
            document.querySelectorAll('.dev-only').forEach(el => el.style.display = 'none');
        } else {
            document.getElementById('btn-toggle-mode').style.display = 'block';
            document.querySelectorAll('.dev-only').forEach(el => el.style.display = 'block');
        }
    }

    initDropZones() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            document.body.addEventListener(evt, (e) => e.preventDefault());
        });

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

        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files);
            this.handleModelFilesUpload(files, type);
        };

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            this.handleModelFilesUpload(files, type);
        });
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
            loader.load(fileMap.get(mainFile.name.toLowerCase()), (fbx) => {
                this.saveAssetToCategory(fbx, mainFile.name, this.activeCategory);
            });
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

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            this.handleTextureFileUpload(file);
        };

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            this.handleTextureFileUpload(file);
        });
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

            if (this.activeTextureIndex === index) {
                img.classList.add('active');
            }

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
                if (this.activeEditorTool === 6) {
                    isActive = this.selectedBrushAssets.includes(name);
                } else {
                    isActive = (i === this.activeHotbarIndex);
                }
                
                slot.className = 'hotbar-slot' + (isActive ? ' active' : '');
                
                slot.style.pointerEvents = 'auto';
                slot.onclick = (e) => {
                    e.stopPropagation();
                    if (this.activeEditorTool === 6) {
                        if (this.selectedBrushAssets.includes(name)) {
                            this.selectedBrushAssets = this.selectedBrushAssets.filter(n => n !== name);
                        } else {
                            this.selectedBrushAssets.push(name);
                        }
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