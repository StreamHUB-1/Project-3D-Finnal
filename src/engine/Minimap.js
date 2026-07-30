import * as THREE from 'three';

export class Minimap {
    constructor(scene) {
        this.scene = scene;

        this.camera = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 500);
        this.camera.up.set(0, 0, -1);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(150, 150);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        const target = document.getElementById('minimap-render-target');
        if (target) target.appendChild(this.renderer.domElement);
        this.viewCone = document.getElementById('minimap-view-cone');
    }

    update(playerPosition, cameraAngle) {
        if (!playerPosition) return;

        this.camera.position.set(playerPosition.x, 200, playerPosition.z);
        this.camera.lookAt(playerPosition.x, 0, playerPosition.z);

        if (this.viewCone) {
            this.viewCone.style.transform = `rotate(${-cameraAngle}rad)`;
        }

        const oldFog = this.scene.fog;
        this.scene.fog = null;
        this.renderer.render(this.scene, this.camera);
        this.scene.fog = oldFog;
    }
}
