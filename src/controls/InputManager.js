import { PCController } from './PCController.js';
import { MobileController } from './MobileController.js';

/**
 * Pengelola Input Utama (Keyboard, Mouse, Touchscreen Mobile, & Sensitivitas)
 */
export class InputManager {
    constructor() {
        this.keys = { w: false, a: false, s: false, d: false, space: false, shift: false, q: false, e: false };
        this.cameraAngle = 0;
        this.cameraPitch = 0;
        this.mouseWheelDelta = 0;
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        
        this.joyMoveX = 0;
        this.joyMoveZ = 0;
        this.isJoySprinting = false;
        this.isAutoRun = false; // Status Auto-Run (PC & Mobile)

        this.sensitivity = 50; 
        this.controlType = 'pc'; 

        this.pcController = new PCController(this);
        this.mobileController = new MobileController(this);

        // AUTO-DETECT SMARTPHONE & TABLET
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.setControlType(isMobile ? 'mobile' : 'pc');

        this.initOrientationCheck();
    }

    /**
     * Meminta atau membalikkan status Auto-Run
     * @param {boolean} [forceState] - Paksa status Auto-Run jika didefinisikan
     */
    toggleAutoRun(forceState) {
        if (typeof forceState === 'boolean') {
            this.isAutoRun = forceState;
        } else {
            this.isAutoRun = !this.isAutoRun;
        }
        
        if (this.mobileController) {
            this.mobileController.updateAutoRunUI(this.isAutoRun);
        }
        
        return this.isAutoRun;
    }

    /**
     * Memeriksa dan memaksakan orientasi layar Landscape untuk perangkat mobile
     */
    initOrientationCheck() {
        const checkOrientation = () => {
            if (this.controlType === 'mobile' && this.mobileController) {
                const isPortrait = window.innerHeight > window.innerWidth;
                this.mobileController.toggleOrientationOverlay(isPortrait);
            }
        };

        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        setTimeout(checkOrientation, 300);
    }

    /**
     * Mengatur tipe kontroler ('pc' atau 'mobile')
     * @param {string} type - Jenis perangkat ('pc' / 'mobile')
     */
    setControlType(type) {
        this.controlType = type;
        this.isAutoRun = false; // Reset Auto-Run saat ganti tipe kontrol
        if (type === 'pc') {
            this.mobileController.disable();
            this.pcController.enable();
        } else if (type === 'mobile') {
            this.pcController.disable();
            this.mobileController.enable();
            this.initOrientationCheck();
        }
    }

    /**
     * Mengatur sensitivitas rotasi kamera
     * @param {number|string} val - Nilai sensitivitas (1 - 100)
     */
    setSensitivity(val) {
        this.sensitivity = parseFloat(val);
    }
}