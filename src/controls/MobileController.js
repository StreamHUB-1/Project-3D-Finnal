import { MobileLayoutEditor } from '../ui/MobileLayoutEditor.js';

/**
 * Modul Kontrol Layar Sentuh (Mobile / HP)
 */
export class MobileController {
    constructor(manager) {
        this.manager = manager;
        this.enabled = false;
        this.uiContainer = null;
        
        this.joystickData = { active: false, identifier: null, originX: 0, originY: 0 };
        this.lookData = { active: false, identifier: null, lastX: 0, lastY: 0 };
        
        this.createUI();
        this.createOrientationOverlay();
        
        // Inisialisasi Modul Editor Layout Custom
        this.layoutEditor = new MobileLayoutEditor(this);

        this.bindEvents();
    }

    /**
     * Memperbarui tampilan tombol Auto-Run di Mobile HUD saat di-toggle
     * @param {boolean} active - Status aktif Auto-Run
     */
    updateAutoRunUI(active) {
        if (this.btnAutoRun) {
            if (active) {
                this.btnAutoRun.style.background = '#10b981';
                this.btnAutoRun.style.borderColor = '#6ee7b7';
                this.btnAutoRun.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.8)';
            } else {
                this.btnAutoRun.style.background = 'rgba(0,0,0,0.4)';
                this.btnAutoRun.style.borderColor = 'rgba(255,255,255,0.3)';
                this.btnAutoRun.style.boxShadow = 'none';
            }
        }
    }

    /**
     * Mengaktifkan Mode Fullscreen HP (Mirip F11 di PC)
     */
    toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const docEl = document.documentElement;
            if (docEl.requestFullscreen) {
                docEl.requestFullscreen().catch(() => {});
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    /**
     * Membuat overlay peringatan rotasi layar saat dalam posisi Portrait
     */
    createOrientationOverlay() {
        this.orientationOverlay = document.createElement('div');
        this.orientationOverlay.id = 'orientation-overlay';
        this.orientationOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #090d16; color: #ffffff; z-index: 999999;
            display: none; flex-direction: column; justify-content: center;
            align-items: center; text-align: center; padding: 20px;
            box-sizing: border-box; font-family: 'Segoe UI', Roboto, sans-serif;
        `;

        this.orientationOverlay.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 20px; animation: rotatePhone 2s infinite ease-in-out;">📱</div>
            <h2 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 0 0 10px 0; letter-spacing: 1px;">MOHON MIRINGKAN HP ANDA</h2>
            <p style="font-size: 13px; color: #94a3b8; max-width: 320px; margin: 0 0 20px 0; line-height: 1.5;">Putar perangkat ke mode Landscape untuk pengalaman bermain game 3D yang optimal.</p>
            <button id="btn-force-fullscreen-overlay" style="padding: 10px 20px; background: #38bdf8; color: #0f172a; border: none; border-radius: 20px; font-weight: bold; cursor: pointer;">⛶ Buka Fullscreen</button>
            <style>
                @keyframes rotatePhone {
                    0% { transform: rotate(0deg); }
                    50% { transform: rotate(-90deg); }
                    100% { transform: rotate(0deg); }
                }
            </style>
        `;
        document.body.appendChild(this.orientationOverlay);

        const btnOverlayFS = this.orientationOverlay.querySelector('#btn-force-fullscreen-overlay');
        if (btnOverlayFS) {
            btnOverlayFS.onclick = () => this.toggleFullscreen();
        }
    }

    /**
     * Menampilkan atau menyembunyikan overlay rotasi landscape
     * @param {boolean} show - True jika portrait (harus diputar)
     */
    toggleOrientationOverlay(show) {
        if (this.orientationOverlay) {
            this.orientationOverlay.style.display = (show && this.enabled) ? 'flex' : 'none';
        }
    }

    createUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'mobile-controls-hud';
        this.uiContainer.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            pointer-events: none; z-index: 8000; display: none;
            user-select: none; -webkit-user-select: none; touch-action: none;
        `;

        this.lookArea = document.createElement('div');
        this.lookArea.style.cssText = `position: absolute; top: 0; right: 0; width: 50vw; height: 100vh; pointer-events: auto;`;

        this.joyArea = document.createElement('div');
        this.joyArea.style.cssText = `position: absolute; top: 0; left: 0; width: 50vw; height: 100vh; pointer-events: auto;`;

        this.joyBase = document.createElement('div');
        this.joyBase.id = 'joyBase';
        this.joyBase.style.cssText = `
            position: absolute; left: 120px; top: calc(100vh - 120px); width: 120px; height: 120px;
            background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%; display: block; pointer-events: none; 
            transform: translate(-50%, -50%) scale(var(--layout-scale, 1));
        `;
        
        this.joyStick = document.createElement('div');
        this.joyStick.style.cssText = `
            position: absolute; top: 50%; left: 50%; width: 50px; height: 50px;
            background: rgba(255,255,255,0.5); border-radius: 50%;
            transform: translate(-50%, -50%); pointer-events: none;
        `;
        this.joyBase.appendChild(this.joyStick);

        const btnStyle = `
            position: absolute; background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%; color: white; font-weight: bold; pointer-events: auto;
            display: flex; justify-content: center; align-items: center; font-size: 11px; font-family: sans-serif; cursor: pointer;
            transform: scale(var(--layout-scale, 1)); transform-origin: center; transition: background 0.2s;
        `;

        this.btnJump = document.createElement('div');
        this.btnJump.id = 'btnJump';
        this.btnJump.innerHTML = "JUMP";
        this.btnJump.style.cssText = btnStyle + `bottom: 40px; right: 40px; width: 70px; height: 70px;`;

        this.btnSprint = document.createElement('div');
        this.btnSprint.id = 'btnSprint';
        this.btnSprint.innerHTML = "RUN";
        this.btnSprint.style.cssText = btnStyle + `bottom: 130px; right: 60px; width: 55px; height: 55px;`;

        this.btnSneak = document.createElement('div');
        this.btnSneak.id = 'btnSneak';
        this.btnSneak.innerHTML = "SNEAK";
        this.btnSneak.style.cssText = btnStyle + `bottom: 190px; right: 60px; width: 50px; height: 50px; font-size: 9px;`;

        this.btnAutoRun = document.createElement('div');
        this.btnAutoRun.id = 'btnAutoRun';
        this.btnAutoRun.innerHTML = "AUTO";
        this.btnAutoRun.style.cssText = btnStyle + `bottom: 250px; right: 60px; width: 50px; height: 50px; font-size: 10px;`;

        // UPDATE: Tombol Tambahan Buat Parkour, Interaksi, & Looting di Layar Kanan
        this.btnRoll = document.createElement('div');
        this.btnRoll.id = 'btnRoll';
        this.btnRoll.innerHTML = "ROLL";
        this.btnRoll.style.cssText = btnStyle + `bottom: 40px; right: 200px; width: 60px; height: 60px;`;

        this.btnInteract = document.createElement('div');
        this.btnInteract.id = 'btnInteract';
        this.btnInteract.innerHTML = "HAND";
        this.btnInteract.style.cssText = btnStyle + `bottom: 160px; right: 130px; width: 55px; height: 55px;`;

        this.btnDrink = document.createElement('div');
        this.btnDrink.id = 'btnDrink';
        this.btnDrink.innerHTML = "DRINK";
        this.btnDrink.style.cssText = btnStyle + `bottom: 220px; right: 130px; width: 50px; height: 50px; font-size: 9px;`;

        this.btnAction1 = document.createElement('div');
        this.btnAction1.id = 'btnAction1';
        this.btnAction1.innerHTML = "ACT 1";
        this.btnAction1.style.cssText = btnStyle + `bottom: 40px; right: 130px; width: 60px; height: 60px;`;

        this.btnAction2 = document.createElement('div');
        this.btnAction2.id = 'btnAction2';
        this.btnAction2.innerHTML = "ACT 2";
        this.btnAction2.style.cssText = btnStyle + `bottom: 100px; right: 160px; width: 50px; height: 50px;`;

        this.btnSettings = document.createElement('div');
        this.btnSettings.id = 'btnSettings';
        this.btnSettings.innerHTML = "⚙️";
        this.btnSettings.style.cssText = btnStyle + `top: 20px; right: 20px; width: 45px; height: 45px; border-radius: 10px; font-size: 22px; z-index: 9999;`;

        this.btnFullscreen = document.createElement('div');
        this.btnFullscreen.id = 'btnFullscreen';
        this.btnFullscreen.innerHTML = "⛶";
        this.btnFullscreen.style.cssText = btnStyle + `top: 20px; right: 75px; width: 45px; height: 45px; border-radius: 10px; font-size: 22px; z-index: 9999;`;

        this.uiContainer.appendChild(this.lookArea);
        this.uiContainer.appendChild(this.joyArea);
        this.uiContainer.appendChild(this.joyBase);
        this.uiContainer.appendChild(this.btnJump);
        this.uiContainer.appendChild(this.btnSprint);
        this.uiContainer.appendChild(this.btnSneak); 
        this.uiContainer.appendChild(this.btnAutoRun);
        this.uiContainer.appendChild(this.btnRoll);     // Tambahan
        this.uiContainer.appendChild(this.btnInteract); // Tambahan
        this.uiContainer.appendChild(this.btnDrink);    // Tambahan
        this.uiContainer.appendChild(this.btnAction1);
        this.uiContainer.appendChild(this.btnAction2);
        this.uiContainer.appendChild(this.btnSettings);
        this.uiContainer.appendChild(this.btnFullscreen);
        document.body.appendChild(this.uiContainer);
    }

    bindEvents() {
        const addPress = (el, action) => {
            el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); action(); }, { passive: false });
            el.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
        };
        const addRelease = (el, action) => {
            el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); action(); }, { passive: false });
            el.addEventListener('touchcancel', (e) => { e.preventDefault(); e.stopPropagation(); action(); }, { passive: false });
            el.addEventListener('mouseup', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
            el.addEventListener('mouseleave', (e) => { e.preventDefault(); e.stopPropagation(); action(); });
        };

        const handleAction = (execute) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            execute();
        };

        const bindBtn = (el, downAction, upAction) => {
            addPress(el, () => handleAction(() => { el.style.background = 'rgba(255,255,255,0.4)'; downAction(); }));
            addRelease(el, () => handleAction(() => { el.style.background = 'rgba(0,0,0,0.4)'; upAction(); }));
        };

        bindBtn(this.btnJump, () => { this.manager.keys.space = true; }, () => { this.manager.keys.space = false; });
        bindBtn(this.btnSprint, () => { this.manager.isJoySprinting = true; }, () => { this.manager.isJoySprinting = false; });
        bindBtn(this.btnSneak, () => { this.manager.keys.c = true; }, () => { this.manager.keys.c = false; });
        
        // UPDATE: Biding logika tombol baru ke Input Manager
        bindBtn(this.btnRoll, () => { this.manager.keys.alt = true; }, () => { this.manager.keys.alt = false; });
        bindBtn(this.btnInteract, () => { this.manager.keys.f = true; }, () => { this.manager.keys.f = false; });
        bindBtn(this.btnDrink, () => { this.manager.keys.x = true; }, () => { this.manager.keys.x = false; });
        
        bindBtn(this.btnAction1, () => { this.manager.isLeftMouseDown = true; }, () => { this.manager.isLeftMouseDown = false; });
        bindBtn(this.btnAction2, () => { this.manager.isRightMouseDown = true; }, () => { this.manager.isRightMouseDown = false; });

        addPress(this.btnAutoRun, () => handleAction(() => {
            this.manager.toggleAutoRun();
        }));

        addPress(this.btnSettings, () => handleAction(() => {
            this.btnSettings.style.background = 'rgba(255,255,255,0.4)';
            document.dispatchEvent(new Event('openMobileMenu'));
        }));
        addRelease(this.btnSettings, () => handleAction(() => { this.btnSettings.style.background = 'rgba(0,0,0,0.4)'; }));

        addPress(this.btnFullscreen, () => handleAction(() => {
            this.btnFullscreen.style.background = 'rgba(255,255,255,0.4)';
            this.toggleFullscreen();
        }));
        addRelease(this.btnFullscreen, () => handleAction(() => { this.btnFullscreen.style.background = 'rgba(0,0,0,0.4)'; }));

        const handleJoyStart = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            if (this.joystickData.active) return;
            const isMouse = e.type.includes('mouse');
            const touch = isMouse ? e : e.changedTouches[0];
            
            this.joystickData.active = true;
            this.joystickData.identifier = isMouse ? 'mouse' : touch.identifier;
            this.joystickData.originX = touch.clientX;
            this.joystickData.originY = touch.clientY;
            
            const data = this.layoutEditor ? this.layoutEditor.layoutData['joyBase'] : null;
            if (!data) {
                this.joyBase.style.left = touch.clientX + 'px';
                this.joyBase.style.top = touch.clientY + 'px';
            }
            this.joyStick.style.transform = `translate(-50%, -50%)`;
        };

        const handleJoyMove = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            if (!this.joystickData.active) return;
            const isMouse = e.type.includes('mouse');
            
            let touch = null;
            if (isMouse && this.joystickData.identifier === 'mouse') touch = e;
            else if (!isMouse) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.joystickData.identifier) {
                        touch = e.changedTouches[i]; break;
                    }
                }
            }

            if (touch) {
                let dx = touch.clientX - this.joystickData.originX;
                let dy = touch.clientY - this.joystickData.originY;
                const maxDist = 60; 
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > maxDist) { 
                    dx = (dx / dist) * maxDist; 
                    dy = (dy / dist) * maxDist; 
                }
                this.joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                
                this.manager.joyMoveX = dx / maxDist;
                this.manager.joyMoveZ = dy / maxDist;

                if (dist > 10 && this.manager.isAutoRun) {
                    this.manager.isAutoRun = false;
                    this.updateAutoRunUI(false);
                }
            }
        };

        const handleJoyEnd = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            const isMouse = e.type.includes('mouse') || e.type === 'mouseleave';
            
            let match = false;
            if (isMouse && this.joystickData.identifier === 'mouse') match = true;
            else if (!isMouse) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.joystickData.identifier) match = true;
                }
            }

            if (match) {
                this.joystickData.active = false;
                this.manager.joyMoveX = 0;
                this.manager.joyMoveZ = 0;
                this.joyStick.style.transform = 'translate(-50%, -50%)';
                
                const data = this.layoutEditor ? this.layoutEditor.layoutData['joyBase'] : null;
                if (!data) {
                    this.joyBase.style.left = '120px';
                    this.joyBase.style.top = 'calc(100vh - 120px)';
                }
            }
        };

        this.joyArea.addEventListener('touchstart', handleJoyStart, { passive: false });
        this.joyArea.addEventListener('touchmove', handleJoyMove, { passive: false });
        this.joyArea.addEventListener('touchend', handleJoyEnd, { passive: false });
        this.joyArea.addEventListener('touchcancel', handleJoyEnd, { passive: false });
        
        this.joyArea.addEventListener('mousedown', handleJoyStart);
        this.joyArea.addEventListener('mousemove', handleJoyMove);
        this.joyArea.addEventListener('mouseup', handleJoyEnd);
        this.joyArea.addEventListener('mouseleave', handleJoyEnd);

        const handleLookStart = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            if (this.lookData.active) return;
            const isMouse = e.type.includes('mouse');
            const touch = isMouse ? e : e.changedTouches[0];
            
            this.lookData.active = true;
            this.lookData.identifier = isMouse ? 'mouse' : touch.identifier;
            this.lookData.lastX = touch.clientX;
            this.lookData.lastY = touch.clientY;
        };

        const handleLookMove = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            if (!this.lookData.active) return;
            const isMouse = e.type.includes('mouse');
            
            let touch = null;
            if (isMouse && this.lookData.identifier === 'mouse') touch = e;
            else if (!isMouse) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.lookData.identifier) {
                        touch = e.changedTouches[i]; break;
                    }
                }
            }

            if (touch) {
                const dx = touch.clientX - this.lookData.lastX;
                const dy = touch.clientY - this.lookData.lastY;
                this.lookData.lastX = touch.clientX;
                this.lookData.lastY = touch.clientY;

                const sens = 0.005 * (this.manager.sensitivity / 50);
                this.manager.cameraAngle -= dx * sens;
                this.manager.cameraPitch -= dy * sens;
                this.manager.cameraPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.manager.cameraPitch));
            }
        };

        const handleLookEnd = (e) => {
            if (this.layoutEditor && this.layoutEditor.isEditing) return;
            e.preventDefault();
            const isMouse = e.type.includes('mouse') || e.type === 'mouseleave';
            
            let match = false;
            if (isMouse && this.lookData.identifier === 'mouse') match = true;
            else if (!isMouse) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.lookData.identifier) match = true;
                }
            }

            if (match) this.lookData.active = false;
        };

        this.lookArea.addEventListener('touchstart', handleLookStart, { passive: false });
        this.lookArea.addEventListener('touchmove', handleLookMove, { passive: false });
        this.lookArea.addEventListener('touchend', handleLookEnd, { passive: false });
        this.lookArea.addEventListener('touchcancel', handleLookEnd, { passive: false });
        
        this.lookArea.addEventListener('mousedown', handleLookStart);
        this.lookArea.addEventListener('mousemove', handleLookMove);
        this.lookArea.addEventListener('mouseup', handleLookEnd);
        this.lookArea.addEventListener('mouseleave', handleLookEnd);
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;

        if (this.manager && this.manager.uiManager && this.manager.uiManager.currentRole) {
            this.uiContainer.style.display = 'block';
        } else {
            this.uiContainer.style.display = 'none';
        }

        const isPortrait = window.innerHeight > window.innerWidth;
        this.toggleOrientationOverlay(isPortrait);

        if (this.layoutEditor) this.layoutEditor.applyLayout();
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.uiContainer.style.display = 'none';
        
        if (this.orientationOverlay) this.orientationOverlay.style.display = 'none';
    }
}