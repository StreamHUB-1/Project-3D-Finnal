import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Modul Pengaturan Pemain (Player Settings) & Fitur Pengembangan Editor Mode
 */
export class PlayerSettings {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.settings = {
            dasar: { volume: 100, showFPS: false, waktu: 'auto' },
            grafik: { resolusi: 'high', bayangan: true, renderDistance: 100 },
            kontrol: { tipe: 'pc', sensitivitas: 50 }
        };

        this.initUI();
        this.initEvents();
    }

    initUI() {
        this.modal = document.createElement('div');
        this.modal.id = 'player-settings-modal';
        this.modal.style.cssText = `
            background: rgba(40, 40, 40, 0.3); border: none;
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); border-radius: 16px; width: 540px; max-width: 92%;
            overflow: hidden; display: none; flex-direction: column; color: #f8fafc; z-index: 100000;
        `;

        this.modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; background: rgba(0,0,0,0.15);">
                <h2 style="margin: 0; font-size: 18px; color: #38bdf8; font-family: sans-serif; font-weight: 800; letter-spacing: 1px;">⚙️ PENGATURAN</h2>
                <button id="btn-close-settings" style="background: none; border: none; color: #ef4444; font-size: 24px; cursor: pointer; font-weight: bold; padding: 5px 15px; margin: -5px -15px; transition: 0.2s;">✕</button>
            </div>
            
            <div style="display: flex; background: rgba(0,0,0,0.1); font-family: sans-serif;">
                <button class="st-tab-btn active" data-target="st-dasar" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; font-weight: bold;">Dasar</button>
                <button class="st-tab-btn" data-target="st-grafik" style="flex: 1; padding: 12px; background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-weight: bold;">Grafik</button>
                <button class="st-tab-btn" data-target="st-kontrol" style="flex: 1; padding: 12px; background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-weight: bold;">Kontrol</button>
                <button class="st-tab-btn" data-target="st-pengembangan" style="flex: 1; padding: 12px; background: transparent; border: none; color: #f59e0b; cursor: pointer; font-weight: bold;">🛠️ Dev</button>
            </div>

            <div style="padding: 24px; font-family: sans-serif; font-size: 14px;">
                <!-- TAB 1: DASAR -->
                <div id="st-dasar" class="st-tab-content" style="display: block;">
                    <div style="margin-bottom: 18px;">
                        <label style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">Volume Master: <span id="val-vol">100%</span></label>
                        <input type="range" id="set-vol" min="0" max="100" value="100" style="width: 100%; cursor: pointer;">
                    </div>
                    <div style="margin-bottom: 18px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold;">Siklus Waktu / Jam Game</label>
                        <select id="set-time-cycle" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <option value="auto">Berjalan Otomatis</option>
                            <option value="00">Jam 00:00 (Tengah Malam)</option>
                            <option value="03">Jam 03:00 (Dini Hari)</option>
                            <option value="06">Jam 06:00 (Fajar)</option>
                            <option value="09">Jam 09:00 (Pagi)</option>
                            <option value="12">Jam 12:00 (Tengah Hari)</option>
                            <option value="15">Jam 15:00 (Sore Terang)</option>
                            <option value="18">Jam 18:00 (Senja/Sunset)</option>
                            <option value="21">Jam 21:00 (Malam)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-weight: bold;">Tampilkan FPS di Layar</label>
                        <input type="checkbox" id="set-fps" style="width: 18px; height: 18px; cursor: pointer;">
                    </div>
                </div>

                <!-- TAB 2: GRAFIK -->
                <div id="st-grafik" class="st-tab-content" style="display: none;">
                    <div style="margin-bottom: 18px;">
                        <label style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">Jarak Pandang (Render Distance): <span id="val-render-dist" style="color:#38bdf8;">100 Meter</span></label>
                        <input type="range" id="set-render-dist" min="30" max="1000" step="10" value="100" style="width: 100%; cursor: pointer;">
                        <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 4px;">*Turunkan ke 30m - 100m untuk HP kentang agar anti-lag.</span>
                    </div>
                    <div style="margin-bottom: 18px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold;">Kualitas Resolusi Render</label>
                        <select id="set-resolusi" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <option value="low">Rendah (Hemat Baterai)</option>
                            <option value="med">Sedang (Seimbang)</option>
                            <option value="high" selected>Tinggi (Visual Tajam & Mulus)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-weight: bold;">Aktifkan Bayangan Real-Time</label>
                        <input type="checkbox" id="set-bayangan" checked style="width: 18px; height: 18px; cursor: pointer;">
                    </div>
                </div>

                <!-- TAB 3: KONTROL -->
                <div id="st-kontrol" class="st-tab-content" style="display: none;">
                    <div style="margin-bottom: 18px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold;">Jenis Perangkat Kontrol</label>
                        <select id="set-tipe-kontrol" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <option value="pc" selected>Keyboard & Mouse (PC)</option>
                            <option value="mobile">Layar Sentuh / Joystick (HP)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 18px;">
                        <label style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold;">Sensitivitas Kamera: <span id="val-sens">50</span></label>
                        <input type="range" id="set-sens" min="1" max="100" value="50" style="width: 100%; cursor: pointer;">
                    </div>
                    <div style="margin-top: 25px; padding-top: 15px;">
                        <button id="btn-edit-layout" style="width: 100%; padding: 12px; background: #f59e0b; color: #fff; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; transition: 0.2s;">📐 SESUAIKAN LAYOUT HUD (HP)</button>
                    </div>
                </div>

                <!-- TAB 4: PENGEMBANGAN (DEVELOPER MODE & WORLD EDITOR) -->
                <div id="st-pengembangan" class="st-tab-content" style="display: none;">
                    <div style="margin-bottom: 20px; text-align: center;">
                        <button id="btn-toggle-dev-role" style="width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; font-weight: 800; border: none; border-radius: 8px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);">🛠️ AKTIFKAN MODE DEVELOPER</button>
                    </div>

                    <div id="dev-tools-box" style="display: none; flex-direction: column; gap: 15px;">
                        <div style="font-weight: bold; color: #38bdf8; font-size: 13px;">📁 UPLOAD ASET KUSTOM</div>
                        
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <div id="drop-zone-karakter" class="drop-zone-glass" style="flex: 1; min-width: 120px; padding: 15px;">
                                <span id="drop-text-karakter">👤 Karakter<br>(.glb/.gltf)</span>
                            </div>
                            <div id="drop-zone-assets" class="drop-zone-glass" style="flex: 1; min-width: 120px; padding: 15px;">
                                <span id="drop-text-assets">📦 Asset World<br>(.glb/.gltf)</span>
                            </div>
                            <div id="drop-zone-fbx" class="drop-zone-glass" style="flex: 1; min-width: 120px; padding: 15px;">
                                <span id="drop-text-fbx">📄 Model<br>(.fbx)</span>
                            </div>
                        </div>

                        <div style="margin-top: 10px;">
                            <div style="font-weight: bold; color: #38bdf8; font-size: 13px; margin-bottom: 8px;">🎨 TEKSTUR LAHAN</div>
                            <div id="drop-zone-texture" class="drop-zone-glass" style="width: 100%; height: 60px; margin-bottom: 10px;">
                                <span id="drop-text-texture">📷 Tarik Gambar Tekstur (.png / .jpg)</span>
                            </div>
                            <div id="texture-gallery" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; max-width: 100%;">
                                <span style="color:#aaa; font-size:11px;">Belum ada tekstur.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="player-only-actions" style="padding: 0 24px 24px 24px; display: flex; gap: 10px; font-family: sans-serif;">
                <button id="btn-resume-game" style="flex: 1; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.2s;">▶ LANJUTKAN</button>
            </div>
        `;
    }

    initEvents() {
        if (this.game && this.game.input) {
            const selectCtrl = this.modal.querySelector('#set-tipe-kontrol');
            if (selectCtrl) selectCtrl.value = this.game.input.controlType;
        }

        // Terapkan nilai default jarak pandang saat menu dibuka
        if (this.game && this.game.engine) {
            const sliderRenderDist = this.modal.querySelector('#set-render-dist');
            const valRenderDist = this.modal.querySelector('#val-render-dist');
            if (sliderRenderDist && valRenderDist) {
                const curDist = this.game.engine.currentMaxDistance;
                sliderRenderDist.value = curDist;
                valRenderDist.innerText = `${curDist} Meter`;
            }

            const selectRes = this.modal.querySelector('#set-resolusi');
            if (selectRes) {
                selectRes.value = this.game.engine.currentResolutionLevel;
            }
        }

        const btnClose = this.modal.querySelector('#btn-close-settings');
        const handleClose = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } this.uiManager.closeSettings(); };
        btnClose.onclick = handleClose; btnClose.ontouchstart = handleClose; 

        const btnResume = this.modal.querySelector('#btn-resume-game');
        const handleResume = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } this.uiManager.resumeGame(); };
        btnResume.onclick = handleResume; btnResume.ontouchstart = handleResume;

        // EVENT TOGGLE DEVELOPER ROLE
        const btnToggleDev = this.modal.querySelector('#btn-toggle-dev-role');
        const devToolsBox = this.modal.querySelector('#dev-tools-box');

        btnToggleDev.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (this.uiManager.currentRole === 'player') {
                this.uiManager.setRole('developer');
                btnToggleDev.innerText = '🎮 KEMBALI KE MODE PLAYER';
                btnToggleDev.style.background = '#ef4444';
                btnToggleDev.style.color = '#ffffff';
                if (devToolsBox) devToolsBox.style.display = 'flex';
            } else {
                this.uiManager.setRole('player');
                btnToggleDev.innerText = '🛠️ AKTIFKAN MODE DEVELOPER';
                btnToggleDev.style.background = '#38bdf8';
                btnToggleDev.style.color = '#0f172a';
                if (devToolsBox) devToolsBox.style.display = 'none';
            }
        };

        // BUKA EDITOR LAYOUT HP
        const btnEditLayout = this.modal.querySelector('#btn-edit-layout');
        btnEditLayout.onmouseenter = () => btnEditLayout.style.background = '#d97706';
        btnEditLayout.onmouseleave = () => btnEditLayout.style.background = '#f59e0b';
        const handleEdit = (e) => {
            if(e) { e.preventDefault(); e.stopPropagation(); }
            
            // Maksa ganti ke mobile mode biar editornya bisa dipake walau tadinya mode PC
            if (this.game && this.game.input && this.game.input.controlType !== 'mobile') {
                this.game.input.setControlType('mobile');
                this.modal.querySelector('#set-tipe-kontrol').value = 'mobile';
            }

            this.uiManager.resumeGame(); // Tutup menu settings
            
            if (this.game && this.game.input && this.game.input.mobileController) {
                this.game.input.mobileController.layoutEditor.start(); // Nyalakan editor layout
            }
        };
        btnEditLayout.onclick = handleEdit; btnEditLayout.ontouchstart = handleEdit;

        const tabBtns = this.modal.querySelectorAll('.st-tab-btn');
        const tabContents = this.modal.querySelectorAll('.st-tab-content');

        tabBtns.forEach(btn => {
            const handleTab = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                tabBtns.forEach(b => { b.classList.remove('active'); b.style.background = 'transparent'; b.style.color = b.getAttribute('data-target') === 'st-pengembangan' ? '#f59e0b' : '#cbd5e1'; });
                tabContents.forEach(c => c.style.display = 'none');

                btn.classList.add('active'); btn.style.background = 'rgba(255,255,255,0.1)'; btn.style.color = 'white';
                
                const targetId = btn.getAttribute('data-target');
                this.modal.querySelector('#' + targetId).style.display = 'block';
            };
            btn.onclick = handleTab; btn.ontouchstart = handleTab;
        });

        // INTEGRASI AUDIO MANAGER KE SLIDER VOLUME
        this.modal.querySelector('#set-vol').oninput = (e) => {
            const volValue = e.target.value;
            this.modal.querySelector('#val-vol').innerText = volValue + '%';
            this.settings.dasar.volume = volValue;
            
            // Sinkronisasi volume ke Howler js (range 0.0 - 1.0)
            if (this.game && this.game.audio) {
                this.game.audio.setMasterVolume(volValue / 100);
            }
        };

        // Event Listener Pengubah Jam / Siklus Waktu di Modal Setting
        this.modal.querySelector('#set-time-cycle').onchange = (e) => {
            this.settings.dasar.waktu = e.target.value;
            if (this.game && this.game.timeCycle) {
                this.game.timeCycle.timeMode = e.target.value;
            }
        };

        // SLIDER JARAK PANDANG PRESISI (30m - 1000m)
        this.modal.querySelector('#set-render-dist').oninput = (e) => {
            const distVal = parseInt(e.target.value);
            this.modal.querySelector('#val-render-dist').innerText = `${distVal} Meter`;
            this.settings.grafik.renderDistance = distVal;
            if (this.game && this.game.engine) {
                this.game.engine.setRenderDistance(distVal);
            }
        };

        this.modal.querySelector('#set-fps').onchange = (e) => {
            this.settings.dasar.showFPS = e.target.checked;
        };

        // EVENT LISTENER KUALITAS RESOLUSI RENDER (LOW / MED / HIGH)
        this.modal.querySelector('#set-resolusi').onchange = (e) => {
            this.settings.grafik.resolusi = e.target.value;
            if (this.game && this.game.engine) {
                this.game.engine.setResolutionQuality(e.target.value);
            }
        };

        this.modal.querySelector('#set-bayangan').onchange = (e) => {
            this.settings.grafik.bayangan = e.target.checked;
            if (this.game && this.game.engine && this.game.engine.renderer) {
                this.game.engine.renderer.shadowMap.enabled = e.target.checked;
                this.game.engine.scene.traverse((child) => { if (child.material) child.material.needsUpdate = true; });
            }
        };

        this.modal.querySelector('#set-tipe-kontrol').onchange = (e) => {
            this.settings.kontrol.tipe = e.target.value;
            if (this.game && this.game.input) {
                this.game.input.setControlType(e.target.value);
                if (e.target.value === 'mobile') this.game.input.mobileController.uiContainer.style.display = 'none';
            }
        };

        this.modal.querySelector('#set-sens').oninput = (e) => {
            this.modal.querySelector('#val-sens').innerText = e.target.value;
            this.settings.kontrol.sensitivitas = e.target.value;
            if (this.game && this.game.input) this.game.input.setSensitivity(e.target.value);
        };
    }

    mount(container) {
        if (container) container.appendChild(this.modal);
    }

    updateUIMode() {
        const actionBox = this.modal.querySelector('#player-only-actions');
        if (actionBox) actionBox.style.display = 'flex';
    }
}