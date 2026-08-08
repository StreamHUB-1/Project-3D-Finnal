/**
 * Konfigurasi Layout Default Utama Perangkat Mobile
 * UPDATE: Penyesuaian layout default untuk memasukkan tombol SNEAK
 */
export const DEFAULT_MOBILE_LAYOUT = {
    "joyBase": { "left": 12.67, "top": 77.37, "scale": 1, "opacity": 1, "hidden": false },
    "btnJump": { "left": 90.38, "top": 63.75, "scale": 0.8, "opacity": 1, "hidden": false },
    "btnSprint": { "left": 84.95, "top": 81.02, "scale": 1, "opacity": 1, "hidden": false },
    "btnSneak": { "left": 84.95, "top": 70.00, "scale": 0.9, "opacity": 1, "hidden": false },
    "btnAutoRun": { "left": 84.95, "top": 50.50, "scale": 0.9, "opacity": 1, "hidden": false },
    "btnAction1": { "left": 0, "top": 0, "scale": 1, "opacity": 1, "hidden": true },
    "btnAction2": { "left": 0, "top": 0, "scale": 1, "opacity": 1, "hidden": true },
    "btnSettings": { "left": 92.19, "top": 4.87, "scale": 1, "opacity": 1, "hidden": false },
    "btnFullscreen": { "left": 85.75, "top": 4.87, "scale": 1, "opacity": 1, "hidden": false },
    "minimap": { "left": 1.02, "top": 1.7, "scale": 0.7, "opacity": 1, "hidden": false },
    "compass": { "left": 50, "top": 2.43, "scale": 0.5, "opacity": 1, "hidden": false },
    "statusHud": { "left": 12.1, "top": 1.7, "scale": 1, "opacity": 1, "hidden": false }
};

/**
 * Modul Editor Layout Mobile (Custom HUD) Level Lanjutan
 * Menangani fungsi drag manual (Anti-Lengket), D-Pad presisi, Skala, Transparansi, Hapus/Sembunyikan,
 * serta fitur Export "📋 SALIN KODE LAYOUT" ke Clipboard.
 */
export class MobileLayoutEditor {
    constructor(mobileController) {
        this.controller = mobileController;
        this.isEditing = false;
        
        // Memuat layout simpanan pengguna atau menggunakan layout default jika kosong
        const savedData = localStorage.getItem('mobile_layout_data');
        this.layoutData = savedData ? JSON.parse(savedData) : JSON.parse(JSON.stringify(DEFAULT_MOBILE_LAYOUT));
        
        // UPDATE: Pemeriksaan tambahan agar format yang disimpan kompatibel jika btnSneak belum ada (mencegah undefined error)
        if (!this.layoutData['btnSneak']) {
            this.layoutData['btnSneak'] = DEFAULT_MOBILE_LAYOUT['btnSneak'];
        }

        this.activeElement = null;
        this.elements = [];

        this.createEditorUI();
    }

