import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GameEngine } from './engine/GameEngine.js';
import { TimeCycle } from './engine/TimeCycle.js';
import { Minimap } from './engine/Minimap.js';
import { World } from './entities/World.js';
import { Player, windUniforms, interactionUniforms } from './entities/Player.js';
import { InputManager } from './controls/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { AudioManager } from './engine/AudioManager.js';

/**
 * Entry Point Utama Permainan (Game Loop & Integrasi Seluruh Sistem)
 */
class Game {
    constructor() {
        this.engine = new GameEngine();

        // SISIPKAN THREE.LoadingManager UNTUK TRACKING PROGRESS DOWNLOAD MAP & KARAKTER
        this.loadingManager = new THREE.LoadingManager(
            // 1. Callback OnLoad (100% Selesai)
            () => {
                console.log("[GameLoading] Seluruh aset utama berhasil dimuat!");
                if (this.ui) {
                    this.ui.hideLoadingScreen();
                }
            },
            // 2. Callback OnProgress (Proses Berjalan)
            (url, itemsLoaded, itemsTotal) => {
                const percent = (itemsLoaded / itemsTotal) * 100;
                if (this.ui) {
                    this.ui.updateLoadingProgress(percent, url);
                }
            },
            // 3. Callback OnError
            (url) => {
                console.error("[GameLoading] Gagal memuat aset dari URL:", url);
            }
        );

        this.timeCycle = new TimeCycle(this.engine.scene, this.engine.dirLight, this.engine.hemiLight);
        this.minimap = new Minimap(this.engine.scene);
        
        // Inisialisasi Dunia dan Karakter (Sisa Rapier sudah dibersihkan)
        this.world = new World(this.engine.scene, this.loadingManager);
        this.audio = new AudioManager();
        this.player = new Player(this.engine.scene, this.loadingManager, this.audio);
        
        this.input = new InputManager();
        this.ui = new UIManager(this);

        this.prevTime = performance.now();
        this.scatterCooldown = 0;

        this.initEditorClickEvents();
        this.animate = this.animate.bind(this);
        
        const unlockAudio = () => {
            this.audio.startAmbience();
            document.removeEventListener('click', unlockAudio);
        };
        document.addEventListener('click', unlockAudio);

        requestAnimationFrame(this.animate);
    }

