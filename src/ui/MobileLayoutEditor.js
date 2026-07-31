/**
 * Modul Editor Layout Mobile (Custom HUD) Level Lanjutan
 * Menangani fungsi drag manual (Anti-Lengket), D-Pad presisi, Skala, dan Transparansi via Smart Toolbox.
 */
export class MobileLayoutEditor {
    constructor(mobileController) {
        this.controller = mobileController;
        this.isEditing = false;
        this.layoutData = JSON.parse(localStorage.getItem('mobile_layout_data')) || {};
        this.activeElement = null;
        this.elements = [];

        this.createEditorUI();
    }

    createEditorUI() {
        // SMART FLOATING TOOLBOX (Menggabungkan semua menu di satu popup)
        this.popup = document.createElement('div');
        this.popup.id = 'layout-popup-tool';
        this.popup.style.cssText = `
            position: fixed; top: 15%; left: 20px; width: 220px;
            background: rgba(15, 23, 42, 0.95); border: 2px solid #38bdf8;
            border-radius: 12px; display: none; flex-direction: column;
            color: white; font-family: sans-serif; z-index: 100001;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7); overflow: hidden;
            user-select: none; -webkit-user-select: none;
        `;

        this.popup.innerHTML = `
            <div id="popup-header" style="background: #0f172a; padding: 12px; cursor: move; text-align: center; border-bottom: 1px solid #334155; font-weight: bold; font-size: 14px; color: #38bdf8;">
                <span id="popup-title">EDITOR LAYOUT</span>
            </div>
            
            <div id="popup-tools" style="padding: 15px; font-size: 12px; display: none; border-bottom: 1px solid #334155; background: rgba(0,0,0,0.2);">
                <div style="text-align: center; margin-bottom: 15px; color: #94a3b8; font-weight: bold;">Geser Presisi</div>
                <div style="display: grid; grid-template-columns: repeat(3, 40px); gap: 5px; justify-content: center; margin-bottom: 15px;">
                    <div></div>
                    <button class="dpad-btn" data-dx="0" data-dy="-1">⬆️</button>
                    <div></div>
                    <button class="dpad-btn" data-dx="-1" data-dy="0">⬅️</button>
                    <button class="dpad-btn" data-dx="0" data-dy="1">⬇️</button>
                    <button class="dpad-btn" data-dx="1" data-dy="0">➡️</button>
                </div>

                <label style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">Ukuran: <span id="val-scale">1.0</span></label>
                <input type="range" id="ed-scale" min="0.5" max="3" step="0.1" value="1" style="width: 100%; margin-bottom: 15px; cursor: pointer;">

                <label style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">Transparansi: <span id="val-alpha">100%</span></label>
                <input type="range" id="ed-alpha" min="0.1" max="1" step="0.1" value="1" style="width: 100%; cursor: pointer;">
            </div>

            <div style="padding: 15px; display: flex; flex-direction: column; gap: 8px;">
                <div id="popup-hint" style="text-align: center; font-size: 11px; color: #cbd5e1; margin-bottom: 5px;">👆 Klik elemen HUD untuk edit</div>
                <button id="btn-layout-save" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 900; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">✅ SIMPAN</button>
                <button id="btn-layout-reset" style="padding: 8px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 900; cursor: pointer;">🔄 RESET DEFAULT</button>
                <button id="btn-layout-cancel" style="padding: 8px; background: #64748b; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">BATAL</button>
            </div>
        `;
        document.body.appendChild(this.popup);

        this.bindEditorEvents();
    }