    createEditorUI() {
        // SMART FLOATING TOOLBOX (Menggabungkan semua menu di satu popup)
        this.popup = document.createElement('div');
        this.popup.id = 'layout-popup-tool';
        this.popup.style.cssText = `
            position: fixed; top: 10%; left: 20px; width: 230px;
            background: rgba(15, 23, 42, 0.95); border: 2px solid #38bdf8;
            border-radius: 12px; display: none; flex-direction: column;
            color: white; font-family: sans-serif; z-index: 100001;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7); overflow: hidden;
            user-select: none; -webkit-user-select: none;
        `;

        this.popup.innerHTML = `
            <div id="popup-header" style="background: #0f172a; padding: 12px; cursor: move; text-align: center; border-bottom: 1px solid #334155; font-weight: bold; font-size: 13px; color: #38bdf8;">
                <span id="popup-title">EDITOR LAYOUT</span>
            </div>
            
            <div id="popup-tools" style="padding: 12px; font-size: 11px; display: none; border-bottom: 1px solid #334155; background: rgba(0,0,0,0.2);">
                <div style="text-align: center; margin-bottom: 10px; color: #94a3b8; font-weight: bold;">Geser Presisi (D-Pad)</div>
                <div style="display: grid; grid-template-columns: repeat(3, 36px); gap: 4px; justify-content: center; margin-bottom: 12px;">
                    <div></div>
                    <button class="dpad-btn" data-dx="0" data-dy="-1" style="padding: 6px; background:#1e293b; border:1px solid #475569; color:white; border-radius:4px; cursor:pointer;">⬆️</button>
                    <div></div>
                    <button class="dpad-btn" data-dx="-1" data-dy="0" style="padding: 6px; background:#1e293b; border:1px solid #475569; color:white; border-radius:4px; cursor:pointer;">⬅️</button>
                    <button class="dpad-btn" data-dx="0" data-dy="1" style="padding: 6px; background:#1e293b; border:1px solid #475569; color:white; border-radius:4px; cursor:pointer;">⬇️</button>
                    <button class="dpad-btn" data-dx="1" data-dy="0" style="padding: 6px; background:#1e293b; border:1px solid #475569; color:white; border-radius:4px; cursor:pointer;">➡️</button>
                </div>

                <label style="display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: bold;">Ukuran: <span id="val-scale">1.0</span></label>
                <input type="range" id="ed-scale" min="0.5" max="3" step="0.1" value="1" style="width: 100%; margin-bottom: 10px; cursor: pointer;">

                <label style="display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: bold;">Transparansi: <span id="val-alpha">100%</span></label>
                <input type="range" id="ed-alpha" min="0.1" max="1" step="0.1" value="1" style="width: 100%; margin-bottom: 10px; cursor: pointer;">

                <button id="btn-toggle-visible" style="width: 100%; padding: 8px; background: #ab47bc; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">👁️ TERSEMBUNYI: NO</button>
            </div>

            <div style="padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                <div id="popup-hint" style="text-align: center; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">👆 Klik elemen HUD mana saja untuk edit</div>
                <button id="btn-layout-save" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 900; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">✅ SIMPAN</button>
                <button id="btn-layout-copy" style="padding: 8px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: 900; cursor: pointer;">📋 SALIN KODE LAYOUT</button>
                <button id="btn-layout-reset" style="padding: 8px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 900; cursor: pointer;">🔄 RESET DEFAULT</button>
                <button id="btn-layout-cancel" style="padding: 8px; background: #64748b; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">BATAL</button>
            </div>
        `;
        document.body.appendChild(this.popup);

        this.bindEditorEvents();
    }

