import { PCController } from './PCController.js';
import { MobileController } from './MobileController.js';

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

        this.sensitivity = 50; 
        this.controlType = 'pc'; 

        this.pcController = new PCController(this);
        this.mobileController = new MobileController(this);

        // AUTO-DETECT SMARTPHONE & TABLET
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.setControlType(isMobile ? 'mobile' : 'pc');
    }

    setControlType(type) {
        this.controlType = type;
        if (type === 'pc') {
            this.mobileController.disable();
            this.pcController.enable();
        } else if (type === 'mobile') {
            this.pcController.disable();
            this.mobileController.enable();
        }
    }

    setSensitivity(val) {
        this.sensitivity = parseFloat(val);
    }
}