    initEditorClickEvents() {
        document.addEventListener('mousedown', (e) => {
            if (!this.ui.isEditorMode || this.ui.currentRole !== 'developer' || document.pointerLockElement !== document.body) return;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), this.engine.camera);

            if (this.ui.activeEditorTool === 3 && e.button === 0) {
                const floorIntersects = raycaster.intersectObject(this.world.floorMesh, true);
                if (floorIntersects.length > 0 && this.ui.hotbarAssetNames.length > 0) {
                    const point = floorIntersects[0].point;
                    const assetName = this.ui.hotbarAssetNames[this.ui.activeHotbarIndex];
                    const template = this.ui.savedAssetsData[assetName];

                    if (template) {
                        const newAsset = SkeletonUtils.clone(template);
                        newAsset.name = assetName; 
                        newAsset.position.copy(point);
                        this.engine.scene.add(newAsset);
                        newAsset.updateMatrixWorld(true);
                        this.world.placedAssetsList.push({ mesh: newAsset });
                    }
                }
            }

            if (this.ui.activeEditorTool === 4) {
                const allMeshes = this.world.placedAssetsList.map(a => a.mesh);
                const intersects = raycaster.intersectObjects(allMeshes, true);

                if (intersects.length > 0) {
                    let foundAsset = null;
                    for (let a of this.world.placedAssetsList) {
                        a.mesh.traverse((child) => {
                            if (child === intersects[0].object) foundAsset = a.mesh;
                        });
                        if (foundAsset) break;
                    }

                    if (foundAsset) {
                        if (e.button === 0) {
                            this.ui.draggedAsset = foundAsset;
                        } else if (e.button === 2) {
                            this.engine.scene.remove(foundAsset);
                            this.world.placedAssetsList = this.world.placedAssetsList.filter(a => a.mesh !== foundAsset);
                        }
                    }
                }
            }

            if (this.ui.activeEditorTool === 5 && e.button === 0 && this.ui.currentCustomTextureImage) {
                const allTargets = [...this.world.baseObstacleMeshes];
                this.world.placedAssetsList.forEach(a => allTargets.push(a.mesh));

                const intersects = raycaster.intersectObjects(allTargets, true);
                if (intersects.length > 0) {
                    const hitMesh = intersects[0].object;
                    if (hitMesh.isMesh && hitMesh !== this.world.floorMesh) {
                        const box = new THREE.Box3().setFromObject(hitMesh);
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        let repeats = Math.max(1, Math.round(maxDim / 5));

                        const objTex = new THREE.Texture(this.ui.currentCustomTextureImage);
                        objTex.wrapS = THREE.RepeatWrapping;
                        objTex.wrapT = THREE.RepeatWrapping;
                        objTex.repeat.set(repeats, repeats);
                        objTex.colorSpace = THREE.SRGBColorSpace;
                        objTex.needsUpdate = true;

                        hitMesh.material = hitMesh.material.clone();
                        hitMesh.material.map = objTex;
                        hitMesh.material.color = new THREE.Color(0xffffff);
                        hitMesh.material.needsUpdate = true;
                    }
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.ui.draggedAsset) {
                this.ui.draggedAsset = null;
            }
        });
    }

    animate() {
        requestAnimationFrame(this.animate);

        const time = performance.now();
        const delta = Math.min((time - this.prevTime) / 1000, 0.1);
        this.prevTime = time;

        windUniforms.time.value += delta;
        this.timeCycle.update(delta);

        if (this.ui.isEditorMode && this.ui.currentRole === 'developer') {
            this.updateEditorControls(delta);
        } else {
            this.player.updatePhysics(delta, this.input, this.input.cameraAngle, this.world);
            this.updateCameraFollowPlayer();
        }

        if (this.player.model) {
            let px = Math.round(this.player.model.position.x);
            let py = Math.round(this.player.model.position.y);
            let pz = Math.round(this.player.model.position.z);
            
            this.ui.updateFPSCompass(this.input.cameraAngle, px, py, pz);
            this.minimap.update(this.player.model.position, this.input.cameraAngle);
        }

        this.engine.render(delta);
    }

    /**
     * Memperbarui posisi kamera dengan Sistem Anti-Nembus Tembok (Spring Arm Collision)
     */
    updateCameraFollowPlayer() {
        if (!this.player.model) return;

        const maxCamDistance = 6;
        
        // 1. Tentukan titik target yang dilihat kamera (Bagian kepala/pundak Karakter)
        const lookAtPos = new THREE.Vector3(
            this.player.model.position.x,
            this.player.model.position.y + 1.5,
            this.player.model.position.z
        );

        // 2. Hitung posisi ideal kamera jika tidak ada halangan apapun
        const idealOffsetX = Math.sin(this.input.cameraAngle) * Math.cos(this.input.cameraPitch) * maxCamDistance;
        const idealOffsetY = -Math.sin(this.input.cameraPitch) * maxCamDistance + 3.0; // Offset tinggi kamera dari tanah
        const idealOffsetZ = Math.cos(this.input.cameraAngle) * Math.cos(this.input.cameraPitch) * maxCamDistance;

        const idealCamPos = new THREE.Vector3(
            lookAtPos.x + idealOffsetX,
            lookAtPos.y + idealOffsetY,
            lookAtPos.z + idealOffsetZ
        );

        // 3. Buat Raycaster dari karakter ke arah posisi ideal kamera
        const dirToCamera = new THREE.Vector3().subVectors(idealCamPos, lookAtPos).normalize();
        const raycaster = new THREE.Raycaster(lookAtPos, dirToCamera, 0, maxCamDistance);

        // 4. Kumpulkan semua objek yang bisa menutupi kamera (Map & Aset)
        let allTargets = [this.world.floorMesh, ...this.world.baseObstacleMeshes];
        this.world.placedAssetsList.forEach(a => {
            const name = (a.mesh.name || '').toLowerCase();
            // Kamera boleh tembus daun/rumput, tapi tidak boleh tembus tembok/batu
            const isPassable = name.includes('grass') || name.includes('bush') || name.includes('flower') || name.includes('clover') || name.includes('plant');
            if (!isPassable) {
                allTargets.push(a.mesh);
            }
        });

        // 5. Cek apakah ada tabrakan antara karakter dan posisi ideal kamera
        const intersects = raycaster.intersectObjects(allTargets, true);
        let finalCamPos = new THREE.Vector3().copy(idealCamPos);

        if (intersects.length > 0) {
            // Jika nabrak, majukan kamera ke titik tabrakan (Beri jarak aman 0.3 meter agar tidak klip ke dinding)
            const safeDistance = Math.max(0.2, intersects[0].distance - 0.3);
            finalCamPos.copy(lookAtPos).add(dirToCamera.multiplyScalar(safeDistance));
        }

        // 6. Aplikasikan posisi final kamera (Gunakan LERP agar pergerakan memantul halus)
        this.engine.camera.position.lerp(finalCamPos, 0.3);
        this.engine.camera.lookAt(lookAtPos);
    }

    updateEditorControls(delta) {
        if (document.pointerLockElement !== document.body) {
            if (this.ui.brushRingMesh) this.ui.brushRingMesh.visible = false;
            return;
        }

        let moveSpeedEditor = (this.input.keys.shift || this.input.isJoySprinting) ? 40 : 20;
        let moveX = this.input.joyMoveX, moveZ = this.input.joyMoveZ, moveY = 0;

        if (this.input.keys.w) moveZ = -1;
        if (this.input.keys.s) moveZ = 1;
        if (this.input.keys.a) moveX = -1;
        if (this.input.keys.d) moveX = 1;
        if (this.input.keys.space) moveY = 1;
        if (this.input.keys.shift) moveY = -1;

        this.engine.camera.rotation.set(this.input.cameraPitch, this.input.cameraAngle, 0, 'YXZ');

        if (moveX !== 0 || moveZ !== 0 || moveY !== 0) {
            let s = Math.sin(this.input.cameraAngle);
            let c = Math.cos(this.input.cameraAngle);
            this.engine.camera.position.x += (moveX * c + moveZ * s) * moveSpeedEditor * delta;
            this.engine.camera.position.z += (moveX * -s + moveZ * c) * moveSpeedEditor * delta;
            this.engine.camera.position.y += moveY * moveSpeedEditor * delta;
        }

        if (this.input.mouseWheelDelta !== 0) {
            if (this.ui.activeEditorTool === 1 || this.ui.activeEditorTool === 2 || this.ui.activeEditorTool === 5 || this.ui.activeEditorTool === 6) {
                this.ui.editorBrushSize += this.input.mouseWheelDelta * -0.005;
                this.ui.editorBrushSize = Math.max(1.0, Math.min(20.0, this.ui.editorBrushSize));
            } else if (this.ui.activeEditorTool === 4) {
                let targetAsset = this.ui.draggedAsset;

                if (!targetAsset) {
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.engine.camera);
                    const allMeshes = this.world.placedAssetsList.map(a => a.mesh);
                    const intersects = raycaster.intersectObjects(allMeshes, true);

                    if (intersects.length > 0) {
                        for (let a of this.world.placedAssetsList) {
                            a.mesh.traverse((child) => {
                                if (child === intersects[0].object) targetAsset = a.mesh;
                            });
                            if (targetAsset) break;
                        }
                    }
                }

                if (targetAsset) {
                    let scaleFactor = this.input.mouseWheelDelta > 0 ? 0.9 : 1.1;
                    targetAsset.scale.multiplyScalar(scaleFactor);
                    targetAsset.updateMatrixWorld(true);
                }
            }
            this.input.mouseWheelDelta = 0;
        }

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.engine.camera);
        const floorIntersects = raycaster.intersectObject(this.world.floorMesh, true);

        if (floorIntersects.length > 0) {
            const point = floorIntersects[0].point;
            const uv = floorIntersects[0].uv;

            this.ui.brushRingMesh.visible = true;
            this.ui.brushRingMesh.position.copy(point);
            this.ui.brushRingMesh.position.y += 0.2;

            if (this.ui.activeEditorTool === 1 || this.ui.activeEditorTool === 2 || this.ui.activeEditorTool === 5 || this.ui.activeEditorTool === 6) {
                this.ui.brushRingMesh.scale.set(this.ui.editorBrushSize, 1, this.ui.editorBrushSize);
            } else if (this.ui.activeEditorTool === 3 || this.ui.activeEditorTool === 4) {
                this.ui.brushRingMesh.scale.set(1.5, 1, 1.5);
            } else {
                this.ui.brushRingMesh.visible = false;
            }

            if ((this.ui.activeEditorTool === 1 || this.ui.activeEditorTool === 2) && (this.input.isLeftMouseDown || this.input.isRightMouseDown)) {
                this.world.sculptTerrain(point, this.ui.editorBrushSize, this.ui.activeEditorTool, delta, this.input.isLeftMouseDown, this.input.isRightMouseDown);

                const snapRay = new THREE.Raycaster();
                const downVec = new THREE.Vector3(0, -1, 0);

                this.world.placedAssetsList.forEach(a => {
                    const assetPos = a.mesh.position;
                    const distToBrush = Math.sqrt(Math.pow(assetPos.x - point.x, 2) + Math.pow(assetPos.z - point.z, 2));

                    if (distToBrush <= this.ui.editorBrushSize + 1.5) {
                        snapRay.set(new THREE.Vector3(assetPos.x, 500, assetPos.z), downVec);
                        const hits = snapRay.intersectObject(this.world.floorMesh, true);
                        if (hits.length > 0) {
                            a.mesh.position.y = hits[0].point.y;
                            a.mesh.updateMatrixWorld(true);
                        }
                    }
                });
            }

            if (this.ui.activeEditorTool === 4 && this.ui.draggedAsset && this.input.isLeftMouseDown) {
                this.ui.draggedAsset.position.copy(point);
                this.ui.draggedAsset.updateMatrixWorld(true);
            }

            if (this.ui.activeEditorTool === 5 && this.input.isLeftMouseDown && this.ui.currentCustomTextureImage) {
                this.world.paintTerrainTexture(uv, this.ui.editorBrushSize, this.ui.currentCustomTextureImage);
            }

            if (this.ui.activeEditorTool === 6 && this.input.isLeftMouseDown) {
                let assetsToSpawn = this.ui.selectedBrushAssets.length > 0 
                                    ? this.ui.selectedBrushAssets 
                                    : [this.ui.hotbarAssetNames[this.ui.activeHotbarIndex]];

                if (assetsToSpawn.length > 0 && assetsToSpawn[0]) {
                    this.scatterCooldown -= delta;
                    if (this.scatterCooldown <= 0) {
                        const assetName = assetsToSpawn[Math.floor(Math.random() * assetsToSpawn.length)];
                        const template = this.ui.savedAssetsData[assetName];
                        
                        if (template) {
                            const isFoliageGrass = assetName.toLowerCase().match(/(grass|bush|flower|plant|clover)/);
                            this.scatterCooldown = isFoliageGrass ? Math.max(0.005, 0.2 - (this.ui.brushDensity * 0.0039)) : 0.15;

                            const r = this.ui.editorBrushSize * Math.sqrt(Math.random());
                            const theta = Math.random() * 2 * Math.PI;
                            const spawnX = point.x + r * Math.cos(theta);
                            const spawnZ = point.z + r * Math.sin(theta);
                            
                            const randomScale = this.ui.brushMinScale + Math.random() * (this.ui.brushMaxScale - this.ui.brushMinScale);
                            let spacing = isFoliageGrass ? Math.max(0.1, 2.5 - (this.ui.brushDensity * 0.048)) : 3.5;
                            let safeDistance = randomScale * spacing;
                            
                            let canSpawn = true;
                            for (let a of this.world.placedAssetsList) {
                                let dx = a.mesh.position.x - spawnX;
                                let dz = a.mesh.position.z - spawnZ;
                                if (Math.sqrt(dx*dx + dz*dz) < safeDistance) {
                                    canSpawn = false;
                                    break;
                                }
                            }

                            if (canSpawn) {
                                const scatterRay = new THREE.Raycaster(new THREE.Vector3(spawnX, 200, spawnZ), new THREE.Vector3(0, -1, 0));
                                const hits = scatterRay.intersectObject(this.world.floorMesh, true);

                                if (hits.length > 0) {
                                    const finalPoint = hits[0].point;
                                    const newAsset = SkeletonUtils.clone(template);
                                    newAsset.name = assetName; 
                                    newAsset.scale.copy(template.scale).multiplyScalar(randomScale);
                                    newAsset.rotation.y = Math.random() * Math.PI * 2;
                                    newAsset.position.copy(finalPoint);
                                    this.engine.scene.add(newAsset);
                                    newAsset.updateMatrixWorld(true);
                                    this.world.placedAssetsList.push({ mesh: newAsset });
                                }
                            }
                        }
                    }
                }
            } else {
                this.scatterCooldown = 0;
            }
        } else {
            this.ui.brushRingMesh.visible = false;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});