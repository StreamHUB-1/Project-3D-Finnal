/**
 * Modul Kontrol PC (Keyboard & Mouse)
 */
export class PCController {
    constructor(manager) {
        this.manager = manager;
        this.enabled = false;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('wheel', this.onWheel, { passive: false });
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('wheel', this.onWheel);
        
        // Reset state biar karakter nggak jalan terus pas diganti ke HP
        for (let k in this.manager.keys) this.manager.keys[k] = false;
        this.manager.isLeftMouseDown = false;
        this.manager.isRightMouseDown = false;
        this.manager.isAutoRun = false;
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.manager.keys.hasOwnProperty(key)) this.manager.keys[key] = true;
        if (e.code === 'Space') this.manager.keys.space = true;

        // FITUR TAB MAP (EXPANDED MAP GTA V STYLE)
        if (e.code === 'Tab') {
            e.preventDefault(); // Mencegah pindah fokus elemen browser
            document.dispatchEvent(new Event('toggleExpandedMap'));
        }

        // FITUR AUTO-RUN DI PC: Tekan tombol R untuk Toggle Auto-Run
        if (e.code === 'KeyR') {
            this.manager.toggleAutoRun();
        }

        // Otomatis batalkan Auto-Run jika pemain menekan S (Mundur)
        if (e.code === 'KeyS') {
            this.manager.isAutoRun = false;
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.manager.keys.hasOwnProperty(key)) this.manager.keys[key] = false;
        if (e.code === 'Space') this.manager.keys.space = false;
    }

    onMouseMove(e) {
        if (document.pointerLockElement === document.body) {
            // Sensitivitas kamera dikalikan dari setingan menu (default 50)
            const sens = 0.002 * (this.manager.sensitivity / 50);
            this.manager.cameraAngle -= e.movementX * sens;
            this.manager.cameraPitch -= e.movementY * sens;
            
            // Batasi pandangan atas/bawah biar kepala karakter nggak muter patah leher
            this.manager.cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.manager.cameraPitch));
        }
    }

    onMouseDown(e) {
        if (e.button === 0) this.manager.isLeftMouseDown = true;
        if (e.button === 2) this.manager.isRightMouseDown = true;
    }

    onMouseUp(e) {
        if (e.button === 0) this.manager.isLeftMouseDown = false;
        if (e.button === 2) this.manager.isRightMouseDown = false;
    }

    onWheel(e) {
        this.manager.mouseWheelDelta = Math.sign(e.deltaY);
    }
}