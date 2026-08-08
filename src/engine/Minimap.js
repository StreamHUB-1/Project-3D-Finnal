import * as THREE from 'three';

/**
 * Modul Peta Mini (Minimap) & Peta Besar Interaktif (Expanded Map GTA 5 Style)
 */
export class Minimap {
    constructor(scene) {
        this.scene = scene;
        this.isExpanded = false;

        // Parameter Kamera & Interaksi Peta
        this.baseFrustum = 350; // Jangkauan default peta besar
        this.currentZoom = 1.0;  // Level Zoom (0.3x - 4.0x)
        this.panOffset = { x: 0, z: 0 }; // Offset geser peta manual (X & Z)
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.touchInitialDist = 0;

        // Kamera Ortografis
        this.camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 2000);
        this.camera.up.set(0, 0, -1);

        // WebGL Renderer khusus Minimap
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(150, 150);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

        this.targetContainer = document.getElementById('minimap-render-target');
        if (this.targetContainer) {
            this.targetContainer.appendChild(this.renderer.domElement);
        }
        this.viewCone = document.getElementById('minimap-view-cone');

        this.createExpandedMapUI();
        this.bindEvents();
    }

    /**
     * Membuat UI Modal untuk Peta Besar Interaktif (Expanded Map GTA V Style)
     */
    createExpandedMapUI() {
        this.mapModal = document.createElement('div');
        this.mapModal.id = 'expanded-map-overlay';
        this.mapModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: none; flex-direction: column; justify-content: center;
            align-items: center; z-index: 999990; font-family: 'Segoe UI', Roboto, sans-serif;
            user-select: none; -webkit-user-select: none;
        `;

        this.mapModal.innerHTML = `
            <!-- HEADER PETA -->
            <div style="position: absolute; top: 15px; text-align: center; color: #ffffff; z-index: 10;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: 2px;">🗺️ PETA KOTA (EXPANDED MAP)</h2>
                <span style="font-size: 11px; color: #94a3b8;">[ Scroll / Pinch ]: Zoom | [ Tahan & Geser ]: Pindah Area</span>
            </div>

            <!-- BINGKAI HOLDER CANVAS PETA -->
            <div id="expanded-map-canvas-holder" style="width: 85vw; height: 70vh; max-width: 650px; max-height: 650px; border: 3px solid #38bdf8; border-radius: 16px; overflow: hidden; position: relative; box-shadow: 0 12px 40px rgba(0,0,0,0.9); cursor: grab; background: #090d16;">
                
                <!-- IKON PLAYER BLIP KUNING MENYALA (POSISI REAL-TIME) -->
                <div id="expanded-player-blip" style="position: absolute; width: 16px; height: 16px; background: #f59e0b; border: 2px solid #ffffff; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 20; pointer-events: none; box-shadow: 0 0 12px #f59e0b;">
                    <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid #ffffff;"></div>
                </div>

                <!-- TOMBOL NAVIGASI D-PAD / RECENTER -->
                <div style="position: absolute; bottom: 15px; right: 15px; display: flex; flex-direction: column; gap: 8px; z-index: 25;">
                    <button id="btn-map-zoom-in" style="width: 40px; height: 40px; background: rgba(15, 23, 42, 0.85); border: 1px solid #38bdf8; color: white; border-radius: 8px; font-weight: bold; font-size: 18px; cursor: pointer;">＋</button>
                    <button id="btn-map-zoom-out" style="width: 40px; height: 40px; background: rgba(15, 23, 42, 0.85); border: 1px solid #38bdf8; color: white; border-radius: 8px; font-weight: bold; font-size: 18px; cursor: pointer;">－</button>
                    <button id="btn-map-recenter" style="padding: 8px 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; font-size: 11px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">🎯 RECENTER</button>
                </div>
            </div>

            <!-- TOMBOL TUTUP -->
            <button id="btn-close-expanded-map" style="position: absolute; bottom: 20px; padding: 10px 28px; background: #ef4444; color: white; border: none; border-radius: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); z-index: 10;">✕ TUTUP PETA</button>
        `;

        document.body.appendChild(this.mapModal);
        this.expandedHolder = this.mapModal.querySelector('#expanded-map-canvas-holder');
        this.expandedPlayerBlip = this.mapModal.querySelector('#expanded-player-blip');
    }

    bindEvents() {
        // Event Toggle via PC (Tombol TAB)
        document.addEventListener('toggleExpandedMap', () => {
            this.toggleExpandedMap();
        });

        // Event Toggle via Tap Minimap Kecil
        const minimapTouchArea = document.getElementById('minimap-container') || document.getElementById('minimap-box');
        if (minimapTouchArea) {
            minimapTouchArea.style.pointerEvents = 'auto';
            minimapTouchArea.style.cursor = 'pointer';

            const handleTap = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleExpandedMap();
            };

            minimapTouchArea.addEventListener('click', handleTap);
            minimapTouchArea.addEventListener('touchstart', handleTap, { passive: false });
        }

        // Tombol Close & Recenter
        const btnClose = this.mapModal.querySelector('#btn-close-expanded-map');
        if (btnClose) {
            btnClose.onclick = (e) => { e.stopPropagation(); this.toggleExpandedMap(false); };
        }

        const btnRecenter = this.mapModal.querySelector('#btn-map-recenter');
        if (btnRecenter) {
            btnRecenter.onclick = (e) => {
                e.stopPropagation();
                this.panOffset = { x: 0, z: 0 };
            };
        }

        // Tombol Zoom In & Zoom Out Manual
        const btnZoomIn = this.mapModal.querySelector('#btn-map-zoom-in');
        if (btnZoomIn) {
            btnZoomIn.onclick = (e) => { e.stopPropagation(); this.adjustZoom(0.3); };
        }

        const btnZoomOut = this.mapModal.querySelector('#btn-map-zoom-out');
        if (btnZoomOut) {
            btnZoomOut.onclick = (e) => { e.stopPropagation(); this.adjustZoom(-0.3); };
        }

        // EVENT MOUSE WHEEL ZOOM
        if (this.expandedHolder) {
            this.expandedHolder.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.2 : 0.2;
                this.adjustZoom(delta);
            }, { passive: false });

            // EVENT DRAG / PAN PETA (MOUSE)
            this.expandedHolder.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                this.expandedHolder.style.cursor = 'grabbing';
                this.dragStart = { x: e.clientX, y: e.clientY };
            });

            window.addEventListener('mousemove', (e) => {
                if (!this.isDragging || !this.isExpanded) return;
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.dragStart = { x: e.clientX, y: e.clientY };

                this.applyPanDelta(dx, dy);
            });

            window.addEventListener('mouseup', () => {
                this.isDragging = false;
                if (this.expandedHolder) this.expandedHolder.style.cursor = 'grab';
            });

            // EVENT DRAG & PINCH ZOOM (TOUCHSCREEN HP)
            this.expandedHolder.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    this.isDragging = true;
                    this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                } else if (e.touches.length === 2) {
                    this.isDragging = false;
                    this.touchInitialDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                }
            }, { passive: false });

            this.expandedHolder.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (e.touches.length === 1 && this.isDragging) {
                    const dx = e.touches[0].clientX - this.dragStart.x;
                    const dy = e.touches[0].clientY - this.dragStart.y;
                    this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

                    this.applyPanDelta(dx, dy);
                } else if (e.touches.length === 2) {
                    const currentDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    const diff = currentDist - this.touchInitialDist;
                    if (Math.abs(diff) > 10) {
                        this.adjustZoom(diff * 0.005);
                        this.touchInitialDist = currentDist;
                    }
                }
            }, { passive: false });

            this.expandedHolder.addEventListener('touchend', () => {
                this.isDragging = false;
            });
        }
    }

    /**
     * Mengatur level zoom peta secara halus
     * @param {number} delta - Selisih perubahan zoom
     */
    adjustZoom(delta) {
        this.currentZoom = Math.max(0.3, Math.min(4.0, this.currentZoom + delta));
        this.updateCameraFrustum();
    }

    /**
     * Memindahkan offset koordinat kamera peta berdasarkan geseran piksel layar
     * @param {number} dx - Geseran piksel X
     * @param {number} dy - Geseran piksel Y
     */
    applyPanDelta(dx, dy) {
        if (!this.expandedHolder) return;
        const width = this.expandedHolder.clientWidth || 500;
        const height = this.expandedHolder.clientHeight || 500;

        const currentFrustumWidth = (this.camera.right - this.camera.left);
        const currentFrustumHeight = (this.camera.top - this.camera.bottom);

        // Konversi piksel geseran ke koordinat dunia Three.js
        this.panOffset.x -= (dx / width) * currentFrustumWidth;
        this.panOffset.z -= (dy / height) * currentFrustumHeight;
    }

    /**
     * Mengubah mode peta antara Minimap Kecil & Peta Besar Luas
     * @param {boolean} [forceState] - Paksa status buka/tutup
     */
    toggleExpandedMap(forceState) {
        if (typeof forceState === 'boolean') {
            this.isExpanded = forceState;
        } else {
            this.isExpanded = !this.isExpanded;
        }

        if (this.isExpanded) {
            // Pindahkan canvas renderer ke wadah Peta Besar
            if (this.expandedHolder) {
                this.expandedHolder.appendChild(this.renderer.domElement);
                setTimeout(() => {
                    const width = this.expandedHolder.clientWidth || 500;
                    const height = this.expandedHolder.clientHeight || 500;
                    this.renderer.setSize(width, height);
                    this.updateCameraFrustum();
                }, 50);
            }

            this.mapModal.style.display = 'flex';
        } else {
            // Balikkan canvas renderer ke wadah Minimap kecil
            if (this.targetContainer) {
                this.targetContainer.appendChild(this.renderer.domElement);
                this.renderer.setSize(150, 150);
                this.updateCameraFrustum();
            }

            this.mapModal.style.display = 'none';
            this.panOffset = { x: 0, z: 0 }; // Reset offset saat ditutup
        }
    }

    /**
     * Memperbarui aspek rasio dan frustum Kamera Ortografis secara presisi
     */
    updateCameraFrustum() {
        if (this.isExpanded && this.expandedHolder) {
            const width = this.expandedHolder.clientWidth || 500;
            const height = this.expandedHolder.clientHeight || 500;
            const aspect = width / height;

            const halfSize = (this.baseFrustum / this.currentZoom);

            // Kamera dikalikan aspect ratio agar gambarnya pas dan tidak penyet / terpotong
            this.camera.left = -halfSize * aspect;
            this.camera.right = halfSize * aspect;
            this.camera.top = halfSize;
            this.camera.bottom = -halfSize;
        } else {
            this.camera.left = -50;
            this.camera.right = 50;
            this.camera.top = 50;
            this.camera.bottom = -50;
        }
        this.camera.updateProjectionMatrix();
    }

    /**
     * Memperbarui posisi kamera peta, rotasi view cone, ikon player blip, dan eksekusi render
     * @param {THREE.Vector3} playerPosition - Posisi koordinat pemain saat ini
     * @param {number} cameraAngle - Arah sudut rotasi kamera horizontal
     */
    update(playerPosition, cameraAngle) {
        if (!playerPosition) return;

        if (this.isExpanded) {
            // Kamera Peta Besar berada di atas target (Posisi Player + Offset Pan)
            const targetX = playerPosition.x + this.panOffset.x;
            const targetZ = playerPosition.z + this.panOffset.z;

            this.camera.position.set(targetX, 1000, targetZ);
            this.camera.lookAt(targetX, 0, targetZ);

            // HITUNG POSISI RELATIF IKON PLAYER BLIP PADA CONTAINER PETA BESAR
            if (this.expandedPlayerBlip && this.expandedHolder) {
                const width = this.expandedHolder.clientWidth || 500;
                const height = this.expandedHolder.clientHeight || 500;

                const frustumWidth = (this.camera.right - this.camera.left);
                const frustumHeight = (this.camera.top - this.camera.bottom);

                // Offset relatif player dari titik pusat kamera
                const relX = -this.panOffset.x;
                const relZ = -this.panOffset.z;

                const normX = relX / (frustumWidth / 2);
                const normY = relZ / (frustumHeight / 2);

                const screenX = (normX * 0.5 + 0.5) * width;
                const screenY = (normY * 0.5 + 0.5) * height;

                // Tampilkan blip hanya jika player berada di dalam area pandang peta
                if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
                    this.expandedPlayerBlip.style.display = 'block';
                    this.expandedPlayerBlip.style.left = `${screenX}px`;
                    this.expandedPlayerBlip.style.top = `${screenY}px`;
                    this.expandedPlayerBlip.style.transform = `translate(-50%, -50%) rotate(${-cameraAngle}rad)`;
                } else {
                    this.expandedPlayerBlip.style.display = 'none';
                }
            }
        } else {
            // Pada mode Minimap Kecil: Kamera mengikuti presisi tepat di atas pemain
            this.camera.position.set(playerPosition.x, 300, playerPosition.z);
            this.camera.lookAt(playerPosition.x, 0, playerPosition.z);
        }

        if (this.viewCone) {
            this.viewCone.style.transform = `rotate(${-cameraAngle}rad)`;
        }

        // PAKSA SELURUH OBJEK MAP MUNCUL DENGAN MEMATIKAN FOG & JARAK CULLING SEMENTARA
        const oldFog = this.scene.fog;
        this.scene.fog = null;

        if (this.isExpanded) {
            this.scene.traverse(child => {
                if (child.isMesh) {
                    child.userData.wasVisible = child.visible;
                    child.visible = true; // Paksa gedung-gedung jauh tetap muncul di peta besar
                }
            });
        }

        this.renderer.render(this.scene, this.camera);

        // Kembalikan status visibilitas asli
        if (this.isExpanded) {
            this.scene.traverse(child => {
                if (child.isMesh && child.userData.wasVisible !== undefined) {
                    child.visible = child.userData.wasVisible;
                }
            });
        }

        this.scene.fog = oldFog;
    }
}