/**
 * Pengelola Input Permainan (Keyboard, Mouse, Wheel, & Touch Joystick Mobile)
 */
export class InputManager {
    constructor() {
        this.cameraAngle = 0;
        this.cameraPitch = 0;
        this.mouseSensitivity = 0.002;

        this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
        this.joyMoveX = 0;
        this.joyMoveZ = 0;
        this.isJoySprinting = false;

        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.mouseWheelDelta = 0;

        this.initKeyboardEvents();
        this.initMouseEvents();
        this.initMobileControls();
    }

    initKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
            }

            // Penanganan khusus tombol Spacebar
            if (e.code === 'Space' || e.key === ' ') {
                this.keys.space = true;
                if (document.pointerLockElement === document.body) {
                    e.preventDefault();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();

            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }

            // Penanganan khusus pelepasan tombol Spacebar
            if (e.code === 'Space' || e.key === ' ') {
                this.keys.space = false;
            }
        });
    }

    initMouseEvents() {
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                this.cameraAngle -= e.movementX * this.mouseSensitivity;
                this.cameraPitch -= e.movementY * this.mouseSensitivity;
                this.cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.isLeftMouseDown = true;
            if (e.button === 2) this.isRightMouseDown = true;
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isLeftMouseDown = false;
            if (e.button === 2) this.isRightMouseDown = false;
        });

        document.addEventListener('wheel', (e) => {
            this.mouseWheelDelta = e.deltaY;
        });
    }

    initMobileControls() {
        const joystickZone = document.getElementById('joystick-zone');
        const joystickKnob = document.getElementById('joystick-knob');
        const touchLookZone = document.getElementById('touch-look-zone');

        let joyActive = false;
        let joyTouchId = null;
        let joyOrigin = { x: 0, y: 0 };
        const maxJoyRadius = 50;

        if (!joystickZone) return;

        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (joyActive) return;
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                joyActive = true;
                joyTouchId = touches[i].identifier;
                const rect = joystickZone.getBoundingClientRect();
                joyOrigin.x = rect.left + rect.width / 2;
                joyOrigin.y = rect.top + rect.height / 2;
                this.updateJoystick(touches[i], joyOrigin, joystickKnob, maxJoyRadius);
                break;
            }
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joyActive) return;
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                if (touches[i].identifier === joyTouchId) {
                    this.updateJoystick(touches[i], joyOrigin, joystickKnob, maxJoyRadius);
                    break;
                }
            }
        }, { passive: false });

        const resetJoystick = (e) => {
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                if (touches[i].identifier === joyTouchId) {
                    joyActive = false;
                    joyTouchId = null;
                    this.joyMoveX = 0;
                    this.joyMoveZ = 0;
                    joystickKnob.style.transform = `translate(-50%, -50%)`;
                    break;
                }
            }
        };

        joystickZone.addEventListener('touchend', resetJoystick);
        joystickZone.addEventListener('touchcancel', resetJoystick);

        let isLooking = false;
        let lookTouchId = null;
        let lastTouchLook = { x: 0, y: 0 };

        if (!touchLookZone) return;

        touchLookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (isLooking) return;
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                isLooking = true;
                lookTouchId = touches[i].identifier;
                lastTouchLook.x = touches[i].clientX;
                lastTouchLook.y = touches[i].clientY;
                break;
            }
        }, { passive: false });

        touchLookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isLooking) return;
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                if (touches[i].identifier === lookTouchId) {
                    let currentX = touches[i].clientX;
                    let currentY = touches[i].clientY;
                    let deltaX = currentX - lastTouchLook.x;
                    let deltaY = currentY - lastTouchLook.y;

                    this.cameraAngle -= deltaX * 0.005;
                    this.cameraPitch -= deltaY * 0.005;
                    this.cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraPitch));

                    lastTouchLook.x = currentX;
                    lastTouchLook.y = currentY;
                    break;
                }
            }
        }, { passive: false });

        const resetLook = (e) => {
            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                if (touches[i].identifier === lookTouchId) {
                    isLooking = false;
                    lookTouchId = null;
                    break;
                }
            }
        };

        touchLookZone.addEventListener('touchend', resetLook);
        touchLookZone.addEventListener('touchcancel', resetLook);
    }

    updateJoystick(touch, origin, knob, maxRadius) {
        let dx = touch.clientX - origin.x;
        let dy = touch.clientY - origin.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxRadius) {
            dx = (dx / distance) * maxRadius;
            dy = (dy / distance) * maxRadius;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.joyMoveX = dx / maxRadius;
        this.joyMoveZ = dy / maxRadius;
    }
}