    bindEditorEvents() {
        // EVENT TOMBOL AKSI
        this.popup.querySelector('#btn-layout-save').onclick = () => this.saveLayout();
        this.popup.querySelector('#btn-layout-reset').onclick = () => this.resetLayout();
        this.popup.querySelector('#btn-layout-cancel').onclick = () => {
            this.applyLayout(); // Balikin posisi ke simpanan terakhir
            this.stop();
        };

        // EVENT DRAG POPUP ITU SENDIRI
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

        // EVENT SLIDER SKALA & OPACITY
        const sliderScale = this.popup.querySelector('#ed-scale');
        sliderScale.oninput = (e) => {
            if (this.activeElement) {
                const val = e.target.value;
                this.popup.querySelector('#val-scale').innerText = val;
                this.activeElement.scale = val;
                
                // Terapkan skala (Khusus minimap & kompas pakai transform murni, yang lain pakai CSS Variable)
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

        // EVENT D-PAD PRESISI (Bisa ditahan)
        const dpadBtns = this.popup.querySelectorAll('.dpad-btn');
        let moveInterval;

        dpadBtns.forEach(btn => {
            const dx = parseInt(btn.getAttribute('data-dx'));
            const dy = parseInt(btn.getAttribute('data-dy'));

            const startMove = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (!this.activeElement) return;
                btn.style.background = '#38bdf8';
                
                // Eksekusi gerak berulang-ulang saat tombol ditahan
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
                btn.style.background = 'initial';
                clearInterval(moveInterval);
            };

            btn.addEventListener('touchstart', startMove, { passive: false });
            btn.addEventListener('mousedown', startMove);
            btn.addEventListener('touchend', stopMove);
            btn.addEventListener('mouseup', stopMove);
            btn.addEventListener('mouseleave', stopMove);
        });
    }

    initElements() {
        this.elements = [
            { id: 'joyBase', el: this.controller.joyBase, name: 'Analog Joystick' },
            { id: 'btnJump', el: this.controller.btnJump, name: 'Tombol Lompat' },
            { id: 'btnSprint', el: this.controller.btnSprint, name: 'Tombol Lari' },
            { id: 'btnAction1', el: this.controller.btnAction1, name: 'Tombol Aksi 1' },
            { id: 'btnAction2', el: this.controller.btnAction2, name: 'Tombol Aksi 2' },
            { id: 'btnSettings', el: this.controller.btnSettings, name: 'Tombol Pengaturan' }
        ];

        // Memburu dan menangkap elemen Minimap & Kompas
        const minimapEl = document.getElementById('minimap') || document.querySelector('.minimap') || document.getElementById('minimap-container');
        if (minimapEl) this.elements.push({ id: 'minimap', el: minimapEl, name: 'Peta Mini' });

        const compassEl = document.getElementById('fps-compass-hud');
        if (compassEl) this.elements.push({ id: 'compass', el: compassEl, name: 'Arah Mata Angin' });

        this.elements.forEach(item => {
            if (!item.el) return;
            
            // Simpan posisi pointer-event asli, lalu paksa jadi 'auto' biar bisa diklik!
            item.originalPointerEvents = item.el.style.pointerEvents || getComputedStyle(item.el).pointerEvents;
            item.el.style.pointerEvents = 'auto';
            item.el.style.transition = 'transform 0.1s';
            item.el.style.zIndex = '99998'; 
            
            // Terapkan nilai saat ini dari layoutData atau default
            item.scale = this.layoutData[item.id] ? this.layoutData[item.id].scale : 1;
            item.opacity = this.layoutData[item.id] && this.layoutData[item.id].opacity !== undefined ? this.layoutData[item.id].opacity : 1;
            
            // Event Drag Manual Elemen
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

            const onEnd = (e) => {
                if (!this.isEditing || !item.isDragging) return;
                item.isDragging = false;
            };

            // Pasang event capturing biar nggak lengket ditimpa event lain
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
            if (i.el) i.el.style.boxShadow = (i.id === 'joyBase' || i.id.includes('btn')) ? 'none' : i.el.style.boxShadow;
        });

        // Kembalikan popup ke state awal (tanpa tools)
        this.popup.querySelector('#popup-title').innerText = 'EDITOR LAYOUT';
        this.popup.querySelector('#popup-tools').style.display = 'none';
        this.popup.querySelector('#popup-hint').style.display = 'block';
    }

    setActiveElement(item) {
        this.clearSelection();
        this.activeElement = item;
        
        // Kasih efek menyala (glow) warna hijau ke elemen yang lagi dipilih
        item.el.style.boxShadow = '0 0 20px 5px #10b981'; 

        // Update Info di Popup & Tampilkan area Tools
        this.popup.querySelector('#popup-title').innerText = item.name.toUpperCase();
        this.popup.querySelector('#popup-tools').style.display = 'block';
        this.popup.querySelector('#popup-hint').style.display = 'none';

        this.popup.querySelector('#ed-scale').value = item.scale || 1;
        this.popup.querySelector('#val-scale').innerText = item.scale || 1;
        
        this.popup.querySelector('#ed-alpha').value = item.opacity !== undefined ? item.opacity : 1;
        this.popup.querySelector('#val-alpha').innerText = Math.round((item.opacity !== undefined ? item.opacity : 1) * 100) + '%';
    }

    start() {
        this.isEditing = true;
        this.initElements();
        
        this.popup.style.display = 'flex';
        this.clearSelection(); // Set popup ke mode awal
        
        // Memunculkan area HUD agar bisa disentuh
        this.controller.uiContainer.style.pointerEvents = 'auto';
        this.controller.uiContainer.style.background = 'rgba(0, 0, 0, 0.6)'; 
    }

    stop() {
        this.isEditing = false;
        this.activeElement = null;
        
        this.popup.style.display = 'none';
        
        // Kembalikan area HUD menjadi tembus pandang
        this.controller.uiContainer.style.pointerEvents = 'none';
        this.controller.uiContainer.style.background = 'transparent';

        // Kembalikan sifat elemen ke aslinya
        this.elements.forEach(item => {
            if (!item.el) return;
            item.el.style.pointerEvents = item.originalPointerEvents; 
            item.el.style.boxShadow = 'none';
            item.el.style.zIndex = ''; 
        });
    }

    saveLayout() {
        this.elements.forEach(item => {
            if (!item.el) return;
            // Konversi ke persentase layar (VW/VH) agar responsif
            const vw = (item.el.offsetLeft / window.innerWidth) * 100;
            const vh = (item.el.offsetTop / window.innerHeight) * 100;
            this.layoutData[item.id] = { 
                left: vw, 
                top: vh, 
                scale: parseFloat(item.scale),
                opacity: parseFloat(item.opacity !== undefined ? item.opacity : 1) 
            };
        });

        localStorage.setItem('mobile_layout_data', JSON.stringify(this.layoutData));
        this.stop();
        
        // Kasih efek notifikasi elegan di tengah layar
        const toast = document.createElement('div');
        toast.innerHTML = '✅ Layout Tersimpan!';
        toast.style.cssText = `position: fixed; top: 20%; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 10px 20px; border-radius: 8px; font-weight: bold; z-index: 999999; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: 0.5s opacity;`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
    }

    resetLayout() {
        if(confirm('Kembalikan semua tombol ke susunan default?')) {
            localStorage.removeItem('mobile_layout_data');
            this.layoutData = {};
            location.reload(); 
        }
    }

    applyLayout() {
        this.initElements();
        this.elements.forEach(item => {
            if (!item.el) return;
            const data = this.layoutData[item.id];
            
            if (data) {
                // Terapkan Posisi Absolut
                item.el.style.position = 'fixed';
                item.el.style.left = data.left + 'vw';
                item.el.style.top = data.top + 'vh';
                item.el.style.bottom = 'auto';
                item.el.style.right = 'auto';
                
                // Terapkan Opacity
                item.opacity = data.opacity !== undefined ? data.opacity : 1;
                item.el.style.opacity = item.opacity;

                // Terapkan Skala
                item.scale = data.scale;
                if (item.id === 'minimap') {
                    item.el.style.transform = `scale(${data.scale})`;
                    item.el.style.transformOrigin = 'top left';
                } else if (item.id === 'compass') {
                    item.el.style.transform = `translateX(-50%) scale(${data.scale})`;
                    item.el.style.transformOrigin = 'top center';
                } else {
                    item.el.style.setProperty('--layout-scale', data.scale);
                }
            } else {
                item.el.style.setProperty('--layout-scale', 1);
                item.scale = 1;
                item.opacity = 1;
                item.el.style.opacity = 1;
            }
            
            item.el.style.pointerEvents = item.originalPointerEvents;
        });
    }
}