    bindEditorEvents() {
        this.popup.querySelector('#btn-layout-save').onclick = () => this.saveLayout();
        this.popup.querySelector('#btn-layout-copy').onclick = () => this.copyLayoutCode();
        this.popup.querySelector('#btn-layout-reset').onclick = () => this.resetLayout();
        this.popup.querySelector('#btn-layout-cancel').onclick = () => {
            this.applyLayout(); 
            this.stop();
        };

        const btnToggleVis = this.popup.querySelector('#btn-toggle-visible');
        btnToggleVis.onclick = () => {
            if (this.activeElement) {
                this.activeElement.hidden = !this.activeElement.hidden;
                this.updateVisibilityUI();
            }
        };

        const header = this.popup.querySelector('#popup-header');
        let isDraggingPopup = false, pStartX, pStartY, pInitX, pInitY;

        const pStart = (e) => {
            isDraggingPopup = true;
            const t = e.touches ? e.touches[0] : e;
            pStartX = t.clientX; pStartY = t.clientY;
            pInitX = this.popup.offsetLeft; pInitY = this.popup.offsetTop;
        };
        const pMove = (e) => {
            if (!isDraggingPopup) return;
            e.preventDefault();
            const t = e.touches ? e.touches[0] : e;
            this.popup.style.left = (pInitX + (t.clientX - pStartX)) + 'px';
            this.popup.style.top = (pInitY + (t.clientY - pStartY)) + 'px';
        };
        const pEnd = () => { isDraggingPopup = false; };

        header.addEventListener('touchstart', pStart, { passive: false });
        document.addEventListener('touchmove', pMove, { passive: false });
        document.addEventListener('touchend', pEnd);
        header.addEventListener('mousedown', pStart);
        document.addEventListener('mousemove', pMove);
        document.addEventListener('mouseup', pEnd);

        const sliderScale = this.popup.querySelector('#ed-scale');
        sliderScale.oninput = (e) => {
            if (this.activeElement) {
                const val = e.target.value;
                this.popup.querySelector('#val-scale').innerText = val;
                this.activeElement.scale = val;
                
                if (this.activeElement.id === 'minimap') {
                    this.activeElement.el.style.transform = `scale(${val})`;
                    this.activeElement.el.style.transformOrigin = 'top left';
                } else if (this.activeElement.id === 'compass') {
                    this.activeElement.el.style.transform = `translateX(-50%) scale(${val})`;
                    this.activeElement.el.style.transformOrigin = 'top center';
                } else {
                    this.activeElement.el.style.setProperty('--layout-scale', val);
                }
            }
        };

        const sliderAlpha = this.popup.querySelector('#ed-alpha');
        sliderAlpha.oninput = (e) => {
            if (this.activeElement) {
                const val = e.target.value;
                this.popup.querySelector('#val-alpha').innerText = Math.round(val * 100) + '%';
                this.activeElement.opacity = val;
                this.activeElement.el.style.opacity = val;
            }
        };

        const dpadBtns = this.popup.querySelectorAll('.dpad-btn');
        let moveInterval;

        dpadBtns.forEach(btn => {
            const dx = parseInt(btn.getAttribute('data-dx'));
            const dy = parseInt(btn.getAttribute('data-dy'));

            const startMove = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (!this.activeElement) return;
                btn.style.background = '#38bdf8';
                
                moveInterval = setInterval(() => {
                    let el = this.activeElement.el;
                    let curLeft = parseFloat(el.style.left) || el.offsetLeft;
                    let curTop = parseFloat(el.style.top) || el.offsetTop;
                    el.style.left = (curLeft + dx) + 'px';
                    el.style.top = (curTop + dy) + 'px';
                }, 30);
            };

            const stopMove = (e) => {
                e.preventDefault(); e.stopPropagation();
                btn.style.background = '#1e293b';
                clearInterval(moveInterval);
            };

            btn.addEventListener('touchstart', startMove, { passive: false });
            btn.addEventListener('mousedown', startMove);
            btn.addEventListener('touchend', stopMove);
            btn.addEventListener('mouseup', stopMove);
            btn.addEventListener('mouseleave', stopMove);
        });
    }

    updateVisibilityUI() {
        if (!this.activeElement) return;
        const btnToggleVis = this.popup.querySelector('#btn-toggle-visible');
        if (this.activeElement.hidden) {
            btnToggleVis.innerText = '👁️ TERSEMBUNYI: YES (TIDAK TAMPIL)';
            btnToggleVis.style.background = '#e11d48';
            this.activeElement.el.style.opacity = '0.2';
        } else {
            btnToggleVis.innerText = '👁️ TERSEMBUNYI: NO (TAMPIL)';
            btnToggleVis.style.background = '#ab47bc';
            this.activeElement.el.style.opacity = this.activeElement.opacity || 1;
        }
    }

    initElements() {
        this.elements = [
            { id: 'joyBase', el: this.controller.joyBase, name: 'Analog Joystick' },
            { id: 'btnJump', el: this.controller.btnJump, name: 'Tombol Lompat' },
            { id: 'btnSprint', el: this.controller.btnSprint, name: 'Tombol Lari' },
            // UPDATE: Memasukkan btnSneak ke daftar elemen editor
            { id: 'btnSneak', el: this.controller.btnSneak, name: 'Tombol Ngendap (Sneak)' },
            { id: 'btnAutoRun', el: this.controller.btnAutoRun, name: 'Tombol Auto Run' },
            { id: 'btnAction1', el: this.controller.btnAction1, name: 'Tombol Aksi 1' },
            { id: 'btnAction2', el: this.controller.btnAction2, name: 'Tombol Aksi 2' },
            { id: 'btnSettings', el: this.controller.btnSettings, name: 'Tombol Pengaturan' },
            { id: 'btnFullscreen', el: this.controller.btnFullscreen, name: 'Tombol Fullscreen' }
        ];

        const minimapEl = document.getElementById('minimap-container') || document.getElementById('minimap') || document.querySelector('.minimap');
        if (minimapEl) this.elements.push({ id: 'minimap', el: minimapEl, name: 'Peta Mini' });

        const compassEl = document.getElementById('fps-compass-hud');
        if (compassEl) this.elements.push({ id: 'compass', el: compassEl, name: 'Kompas Arah' });

        const statusHudEl = document.getElementById('status-hud');
        if (statusHudEl) this.elements.push({ id: 'statusHud', el: statusHudEl, name: 'Jam & Koordinat' });

        this.elements.forEach(item => {
            if (!item.el) return;
            
            item.originalPointerEvents = item.el.style.pointerEvents || getComputedStyle(item.el).pointerEvents;
            item.el.style.pointerEvents = 'auto';
            item.el.style.transition = 'transform 0.1s';
            item.el.style.zIndex = '99998'; 
            
            item.scale = this.layoutData[item.id] ? this.layoutData[item.id].scale : 1;
            item.opacity = this.layoutData[item.id] && this.layoutData[item.id].opacity !== undefined ? this.layoutData[item.id].opacity : 1;
            item.hidden = this.layoutData[item.id] && this.layoutData[item.id].hidden !== undefined ? this.layoutData[item.id].hidden : false;

            let startX, startY, initialLeft, initialTop;

            const onStart = (e) => {
                if (!this.isEditing) return;
                e.preventDefault(); e.stopPropagation();
                
                this.setActiveElement(item);

                const touch = e.touches ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                initialLeft = item.el.offsetLeft;
                initialTop = item.el.offsetTop;
                item.isDragging = true;
            };

            const onMove = (e) => {
                if (!this.isEditing || !item.isDragging) return;
                e.preventDefault(); e.stopPropagation();

                const touch = e.touches ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;

                item.el.style.position = 'fixed';
                item.el.style.left = (initialLeft + dx) + 'px';
                item.el.style.top = (initialTop + dy) + 'px';
                item.el.style.bottom = 'auto';
                item.el.style.right = 'auto';
            };

            const onEnd = () => {
                if (!this.isEditing || !item.isDragging) return;
                item.isDragging = false;
            };

            item.el.addEventListener('touchstart', onStart, { passive: false, capture: true });
            item.el.addEventListener('mousedown', onStart, true);
            
            document.addEventListener('touchmove', onMove, { passive: false, capture: true });
            document.addEventListener('mousemove', onMove, true);
            
            document.addEventListener('touchend', onEnd, true);
            document.addEventListener('mouseup', onEnd, true);
        });
    }

    clearSelection() {
        this.activeElement = null;
        this.elements.forEach(i => {
            if (i.el) {
                i.el.style.boxShadow = 'none';
                if (i.hidden) i.el.style.display = 'none';
            }
        });

        this.popup.querySelector('#popup-title').innerText = 'EDITOR LAYOUT';
        this.popup.querySelector('#popup-tools').style.display = 'none';
        this.popup.querySelector('#popup-hint').style.display = 'block';
    }

    setActiveElement(item) {
        this.clearSelection();
        this.activeElement = item;
        
        if (item.hidden) item.el.style.display = 'flex';

        item.el.style.boxShadow = '0 0 20px 5px #10b981'; 

        this.popup.querySelector('#popup-title').innerText = item.name.toUpperCase();
        this.popup.querySelector('#popup-tools').style.display = 'block';
        this.popup.querySelector('#popup-hint').style.display = 'none';

        this.popup.querySelector('#ed-scale').value = item.scale || 1;
        this.popup.querySelector('#val-scale').innerText = item.scale || 1;
        
        this.popup.querySelector('#ed-alpha').value = item.opacity !== undefined ? item.opacity : 1;
        this.popup.querySelector('#val-alpha').innerText = Math.round((item.opacity !== undefined ? item.opacity : 1) * 100) + '%';

        this.updateVisibilityUI();
    }

    start() {
        this.isEditing = true;
        this.initElements();
        
        this.popup.style.display = 'flex';
        this.clearSelection(); 
        
        this.controller.uiContainer.style.pointerEvents = 'auto';
        this.controller.uiContainer.style.background = 'rgba(0, 0, 0, 0.6)'; 

        this.elements.forEach(item => {
            if (item.el) {
                item.el.style.display = 'flex';
                if (item.hidden) item.el.style.opacity = '0.25';
            }
        });
    }

    stop() {
        this.isEditing = false;
        this.activeElement = null;
        
        this.popup.style.display = 'none';
        
        this.controller.uiContainer.style.pointerEvents = 'none';
        this.controller.uiContainer.style.background = 'transparent';

        this.elements.forEach(item => {
            if (!item.el) return;
            item.el.style.pointerEvents = item.originalPointerEvents;
            item.el.style.boxShadow = 'none';
            item.el.style.zIndex = ''; 

            if (item.hidden) {
                item.el.style.display = 'none';
            } else {
                item.el.style.display = 'flex';
            }
        });
    }

    saveLayout() {
        this.elements.forEach(item => {
            if (!item.el) return;
            const vw = (item.el.offsetLeft / window.innerWidth) * 100;
            const vh = (item.el.offsetTop / window.innerHeight) * 100;
            this.layoutData[item.id] = { 
                left: parseFloat(vw.toFixed(2)), 
                top: parseFloat(vh.toFixed(2)), 
                scale: parseFloat(item.scale),
                opacity: parseFloat(item.opacity !== undefined ? item.opacity : 1),
                hidden: item.hidden || false
            };
        });

        localStorage.setItem('mobile_layout_data', JSON.stringify(this.layoutData));
        this.stop();
        this.showToast('✅ Layout Berhasil Disimpan!');
    }

    /**
     * Memformat & Menyalin seluruh data konfigurasi layout JSON ke Clipboard
     */
    copyLayoutCode() {
        this.elements.forEach(item => {
            if (!item.el) return;
            const vw = (item.el.offsetLeft / window.innerWidth) * 100;
            const vh = (item.el.offsetTop / window.innerHeight) * 100;
            this.layoutData[item.id] = { 
                left: parseFloat(vw.toFixed(2)), 
                top: parseFloat(vh.toFixed(2)), 
                scale: parseFloat(item.scale),
                opacity: parseFloat(item.opacity !== undefined ? item.opacity : 1),
                hidden: item.hidden || false
            };
        });

        const jsonString = JSON.stringify(this.layoutData, null, 2);
        const formattedCode = `const DEFAULT_MOBILE_LAYOUT = ${jsonString};`;

        navigator.clipboard.writeText(formattedCode).then(() => {
            this.showToast('📋 Kode layout berhasil disalin ke Clipboard!');
        }).catch(err => {
            console.error('Gagal menyalin kode:', err);
            this.showToast('❌ Gagal menyalin kode layout!');
        });
    }

    resetLayout() {
        if (confirm("Reset layout ke pengaturan awal?")) {
            localStorage.removeItem('mobile_layout_data');
            this.layoutData = JSON.parse(JSON.stringify(DEFAULT_MOBILE_LAYOUT));
            this.applyLayout();
            this.stop();
            this.showToast('🔄 Layout direset ke default!');
        }
    }

    applyLayout() {
        const layout = this.layoutData;
        if (!layout) return;

        const applyToElement = (id, el) => {
            if (!el || !layout[id]) return;
            const data = layout[id];
            
            el.style.position = 'absolute';
            el.style.left = `${data.left}vw`;
            el.style.top = `${data.top}vh`;
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            
            if (id === 'minimap') {
                el.style.transform = `scale(${data.scale || 1})`;
                el.style.transformOrigin = 'top left';
            } else if (id === 'compass') {
                el.style.transform = `translateX(-50%) scale(${data.scale || 1})`;
                el.style.transformOrigin = 'top center';
            } else {
                el.style.setProperty('--layout-scale', data.scale || 1);
            }
            
            el.style.opacity = data.opacity !== undefined ? data.opacity : 1;
            el.style.display = data.hidden ? 'none' : 'flex';
        };

        applyToElement('joyBase', this.controller.joyBase);
        applyToElement('btnJump', this.controller.btnJump);
        applyToElement('btnSprint', this.controller.btnSprint);
        applyToElement('btnSneak', this.controller.btnSneak); // Terapkan posisi tombol Sneak
        applyToElement('btnAutoRun', this.controller.btnAutoRun);
        applyToElement('btnAction1', this.controller.btnAction1);
        applyToElement('btnAction2', this.controller.btnAction2);
        applyToElement('btnSettings', this.controller.btnSettings);
        applyToElement('btnFullscreen', this.controller.btnFullscreen);
        
        applyToElement('minimap', document.getElementById('minimap-container') || document.getElementById('minimap') || document.querySelector('.minimap'));
        applyToElement('compass', document.getElementById('fps-compass-hud'));
        applyToElement('statusHud', document.getElementById('status-hud'));
    }

    showToast(message) {
        let toast = document.getElementById('layout-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'layout-toast';
            toast.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8); color: white; padding: 10px 20px;
                border-radius: 20px; font-family: sans-serif; font-size: 12px; font-weight: bold;
                z-index: 100002; transition: opacity 0.3s; opacity: 0; pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }
}