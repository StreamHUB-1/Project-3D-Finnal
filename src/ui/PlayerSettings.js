/**
 * Modul Pengaturan Pemain (Player Settings)
 */
export class PlayerSettings {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.settings = {
            dasar: { volume: 100, showFPS: false },
            grafik: { resolusi: 'high', bayangan: true },
            kontrol: { tipe: 'pc', sensitivitas: 50 }
        };

        this.initUI();
        this.initEvents();
    }

    initUI() {
        this.modal = document.createElement('div');
        this.modal.id = 'player-settings-modal';
        this.modal.style.cssText = `
            background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); border-radius: 12px; width: 500px; max-width: 90%;
            overflow: hidden; display: none; flex-direction: column; color: #f8fafc; z-index: 100000;
        `;

        this.modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h2 style="margin: 0; font-size: 18px; color: #38bdf8; font-family: sans-serif; font-weight: 800;">⚙️ PENGATURAN</h2>
                <button id="btn-close-settings" style="background: none; border: none; color: #ef4444; font-size: 24px; cursor: pointer; font-weight: bold; padding: 5px 15px; margin: -5px -15px; transition: 0.2s;">✕</button>
            </div>
            <div style="display: flex; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.1); font-family: sans-serif;">
                <button class="st-tab-btn active" data-target="st-dasar" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; font-weight: bold; border-bottom: 2px solid #38bdf8;">Dasar</button>
                <button class="st-tab-btn" data-target="st-grafik" style="flex: 1; padding: 12px; background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-weight: bold; border-bottom: 2px solid transparent;">Grafik</button>
                <button class="st-tab-btn" data-target="st-kontrol" style="flex: 1; padding: 12px; background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-weight: bold; border-bottom: 2px solid transparent;">Kontrol</button>
            </div>
            <div style="padding: 20px; font-family: sans-serif; font-size: 14px;">
                <div id="st-dasar" class="st-tab-content" style="display: block;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">Volume Master: <span id="val-vol">100%</span></label>
                        <input type="range" id="set-vol" min="0" max="100" value="100" style="width: 100%; cursor: pointer;">
                    </div>
                    <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-weight: bold;">Tampilkan FPS di Layar</label>
                        <input type="checkbox" id="set-fps" style="width: 18px; height: 18px; cursor: pointer;">
                    </div>
                </div>
                <div id="st-grafik" class="st-tab-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Kualitas Resolusi Render</label>
                        <select id="set-resolusi" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); color: white; border: 1px solid #475569; border-radius: 4px; cursor: pointer;">
                            <option value="low">Rendah (Performa Tinggi)</option>
                            <option value="med">Sedang (Seimbang)</option>
                            <option value="high" selected>Tinggi (Visual Tajam)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-weight: bold;">Aktifkan Bayangan Real-Time</label>
                        <input type="checkbox" id="set-bayangan" checked style="width: 18px; height: 18px; cursor: pointer;">
                    </div>
                </div>
                <div id="st-kontrol" class="st-tab-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Jenis Perangkat Kontrol</label>
                        <select id="set-tipe-kontrol" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); color: white; border: 1px solid #475569; border-radius: 4px; cursor: pointer;">
                            <option value="pc" selected>Keyboard & Mouse (PC)</option>
                            <option value="mobile">Layar Sentuh / Joystick (HP)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">Sensitivitas Kamera: <span id="val-sens">50</span></label>
                        <input type="range" id="set-sens" min="1" max="100" value="50" style="width: 100%; cursor: pointer;">
                    </div>
                    <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <button id="btn-edit-layout" style="width: 100%; padding: 12px; background: #f59e0b; color: #fff; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s;">📐 SESUAIKAN LAYOUT HUD (HP)</button>
                    </div>
                </div>
            </div>
            <div id="player-only-actions" style="padding: 0 20px 20px 20px; display: none; gap: 10px; font-family: sans-serif;">
                <button id="btn-resume-game" style="flex: 1; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; transition: 0.2s;">▶ LANJUTKAN</button>
                <button id="btn-logout-player" style="flex: 1; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; transition: 0.2s;">🚪 GANTI PERAN</button>
            </div>
        `;
    }

    initEvents() {
        if (this.game && this.game.input) {
            const selectCtrl = this.modal.querySelector('#set-tipe-kontrol');
            if (selectCtrl) selectCtrl.value = this.game.input.controlType;
        }

        const btnClose = this.modal.querySelector('#btn-close-settings');
        const handleClose = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } this.uiManager.closeSettings(); };
        btnClose.onclick = handleClose; btnClose.ontouchstart = handleClose; 

        const btnResume = this.modal.querySelector('#btn-resume-game');
        const handleResume = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } this.uiManager.resumeGame(); };
        btnResume.onclick = handleResume; btnResume.ontouchstart = handleResume;

        const btnLogout = this.modal.querySelector('#btn-logout-player');
        const handleLogout = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } this.uiManager.logout(); };
        btnLogout.onclick = handleLogout; btnLogout.ontouchstart = handleLogout;

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
                tabBtns.forEach(b => { b.classList.remove('active'); b.style.background = 'transparent'; b.style.borderBottom = '2px solid transparent'; b.style.color = '#cbd5e1'; });
                tabContents.forEach(c => c.style.display = 'none');

                btn.classList.add('active'); btn.style.background = 'rgba(255,255,255,0.1)'; btn.style.borderBottom = '2px solid #38bdf8'; btn.style.color = 'white';
                
                const targetId = btn.getAttribute('data-target');
                this.modal.querySelector('#' + targetId).style.display = 'block';
            };
            btn.onclick = handleTab; btn.ontouchstart = handleTab;
        });

        this.modal.querySelector('#set-vol').oninput = (e) => {
            this.modal.querySelector('#val-vol').innerText = e.target.value + '%';
            this.settings.dasar.volume = e.target.value;
        };

        this.modal.querySelector('#set-fps').onchange = (e) => {
            this.settings.dasar.showFPS = e.target.checked;
        };

        this.modal.querySelector('#set-resolusi').onchange = (e) => {
            this.settings.grafik.resolusi = e.target.value;
            if (this.game && this.game.engine && this.game.engine.renderer) {
                const renderer = this.game.engine.renderer;
                if (e.target.value === 'low') renderer.setPixelRatio(0.7);
                else if (e.target.value === 'med') renderer.setPixelRatio(1.0);
                else if (e.target.value === 'high') renderer.setPixelRatio(window.devicePixelRatio);
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
        if (actionBox) actionBox.style.display = (this.uiManager.currentRole === 'player') ? 'flex' : 'none';
    }
}